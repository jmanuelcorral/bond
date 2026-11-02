/**
 * Status line: pie de pi pensado para tener varios agentes en paneles de Herdr. A la izquierda,
 * la insignia de bond (">>" en dos filas y "bond"); a su lado, cada dato con su icono:
 *
 *   L1  agente@panel  carpeta  rama [worktree]  modelo thinking [→ modelo enrutado]
 *   L2  barra de contexto %  coste ↑entrada ↓salida  tiempo sesión  tiempo api  +líneas -líneas  ✓ ✗  [espera por rate limit]
 *   L3  estados de otras extensiones (ctx.ui.setStatus), solo si hay alguno
 *
 * Si no cabe todo, se quitan primero los datos menos importantes (tiempos, contadores...); en
 * paneles estrechos la insignia se queda en los ">>". Iconos Nerd Font; con BOND_ICONS=unicode,
 * símbolos que traen todas las fuentes.
 *
 * /statusline lo activa o desactiva (vuelve el pie por defecto de pi).
 *
 * Basado en status-line.ts de Jeyapaul/pi (MIT, https://github.com/Jeyapaul/pi):
 * barra de contexto, contadores de peticiones y lectura de la espera por rate limit.
 */

import { execFile } from "node:child_process";
import { basename } from "node:path";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { badgeWidth, paintIcon, renderBadge } from "../lib/bond-logo.mts";
import { fitSegments, iconSet, type Segment } from "../lib/status-bar.mts";

const HERDR_REFRESH_MS = 30_000;
const BAR_WIDTH = 10;
/** Desde aquí la insignia lleva la palabra «bond»; por debajo, solo los «>>». */
const BADGE_WORD_WIDTH = 90;
/** Por debajo de este ancho no hay insignia. */
const BADGE_MIN_WIDTH = 50;

function run(cmd: string, args: string[], cwd?: string): Promise<string> {
	return new Promise((resolve) => {
		execFile(cmd, args, { cwd, timeout: 3000, encoding: "utf8" }, (err, stdout) => resolve(err ? "" : stdout.trim()));
	});
}

const fmtTokens = (n: number) =>
	n < 1000 ? `${n}` : n < 1_000_000 ? `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k` : `${(n / 1_000_000).toFixed(1)}M`;

