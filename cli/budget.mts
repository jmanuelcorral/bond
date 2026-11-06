// Presupuesto de los agentes (epic #84): eventos desde los hooks y estado agregado.
//
// La detección es event-driven (decisión del epic): `bond sync` instala un hook por agente
// que invoca `bond budget-hook <agente>` pasándole el JSON del evento por stdin. El hook
// es fail-open: pase lo que pase sale 0 y nunca bloquea al agente. Los eventos se guardan
// en ~/.bond/events/YYYY-MM-DD.jsonl (append-only; se purgan tras unos días) y `bond budget`
// los agrega junto con lo que pueda leerse en local: el transcript de Codex lleva el
// snapshot de rate limits que escribe el propio agente (decisión 2026-11-06: nada de
// endpoints), y donde no hay señal documentada el estado es `unknown`, sin inventar nada.

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BOND_HOME, assetsPath } from "./runtime.mts";
import { HOME, which } from "./util.mts";
import { t } from "./messages.mts";

export type BudgetState = "ok" | "low" | "exhausted" | "unknown";
export type BudgetSource = "hook" | "headers" | "api" | "reactive";

export interface BudgetWindow {
	kind: string;
	usedPct?: number;
	resetAt?: number;
	windowMinutes?: number;
}

export interface BudgetStatus {
	agent: string;
	state: BudgetState;
	windows: BudgetWindow[];
	source: BudgetSource;
	checkedAt: string;
	detail?: string;
}

export interface BudgetEvent {
	ts: string;
	agent: string;
	event: string;
	session_id?: string;
	transcript_path?: string;
	cwd?: string;
	status?: number;
}

/** Agentes cuyo hook alimenta el event log (pi lo alimenta vía su extensión, mismo canal). */
export const HOOKED_AGENTS = ["codex", "claude", "agy", "opencode", "pi"];

// ---- event log (~/.bond/events) ---------------------------------------------------------

export const eventsDir = () => process.env.BOND_EVENTS_DIR ?? join(BOND_HOME, "events");
const KEEP_DAYS = 7;

export function appendEvent(ev: BudgetEvent): void {
	mkdirSync(eventsDir(), { recursive: true });
	appendFileSync(join(eventsDir(), `${ev.ts.slice(0, 10)}.jsonl`), `${JSON.stringify(ev)}\n`);
}

/** Eventos de los últimos KEEP_DAYS días, ordenados por ts. Purga los ficheros más viejos. */
export function readEvents(now: Date = new Date()): BudgetEvent[] {
	if (!existsSync(eventsDir())) return [];
	const cutoff = now.getTime() - KEEP_DAYS * 86_400_000;
	const events: BudgetEvent[] = [];
	for (const f of readdirSync(eventsDir()).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))) {
		const p = join(eventsDir(), f);
		if (statSync(p).mtimeMs < cutoff) {
			rmSync(p, { force: true });
			continue;
		}
		for (const line of readFileSync(p, "utf8").split("\n")) {
			if (!line.trim()) continue;
			try {
				const e = JSON.parse(line);
				if (e && typeof e.ts === "string" && typeof e.agent === "string") events.push(e);
			} catch {
				// línea corrupta: se ignora.
			}
		}
	}
	return events.sort((a, b) => a.ts.localeCompare(b.ts));
}

// ---- hook: bond budget-hook <agente> ----------------------------------------------------

const EVENT_MAP: Record<string, string> = {
	stop: "stop",
	sessionstart: "session_start",
	session_start: "session_start",
	sessionshutdown: "session_end",
	session_shutdown: "session_end",
	precompact: "pre_compact",
	session_before_compact: "pre_compact",
	session_compact: "compact",
	notification: "notification",
	interrupt: "interrupt",
	userpromptsubmit: "prompt_submit",
	"session.idle": "idle",
	"session.error": "error",
};

/** Mapea el JSON que pasa cada agente al evento normalizado. Puro: nunca lanza. */
export function hookEvent(agent: string, raw: string, ts: string): BudgetEvent {
	const ev: BudgetEvent = { ts, agent, event: "raw" };
	try {
		const d = JSON.parse(raw);
		if (d && typeof d === "object") {
			const name = typeof d.hook_event_name === "string" ? d.hook_event_name : typeof d.event === "string" ? d.event : undefined;
			if (name) ev.event = EVENT_MAP[name.toLowerCase()] ?? name.toLowerCase();
			for (const k of ["session_id", "transcript_path", "cwd"] as const) if (typeof d[k] === "string") ev[k] = d[k];
			if (typeof d.status === "number") ev.status = d.status;
		}
	} catch {
		// stdin que no es JSON: se guarda como raw, que también es señal de vida.
	}
	return ev;
}

