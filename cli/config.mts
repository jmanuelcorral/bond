// Configuración global de bond (~/.bond/config.toml) y su estado (state.json).
//
// config.toml lo escribe `bond setup` (y se puede editar a mano): agentes, agente por defecto,
// proveedores y modelos. Las claves no van aquí sino en ~/.bond/keys/ (ver keys.mts).
// state.json lo escribe bond: qué
// sirve cada pasarela (bond models probe) y qué claves gestiona en la config de cada agente,
// para poder quitar lo que ya no está sin tocar lo que no es suyo.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "smol-toml";
import { ICON_STYLES, type IconStyle } from "../lib/status-bar.mts";
import { LANGS, type Lang } from "../lib/lang.mts";
import { t } from "./messages.mts";
import { BOND_HOME } from "./runtime.mts";
import { die, HOME, log } from "./util.mts";

export const CONFIG_DIR = BOND_HOME;
export const CONFIG_FILE = join(CONFIG_DIR, "config.toml");
const STATE_FILE = join(CONFIG_DIR, "state.json");
/** Ubicación de bond 0.3-0.7: se migra sola a ~/.bond la primera vez. */
function legacyDir(): string {
	return join(process.env.XDG_CONFIG_HOME || join(HOME, ".config"), "bond");
}

let migrated = false;
function migrateLegacy(): void {
	if (migrated) return;
	migrated = true;
	const leg = legacyDir();
	const home = process.env.BOND_HOME || CONFIG_DIR;
	if (existsSync(join(home, "config.toml")) || !existsSync(join(leg, "config.toml"))) return;
	mkdirSync(home, { recursive: true });
	for (const f of ["config.toml", "state.json"]) {
		if (existsSync(join(leg, f))) copyFileSync(join(leg, f), join(home, f));
	}
	log(t("config.migrated", { from: leg, to: home }));
}

/** ¿Hay configuración global? */
export function configExists(): boolean {
	migrateLegacy();
	return existsSync(CONFIG_FILE);
}

/** APIs que puede servir una pasarela. */
export type Api = "chat" | "responses" | "messages";

/**
 * Resultado de probar una API en `bond models probe` (#76):
 * - `ok`: responde con contenido utilizable.
 * - `empty_reasoning`: 200 pero sin contenido util (típico de modelos razonadores
 *   cuyo presupuesto de tokens se va entero en `reasoning`).
 * - `fail`: fallo de transporte o HTTP != 2xx.
 */
export type ProbeApiStatus = "ok" | "empty_reasoning" | "fail";

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
	/** La clave está guardada en ~/.bond/keys/<id> (la pide `bond setup`). */
	key_stored?: boolean;
	/** Tipo de endpoint, informativo: ollama, lmstudio, openai, custom. */
	kind?: string;
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
	/** Agentes con los que bond se integra (los elige `bond setup`). */
	agents: string[];
	/** Agente que se propone por defecto en `bond init`. */
	default_agent?: string;
	/** Subcomando por defecto al ejecutar bond a secas: "app" o "dev". */
	default_command?: "app" | "dev";
	providers: Provider[];
	/** [update] auto = false: bond no pregunta al arrancar si hay versión nueva. */
	update?: { auto?: boolean };
	/** [suggestions] sugerencias de prompt de pi: modelo barato del registro y si van activas. */
	suggestions?: { enabled?: boolean; model?: string };
	/** [ui] icons: iconos del pie de pi; [ui] lang: idioma de la consola (los pregunta `bond setup`). */
	ui?: { icons?: IconStyle; lang?: Lang };
	/**
	 * [decisions] author: autoría fija para los registros de decisión (D12). Sin ella la
	 * autoría es el agente del panel de Herdr, que en un worktree delegado es un minion con
	 * nombre propio (MINIONS en team.mts) y no el orquestador con el que se habla. Se guarda
	 * tal cual: se valida al usarla, para que un valor malo no rompa `bond models`.
	 */
	decisions?: { author?: string };
}

/** Lo que recuerda el aviso de versión nueva al arrancar (ver offerUpdate en update.mts). */
export interface UpdateState {
	/** Última consulta a las releases (ISO); la siguiente, pasadas 24 h. */
	checkedAt?: string;
	/** Última release vista (vX.Y.Z). */
	latest?: string;
	/** Versión que se pidió omitir: no se vuelve a nombrar hasta que salga otra. */
	skipped?: string;
}

export interface State {
	probes: Record<string, { apis: Api[]; served: string[]; at: string; status?: Partial<Record<Api, ProbeApiStatus>> }>;
	/** Por agente: ids de proveedor que bond escribió la última vez. */
	managed: Record<string, string[]>;
	/** Ficheros de los que ya se guardó copia antes de tocarlos por primera vez. */
	backedUp: string[];
	update?: UpdateState;
}

