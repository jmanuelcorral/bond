// Generadores de la configuración de modelos de cada agente a partir de config.toml.
//
// Dos estrategias para no pisar lo ajeno:
// - JSON (pi, opencode): bond reescribe solo los proveedores que gestiona (los de ahora y los
//   que escribió la vez anterior, apuntados en state.json) y deja el resto del fichero igual.
// - Texto (Crush, Codex): un bloque entre marcas al final del fichero; fuera, nada se toca.

import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import type { Api, Model, Provider, State } from "./config.mts";
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
				// pi necesita una clave para listar el modelo; sin variable, una de relleno.
				apiKey: p.api_key_env ? `\${${p.api_key_env}}` : "bond",
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
	note: "formato de opencode v2: providers.<id>.settings.baseURL",
	render(current, providers, state) {
		const generated: Record<string, unknown> = {};
		for (const p of providers) {
			generated[p.id] = {
				...(p.name ? { name: p.name } : {}),
				package: "@opencode/ai/providers/openai-compatible",
				...(p.api_key_env ? { env: [p.api_key_env] } : {}),
				settings: { baseURL: p.base_url },
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

const BEGIN = "# >>> bond >>>";
const END = "# <<< bond <<<";
const BLOCK_NOTE = "generado por `bond models sync`; no editar: cambia ~/.config/bond/config.toml";

/** Quita el bloque de bond (si lo hay) y devuelve el resto del fichero. */
function withoutBlock(current: string): string {
	const start = current.indexOf(BEGIN);
	if (start < 0) return current;
	const end = current.indexOf(END, start);
	const after = end < 0 ? "" : current.slice(end + END.length).replace(/^\n/, "");
	return current.slice(0, start).replace(/\n+$/, "\n") + after;
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
	note: "crushrc es un script de bash; si defines a mano un proveedor con el mismo id, bond no lo duplica",
	render(current, providers) {
		const rest = withoutBlock(current ?? "");
		// Proveedores definidos a mano fuera del bloque: no se duplican; manda lo tuyo.
		const manual = new Set([...rest.matchAll(/^\s*provider\s+add\s+(\S+)/gm)].map((m) => m[1]));
		const skipped: Rendered["skipped"] = [];
		let body = "";
		const managed: string[] = [];
		for (const p of providers) {
			if (manual.has(p.id)) {
				skipped.push({ id: p.id, why: "ya definido a mano en crushrc (fuera del bloque de bond)" });
				continue;
			}
			managed.push(p.id);
			const key = p.api_key_env ? `"\${${p.api_key_env}}"` : "bond";
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

const codex: Target = {
	agent: "codex",
	needs: "responses",
	file: () => join(process.env.CODEX_HOME || join(HOME, ".codex"), "config.toml"),
	installed: () => !!which("codex"),
	verify: "codex -p <proveedor>-<modelo>",
	note: "Codex solo habla la API Responses; sin verificar con un Codex instalado",
	render(current, providers) {
		let body = "";
		for (const p of providers) {
			body += `[model_providers.${p.id}]\nname = ${tomlStr(p.name ?? p.id)}\nbase_url = ${tomlStr(p.base_url)}\nwire_api = "responses"\n`;
			if (p.api_key_env) body += `env_key = ${tomlStr(p.api_key_env)}\n`;
			for (const m of modelsFor(p, "codex")) {
				body += `\n[profiles.${tomlStr(`${p.id}-${m.id}`)}]\nmodel_provider = ${tomlStr(p.id)}\nmodel = ${tomlStr(m.id)}\n`;
				if (m.context) body += `model_context_window = ${m.context}\n`;
				if (m.max_output) body += `model_max_output_tokens = ${m.max_output}\n`;
			}
			body += "\n";
		}
		return { text: appendBlock(withoutBlock(current ?? ""), body), managed: providers.map((p) => p.id), skipped: [] };
	},
};

export const TARGETS: Target[] = [pi, opencode, crush, codex];

/** Agentes que no pueden usar una pasarela compatible con OpenAI, y por qué (para `models list`). */
export const INCOMPATIBLE: Record<string, string> = {
	claude: "Claude Code solo habla la API de Anthropic (/v1/messages)",
	gemini: "Gemini CLI solo habla la API de Gemini",
};

/** Lee el fichero actual siguiendo symlinks (el models.json de pi era un symlink al repo). */
export function readCurrent(file: string): string | undefined {
	try {
		return readFileSync(lstatSync(file).isSymbolicLink() ? realpathSync(file) : file, "utf8");
	} catch {
		return undefined;
	}
}
