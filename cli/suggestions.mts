// Sugerencias de prompt de pi: ghost text con el siguiente prompt cuando el agente se asienta.
//
// Las pone la extensión @mrclrchtr/supi-prompt-suggestions (MIT, solo after-turn: editor vacío
// al terminar el turno). bond elige el modelo más barato de su registro, escribe el config de
// supi y se asegura de que pi tenga `enabledModels`: sin esa clave la extensión no ve ningún
// modelo seleccionable (getSelectableModels devuelve lista vacía) aunque el default de pi sea
// «todos los disponibles».
//
// El fichero de supi lo comparten varios paquetes de la suite: se fusiona, nunca se sustituye.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { activeProviders, type Config, type Model } from "./config.mts";
import { act, AGENT_DIR, run, which } from "./util.mts";

/** Paquete de pi con las sugerencias. El pin se actualiza al preparar la release. */
export const SUGGESTIONS_PACKAGE = "npm:@mrclrchtr/supi-prompt-suggestions@11.0.1";
/** Nombre npm sin versión: así se reconoce el paquete ya declarado en la config de pi. */
export const SUGGESTIONS_NAME = "@mrclrchtr/supi-prompt-suggestions";
/** Sección que lee la extensión dentro del config de supi. */
export const SUGGESTIONS_SECTION = "promptSuggestions";
/** Valor que apaga la extensión sin desinstalarla. */
export const DISABLED = "disabled";

/** Nombres que huelen a modelo barato y rápido para estar sugiriendo todo el rato. */
const CHEAP = ["haiku", "mini", "flash", "nano", "lite", "small", "1.5b", "3b", "3.2b", "3.8b"];

export interface SuggestionPaths {
	/** Config de la suite supi (global de pi). */
	supiConfig: string;
	/** settings.json personal de pi: de ahí sale enabledModels. */
	piSettings: string;
}

export const suggestionPaths = (agentDir: string = AGENT_DIR): SuggestionPaths => ({
	supiConfig: join(agentDir, "supi", "config.json"),
	piSettings: join(agentDir, "settings.json"),
});

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Lectura tolerante: fichero ausente o roto cuenta como null (lo señalará quien lo escriba). */
export function readJsonFile(path: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

/** ¿El modelo sirve para pi? Los restringidos a otros agentes quedan fuera. */
function usableForPi(m: Model): boolean {
	return !Array.isArray(m.agents) || m.agents.includes("pi");
}

function cheapScore(m: Model): number {
	const hay = `${m.id} ${m.name ?? ""}`.toLowerCase();
	const i = CHEAP.findIndex((t) => hay.includes(t));
	return i < 0 ? CHEAP.length : i;
}

/**
 * Modelo para sugerir: primero los de coste cero (proveedor `free`), dentro de ellos el de
 * nombre más barato; si no hay gratuitos, lo mismo sobre el resto. undefined si el registro
 * de bond no tiene nada que ofrecer a pi.
 */
export function pickSuggestionModel(cfg: Config): string | undefined {
	const providers = activeProviders(cfg);
	const free = providers.filter((p) => p.free === true);
	const pool = free.length ? free : providers;
	const scored = pool
		.flatMap((p) => p.models.filter(usableForPi).map((m) => ({ id: `${p.id}/${m.id}`, score: cheapScore(m) })))
		.sort((a, b) => a.score - b.score);
	return scored[0]?.id;
}

/** La sección de sugerencias dentro del config de supi, fusionando lo que ya hubiera. */
export function mergeSupiConfig(existing: Record<string, unknown> | null, model: string): Record<string, unknown> {
	const base = existing ?? {};
	const section = isRecord(base[SUGGESTIONS_SECTION]) ? { ...(base[SUGGESTIONS_SECTION] as Record<string, unknown>) } : {};
	section.model = model;
	return { ...base, [SUGGESTIONS_SECTION]: section };
}

/**
 * `enabledModels` de pi: se pone `["*"]` solo si no había una lista no vacía. Una lista
 * puesta por el usuario se respeta tal cual, aunque limite lo que se puede sugerir.
 */
export function withEnabledModels(settings: Record<string, unknown> | null): { settings: Record<string, unknown>; changed: boolean } {
	const base = settings ?? {};
	if (Array.isArray(base.enabledModels) && base.enabledModels.length > 0) return { settings: base, changed: false };
	return { settings: { ...base, enabledModels: ["*"] }, changed: true };
}

/** ¿El paquete ya está declarado en `packages` de la config de pi (forma string u objeto)? */
export function isPackageDeclared(settings: Record<string, unknown> | null, name: string = SUGGESTIONS_NAME): boolean {
	const pkgs = settings?.packages;
	if (!Array.isArray(pkgs)) return false;
	return pkgs.some((p) => {
		if (typeof p === "string") return p.includes(name);
		return isRecord(p) && typeof p.source === "string" && p.source.includes(name);
	});
}

/** El modelo que tiene puesto ahora mismo la extensión en el config de supi. */
export function readSupiModel(paths: SuggestionPaths = suggestionPaths()): string | undefined {
	const s = readJsonFile(paths.supiConfig);
	const section = s && isRecord(s[SUGGESTIONS_SECTION]) ? (s[SUGGESTIONS_SECTION] as Record<string, unknown>) : undefined;
	return typeof section?.model === "string" ? section.model : undefined;
}

/**
 * ¿`enabledModels` de pi permite este modelo? Admite `"*"`, `"proveedor/*"` y `"proveedor/modelo"`.
 * Sin lista (o vacía) no deja ninguno: es justo el caso que con `bond setup` se evita.
 */
export function enabledModelsCover(model: string, patterns: unknown): boolean {
	if (!Array.isArray(patterns) || patterns.length === 0) return false;
	return patterns.some((raw) => {
		if (typeof raw !== "string") return false;
		const p = raw.trim();
		if (p === "*") return true;
		if (p.endsWith("/*")) return model.startsWith(p.slice(0, -1));
		return p === model;
	});
}

/**
 * Otras extensiones locales que también reemplazan el editor de pi (`setEditorComponent`):
 * solo una puede estar activa, así que interesa saber si hay más. Mejor esfuerzo: se miran los
 * ficheros del directorio de extensiones de pi, no los paquetes npm de terceros.
 */
export function otherEditorExtensions(dir: string = join(AGENT_DIR, "extensions")): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isFile() || !/\.(ts|js|mjs|cjs)$/.test(entry.name)) continue;
		try {
			if (readFileSync(join(dir, entry.name), "utf8").includes("setEditorComponent")) out.push(entry.name);
		} catch {
			// Fichero ilegible: no se cuenta.
		}
	}
	return out;
}