async function readStdinCapped(maxBytes = 4_194_304, ms = 2000): Promise<string> {
	if (process.stdin.isTTY) return "";
	const chunks: Buffer[] = [];
	let size = 0;
	const timer = setTimeout(() => process.stdin.destroy(), ms);
	try {
		for await (const c of process.stdin) {
			size += (c as Buffer).length;
			if (size > maxBytes) break;
			chunks.push(c as Buffer);
		}
	} catch {
		// destruido por el timeout: vale con lo que haya entrado.
	}
	clearTimeout(timer);
	return Buffer.concat(chunks).toString("utf8");
}

/**
 * Entrada del hook: `bond budget-hook <agente>`. Fail-open por diseño: cualquier fallo se
 * traga y sale 0, porque un hook nunca puede bloquear al agente que lo invoca.
 */
export async function budgetHook(args: string[]): Promise<void> {
	const agent = args[0] ?? "";
	if (!HOOKED_AGENTS.includes(agent)) return;
	let raw = "";
	try {
		raw = await readStdinCapped();
		appendEvent(hookEvent(agent, raw, new Date().toISOString()));
	} catch {
		// fail-open.
	}
}

// ---- adaptador Codex: el transcript local (decisión 2026-11-06) ------------------------

export interface CodexBudget {
	usedPct?: number;
	windowMinutes?: number;
	resetAt?: number;
	reachedType?: string | null;
	contextWindow?: number;
}

/** Último evento token_count de un rollout .jsonl de Codex. Línea corrupta no corta el scan. */
export function parseCodexTranscript(text: string): CodexBudget | undefined {
	let last: CodexBudget | undefined;
	for (const line of text.split("\n")) {
		if (!line.includes('"token_count"')) continue;
		try {
			const d = JSON.parse(line);
			if (d?.type !== "event_msg" || d?.payload?.type !== "token_count") continue;
			const rl = d.payload.rate_limits ?? {};
			const primary = rl.primary ?? {};
			last = {
				usedPct: typeof primary.used_percent === "number" ? primary.used_percent : undefined,
				windowMinutes: typeof primary.window_minutes === "number" ? primary.window_minutes : undefined,
				resetAt: typeof primary.resets_at === "number" ? primary.resets_at : undefined,
				reachedType: typeof rl.rate_limit_reached_type === "string" ? rl.rate_limit_reached_type : null,
				contextWindow: typeof d.payload.info?.model_context_window === "number" ? d.payload.info.model_context_window : undefined,
			};
		} catch {
			// línea corrupta: sigue.
		}
	}
	return last;
}

export const LOW_PCT = 80;

export function stateFromCodex(b: CodexBudget): BudgetState {
	if (b.reachedType) return "exhausted";
	if (typeof b.usedPct === "number") return b.usedPct >= 100 ? "exhausted" : b.usedPct >= LOW_PCT ? "low" : "ok";
	return "unknown";
}

const windowKind = (minutes?: number) => (minutes === 300 ? "5h" : minutes === 10_080 ? "weekly" : "primary");

export function codexStatus(now: Date = new Date()): BudgetStatus {
	const unknown: BudgetStatus = { agent: "codex", state: "unknown", windows: [], source: "hook", checkedAt: now.toISOString() };
	const withTranscript = readEvents(now).filter((e) => e.agent === "codex" && e.transcript_path);
	const ev = withTranscript[withTranscript.length - 1];
	if (!ev?.transcript_path || !existsSync(ev.transcript_path)) return unknown;
	let text: string;
	try {
		text = readFileSync(ev.transcript_path, "utf8");
	} catch {
		return unknown;
	}
	const b = parseCodexTranscript(text);
	if (!b) return unknown;
	const windows: BudgetWindow[] =
		typeof b.usedPct === "number" ? [{ kind: windowKind(b.windowMinutes), usedPct: b.usedPct, resetAt: b.resetAt, windowMinutes: b.windowMinutes }] : [];
	return { agent: "codex", state: stateFromCodex(b), windows, source: "hook", checkedAt: now.toISOString(), detail: b.reachedType ?? undefined };
}

