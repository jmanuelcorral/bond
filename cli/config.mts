// Configuración global de bond (~/.config/bond/config.toml) y su estado (state.json).
//
// config.toml lo edita el usuario: proveedores y modelos. state.json lo escribe bond: qué
// sirve cada pasarela (bond models probe) y qué claves gestiona en la config de cada agente,
// para poder quitar lo que ya no está sin tocar lo que no es suyo.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "smol-toml";
import { die, HOME } from "./util.mts";

export const CONFIG_DIR = join(process.env.XDG_CONFIG_HOME || join(HOME, ".config"), "bond");
export const CONFIG_FILE = join(CONFIG_DIR, "config.toml");
const STATE_FILE = join(CONFIG_DIR, "state.json");

/** APIs que puede servir una pasarela. */
export type Api = "chat" | "responses" | "messages";

export interface Model {
	id: string;
	name?: string;
	context?: number;
	max_output?: number;
	reasoning?: boolean;
	input?: string[];
	enabled?: boolean;
	/** Si se indica, solo estos agentes reciben el modelo. */
	agents?: string[];
}

export interface Provider {
	id: string;
	name?: string;
	base_url: string;
	/** Nombre de la variable de entorno con la clave; nunca la clave. */
	api_key_env?: string;
	/** APIs que sirve; si falta, se usa lo que detectó `bond models probe` (o "chat"). */
	apis?: Api[];
	/** Modelos propios sin coste: pi no simula gasto. */
	free?: boolean;
	enabled?: boolean;
	models: Model[];
	/** Ajustes extra para un agente concreto, copiados tal cual (p. ej. pi.compat). */
	pi?: Record<string, unknown>;
}

export interface Config {
	providers: Provider[];
}

export interface State {
	probes: Record<string, { apis: Api[]; served: string[]; at: string }>;
	/** Por agente: ids de proveedor que bond escribió la última vez. */
	managed: Record<string, string[]>;
	/** Ficheros de los que ya se guardó copia antes de tocarlos por primera vez. */
	backedUp: string[];
}

export function loadConfig(): Config {
	if (!existsSync(CONFIG_FILE)) die(`no hay configuración global: ${CONFIG_FILE}\n  créala con: bond models init`);
	let raw: Record<string, unknown>;
	try {
		raw = parse(readFileSync(CONFIG_FILE, "utf8")) as Record<string, unknown>;
	} catch (e) {
		die(`${CONFIG_FILE} no es TOML válido: ${(e as Error).message}`);
	}
	const providers: Provider[] = [];
	for (const [id, value] of Object.entries((raw.providers ?? {}) as Record<string, Record<string, unknown>>)) {
		if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) die(`proveedor '${id}': usa minúsculas, dígitos, - o _`);
		if (typeof value.base_url !== "string") die(`proveedor '${id}': falta base_url`);
		const p = { ...value, id, models: (value.models ?? []) as Model[] } as Provider;
		for (const m of p.models) if (typeof m.id !== "string") die(`proveedor '${id}': hay un modelo sin id`);
		providers.push(p);
	}
	return { providers };
}

/** Proveedores y modelos activos. */
export function activeProviders(cfg: Config): Provider[] {
	return cfg.providers
		.filter((p) => p.enabled !== false)
		.map((p) => ({ ...p, models: p.models.filter((m) => m.enabled !== false) }))
		.filter((p) => p.models.length > 0);
}

export function loadState(): State {
	try {
		const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
		return { probes: s.probes ?? {}, managed: s.managed ?? {}, backedUp: s.backedUp ?? [] };
	} catch {
		return { probes: {}, managed: {}, backedUp: [] };
	}
}