/** Copia la versión anterior (.prev) antes de escribir, como hace saveConfig con config.toml. */
function writeJson(path: string, data: Record<string, unknown>): void {
	if (existsSync(path)) copyFileSync(path, `${path}.prev`);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

export interface InstallResult {
	ok: boolean;
	message: string;
}

/** Instala el paquete en el ámbito personal de pi. Sin pi o sin red: aviso, no fallo. */
export function installSuggestionsPackage(pkg: string = SUGGESTIONS_PACKAGE): InstallResult {
	const bin = which("pi");
	if (!bin) return { ok: false, message: "pi no está en el PATH" };
	const r = run(bin, ["install", pkg], { timeout: 180_000 });
	if (r.status !== 0) {
		const last = (r.stderr || r.stdout || "").trim().split("\n").filter(Boolean).pop() ?? `status ${r.status}`;
		return { ok: false, message: `pi install salió con ${r.status}: ${last}` };
	}
	return { ok: true, message: "" };
}

export interface SuggestionApplyResult {
	enabled: boolean;
	model?: string;
	/** El paquete quedó instalado en esta pasada o ya estaba declarado. */
	installed: boolean;
	/** Se puso enabledModels porque no estaba. */
	enabledModelsChanged: boolean;
	notes: string[];
}

/**
 * Aplica las sugerencias de prompt: config de supi fusionado, enabledModels de pi y el
 * paquete. Al desactivar solo se escribe `disabled` en supi: ni se instala ni se toca la
 * configuración de pi. Los fallos de instalación no cortan el setup.
 */
export function applySuggestions(
	cfg: Config,
	opts: { paths?: SuggestionPaths; install?: (pkg: string) => InstallResult } = {},
): SuggestionApplyResult {
	const paths = opts.paths ?? suggestionPaths();
	const notes: string[] = [];
	const enabled = cfg.suggestions?.enabled !== false;
	const model = enabled ? cfg.suggestions?.model || pickSuggestionModel(cfg) : DISABLED;

	if (enabled && !model) {
		return { enabled: false, installed: false, enabledModelsChanged: false, notes: ["el registro de bond no tiene modelos para pi: las sugerencias quedan sin activar"] };
	}
	const finalModel = model ?? DISABLED;

	// Al apagar no se toca la configuración de pi: solo queda disabled en el config de supi.
	if (!enabled) {
		act(`${paths.supiConfig}: ${SUGGESTIONS_SECTION}.model = ${DISABLED}`, () => {
			writeJson(paths.supiConfig, mergeSupiConfig(readJsonFile(paths.supiConfig), DISABLED));
		});
		return { enabled: false, model: DISABLED, installed: false, enabledModelsChanged: false, notes: [] };
	}

	const pi = withEnabledModels(readJsonFile(paths.piSettings));
	act(`enabledModels de pi: ${pi.changed ? '["*"] (no estaba puesto)' : "ya estaba puesto, se respeta"}`, () => {
		if (pi.changed) writeJson(paths.piSettings, pi.settings);
	});
	if (!pi.changed) notes.push("enabledModels de pi ya estaba puesto");

	act(`${paths.supiConfig}: ${SUGGESTIONS_SECTION}.model = ${finalModel}`, () => {
		writeJson(paths.supiConfig, mergeSupiConfig(readJsonFile(paths.supiConfig), finalModel));
	});

	const declared = isPackageDeclared(readJsonFile(paths.piSettings));
	let installed = declared;
	if (declared) notes.push(`${SUGGESTIONS_NAME} ya estaba declarado en la config de pi`);
	else {
		let res: InstallResult | undefined;
		act(`pi install ${SUGGESTIONS_PACKAGE}`, () => {
			res = (opts.install ?? installSuggestionsPackage)(SUGGESTIONS_PACKAGE);
		});
		if (res) {
			installed = res.ok;
			if (!res.ok) notes.push(res.message);
		}
	}

	return { enabled: true, model: finalModel, installed, enabledModelsChanged: pi.changed, notes };
}
