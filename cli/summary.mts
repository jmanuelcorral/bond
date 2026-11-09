/**
 * Resumen de sesión determinista (#87, epic #84). Lee los ficheros de sesión de cada agente
 * (pi, Claude Code, Codex, agy) y produce los últimos N intercambios user/assistant con estado
 * del repo y metadatos, listos para pegar como contexto en otro agente. Sin red y sin LLM: lo
 * que sale es literalmente lo que hay en el transcript. `bond handoff` (#88) consumirá esto.
 *
 * Formatos (verificados contra sesiones reales, 2026-11-09):
 *  - pi:    ~/.pi/agent/sessions/<proyecto>/*.jsonl; líneas {type:"session",cwd} y
 *           {type:"message", message:{role, content:[{type:"text",text}], model, usage}}.
 *  - claude: ~/.claude/projects/<proyecto>/*.jsonl; líneas {type:"user"|"assistant",
 *           message:{role, content: string | bloques}}; cada línea trae "cwd".
 *  - codex: ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl; {type:"session_meta",payload:{cwd}},
 *           {type:"response_item",payload:{type:"message",role,content:[{type:"input_text"|
 *           "output_text",text}]}} (role "developer" y los bloques de contexto van fuera), y
 *           turn_context con payload.model.
 *  - agy:   ~/.gemini/antigravity-cli/brain/<id>/.system_generated/logs/transcript[_full].jsonl;
 *           pasos {type:"USER_INPUT",source:"USER_EXPLICIT",content} (envuelve el encargo en
 *           <USER_REQUEST>) y {type:"PLANNER_RESPONSE",source:"MODEL",content}.
 * Como en budget.mts: línea corrupta no corta el scan; formato no reconocido, error claro.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { t } from "./messages.mts";
import { AGENT_DIR } from "./util.mts";

export const SUMMARY_AGENTS = ["pi", "claude", "codex", "agy"] as const;
export type SummaryAgent = (typeof SUMMARY_AGENTS)[number];

export interface SessionExchange {
	role: "user" | "assistant";
	text: string;
}

export interface RepoContext {
	status: string;
	diffStat: string;
}

export interface SessionSummary {
	agent: SummaryAgent;
	sessionFile: string;
	model?: string;
	generatedAt: string;
	exchanges: SessionExchange[];
	repo?: RepoContext;
}

export interface SummaryOptions {
	/** Intercambios que se conservan (los últimos N). */
	n?: number;
	/** Caracteres máximos por intercambio; lo demás se corta con «…». */
	maxChars?: number;
	cwd?: string;
	home?: string;
	/** Ruta explícita de la sesión; sin ella se busca la sesión más reciente del agente. */
	sessionFile?: string;
	/** Inyectable para que los tests sean deterministas. */
	now?: Date;
	/** Falso para no ejecutar git (render sin sección de repo). */
	repoContext?: boolean;
}

const DEFAULT_TAIL = 10;
const DEFAULT_MAX_CHARS = 1200;
/** Bloques de contexto que Codex mete como «user» y no forman parte del diálogo. */
const CODEX_NOISE = ["<environment_context>", "<user_instructions>", "<permissions", "<approvals", "<turn_context", "<permissions_instructions>"];

const isSummaryAgent = (a: string): a is SummaryAgent => (SUMMARY_AGENTS as readonly string[]).includes(a);

const textFromBlocks = (content: unknown): string => {
	if (typeof content === "string") return content.trim();
	if (!Array.isArray(content)) return "";
	return (content as Array<{ type?: string; text?: unknown }>)
		.filter((p) => (p?.type === "text" || p?.type === "input_text" || p?.type === "output_text" || p?.type === "output") && typeof p.text === "string" && (p.text as string).trim())
		.map((p) => (p.text as string).trim())
		.join("\n\n")
		.trim();
};

const lines = (text: string) => text.split("\n");
const parseLine = (line: string): Record<string, any> | undefined => {
	if (!line.trim()) return undefined;
	try {
		return JSON.parse(line);
	} catch {
		return undefined; // línea corrupta: se salta, como en budget.mts
	}
};

const stripWrapper = (text: string, tag: string): string => {
	const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(text);
	return (m ? m[1] : text).trim();
};

interface Parsed {
	exchanges: SessionExchange[];
	model?: string;
}

