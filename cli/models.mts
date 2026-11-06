// `bond models`: registro global de modelos (~/.config/bond/config.toml) y su traducción a
// la configuración de cada agente.

import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { inspect } from "node:util";
import { activeProviders, type Api, CONFIG_DIR, CONFIG_FILE, initialConfig, loadConfig, loadState, providerApis, saveState, type ProbeApiStatus, type State } from "./config.mts";
import { BEGIN, codexConfigFile, INCOMPATIBLE, readCurrent, hasComments, TARGETS, withoutBlock } from "./agents.mts";
import { t } from "./messages.mts";
import { act, AGENT_DIR, bad, caution, die, dim, isDryRun, log, ok, REPO_DIR, run, STAMP, warn, which } from "./util.mts";

export const modelsHelp = (): string => t("models.help", { file: CONFIG_FILE });
export const MODELS_HELP = modelsHelp;

export async function models(args: string[]): Promise<void> {
	const [sub, ...rest] = args;
	switch (sub) {
		case "init":
			return init(rest);
		case "list":
		case undefined:
			return list();
		case "probe":
			return probe(rest);
		case "sync":
			return sync(rest);
		case "path":
			return console.log(CONFIG_FILE);
		default:
			die(t("models.unknown_sub", { sub }), 2);
	}
}

// --- init ---------------------------------------------------------------------------------

/** models.json de pi del que importar: el del repo (el de antes de bond) o el de ~/.pi/agent. */
function legacyPiModels(): string | undefined {
	for (const f of [join(REPO_DIR, "pi", "agent", "models.json"), join(AGENT_DIR, "models.json")]) if (existsSync(f)) return f;
	return undefined;
}

export function init(args: string[] = []): void {
	if (existsSync(CONFIG_FILE) && !args.includes("--force")) {
		log(t("models.init_exists", { file: CONFIG_FILE }));
		return;
	}
	const source = legacyPiModels();
	const text = initialConfig(source);
	if (existsSync(CONFIG_FILE)) act(`cp ${CONFIG_FILE} ${CONFIG_FILE}.bak.${STAMP}`, () => copyFileSync(CONFIG_FILE, `${CONFIG_FILE}.bak.${STAMP}`));
	act(t("util.write", { file: CONFIG_FILE }), () => {
		mkdirSync(CONFIG_DIR, { recursive: true });
		writeFileSync(CONFIG_FILE, text);
	});
	log(source ? t("models.init_created_imported", { file: CONFIG_FILE, source }) : t("models.init_created_empty", { file: CONFIG_FILE }));
	if (isDryRun()) console.log(dim(text));
}

// --- list ---------------------------------------------------------------------------------

function list(): void {
	const cfg = loadConfig();
	const state = loadState();
	if (!cfg.providers.length) return console.log(t("models.list_none", { file: CONFIG_FILE }));
	for (const p of cfg.providers) {
		const apis = providerApis(p, state);
		const probed = state.probes[p.id];
		const off = p.enabled === false ? caution(t("models.list_disabled")) : "";
		console.log(`\n${p.id}${off}  ${dim(p.base_url)}`);
		const apisDetail = p.apis
			? t("models.list_apis_declared")
			: probed
				? t("models.list_apis_probe", { date: probed.at.slice(0, 16).replace("T", " ") })
				: t("models.list_apis_assumed");
		console.log(dim(`  APIs: ${apis.join(", ")}${apisDetail}`));
		for (const m of p.models) {
			const served = probed ? (probed.served.includes(m.id) ? "" : caution(t("models.list_not_served"))) : "";
			const limits = [m.context && `ctx ${m.context}`, m.max_output && `out ${m.max_output}`].filter(Boolean).join(", ");
			console.log(`  ${m.enabled === false ? dim(t("models.list_model_disabled", { id: m.id })) : `• ${m.id}`}  ${dim(limits)}${served}`);
		}
		const agents = [
			...TARGETS.map((t) => [t.agent, apis.includes(t.needs) ? ok("✓") : bad("✗")] as const),
			["copilot", apis.includes("chat") || apis.includes("responses") ? ok("✓") : bad("✗")] as const,
			...Object.keys(INCOMPATIBLE).map((a) => [a, apis.includes("messages") && a === "claude" ? ok("✓") : bad("✗")] as const),
		];
		console.log(t("models.list_agents", { agents: agents.map(([a, m]) => `${m} ${a}`).join("  ") }));
	}
	// La nota de Codex solo interesa a quien lo eligió en `bond setup` o lo tiene instalado:
	// para el resto es ruido de un agente que no usa (#80).
	if (cfg.agents.includes("codex") || which("codex")) {
		console.log(dim(`\n${t("models.note_codex")}`));
	}
}

