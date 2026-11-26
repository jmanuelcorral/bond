// Generadores de la configuración de modelos de cada agente a partir de config.toml.
//
// Dos estrategias para no pisar lo ajeno:
// - JSON (pi, opencode): bond reescribe solo los proveedores que gestiona (los de ahora y los
//   que escribió la vez anterior, apuntados en state.json) y deja el resto del fichero igual.
// - Texto (Crush, Codex): un bloque entre marcas al final del fichero; fuera, nada se toca.

import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import type { Api, Model, Provider, State } from "./config.mts";
import { keyPath } from "./keys.mts";
import { t } from "./messages.mts";
import { AGENT_DIR, HOME, which } from "./util.mts";

export interface Rendered {
	/** Contenido nuevo del fichero completo. */
	text: string;
	/** Ids de proveedor que quedan gestionados por bond (para la próxima vez). */
	managed: string[];
	/** Proveedores que no se escribieron y por qué. */
	skipped: Array<{ id: string; why: string }>;
}

export interface Target {
	agent: string;
	/** API que necesita el agente de la pasarela. */
	needs: Api;
	file: () => string;
	installed: () => boolean;
	render: (current: string | undefined, providers: Provider[], state: State) => Rendered;
	/** Cómo comprobar a mano que el agente ve los modelos. */
	verify: string;
	note?: string;
	/** Clave en state.managed (por defecto, el agente): un agente puede tener varios ficheros. */
	stateKey?: string;
	/** Si el fichero es un enlace simbólico (instalaciones antiguas lo enlazaban al repo), no se toca. */
	keepSymlink?: boolean;
}

const xdg = () => process.env.XDG_CONFIG_HOME || join(HOME, ".config");

/** Modelos de un proveedor que van a este agente. */
const modelsFor = (p: Provider, agent: string): Model[] => p.models.filter((m) => !m.agents || m.agents.includes(agent));

/** JSON con comentarios (// y /* *\/) y comas finales, como opencode.jsonc o el models.json de pi. */
export function parseJsonc(text: string): Record<string, unknown> {
	let out = "";
	let inString = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (inString) {
			out += c;
			if (c === "\\") out += text[++i] ?? "";
			else if (c === '"') inString = false;
		} else if (c === '"') {
			inString = true;
			out += c;
		} else if (c === "/" && text[i + 1] === "/") {
			while (i < text.length && text[i] !== "\n") i++;
			out += "\n";
		} else if (c === "/" && text[i + 1] === "*") {
			i = text.indexOf("*/", i + 2) + 1 || text.length;
		} else out += c;
	}
	return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1") || "{}");
}

/** ¿Tiene comentarios? Al reescribir un JSONC se pierden, así que se avisa. */
export const hasComments = (text: string) => /^\s*\/\/|\/\*/m.test(text);

function mergeProviders(
	current: string | undefined,
	key: string,
	generated: Record<string, unknown>,
	previous: string[],
): string {
	const obj = current?.trim() ? parseJsonc(current) : {};
	const existing = { ...((obj[key] as Record<string, unknown>) ?? {}) };
	for (const id of previous) delete existing[id];
	obj[key] = { ...existing, ...generated };
	return `${JSON.stringify(obj, null, 2)}\n`;
}

// --- pi -------------------------------------------------------------------------------

const pi: Target = {
	agent: "pi",
	needs: "chat",
	file: () => join(AGENT_DIR, "models.json"),
	installed: () => !!which("pi"),
	verify: "pi --list-models",
	render(current, providers, state) {
		const generated: Record<string, unknown> = {};
		for (const p of providers) {
			const extra = (p.pi ?? {}) as Record<string, unknown>;
			generated[p.id] = {
				...(p.name ? { name: p.name } : {}),
				baseUrl: p.base_url,
				api: "openai-completions",
				// pi necesita una clave para listar el modelo; sin clave, una de relleno. La guardada
				// en ~/.bond/keys la lee pi al usarla, con un comando (no se copia aquí).
				apiKey: p.key_stored ? `!bond key ${p.id}` : p.api_key_env ? `\${${p.api_key_env}}` : "bond",
				...extra,
				models: modelsFor(p, "pi").map((m) => ({
					id: m.id,
					...(m.name ? { name: m.name } : {}),
					...(m.reasoning !== undefined ? { reasoning: m.reasoning } : {}),
					input: m.input ?? ["text"],
					...(m.context ? { contextWindow: m.context } : {}),
					...(m.max_output ? { maxTokens: m.max_output } : {}),
					...(p.free ? { cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } } : {}),
				})),
			};
		}
		const text = mergeProviders(current, "providers", generated, state.managed.pi ?? []);
		return { text, managed: Object.keys(generated), skipped: [] };
	},
};