function parsePi(text: string): Parsed {
	const exchanges: SessionExchange[] = [];
	let model: string | undefined;
	for (const line of lines(text)) {
		if (!line.includes('"role":"user"') && !line.includes('"role":"assistant"')) continue;
		const e = parseLine(line);
		if (e?.type !== "message" || !e.message) continue;
		const role = e.message.role;
		if (role !== "user" && role !== "assistant") continue;
		const txt = textFromBlocks(e.message.content);
		if (!txt) continue; // solo tool-calls, razonamiento o tool results: no es diálogo
		exchanges.push({ role, text: txt });
		if (role === "assistant" && typeof e.message.model === "string") model = e.message.model;
	}
	return { exchanges, model };
}

function parseClaude(text: string): Parsed {
	const exchanges: SessionExchange[] = [];
	let model: string | undefined;
	for (const line of lines(text)) {
		if (!line.includes('"user"') && !line.includes('"assistant"')) continue;
		const e = parseLine(line);
		if (!e?.message) continue;
		if (e.isSidechain === true || e.isMeta === true) continue; // subagentes y metas: no el hilo
		const role = e.message.role;
		if (role !== "user" && role !== "assistant") continue;
		const txt = textFromBlocks(e.message.content);
		if (!txt) continue;
		exchanges.push({ role, text: txt });
		if (role === "assistant" && typeof e.message.model === "string") model = e.message.model;
	}
	return { exchanges, model };
}

function parseCodex(text: string): Parsed {
	const exchanges: SessionExchange[] = [];
	let model: string | undefined;
	for (const line of lines(text)) {
		if (!line.includes('"message"') && !line.includes('"model"')) continue;
		const e = parseLine(line);
		const p = e?.payload;
		if (!p) continue;
		if (typeof p.model === "string" && p.model) model = p.model;
		if (e?.type !== "response_item" || p.type !== "message") continue;
		if (p.role !== "user" && p.role !== "assistant") continue; // fuera "developer"
		let txt = textFromBlocks(p.content);
		if (CODEX_NOISE.some((n) => txt.startsWith(n))) continue;
		if (!txt) continue;
		exchanges.push({ role: p.role, text: txt });
	}
	return { exchanges, model };
}

function parseAgy(text: string): Parsed {
	const exchanges: SessionExchange[] = [];
	for (const line of lines(text)) {
		if (!line.includes('"USER_INPUT"') && !line.includes('"PLANNER_RESPONSE"')) continue;
		const e = parseLine(line);
		if (typeof e?.content !== "string" || !e.content.trim()) continue;
		if (e.type === "USER_INPUT" && e.source === "USER_EXPLICIT") {
			const txt = stripWrapper(e.content, "USER_REQUEST");
			if (txt && !txt.startsWith("/")) exchanges.push({ role: "user", text: txt });
		} else if (e.type === "PLANNER_RESPONSE" && e.source === "MODEL") {
			exchanges.push({ role: "assistant", text: e.content.trim() });
		}
	}
	return { exchanges };
}

const PARSERS: Record<SummaryAgent, (text: string) => Parsed> = { pi: parsePi, claude: parseClaude, codex: parseCodex, agy: parseAgy };

/** @internal: parsea un texto de sesión ya leído (lo usa la localización y los tests). */
export function parseSession(agent: SummaryAgent, text: string): Parsed {
	return PARSERS[agent](text);
}

const mtime = (f: string) => {
	try {
		return statSync(f).mtimeMs;
	} catch {
		return 0;
	}
};
const newest = (files: string[]) => files.sort((a, b) => mtime(b) - mtime(a))[0];

const walk = (dir: string, out: string[] = []): string[] => {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const d of entries) {
		const f = join(dir, d.name);
		if (d.isDirectory()) walk(f, out);
		else if (d.name.endsWith(".jsonl")) out.push(f);
	}
	return out;
};
const mentionsCwd = (file: string, cwd: string) => {
	try {
		return readFileSync(file, "utf8").includes(`"cwd":${JSON.stringify(cwd)}`);
	} catch {
		return false;
	}
};

