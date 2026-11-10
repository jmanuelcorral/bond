// `bond handoff` (#88, epic #84): propuesta de traspaso cuando el agente del panel se queda
// sin presupuesto. Bond NUNCA ejecuta el traspaso (decisión 1 del epic): detecta el origen,
// ordena los candidatos por `state` (D1: ok → low → unknown → exhausted), escribe el resumen
// determinista de la sesión (#87) como fichero (D3) e imprime el comando exacto para
// continuar en cada candidato. El usuario decide y lanza.
//
// Ningún camino de código de este módulo lanza un agente destino: la verificación está en
// test/handoff.test.mts con stubs en el PATH que dejarían marca si alguien los invocara.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fmtWindows, statusFor } from "./budget.mts";
import type { BudgetState, BudgetStatus } from "./budget.mts";
import { agents, defaultAgentArgs, insideHerdr, type HerdrAgent } from "./herdr.mts";
import { BOND_HOME } from "./runtime.mts";
import { renderSessionSummary, summarizeSession, SUMMARY_AGENTS } from "./summary.mts";
import { t } from "./messages.mts";
import { die } from "./util.mts";

export interface HandoffCandidate {
	agent: string;
	status: BudgetStatus;
	/** Comando para continuar en este agente, con la ruta del resumen (D3). Bond no lo ejecuta. */
	command: string;
}

export interface HandoffProposal {
	from: string;
	fromStatus: BudgetStatus;
	summaryFile?: string;
	summaryMd?: string;
	candidates: HandoffCandidate[];
	generatedAt: string;
}

export interface HandoffOptions {
	from: string;
	tail?: number;
	/** Inyectable para tests deterministas. */
	now?: Date;
	/** Raíz de sesiones y de ~/.bond/handoff (por defecto, home real y BOND_HOME). */
	home?: string;
	cwd?: string;
	/** Agentes candidatos; por defecto los de la config global (o los del resumen). */
	all?: string[];
	/** Inyectable: claudeStatus hace red y los tests no la pisan. */
	fetchImpl?: typeof fetch;
}

/** D1 (aprobada 2026-11-10): exhaustido al final (es lo que motiva el traspaso), unknown antes porque puede valer. */
const STATE_ORDER: BudgetState[] = ["ok", "low", "unknown", "exhausted"];
const stateRank = (s: BudgetState) => STATE_ORDER.indexOf(s);

/** Agente del panel actual según Herdr; undefined si no estamos en Herdr o el panel no tiene agente. */
export function currentPaneAgent(panes: HerdrAgent[] = agents(), paneId: string | undefined = process.env.HERDR_PANE_ID): string | undefined {
	if (!paneId) return undefined;
	return panes.find((p) => p.pane_id === paneId)?.agent;
}

/** Comando de continuación de un agente: ejecutable + args por defecto (agy) + el resumen por ruta (D3). */
function continueCommand(agent: string, summaryFile?: string): string {
	const prompt = summaryFile ? t("handoff.prompt", { file: summaryFile }) : t("handoff.prompt_nofile");
	return [agent, ...defaultAgentArgs(agent, []), `"${prompt}"`].join(" ");
}

/**
 * Candidatos: todos menos el origen y los fuera de alcance (opencode, decisión de #86/#87),
 * con su BudgetStatus, ordenados por `state` (D1; estable dentro de un mismo estado).
 * El status de claude degrada a `unknown` si la red falla: la propuesta nunca muere por eso.
 */
export async function handoffCandidates(
	all: string[],
	from: string,
	now: Date = new Date(),
	opts: { summaryFile?: string; fetchImpl?: typeof fetch } = {},
): Promise<HandoffCandidate[]> {
	const pool = [...new Set(all)].filter((a) => a !== from && a !== "opencode");
	const statuses = await Promise.all(pool.map((a) => statusFor(a, now, opts.fetchImpl ?? fetch)));
	return statuses
		.slice()
		.sort((a, b) => stateRank(a.state) - stateRank(b.state))
		.map((status) => ({ agent: status.agent, status, command: continueCommand(status.agent, opts.summaryFile) }));
}

/** Nombre del fichero de resumen: <utc legible>-<agente>.md (rastro trazable, como el event log). */
const summaryFileName = (iso: string, agent: string) => `${iso.replace(/[:.]/g, "-")}-${agent}.md`;