// --- pi: compactación por modelo ------------------------------------------------------
//
// Con poco contexto, el umbral por defecto de pi (compactar con 16384 libres) llega tarde: un
// resultado de herramienta grande lo salta y la petición de resumen, que va al mismo modelo, ya
// no cabe (bond#92). Para esos modelos bond escribe compaction.modelOverrides en el
// settings.json de pi: solo sus entradas, apuntadas en state.json; las de la persona no se tocan.

/** Hasta este contextWindow bond ajusta la compactación. */
export const PI_COMPACTION_MAX_CONTEXT = 200_000;
const PI_DEFAULT_RESERVE = 16_384;

/** Ajuste de compactación para un contextWindow, o null si no hace falta (o no se conoce). */
export function piCompactionFor(context: number | undefined): { reserveTokens: number; keepRecentTokens: number } | null {
	if (!context || context <= 0 || context > PI_COMPACTION_MAX_CONTEXT) return null;
	// Compacta con un 25 % libre (nunca antes que el defecto de pi), sin pasar de la mitad.
	const reserveTokens = Math.min(Math.max(PI_DEFAULT_RESERVE, Math.ceil(context * 0.25)), Math.floor(context / 2));
	const keepRecentTokens = Math.min(20_000, Math.floor(context * 0.12));
	return { reserveTokens, keepRecentTokens };
}

export const piCompaction: Target = {
	agent: "pi",
	stateKey: "pi-compaction",
	keepSymlink: true,
	needs: "chat",
	file: () => join(AGENT_DIR, "settings.json"),
	installed: () => !!which("pi"),
	verify: "compaction.modelOverrides en ~/.pi/agent/settings.json",
	render(current, providers, state) {
		const obj = current?.trim() ? parseJsonc(current) : {};
		const compaction = { ...((obj.compaction as Record<string, unknown>) ?? {}) };
		const overrides = { ...((compaction.modelOverrides as Record<string, unknown>) ?? {}) };
		const previous = state.managed["pi-compaction"] ?? [];
		const hadModelOverrides = "modelOverrides" in compaction;
		for (const key of previous) delete overrides[key];
		const managed: string[] = [];
		const skipped: Array<{ id: string; why: string }> = [];
		for (const p of providers) {
			for (const m of modelsFor(p, "pi")) {
				const value = piCompactionFor(m.context);
				if (!value) continue;
				const key = `${p.id}/${m.id}`;
				// Una entrada que bond no escribió es de la persona: se respeta.
				if (key in overrides) {
					skipped.push({ id: key, why: t("models.pi_compaction_user_override") });
					continue;
				}
				overrides[key] = value;
				managed.push(key);
			}
		}
		// Nada que bond escriba ni que quitar: el fichero de pi queda tal cual (ni se reformatea).
		if (!managed.length && !previous.length) return { text: current ?? "", managed, skipped };
		if (Object.keys(overrides).length || hadModelOverrides) compaction.modelOverrides = overrides;
		else delete compaction.modelOverrides;
		if (Object.keys(compaction).length) obj.compaction = compaction;
		else delete obj.compaction;
		return { text: `${JSON.stringify(obj, null, 2)}\n`, managed, skipped };
	},
};

/** Ficheros de más que se generan junto al principal de un agente. */
export const COMPANIONS: Record<string, Target[]> = { pi: [piCompaction] };

// --- opencode v2 ----------------------------------------------------------------------