// ---- adaptador Claude: headers anthropic-ratelimit-* (documentados) --------------------

/**
 * Parsea los headers de rate limit de Anthropic (documentados en toda respuesta).
 * Cada familia (requests, input_tokens, output_tokens, tokens) con limit y remaining
 * forma una ventana. Puro: sin red.
 */
export function parseAnthropicRateHeaders(headers: Record<string, string | undefined>): { windows: BudgetWindow[]; state: BudgetState } {
	const get = (name: string) => headers[`anthropic-ratelimit-${name}`] ?? headers[`anthropic-ratelimit-${name}`.toLowerCase()];
	const num = (v: string | undefined) => (v !== undefined && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : undefined);
	const windows: BudgetWindow[] = [];
	let state: BudgetState = "unknown";
	for (const kind of ["requests", "input_tokens", "output_tokens", "tokens"] as const) {
		const remaining = num(get(`${kind}-remaining`));
		const limit = num(get(`${kind}-limit`));
		if (remaining === undefined || limit === undefined || limit <= 0) continue;
		const resetIso = get(`${kind}-reset`);
		const resetMs = resetIso ? Date.parse(resetIso) : NaN;
		const usedPct = Math.max(0, Math.min(100, ((limit - remaining) / limit) * 100));
		windows.push({ kind, usedPct, resetAt: Number.isNaN(resetMs) ? undefined : Math.floor(resetMs / 1000), windowMinutes: undefined });
		if (remaining <= 0) state = "exhausted";
		else if (usedPct >= LOW_PCT && state !== "exhausted") state = "low";
		else if (state === "unknown") state = "ok";
	}
	return { windows, state };
}

/**
 * Estado de Claude Code: una llamada mínima a api.anthropic.com con la clave de
 * ~/.bond/keys/anthropic; los headers de la respuesta (llegue 200 o 4xx) traen el
 * estado de límites. Sin clave o sin red → unknown, sin insistir.
 */
export async function claudeStatus(now: Date = new Date(), fetchImpl: typeof fetch = fetch): Promise<BudgetStatus> {
	const unknown: BudgetStatus = { agent: "claude", state: "unknown", windows: [], source: "headers", checkedAt: now.toISOString() };
	const { readKey } = await import("./keys.mts");
	const key = readKey("anthropic");
	if (!key) return unknown;
	try {
		const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
			body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
			signal: AbortSignal.timeout(8000),
		});
		const h: Record<string, string | undefined> = {};
		res.headers.forEach((v, k) => (h[k] = v));
		const { windows, state } = parseAnthropicRateHeaders(h);
		if (!windows.length) return unknown;
		return { agent: "claude", state, windows, source: "headers", checkedAt: now.toISOString() };
	} catch {
		return unknown;
	}
}

// ---- instalador de hooks (los que hay hasta esta rebanada) ------------------------------

/** Dónde está el ejecutable de bond para el comando del hook: BOND_BIN, el del PATH o el de los assets. */
export function bondHookCommand(agent: string): string {
	const found = process.env.BOND_BIN ?? which("bond") ?? assetsPath("bin", "bond");
	const cmd = found.includes(" ") ? JSON.stringify(found) : found;
	return `${cmd} budget-hook ${agent}`;
}

/**
 * Fusiona el grupo de bond en un JSON de hooks con forma {hooks: {Evento: [{hooks: [...]}]}}
 * (Codex y Claude Code comparten forma). Deja intactas las entradas ajenas (p. ej. la de
 * herdr); la nuestra se identifica por `marker`. Converge en una pasada y es estable.
 */
export function mergeAgentHooks(existing: unknown, events: string[], cmd: string, marker: string): { doc: Record<string, unknown>; changed: boolean } {
	const base = existing && typeof existing === "object" && !Array.isArray(existing) ? structuredClone(existing as Record<string, unknown>) : {};
	const hooks = (base.hooks && typeof base.hooks === "object" && !Array.isArray(base.hooks) ? base.hooks : {}) as Record<string, unknown[]>;
	base.hooks = hooks;
	let changed = false;
	const isOurs = (g: unknown) => {
		const hs = (g as { hooks?: unknown[] })?.hooks;
		return Array.isArray(hs) && hs.some((h) => String((h as { command?: unknown })?.command ?? "").includes(marker));
	};
	for (const ev of events) {
		const cur = Array.isArray(hooks[ev]) ? hooks[ev] : [];
		const foreign = cur.filter((g) => !isOurs(g));
		const next = [...foreign, { hooks: [{ type: "command", command: cmd, timeout: 5 }] }];
		if (JSON.stringify(cur) !== JSON.stringify(next)) {
			hooks[ev] = next;
			changed = true;
		}
	}
	return { doc: base, changed };
}