/**
 * Propuesta completa: estado del origen, resumen de su sesión escrito a fichero (si hay) y
 * candidatos ordenados. Sin sesión legible la propuesta sigue siendo útil sin resumen
 * (mismo criterio que todos-`unknown`). No lanza ningún agente.
 */
export async function buildHandoff(opts: HandoffOptions): Promise<HandoffProposal> {
	const now = opts.now ?? new Date();
	const generatedAt = now.toISOString();
	const fromStatus = await statusFor(opts.from, now, opts.fetchImpl ?? fetch);

	// D3: el resumen viaja como ruta de fichero, no pegado en el comando.
	let summaryFile: string | undefined;
	let summaryMd: string | undefined;
	if ((SUMMARY_AGENTS as readonly string[]).includes(opts.from)) {
		try {
			summaryMd = renderSessionSummary(summarizeSession(opts.from, { n: opts.tail, home: opts.home, cwd: opts.cwd }));
			const dir = join(opts.home ?? BOND_HOME, "handoff");
			mkdirSync(dir, { recursive: true });
			summaryFile = join(dir, summaryFileName(generatedAt, opts.from));
			writeFileSync(summaryFile, summaryMd);
		} catch {
			// Sin resumen la propuesta sigue valiendo (criterio de #88).
			summaryMd = undefined;
		}
	}

	let all = opts.all;
	if (!all) {
		try {
			const { configExists, loadConfig } = await import("./config.mts");
			all = configExists() ? loadConfig().agents : [...SUMMARY_AGENTS];
		} catch {
			all = [...SUMMARY_AGENTS];
		}
	}
	const candidates = await handoffCandidates(all, opts.from, now, { summaryFile, fetchImpl: opts.fetchImpl });
	return { from: opts.from, fromStatus, summaryFile, summaryMd, candidates, generatedAt };
}

/** La propuesta en Markdown: cabecera, tabla `agente · estado · ventanas · fuente`, resumen y comandos. */
export function renderHandoff(p: HandoffProposal): string {
	const out: string[] = [`# ${t("handoff.title", { from: p.from, state: p.fromStatus.state })}`, ""];
	out.push(`- ${t("handoff.generated")}: ${p.generatedAt}`, "");
	if (!p.candidates.length) {
		out.push(t("handoff.no_candidates"), "");
	} else {
		out.push(t("handoff.table_header"), t("handoff.table_rule"));
		for (const c of p.candidates) out.push(`| ${c.agent} | ${c.status.state} | ${fmtWindows(c.status.windows)} | ${c.status.source} |`);
		out.push("");
		if (p.candidates.every((c) => c.status.state === "unknown")) out.push(`> ${t("handoff.all_unknown")}`, "");
	}
	out.push(`## ${t("handoff.summary_section")}`, "");
	if (p.summaryMd && p.summaryFile) {
		out.push(t("handoff.summary_file", { file: p.summaryFile }), "", p.summaryMd.trimEnd(), "");
	} else {
		out.push(t("handoff.summary_none"), "");
	}
	out.push(`## ${t("handoff.commands_section")}`, "");
	for (const c of p.candidates) out.push(t("handoff.command_row", { agent: c.agent, command: c.command }));
	if (!p.candidates.length) out.push(t("handoff.prompt_nofile"));
	return out.join("\n").trim() + "\n";
}

/** `bond handoff [--from ag] [--tail N]`: imprime la propuesta; no lanza nada. */
export async function handoff(args: string[]): Promise<void> {
	let from: string | undefined;
	let tail: number | undefined;
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "-h" || a === "--help") return console.log(HANDOFF_HELP());
		else if (a === "--from") from = args[++i] ?? die(t("handoff.needs_value", { opt: "--from" }));
		else if (a === "--tail" || a === "-n") {
			const v = Number(args[++i]);
			if (!Number.isInteger(v) || v < 1) die(t("handoff.bad_tail", { value: String(args[i]) }));
			tail = v;
		}
		else die(t("handoff.bad_arg", { arg: a }));
	}
	if (!from && insideHerdr()) from = currentPaneAgent();
	if (!from) die(t("handoff.no_herdr"));
	console.log(renderHandoff(await buildHandoff({ from, tail })));
}

export const HANDOFF_HELP = () => t("handoff.help");