const opencode: Target = {
	agent: "opencode",
	needs: "chat",
	file: () => {
		const dir = join(xdg(), "opencode");
		const jsonc = join(dir, "opencode.jsonc");
		return existsSync(jsonc) ? jsonc : join(dir, "opencode.json");
	},
	installed: () => !!which("opencode"),
	verify: "opencode models | grep <proveedor>",
	get note() {
		return t("models.note_opencode");
	},
	render(current, providers, state) {
		const generated: Record<string, unknown> = {};
		for (const p of providers) {
			generated[p.id] = {
				...(p.name ? { name: p.name } : {}),
				package: "@opencode/ai/providers/openai-compatible",
				...(p.api_key_env && !p.key_stored ? { env: [p.api_key_env] } : {}),
				settings: { baseURL: p.base_url, ...(p.key_stored ? { apiKey: `{file:${keyPath(p.id)}}` } : {}) },
				models: Object.fromEntries(
					modelsFor(p, "opencode").map((m) => [
						m.id,
						{
							...(m.name ? { name: m.name } : {}),
							...(m.context || m.max_output
								? { limit: { ...(m.context ? { context: m.context } : {}), ...(m.max_output ? { output: m.max_output } : {}) } }
								: {}),
						},
					]),
				),
			};
		}
		let text = mergeProviders(current, "providers", generated, state.managed.opencode ?? []);
		if (!current?.trim()) text = text.replace("{\n", '{\n  "$schema": "https://opencode.ai/config.json",\n');
		return { text, managed: Object.keys(generated), skipped: [] };
	},
};

// --- bloques de texto (Crush, Codex) --------------------------------------------------

export const BEGIN = "# >>> bond >>>";
export const END = "# <<< bond <<<";
const BLOCK_NOTE = "generado por `bond models sync`; no editar: cambia ~/.config/bond/config.toml";

/** Quita el bloque de bond (si lo hay) y devuelve el resto del fichero. */
export function withoutBlock(current: string): string {
	const start = current.indexOf(BEGIN);
	if (start < 0) return current;
	const end = current.indexOf(END, start);
	const after = end < 0 ? "" : current.slice(end + END.length).replace(/^\n/, "");
	return current.slice(0, start).replace(/\n+$/, "\n") + after;
}

export function codexConfigFile(): string {
	return join(process.env.CODEX_HOME || join(HOME, ".codex"), "config.toml");
}

/** El bloque va siempre al final: en TOML, unas tablas al final no cambian el significado del resto. */
function appendBlock(rest: string, body: string): string {
	if (!body.trim()) return rest; // nada que gestionar: el fichero queda como estaba
	const base = rest.trim() ? `${rest.replace(/\n*$/, "")}\n\n` : "";
	return `${base}${BEGIN} ${BLOCK_NOTE}\n${body.replace(/\n*$/, "")}\n${END}\n`;
}

const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const tomlStr = (s: string) => JSON.stringify(s);

const crush: Target = {
	agent: "crush",
	needs: "chat",
	file: () => join(xdg(), "crush", "crushrc"),
	installed: () => !!which("crush"),
	verify: "crush models | grep <proveedor>",
	get note() {
		return t("models.note_crush");
	},
	render(current, providers) {
		const rest = withoutBlock(current ?? "");
		// Proveedores definidos a mano fuera del bloque: no se duplican; manda lo tuyo.
		const manual = new Set([...rest.matchAll(/^\s*provider\s+add\s+(\S+)/gm)].map((m) => m[1]));
		const skipped: Rendered["skipped"] = [];
		let body = "";
		const managed: string[] = [];
		for (const p of providers) {
			if (manual.has(p.id)) {
				skipped.push({ id: p.id, why: t("models.crush_skipped_manual") });
				continue;
			}
			managed.push(p.id);
			const key = p.key_stored ? `"$(bond key ${p.id})"` : p.api_key_env ? `"\${${p.api_key_env}}"` : "bond";
			body += `provider add ${p.id} \\\n  --name ${shq(p.name ?? p.id)} \\\n  --type openai-compat \\\n  --base-url ${shq(p.base_url)} \\\n  --api-key ${key} \\\n  --discover-models false\n`;
			for (const m of modelsFor(p, "crush")) {
				body += `model add ${p.id}/${m.id} \\\n  --name ${shq(m.name ?? m.id)}`;
				if (m.context) body += ` \\\n  --context-window ${m.context}`;
				if (m.max_output) body += ` \\\n  --default-max-tokens ${m.max_output}`;
				body += "\n";
			}
		}
		return { text: appendBlock(rest, body), managed, skipped };
	},
};

export const TARGETS: Target[] = [pi, opencode, crush];

/** Agentes que no pueden usar una pasarela compatible con OpenAI, y por qué (para `models list`). */
export const INCOMPATIBLE: Record<string, string> = {
	claude: "Claude Code solo habla la API de Anthropic (/v1/messages)",
};

/** Lee el fichero actual siguiendo symlinks (el models.json de pi era un symlink al repo). */
export function readCurrent(file: string): string | undefined {
	try {
		return readFileSync(lstatSync(file).isSymbolicLink() ? realpathSync(file) : file, "utf8");
	} catch {
		return undefined;
	}
}