// --- probe --------------------------------------------------------------------------------

/**
 * Clasifica la respuesta de un probe (#76). Puro a propósito: se puede probar con
 * cuerpos stub sin red. Reglas (aprobadas en el refinamiento de #76):
 * - HTTP != 2xx o cuerpo no parseable → `fail` (endpoint caído o roto).
 * - 2xx con contenido utilizable (`content`/`output_text`/bloque `text` no vacío) → `ok`.
 * - 2xx sin contenido util → `empty_reasoning`: sea por presupuesto de razonamiento
 *   (`reasoning_content` presente, `finish_reason: "length"`, `incomplete_details.reason:
 *   "max_output_tokens"`, solo bloques `thinking`) o porque no hay nada que mostrar;
 *   en cualquier caso el usuario necesita saberlo.
 */
export function classifyProbe(api: Api, status: number, json: unknown): ProbeApiStatus {
	if (status < 200 || status >= 300 || json === null || typeof json !== "object") return "fail";
	const j = json as Record<string, any>;
	const nonEmpty = (s: unknown): boolean => typeof s === "string" && s.trim().length > 0;
	if (api === "chat") {
		const msg = (j.choices?.[0]?.message ?? {}) as Record<string, any>;
		if (nonEmpty(msg.content)) return "ok";
		return "empty_reasoning";
	}
	if (api === "responses") {
		if (nonEmpty(j.output_text)) return "ok";
		const texts = Array.isArray(j.output)
			? j.output.flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
			: [];
		if (texts.some((b: any) => (b?.type === "output_text" || b?.type === "text") && nonEmpty(b.text))) return "ok";
		return "empty_reasoning";
	}
	// messages (Anthropic)
	const blocks = Array.isArray(j.content) ? j.content : [];
	if (blocks.some((b: any) => b?.type === "text" && nonEmpty(b.text))) return "ok";
	return "empty_reasoning";
}

async function postProbe(api: Api, url: string, body: unknown, headers: Record<string, string>): Promise<ProbeApiStatus> {
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json", ...headers },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(120_000), // la primera petición puede cargar el modelo en RAM
		});
		let json: unknown = null;
		try {
			json = await res.json();
		} catch {
			json = null;
		}
		return classifyProbe(api, res.status, json);
	} catch {
		return "fail";
	}
}