export const CANONICAL_PROVIDERS_MSG = `proveedores en la forma [[providers]]: bond espera una tabla por proveedor, [providers.halo]
  cambia:
    [[providers]]
    id = "halo"
  por:
    [providers.halo]
    base_url = "https://..."`;

export function loadConfig(): Config {
	if (!configExists()) die(`no hay configuración global: ${CONFIG_FILE}\n  créala con: bond setup`);
	let raw: Record<string, unknown>;
	try {
		raw = parse(readFileSync(CONFIG_FILE, "utf8")) as Record<string, unknown>;
	} catch (e) {
		die(`${CONFIG_FILE} no es TOML válido: ${(e as Error).message}`);
	}
	if (Array.isArray(raw.providers) && raw.providers.length) die(CANONICAL_PROVIDERS_MSG);
	const providers: Provider[] = [];
	for (const [id, value] of Object.entries((raw.providers ?? {}) as Record<string, Record<string, unknown>>)) {
		if (/^\d+$/.test(id)) die(CANONICAL_PROVIDERS_MSG);
		if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) die(`proveedor '${id}': usa minúsculas, dígitos, - o _`);
		if (typeof value.base_url !== "string") die(`proveedor '${id}': falta base_url`);
		const p = { ...value, id, models: (value.models ?? []) as Model[] } as Provider;
		for (const m of p.models) if (typeof m.id !== "string") die(`proveedor '${id}': hay un modelo sin id`);
		providers.push(p);
	}
	return {
		agents: Array.isArray(raw.agents) ? (raw.agents as string[]) : [],
		default_agent: typeof raw.default_agent === "string" ? raw.default_agent : undefined,
		default_command: raw.default_command === "app" || raw.default_command === "dev" ? raw.default_command : undefined,
		providers,
		suggestions: readSuggestions(raw),
		ui: readUi(raw),
		decisions: readDecisions(raw),
	};
}

/** [suggestions] de config.toml; undefined si no hay sección o no dice nada útil. */
function readSuggestions(raw: Record<string, unknown>): Config["suggestions"] {
	if (!raw.suggestions || typeof raw.suggestions !== "object" || Array.isArray(raw.suggestions)) return undefined;
	const s = raw.suggestions as Record<string, unknown>;
	const out: { enabled?: boolean; model?: string } = {};
	if (typeof s.enabled === "boolean") out.enabled = s.enabled;
	if (typeof s.model === "string") out.model = s.model;
	return Object.keys(out).length ? out : undefined;
}

/** [ui] de config.toml; undefined si no hay sección o no dice nada útil. Un valor inválido se ignora. */
function readUi(raw: Record<string, unknown>): Config["ui"] {
	if (!raw.ui || typeof raw.ui !== "object" || Array.isArray(raw.ui)) return undefined;
	const ui = raw.ui as Record<string, unknown>;
	const out: NonNullable<Config["ui"]> = {};
	if (typeof ui.icons === "string" && ICON_STYLES.includes(ui.icons as IconStyle)) out.icons = ui.icons as IconStyle;
	if (typeof ui.lang === "string" && LANGS.includes(ui.lang as Lang)) out.lang = ui.lang as Lang;
	return Object.keys(out).length ? out : undefined;
}

/** [decisions] de config.toml; undefined si no hay sección o no dice nada útil. */
function readDecisions(raw: Record<string, unknown>): Config["decisions"] {
	if (!raw.decisions || typeof raw.decisions !== "object" || Array.isArray(raw.decisions)) return undefined;
	const d = raw.decisions as Record<string, unknown>;
	const out: { author?: string } = {};
	if (typeof d.author === "string" && d.author.trim()) out.author = d.author.trim();
	return Object.keys(out).length ? out : undefined;
}

/** Config vacía (primera vez) o la que haya. */
export function loadConfigOrEmpty(): Config {
	return configExists() ? loadConfig() : { agents: [], providers: [] };
}

const SAVED_HEADER = `# Configuración global de bond. La escribe \`bond setup\`; se puede editar a mano y
# aplicar con \`bond models sync\`. Las claves NO van aquí: están en ~/.bond/keys/.
`;

/** Guarda config.toml (los comentarios a mano se pierden; se guarda copia de la versión anterior). */
export function saveConfig(cfg: Config): void {
	mkdirSync(CONFIG_DIR, { recursive: true });
	if (existsSync(CONFIG_FILE)) copyFileSync(CONFIG_FILE, `${CONFIG_FILE}.prev`);
	const providers = Object.fromEntries(cfg.providers.map(({ id, ...rest }) => [id, rest]));
	const data: Record<string, unknown> = { agents: cfg.agents };
	if (cfg.default_agent) data.default_agent = cfg.default_agent;
	if (cfg.default_command) data.default_command = cfg.default_command;
	data.providers = providers;
	if (cfg.update) data.update = cfg.update;
	if (cfg.suggestions) data.suggestions = cfg.suggestions;
	if (cfg.ui) data.ui = cfg.ui;
	if (cfg.decisions) data.decisions = cfg.decisions;
	writeFileSync(CONFIG_FILE, `${SAVED_HEADER}\n${stringify(data)}\n`);
}