/** Sesión más reciente del agente en el home dado, filtrando por cwd cuando el formato lo permite. */
export function findSessionFile(agent: SummaryAgent, opts: { cwd?: string; home?: string } = {}): string | undefined {
	const home = opts.home ?? homedir();
	const cwd = opts.cwd ?? process.cwd();
	if (agent === "pi") {
		const root = process.env.PI_CODING_AGENT_SESSION_DIR || join(home, ".pi", "agent", "sessions");
		const all = walk(root).filter((f) => mentionsCwd(f, cwd));
		return newest(all);
	}
	if (agent === "claude") {
		const projects = process.env.CLAUDE_CONFIG_DIR ? join(process.env.CLAUDE_CONFIG_DIR, "projects") : join(home, ".claude", "projects");
		return newest(walk(projects).filter((f) => mentionsCwd(f, cwd)));
	}
	if (agent === "codex") {
		return newest(walk(join(home, ".codex", "sessions")).filter((f) => mentionsCwd(f, cwd)));
	}
	const brain = join(home, ".gemini", "antigravity-cli", "brain");
	let dirs: string[] = [];
	try {
		dirs = readdirSync(brain, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(brain, d.name));
	} catch {
		return undefined;
	}
	const files = dirs
		.map((d) => join(d, ".system_generated", "logs", "transcript_full.jsonl"))
		.concat(dirs.map((d) => join(d, ".system_generated", "logs", "transcript.jsonl")))
		.filter((f) => existsSync(f));
	return newest(files);
}

function repoContext(cwd: string): RepoContext | undefined {
	const git = (args: string[]) => {
		try {
			return execFileSync("git", args, { cwd, encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "ignore"] }).trim();
		} catch {
			return undefined;
		}
	};
	const status = git(["status", "--short"]);
	const diffStat = git(["diff", "--stat"]);
	if (status === undefined || diffStat === undefined) return undefined;
	return { status, diffStat };
}

const clip = (text: string, maxChars: number) => (text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text);

/**
 * Resumen determinista de la sesión de un agente. Con `sessionFile` explícito se usa tal cual;
 * si no, se localiza la sesión más reciente del agente (pi/claude/codex filtran por cwd).
 * Error claro (no parcialmente-silencioso) si el agente no está soportado, no hay sesión,
 * no se puede leer o no tiene intercambios reconocibles.
 */
export function summarizeSession(agent: string, opts: SummaryOptions = {}): SessionSummary {
	if (!isSummaryAgent(agent)) throw new Error(t("summary.unknown_agent", { agent }));
	const cwd = opts.cwd ?? process.cwd();
	const file = opts.sessionFile ?? findSessionFile(agent, { cwd, home: opts.home });
	if (!file) throw new Error(t("summary.no_session", { agent, cwd }));
	let text: string;
	try {
		text = readFileSync(file, "utf8");
	} catch {
		throw new Error(t("summary.unreadable", { file }));
	}
	const parsed = parseSession(agent, text);
	if (!parsed.exchanges.length) throw new Error(t("summary.no_exchanges", { file }));
	const n = Math.max(1, opts.n ?? DEFAULT_TAIL);
	const maxChars = Math.max(50, opts.maxChars ?? DEFAULT_MAX_CHARS);
	const summary: SessionSummary = {
		agent,
		sessionFile: file,
		model: parsed.model,
		generatedAt: (opts.now ?? new Date()).toISOString(),
		exchanges: parsed.exchanges.slice(-n).map((x) => ({ role: x.role, text: clip(x.text, maxChars) })),
	};
	if (opts.repoContext !== false) {
		const repo = repoContext(cwd);
		if (repo) summary.repo = repo;
	}
	return summary;
}

/** Markdown pegable: cabecera trazable, estado del repo y los intercambios en orden cronológico. */
export function renderSessionSummary(s: SessionSummary): string {
	const out: string[] = [`# ${t("summary.title")} — ${s.agent}`, ""];
	out.push(`- ${t("summary.session")}: ${s.sessionFile}`);
	if (s.model) out.push(`- ${t("summary.model")}: ${s.model}`);
	out.push(`- ${t("summary.generated")}: ${s.generatedAt}`, "");
	if (s.repo) {
		out.push(`## ${t("summary.repo")}`, "", `\`${t("summary.status")}\``, "", s.repo.status || `_${t("summary.clean")}_`, "", `\`${t("summary.diff")}\``, "", s.repo.diffStat || `_${t("summary.clean")}_`, "");
	}
	out.push(`## ${t("summary.exchanges")}`, "");
	for (const x of s.exchanges) out.push(`**${x.role === "user" ? t("summary.role_user") : t("summary.role_assistant")}:**`, "", x.text, "");
	return out.join("\n").trim() + "\n";
}