async function probe(ids: string[]): Promise<void> {
	const cfg = loadConfig();
	const state = loadState();
	const targets = cfg.providers.filter((p) => !ids.length || ids.includes(p.id));
	if (!targets.length) die(t("models.probe_no_match", { ids: ids.join(", ") }));
	for (const p of targets) {
		const base = p.base_url.replace(/\/$/, "");
		const key = p.api_key_env ? process.env[p.api_key_env] : undefined;
		if (p.api_key_env && !key) warn(t("models.probe_var_undefined", { id: p.id, var: p.api_key_env }));
		const auth: Record<string, string> = key ? { authorization: `Bearer ${key}`, "x-api-key": key } : {};
		log(`${p.id}: ${base}`);
		let served: string[] = [];
		try {
			const res = await fetch(`${base}/models`, { headers: auth, signal: AbortSignal.timeout(15_000) });
			served = (((await res.json()) as { data?: Array<{ id: string }> }).data ?? []).map((m) => m.id);
		} catch (e) {
			warn(t("models.probe_models_failed", { id: p.id, err: (e as Error).message }));
		}
		const model = p.models.find((m) => m.enabled !== false)?.id;
		if (!model) {
			warn(t("models.probe_no_active_models", { id: p.id }));
			continue;
		}
		// Una detrás de otra: las pasarelas locales no suelen atender varias a la vez (429).
		const checks: Array<[Api, () => Promise<ProbeApiStatus>]> = [
			["chat", () => postProbe("chat", `${base}/chat/completions`, { model, messages: [{ role: "user", content: "ok" }], max_tokens: 8 }, auth)],
			["responses", () => postProbe("responses", `${base}/responses`, { model, input: "ok", max_output_tokens: 16 }, auth)],
			["messages", () => postProbe("messages", `${base}/messages`, { model, max_tokens: 8, messages: [{ role: "user", content: "ok" }] }, { ...auth, "anthropic-version": "2023-06-01" })],
		];
		const apis: Api[] = [];
		const apiStatus: Partial<Record<Api, ProbeApiStatus>> = {};
		for (const [api, check] of checks) {
			const res = await check();
			apiStatus[api] = res;
			// La API la sirve aunque la respuesta salga vacía: el endpoint está vivo (#76).
			if (res !== "fail") apis.push(api);
			const mark = res === "ok" ? ok("✓") : res === "empty_reasoning" ? caution("!") : bad("✗");
			const note = res === "empty_reasoning" ? `  ${t("models.probe_empty_reasoning", { api })}` : "";
			console.log(`  ${mark} ${api}${note}`);
		}
		const declared = p.models.filter((m) => m.enabled !== false).map((m) => m.id);
		const missing = declared.filter((m) => served.length && !served.includes(m));
		const status = served.length ? t("models.probe_models_serves", { count: served.length }) : t("models.probe_models_unavailable");
		const missingStr = missing.length ? t("models.probe_models_missing", { missing: missing.join(", ") }) : "";
		console.log(`  ${missing.length ? caution("!") : ok("✓")} ` + t("models.probe_models_summary", { status, missing: missingStr }));
		state.probes[p.id] = { apis, served, at: new Date().toISOString(), status: apiStatus };
	}
	saveState(state);
	if (targets.some((p) => p.apis)) console.log(dim(t("models.probe_apis_note")));
}

// --- sync ---------------------------------------------------------------------------------

function showDiff(file: string, before: string | undefined, after: string): void {
	const dir = join(tmpdir(), `bond-${process.pid}`);
	mkdirSync(dir, { recursive: true });
	const a = join(dir, "antes");
	const b = join(dir, "despues");
	writeFileSync(a, before ?? "");
	writeFileSync(b, after);
	const d = run("diff", ["-u", "--label", `${file} (actual)`, "--label", `${file} (bond)`, a, b]);
	console.log(d.stdout || d.stderr);
	rmSync(dir, { recursive: true, force: true });
}

export interface SyncOptions {
	agents?: string[];
	check?: boolean;
	quiet?: boolean;
}

/** ¿Sigue en pie el bloque huérfano de bond en ~/.codex/config.toml? (issue #80) */
export function codexOrphan(): boolean {
	const current = readCurrent(codexConfigFile());
	return !!current && current.includes(BEGIN);
}

/**
 * Limpia el bloque huérfano que bond dejó en ~/.codex/config.toml (issue #80).
 * Idempotente: si no hay bloque no hace nada ni deja copia.
 */
export function cleanCodexOrphan(say: (s: string) => void, check?: boolean, state?: State): boolean {
	const file = codexConfigFile();
	const current = readCurrent(file);
	if (!current || !current.includes(BEGIN)) return false;
	const label = `${"codex".padEnd(9)}`;
	if (check) {
		say(`${bad("✗")} ${label}${t("models.sync_orphan_block")}  ${dim(file)}`);
		return true;
	}
	if (isDryRun()) {
		say(`${caution("~")} ${label}${t("models.sync_would_clean_codex")} ${file}`);
		showDiff(file, current, withoutBlock(current));
		return true;
	}
	if (!state?.backedUp.includes(file)) {
		writeFileSync(`${file}.bak.${STAMP}`, current);
		state?.backedUp.push(file);
	}
	writeFileSync(file, withoutBlock(current));
	if (state?.managed?.codex) delete state.managed.codex;
	say(`${ok("✓")} ${label}${t("models.sync_cleaned_codex")}  ${dim(file)}`);
	return true;
}