export interface HookInstall {
	path: string;
	needed: boolean;
	apply?: () => void;
}

function installJsonHooks(path: string, events: string[], cmd: string, marker: string): HookInstall {
	let existing: unknown = {};
	if (existsSync(path)) {
		try {
			existing = JSON.parse(readFileSync(path, "utf8"));
		} catch {
			return { path, needed: true }; // JSON ajeno ilegible: no lo tocamos, solo avisamos.
		}
	}
	const { doc, changed } = mergeAgentHooks(existing, events, cmd, marker);
	if (!changed) return { path, needed: false };
	return {
		path,
		needed: true,
		apply: () => {
			mkdirSync(join(path, ".."), { recursive: true });
			const tmp = `${path}.bond-tmp`;
			writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`);
			renameSync(tmp, path);
		},
	};
}

/** Hooks que bond gestiona por agente: eventos y fichero de destino (relativo al home). */
export const HOOK_TARGETS: Record<string, { subpath: string[]; events: string[] }> = {
	codex: { subpath: [".codex", "hooks.json"], events: ["Stop"] },
	claude: { subpath: [".claude", "settings.json"], events: ["Stop", "Notification", "PreCompact"] },
};

/** Acciones de instalación de hooks para los agentes dados (los que tengan destino). */
export function ensureBudgetHooks(agents: string[], opts: { check?: boolean; home?: string } = {}): HookInstall[] {
	const home = opts.home ?? process.env.BOND_HOOK_HOME ?? HOME;
	const installs: HookInstall[] = [];
	for (const a of agents) {
		const target = HOOK_TARGETS[a];
		if (!target) continue;
		const path = join(home, ...target.subpath);
		const cmd = bondHookCommand(a);
		const marker = `budget-hook ${a}`;
		const inst = installJsonHooks(path, target.events, cmd, marker);
		if (opts.check) installs.push({ path, needed: inst.needed });
		else installs.push(inst);
	}
	return installs.filter((i) => i.needed);
}

// ---- comando bond budget ---------------------------------------------------------------

const stateIcon = (s: BudgetState) => (s === "ok" ? "✓" : s === "low" ? "!" : s === "exhausted" ? "✗" : "·");

const fmtReset = (epoch?: number) => (typeof epoch === "number" ? new Date(epoch * 1000).toISOString().slice(0, 16).replace("T", " ") : undefined);

function fmtWindows(ws: BudgetWindow[]): string {
	if (!ws.length) return "";
	return ws
		.map((w) => {
			const pct = typeof w.usedPct === "number" ? `${Math.round(w.usedPct)}%` : "?";
			const reset = fmtReset(w.resetAt);
			return `${w.kind} ${pct}${reset ? ` · → ${reset}` : ""}`;
		})
		.join(", ");
}

export async function budget(args: string[]): Promise<void> {
	if (args.includes("-h") || args.includes("--help")) {
		console.log(t("budget.help"));
		return;
	}
	let agents: string[] = [];
	try {
		const { configExists, loadConfig } = await import("./config.mts");
		if (configExists()) agents = loadConfig().agents ?? [];
	} catch {
		// sin config global: se intuye abajo
	}
	if (!agents.length) agents = ["codex"];
	const statuses: BudgetStatus[] = [];
	for (const a of agents) {
		if (a === "codex") statuses.push(codexStatus());
		else if (a === "claude") statuses.push(await claudeStatus());
		else statuses.push({ agent: a, state: "unknown", windows: [], source: "hook", checkedAt: new Date().toISOString() });
	}
	console.log(t("budget.title", { days: KEEP_DAYS }));
	const width = Math.max(...statuses.map((s) => s.agent.length), 6);
	for (const s of statuses) {
		const win = fmtWindows(s.windows);
		const line = `  ${s.agent.padEnd(width)}  ${stateIcon(s.state)} ${s.state.padEnd(9)}${win ? `  ${win}` : ""}  ${s.state === "unknown" ? "" : `(${s.source})`}`;
		console.log(line.trimEnd());
	}
}

export const BUDGET_HELP = () => t("budget.help");