export function saveState(state: State): void {
	mkdirSync(CONFIG_DIR, { recursive: true });
	writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

/** APIs de un proveedor: las declaradas, si no las detectadas, si no "chat". */
export function providerApis(p: Provider, state: State): Api[] {
	return p.apis ?? state.probes[p.id]?.apis ?? ["chat"];
}

// --- bond models init ----------------------------------------------------------------

const HEADER = `# Configuración global de bond: los modelos a los que tienen acceso tus agentes.
#
# Tras editarla:
#   bond models probe   # qué APIs sirve cada pasarela (chat, responses, messages)
#   bond models sync    # genera la configuración de modelos de cada agente
#
# Nunca pongas aquí una clave: api_key_env es el NOMBRE de la variable de entorno.
# Referencia: docs/reference.md (sección "Modelos globales").
`;

const EXAMPLE = `
# Ejemplo: una pasarela compatible con OpenAI (llama-swap, vLLM, Ollama...).
# [providers.halo]
# name = "Halo (local)"
# base_url = "http://halo.example/v1"
# free = true
#
# [[providers.halo.models]]
# id = "flash-halogen"
# name = "Flash Halogen"
# context = 131072
# max_output = 8192
# reasoning = true
`;

const tomlValue = (v: unknown): string => {
	if (typeof v === "string") return JSON.stringify(v);
	if (Array.isArray(v)) return `[${v.map(tomlValue).join(", ")}]`;
	return String(v);
};

/**
 * Objetos JSON que están comentados con // (así desactivaba modelos el models.json de pi):
 * se quitan los // y se recorren las llaves para sacar cada objeto completo.
 */
function commentedObjects(text: string): Array<Record<string, unknown>> {
	const body = text
		.split("\n")
		.filter((l) => /^\s*\/\//.test(l))
		.map((l) => l.replace(/^\s*\/\/ ?/, ""))
		.join("\n");
	const out: Array<Record<string, unknown>> = [];
	let depth = 0;
	let start = -1;
	for (let i = 0; i < body.length; i++) {
		if (body[i] === "{") {
			if (depth === 0) start = i;
			depth++;
		} else if (body[i] === "}" && depth > 0 && --depth === 0) {
			try {
				out.push(JSON.parse(body.slice(start, i + 1)));
			} catch {
				// Comentario que no es un objeto JSON completo: se ignora.
			}
		}
	}
	return out;
}

/**
 * config.toml inicial. Si hay un models.json de pi (el de antes de bond), importa sus
 * proveedores, incluidos los modelos que estaban comentados con //, como desactivados.
 */
export function initialConfig(piModelsPath?: string): string {
	if (!piModelsPath || !existsSync(piModelsPath)) return HEADER + EXAMPLE;
	const text = readFileSync(piModelsPath, "utf8");
	const json = JSON.parse(text.replace(/^\s*\/\/.*$/gm, "")) as {
		providers?: Record<string, { name?: string; baseUrl: string; api?: string; compat?: Record<string, unknown>; models?: Array<Record<string, unknown>> }>;
	};
	const disabled = commentedObjects(text).filter((o) => typeof o.id === "string");

	let out = HEADER;
	for (const [id, p] of Object.entries(json.providers ?? {})) {
		out += `\n[providers.${id}]\n`;
		if (p.name) out += `name = ${tomlValue(p.name)}\n`;
		out += `base_url = ${tomlValue(p.baseUrl)}\n`;
		const free = (p.models ?? []).every((m) => {
			const c = m.cost as Record<string, number> | undefined;
			return !c || Object.values(c).every((x) => x === 0);
		});
		if (free) out += "free = true\n";
		const models = [...(p.models ?? []).map((m) => ({ ...m, enabled: true })), ...disabled.map((d) => ({ ...d, enabled: false }))];
		for (const m of models) {
			out += `\n${m.enabled ? "" : "# Desactivado: no estaba activo en el models.json de pi.\n"}[[providers.${id}.models]]\n`;
			out += `id = ${tomlValue(m.id)}\n`;
			if (m.name) out += `name = ${tomlValue(m.name)}\n`;
			if (m.contextWindow) out += `context = ${m.contextWindow}\n`;
			if (m.maxTokens) out += `max_output = ${m.maxTokens}\n`;
			if (m.reasoning !== undefined) out += `reasoning = ${m.reasoning}\n`;
			if (m.input) out += `input = ${tomlValue(m.input)}\n`;
			if (!m.enabled) out += "enabled = false\n";
		}
		if (p.api || p.compat) {
			out += `\n# Ajustes que solo usa pi (se copian tal cual a ~/.pi/agent/models.json).\n[providers.${id}.pi]\n`;
			if (p.api) out += `api = ${tomlValue(p.api)}\n`;
			if (p.compat) {
				out += `\n[providers.${id}.pi.compat]\n`;
				for (const [k, v] of Object.entries(p.compat)) out += `${k} = ${tomlValue(v)}\n`;
			}
		}
	}
	return out;
}