/** Proveedores y modelos activos. */
export function activeProviders(cfg: Config): Provider[] {
	return cfg.providers
		.filter((p) => p.enabled !== false)
		.map((p) => ({ ...p, models: p.models.filter((m) => m.enabled !== false) }))
		.filter((p) => p.models.length > 0);
}

export function loadState(): State {
	migrateLegacy();
	try {
		const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
		return { probes: s.probes ?? {}, managed: s.managed ?? {}, backedUp: s.backedUp ?? [], ...(s.update && { update: s.update }) };
	} catch {
		return { probes: {}, managed: {}, backedUp: [] };
	}
}

export function saveState(state: State): void {
	mkdirSync(CONFIG_DIR, { recursive: true });
	writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

/** ¿Pregunta bond al arrancar si hay versión nueva? ([update] auto; por defecto, sí). */
export function updateAuto(): boolean {
	if (!configExists()) return true;
	try {
		return (parse(readFileSync(CONFIG_FILE, "utf8")) as { update?: { auto?: unknown } }).update?.auto !== false;
	} catch {
		// Un config.toml roto lo señalan los comandos que lo usan; el arranque no se para aquí.
		return true;
	}
}

/**
 * Comprueba si hay indicios de una instalación previa de bond,
 * aunque no exista config.toml (por ejemplo si nunca se ejecutó bond setup
 * pero existen state.json, keys, events, catalogs, AGENTS.md, hubs.toml,
 * o la carpeta de configuración heredada previa a 1.11.0).
 */
export function hasExistingInstallEvidence(): boolean {
	migrateLegacy();
	const home = process.env.BOND_HOME || CONFIG_DIR;
	if (existsSync(join(home, "config.toml"))) return true;
	if (existsSync(join(home, "state.json"))) return true;
	if (existsSync(join(home, "AGENTS.md"))) return true;
	if (existsSync(join(home, "hubs.toml"))) return true;
	for (const sub of ["keys", "events", "catalogs"]) {
		const p = join(home, sub);
		if (existsSync(p)) {
			try {
				if (readdirSync(p).length > 0) return true;
			} catch {
				return true;
			}
		}
	}
	const leg = legacyDir();
	if (existsSync(join(leg, "config.toml")) || existsSync(join(leg, "state.json"))) return true;
	return false;
}

/**
 * Subcomando por defecto al ejecutar `bond` a secas:
 * - Si config.toml define `default_command`: ese valor ("app" o "dev").
 * - Si hay config.toml pero no define `default_command`: "dev" (instalación existente).
 * - Si no hay config.toml pero hay evidencia de instalación existente: "dev".
 * - Si es una instalación totalmente nueva (sin rastro previo de bond): "app".
 */
export function defaultCommand(): "app" | "dev" {
	const file = join(process.env.BOND_HOME || CONFIG_DIR, "config.toml");
	if (existsSync(file)) {
		try {
			const raw = parse(readFileSync(file, "utf8")) as Record<string, unknown>;
			if (raw.default_command === "app" || raw.default_command === "dev") return raw.default_command;
			return "dev";
		} catch {
			return "dev";
		}
	}
	if (hasExistingInstallEvidence()) return "dev";
	return "app";
}

/**
 * Pone `auto` en la tabla [update] de config.toml editando solo esas líneas: el resto del
 * fichero, comentarios incluidos, se queda como está. Si no hay config, la crea con esa tabla.
 */
export function setUpdateAuto(auto: boolean): void {
	migrateLegacy();
	mkdirSync(CONFIG_DIR, { recursive: true });
	const text = existsSync(CONFIG_FILE) ? readFileSync(CONFIG_FILE, "utf8") : "";
	const lines = text.split("\n");
	const start = lines.findIndex((l) => /^\s*\[update\]\s*(#.*)?$/.test(l));
	if (start < 0) {
		const body = text.trimEnd();
		writeFileSync(CONFIG_FILE, `${body ? `${body}\n\n` : ""}[update]\nauto = ${auto}\n`);
		return;
	}
	let end = lines.findIndex((l, i) => i > start && /^\s*\[/.test(l));
	if (end < 0) end = lines.length;
	const table = lines.slice(start + 1, end).filter((l) => !/^\s*auto\s*=/.test(l));
	writeFileSync(CONFIG_FILE, [...lines.slice(0, start + 1), `auto = ${auto}`, ...table, ...lines.slice(end)].join("\n"));
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
		const models: Array<Record<string, any>> = [...(p.models ?? []).map((m) => ({ ...m, enabled: true })), ...disabled.map((d) => ({ ...d, enabled: false }))];
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