/** Sincroniza; devuelve los agentes desfasados (para --check y bond doctor). */
export function syncAgents(opts: SyncOptions = {}): string[] {
	const cfg = loadConfig();
	const state = loadState();
	const providers = activeProviders(cfg);
	const say = (s: string) => !opts.quiet && console.log(s);
	const stale: string[] = [];
	const chosen = opts.agents?.length
		? TARGETS.filter((t) => opts.agents!.includes(t.agent))
		: TARGETS.filter((t) => (!cfg.agents.length || cfg.agents.includes(t.agent)) && t.installed());
	// `codex` se quedó sin generador de modelos al pasar a su cuenta oficial (#80), pero sigue
	// valiendo en --agent: es la forma de limpiar su bloque huérfano sin tocar los demás.
	if (opts.agents)
		for (const a of opts.agents) if (a !== "codex" && !TARGETS.some((t) => t.agent === a)) die(t("models.sync_unsupported_agent", { agent: a }));

	// La limpieza del huérfano corre siempre, también con --agent explícito: así la ven
	// `bond doctor`, que pasa su propia lista, y `bond models sync --agent codex`.
	const hadOrphan = cleanCodexOrphan(say, opts.check, state);
	if (hadOrphan) {
		if (opts.check) stale.push("codex");
	} else if (opts.agents?.includes("codex")) {
		say(`${ok("✓")} ${"codex".padEnd(9)}${t("models.sync_codex_no_orphan")}  ${dim(codexConfigFile())}`);
	}

	for (const target of chosen) {
		const usable = providers.filter((p) => providerApis(p, state).includes(target.needs));
		const unusable = providers.filter((p) => !usable.includes(p));
		const file = target.file();
		const current = readCurrent(file);
		const out = target.render(current, usable, state);
		const notes = [
			...unusable.map((p) => t("models.sync_api_unsupported", { id: p.id, api: target.needs })),
			...out.skipped.map((s) => `${s.id}: ${s.why}`),
		];
		const changed = out.text !== (current ?? "");
		const label = `${target.agent.padEnd(9)}`;
		if (!changed) {
			say(`${ok("✓")} ${label}${dim(`${t("models.sync_up_to_date")}  ${file}`)}`);
		} else if (opts.check) {
			stale.push(target.agent);
			say(`${bad("✗")} ${label}${t("models.sync_outdated")}  ${dim(file)}`);
		} else {
			stale.push(target.agent);
			if (current && /\.jsonc?$/.test(file) && hasComments(current)) {
				warn(t("models.sync_comments_warn", { file }));
			}
			if (isDryRun()) {
				say(`${caution("~")} ${label}${t("models.sync_would_change")} ${file}`);
				showDiff(file, current, out.text);
			} else {
				// Copia la primera vez que bond toca el fichero.
				if (current !== undefined && !state.backedUp.includes(file)) {
					writeFileSync(`${file}.bak.${STAMP}`, current);
					state.backedUp.push(file);
				}
				mkdirSync(dirname(file), { recursive: true });
				// El models.json de pi era un symlink al repo: pasa a ser un fichero de esta máquina.
				rmSync(file, { force: true });
				writeFileSync(file, out.text);
				state.managed[target.agent] = out.managed;
				say(`${ok("✓")} ${label}${t("models.sync_updated")}  ${dim(file)}`);
			}
		}
		if (out.managed.length && changed && !opts.check) say(dim(t("models.sync_verify", { models: out.managed.join(", "), verify: target.verify })));
		for (const n of notes) say(`    ${caution("!")} ${n}`);
		if (target.note && changed && !opts.check) say(dim(`    ${target.note}`));
	}
	const notInstalled = TARGETS.filter((t) => (!cfg.agents.length || cfg.agents.includes(t.agent)) && !chosen.includes(t) && !t.installed()).map((t) => t.agent);
	if (notInstalled.length && !opts.agents) say(dim(t("models.sync_not_installed", { agents: notInstalled.join(", ") })));
	if (!opts.check && !isDryRun()) saveState(state);
	return stale;
}

function sync(args: string[]): void {
	const agents: string[] = [];
	let check = false;
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--agent") agents.push(args[++i] ?? die(t("models.sync_agent_needs_val")));
		else if (args[i] === "--check") check = true;
		else if (args[i] === "--dry-run") continue;
		else die(t("models.sync_unknown_opt", { opt: args[i] }));
	}
	const stale = syncAgents({ agents: agents.length ? agents : undefined, check });
	if (check && stale.length) process.exitCode = 1;
}