const fmtDur = (ms: number) => {
	const s = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = String(s % 60).padStart(2, "0");
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

/** Espera que pide el proveedor en el texto del error: "try again in 8.4s", "retry after 2 minutes"... */
function parseRetryWaitMs(msg?: string): number {
	if (!msg) return 0;
	const filler = "[^.\\n]{0,60}?";
	let m = new RegExp(`(?:retry|try|wait)${filler}\\b(?:in|after)\\s+(\\d+(?:\\.\\d+)?)\\s*(?:seconds?|secs?|s\\b)`, "i").exec(msg);
	if (m) return Number.parseFloat(m[1]) * 1000;
	m = new RegExp(`(?:retry|try|wait)${filler}\\b(?:in|after)\\s+(\\d+)\\s*(?:minutes?|mins?|m\\b)`, "i").exec(msg);
	if (m) return Number.parseFloat(m[1]) * 60_000;
	m = /retry[-\s]?after(?:[:=]\s*|\s+)(\d+)/i.exec(msg);
	if (m) return Number.parseFloat(m[1]) * 1000;
	m = /\brate.?limit[^.]*?reset in\s+(\d+(?:\.\d+)?)\s*(s\b|sec|seconds?)/i.exec(msg);
	if (m) return Number.parseFloat(m[1]) * 1000;
	return 0;
}

/** Cabecera retry-after: segundos o fecha HTTP. */
function parseRetryAfterHeader(value?: string): number {
	if (!value) return 0;
	const secs = Number(value);
	if (Number.isFinite(secs)) return secs * 1000;
	const at = Date.parse(value);
	return Number.isFinite(at) ? Math.max(0, at - Date.now()) : 0;
}

export default function (pi: ExtensionAPI) {
	let enabled = true;
	let ctxRef: ExtensionContext | undefined;

	// Identidad: se calcula al arrancar la sesión (git) y se refresca en segundo plano (Herdr).
	let folder = "";
	let isWorktree = false;
	const paneId = process.env.HERDR_ENV === "1" ? process.env.HERDR_PANE_ID : undefined;
	let herdrName = "";
	let herdrTimer: ReturnType<typeof setInterval> | undefined;

	// Estadísticas de la sesión.
	let sessionStart = Date.now();
	let apiTimeMs = 0;
	let streamingSince = 0;
	let linesAdded = 0;
	let linesRemoved = 0;
	let reqOk = 0;
	let reqFail = 0;
	let failCounted = false;
	let rateLimitedUntil = 0;

	async function detectGit(cwd: string) {
		const out = await run("git", ["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"], cwd);
		const [gitDir, commonDir] = out.split("\n");
		isWorktree = !!gitDir && !!commonDir && gitDir !== commonDir;
	}

	async function refreshHerdrName() {
		if (!paneId) return;
		const raw = await run("herdr", ["agent", "list"]);
		try {
			const agents: Array<{ pane_id?: string; name?: string }> = JSON.parse(raw)?.result?.agents ?? [];
			herdrName = agents.find((a) => a.pane_id === paneId)?.name ?? "";
		} catch {
			// Sin servidor o salida inesperada: se queda el último nombre conocido.
		}
	}

	function sessionTotals(ctx: ExtensionContext) {
		let cost = 0;
		let input = 0;
		let output = 0;
		let lastModel = "";
		for (const e of ctx.sessionManager.getBranch()) {
			if (e.type !== "message" || e.message.role !== "assistant") continue;
			const m = e.message as AssistantMessage;
			cost += m.usage?.cost?.total ?? 0;
			input += (m.usage?.input ?? 0) + (m.usage?.cacheRead ?? 0) + (m.usage?.cacheWrite ?? 0);
			output += m.usage?.output ?? 0;
			lastModel = m.model ?? lastModel;
		}
		return { cost, input, output, lastModel };
	}

	function makeFooter(tui: { requestRender(): void }, theme: Theme, footerData: any) {
		const tick = setInterval(() => tui.requestRender(), 1000);
		const unsub = footerData.onBranchChange(() => tui.requestRender());
		const I = iconSet();
		const seg = (text: string, drop: number): Segment => ({ text, width: visibleWidth(text), drop });
		const item = (icon: string, text: string, drop: number) => seg(`${paintIcon(icon)} ${text}`, drop);

		return {
			dispose() {
				clearInterval(tick);
				unsub();
			},
			invalidate() {},
			render(width: number): string[] {
				const ctx = ctxRef;
				if (!ctx) return [];
				const now = Date.now();
				const totals = sessionTotals(ctx);

				// Insignia a la izquierda, con la misma sangría para las tres líneas.
				const badge = width >= BADGE_MIN_WIDTH ? renderBadge(width >= BADGE_WORD_WIDTH) : undefined;
				const indent = badge ? badgeWidth(width >= BADGE_WORD_WIDTH) + 2 : 0;
				const room = width - indent;

				// L1: quién soy y dónde. Si no cabe, se va antes la carpeta, luego el agente y la rama.
				const branch = footerData.getGitBranch();
				const model = ctx.model;
				let modelStr = model ? model.id : "sin modelo";
				if (model && totals.lastModel && totals.lastModel !== model.id) modelStr += ` → ${totals.lastModel}`;
				const l1: Segment[] = [
					paneId ? item(I.agent, theme.fg("accent", herdrName ? `${herdrName}@${paneId}` : paneId), 2) : seg("", 0),
					item(I.folder, theme.fg("text", folder), 3),
					branch ? item(I.branch, theme.fg("muted", branch) + (isWorktree ? ` ${theme.fg("warning", I.worktree)}` : ""), 1) : seg("", 0),
					item(I.model, theme.fg("accent", modelStr) + (model && ctx.thinkingLevel ? ` ${theme.fg("dim", ctx.thinkingLevel)}` : ""), 0),
				];

				// L2: cuánto queda y cuánto ha costado. Se van antes los tiempos y los contadores.
				const usage = ctx.getContextUsage();
				const pct = usage?.percent ?? null;
				let bar: string;
				if (pct == null) {
					bar = theme.fg("dim", `${"━".repeat(BAR_WIDTH)} --%`);
				} else {
					const filled = Math.max(0, Math.min(BAR_WIDTH, Math.round((pct / 100) * BAR_WIDTH)));
					const color = pct < 50 ? "success" : pct < 80 ? "warning" : "error";
					bar = theme.fg(color, "━".repeat(filled)) + theme.fg("dim", "━".repeat(BAR_WIDTH - filled)) + theme.fg(color, ` ${Math.round(pct)}%`);
				}
				const tokens = theme.fg("muted", `↑${fmtTokens(totals.input)} ↓${fmtTokens(totals.output)}`);
				const cost = totals.cost > 0 ? `${theme.fg("text", `$${totals.cost.toFixed(2)}`)} ` : "";
				const l2: Segment[] = [
					item(I.context, bar, 0),
					item(I.cost, cost + tokens, 2),
					item(I.time, theme.fg("dim", fmtDur(now - sessionStart)), 4),
					item(I.api, theme.fg("dim", fmtDur(apiTimeMs + (streamingSince ? now - streamingSince : 0))), 5),
					item(I.diff, `${theme.fg("toolDiffAdded", `+${linesAdded}`)} ${theme.fg("toolDiffRemoved", `-${linesRemoved}`)}`, 3),
				];
				if (reqOk + reqFail > 0) {
					l2.push(seg(theme.fg("success", `${I.ok} ${reqOk}`) + (reqFail ? ` ${theme.fg("error", `${I.fail} ${reqFail}`)}` : ""), 3));
				}
				// La espera por rate limit no se quita nunca: va a la derecha, y lo demás cede el sitio.
				const wait = rateLimitedUntil - now;
				let line2: string;
				if (wait > 0) {
					const right = `${paintIcon(I.wait)} ${theme.fg("error", "rate limit · reintento en ")}${theme.fg("warning", fmtDur(wait))}`;
					const left = fitSegments(l2, Math.max(0, room - visibleWidth(right) - 2));
					line2 = left + " ".repeat(Math.max(2, room - visibleWidth(left) - visibleWidth(right))) + right;
				} else {
					line2 = fitSegments(l2, room);
				}

				const body = [fitSegments(l1, room), line2];
				// L3: estados de otras extensiones, que un pie propio taparía si no se pintan aquí.
				const statuses = [...(footerData.getExtensionStatuses?.() ?? new Map()).values()].filter(Boolean);
				if (statuses.length) body.push(statuses.map((st) => `${theme.fg("dim", I.status)} ${st}`).join("  "));

				const pad = " ".repeat(indent);
				return body.map((line, i) => truncateToWidth((badge ? (i < 2 ? `${badge[i]}  ` : pad) : "") + line, width));
			},
		};
	}

	function install(ctx: ExtensionContext) {
		ctxRef = ctx;
		if (enabled && ctx.mode === "tui") ctx.ui.setFooter((tui, theme, footerData) => makeFooter(tui, theme, footerData));
	}

	pi.on("session_start", async (_event, ctx) => {
		sessionStart = Date.now();
		apiTimeMs = 0;
		streamingSince = 0;
		linesAdded = 0;
		linesRemoved = 0;
		reqOk = 0;
		reqFail = 0;
		failCounted = false;
		rateLimitedUntil = 0;
		folder = basename(ctx.cwd) || ctx.cwd;
		install(ctx);
		void detectGit(ctx.cwd);
		if (paneId && !herdrTimer) {
			void refreshHerdrName();
			herdrTimer = setInterval(() => void refreshHerdrName(), HERDR_REFRESH_MS);
			herdrTimer.unref?.();
		}
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		if (enabled && ctx.mode === "tui") ctx.ui.setFooter(undefined);
		if (herdrTimer) clearInterval(herdrTimer);
		herdrTimer = undefined;
		ctxRef = undefined;
	});

	pi.on("message_start", async (event) => {
		if (event.message.role === "assistant") streamingSince = Date.now();
	});

	// Un fallo HTTP final se cuenta aquí; su message_end con stopReason "error" no se vuelve a contar.
	pi.on("after_provider_response", async (event) => {
		if (event.status < 400) return;
		reqFail++;
		failCounted = true;
		const wait = parseRetryAfterHeader(event.headers?.["retry-after"]);
		if (wait > 0) rateLimitedUntil = Date.now() + wait;
	});

	pi.on("message_end", async (event) => {
		const m = event.message as AssistantMessage;
		if (m.role !== "assistant") return;
		if (streamingSince) {
			apiTimeMs += Date.now() - streamingSince;
			streamingSince = 0;
		}
		if (m.stopReason === "error") {
			if (!failCounted) reqFail++;
			const wait = parseRetryWaitMs(m.errorMessage);
			if (wait > 0) rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + wait);
		} else if (m.stopReason === "stop" || m.stopReason === "length" || m.stopReason === "toolUse") {
			reqOk++;
			rateLimitedUntil = 0;
		}
		// pending, aborted y deferred no son ni éxito ni fallo de la petición.
		failCounted = false;
	});

	pi.on("tool_execution_start", async (event) => {
		if (event.toolName === "write" && typeof event.args?.content === "string") {
			linesAdded += event.args.content.split("\n").length;
		}
	});

	pi.on("tool_execution_end", async (event) => {
		if (event.toolName !== "edit" || event.isError) return;
		const patch: string | undefined = event.result?.details?.patch;
		if (!patch) return;
		for (const line of patch.split("\n")) {
			if (line.startsWith("+++") || line.startsWith("---")) continue;
			if (line.startsWith("+")) linesAdded++;
			else if (line.startsWith("-")) linesRemoved++;
		}
	});

	pi.registerCommand("statusline", {
		description: "Activa o desactiva el pie de estado de bond",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			if (ctx.mode !== "tui") return;
			if (enabled) install(ctx);
			else ctx.ui.setFooter(undefined);
			ctx.ui.notify(enabled ? "Pie de estado activado" : "Pie por defecto de pi", "info");
		},
	});
}
