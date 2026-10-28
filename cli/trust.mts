// Confianza heredada para los worktrees de bond team: si el orquestador (el agente que lanza el
// equipo) o el propio agente ya confía en el checkout principal, el worktree de una rama recibe esa
// confianza en pi, Claude Code y agy, y su agente arranca sin preguntar. Sin ninguna de las dos, el
// agente pregunta como siempre.

import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { AGENT_DIR, HOME } from "./util.mts";

export interface TrustFiles {
	/** pi: ruta → true/false/null; vale la entrada más cercana subiendo carpetas. */
	pi: string;
	/** Claude Code: projects[ruta].hasTrustDialogAccepted. */
	claude: string;
	/** agy (Antigravity): trustedWorkspaces, lista de rutas. */
	agy: string;
}

export const trustFiles = (): TrustFiles => ({
	pi: join(AGENT_DIR, "trust.json"),
	claude: join(process.env.CLAUDE_CONFIG_DIR || HOME, ".claude.json"),
	agy: join(HOME, ".gemini", "antigravity-cli", "settings.json"),
});

/** Agentes con confianza automática; el resto pregunta como siempre. */
export const TRUST_KINDS = ["pi", "claude", "agy"];

export type TrustResult = "heredada" | "ya la tenía" | "sin confianza" | "no aplica";

/** Misma ruta escrita con / o con \ (Windows): para comparar claves. */
const norm = (p: string) => p.replace(/\\/g, "/").replace(/(.)\/+$/, "$1");

/** Valor de la entrada de `p` o de la carpeta superior más cercana que tenga una. */
function nearest<T>(entries: Map<string, T>, p: string): T | undefined {
	for (let d = p; ; d = dirname(d)) {
		const v = entries.get(norm(d));
		if (v !== undefined) return v;
		if (dirname(d) === d) return undefined;
	}
}

const readJson = (file: string): Record<string, unknown> | undefined => {
	if (!existsSync(file)) return undefined;
	const data = JSON.parse(readFileSync(file, "utf8"));
	return data && typeof data === "object" && !Array.isArray(data) ? data : undefined;
};

/** Con la confianza avalada por el orquestador, un fichero que falta se crea con este contenido. */
function createJson(file: string, data: unknown): void {
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

/**
 * Escritura atómica: fichero temporal en la misma carpeta y rename, con los permisos del
 * original. Si es un enlace, se escribe su destino.
 */
function writeJsonAtomic(file: string, data: unknown, original: string): void {
	const real = realpathSync(file);
	const tmp = `${real}.bond-${process.pid}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(data, null, 2)}${original.endsWith("\n") ? "\n" : ""}`, { mode: statSync(real).mode & 0o777 });
	try {
		renameSync(tmp, real);
	} catch (e) {
		rmSync(tmp, { force: true });
		throw e;
	}
}

const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Con el cerrojo de pi (`trust.json.lock`) cogido: se crea con mkdir, que falla si ya existe
 * (como carpeta o como fichero). Uno de más de 10 s se da por abandonado.
 */
export function withLock<T>(file: string, fn: () => T, timeoutMs = 5000): T {
	const lock = `${file}.lock`;
	const until = Date.now() + timeoutMs;
	for (;;) {
		try {
			mkdirSync(lock);
			break;
		} catch (e) {
			if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
			try {
				if (Date.now() - statSync(lock).mtimeMs > 10_000) {
					rmSync(lock, { recursive: true, force: true });
					continue;
				}
			} catch {
				continue; // Lo acaban de soltar.
			}
			if (Date.now() > until) throw new Error(`${lock} sigue cogido: no toco la confianza de pi`);
			sleep(50);
		}
	}
	try {
		return fn();
	} finally {
		rmSync(lock, { recursive: true, force: true });
	}
}

/**
 * pi: si el checkout principal es de confianza (o `vouched`: el orquestador confía en él), añade
 * el worktree a trust.json.
 */
export function inheritPiTrust(main: string, worktree: string, file: string, vouched = false): TrustResult {
	if (!existsSync(file)) {
		if (!vouched) return "sin confianza";
		createJson(file, { [worktree]: true });
		return "heredada";
	}
	return withLock(file, () => {
		const original = readFileSync(file, "utf8");
		const data = readJson(file) ?? {};
		const entries = new Map(Object.entries(data).map(([k, v]) => [norm(k), v]));
		if (!vouched && nearest(entries, main) !== true) return "sin confianza";
		// Una decisión tuya sobre esa carpeta o una superior se respeta: no se confía por encima de un false.
		const current = nearest(entries, worktree);
		if (current === true) return "ya la tenía";
		if (current === false || entries.has(norm(worktree))) return "sin confianza";
		data[worktree] = true;
		writeJsonAtomic(file, data, original);
		return "heredada";
	});
}

/** Lo que Claude Code guarda para un proyecto nuevo, con la confianza ya dada. */
const claudeProject = () => ({
	allowedTools: [],
	mcpContextUris: [],
	mcpServers: {},
	enabledMcpjsonServers: [],
	disabledMcpjsonServers: [],
	hasTrustDialogAccepted: true,
	projectOnboardingSeenCount: 0,
});

/**
 * Claude Code: si el checkout principal o una carpeta superior tiene hasTrustDialogAccepted (o
 * `vouched`), lo marca para el worktree. Claude reescribe ~/.claude.json mientras está abierto: se
 * relee justo antes de escribir y se escribe de forma atómica. Sin ~/.claude.json no se crea:
 * Claude Code no se ha usado en esta máquina.
 */
export function inheritClaudeTrust(main: string, worktree: string, file: string, vouched = false): TrustResult {
	const original = existsSync(file) ? readFileSync(file, "utf8") : "";
	const data = original ? readJson(file) : undefined;
	if (data && vouched && data.projects === undefined) data.projects = {};
	const projects = data?.projects;
	if (!data || !projects || typeof projects !== "object") return "sin confianza";
	const byPath = projects as Record<string, { hasTrustDialogAccepted?: boolean } | undefined>;
	const accepted = new Map(Object.entries(byPath).map(([k, v]) => [norm(k), v?.hasTrustDialogAccepted === true ? true : undefined]));
	if (!vouched && nearest(accepted, main) !== true) return "sin confianza";
	if (nearest(accepted, worktree) === true) return "ya la tenía";
	// La clave, con las barras de las que ya hay (Claude en Windows guarda C:/...).
	const key = Object.keys(byPath).some((k) => k.includes("\\")) ? worktree : norm(worktree);
	const existing = Object.entries(byPath).find(([k]) => norm(k) === norm(worktree));
	if (existing) byPath[existing[0]] = { ...existing[1], hasTrustDialogAccepted: true };
	else byPath[key] = claudeProject();
	writeJsonAtomic(file, data, original);
	return "heredada";
}

/**
 * agy: si el checkout principal (o una carpeta superior) está en trustedWorkspaces (o `vouched`),
 * añade el worktree. Se relee justo antes de escribir y se escribe de forma atómica, como en Claude.
 */
export function inheritAgyTrust(main: string, worktree: string, file: string, vouched = false): TrustResult {
	if (vouched && !existsSync(file)) {
		createJson(file, { trustedWorkspaces: [norm(worktree)] });
		return "heredada";
	}
	const original = existsSync(file) ? readFileSync(file, "utf8") : "";
	const data = original ? readJson(file) : undefined;
	if (data && vouched && data.trustedWorkspaces === undefined) data.trustedWorkspaces = [];
	const list = data?.trustedWorkspaces;
	if (!data || !Array.isArray(list)) return "sin confianza";
	const trusted = new Map(list.filter((p): p is string => typeof p === "string").map((p) => [norm(p), true]));
	if (!vouched && nearest(trusted, main) !== true) return "sin confianza";
	// Solo cuenta la ruta exacta: no está comprobado que agy confíe en las subcarpetas.
	if (trusted.has(norm(worktree))) return "ya la tenía";
	data.trustedWorkspaces = [...list, list.some((p) => typeof p === "string" && p.includes("\\")) ? worktree : norm(worktree)];
	writeJsonAtomic(file, data, original);
	return "heredada";
}

/** ¿Confía `kind` en `dir`? Solo lee: es la confianza del orquestador en el checkout principal. */
export function trusts(kind: string, dir: string, files: TrustFiles = trustFiles()): boolean {
	try {
		if (kind === "pi") {
			const data = readJson(files.pi) ?? {};
			return nearest(new Map(Object.entries(data).map(([k, v]) => [norm(k), v])), dir) === true;
		}
		if (kind === "claude") {
			const projects = readJson(files.claude)?.projects;
			if (!projects || typeof projects !== "object") return false;
			const byPath = projects as Record<string, { hasTrustDialogAccepted?: boolean } | undefined>;
			return nearest(new Map(Object.entries(byPath).map(([k, v]) => [norm(k), v?.hasTrustDialogAccepted === true ? true : undefined])), dir) === true;
		}
		if (kind === "agy") {
			const list = readJson(files.agy)?.trustedWorkspaces;
			if (!Array.isArray(list)) return false;
			return nearest(new Map(list.filter((p): p is string => typeof p === "string").map((p) => [norm(p), true])), dir) === true;
		}
	} catch {
		// Un fichero ilegible no avala nada.
	}
	return false;
}

/**
 * Confianza para el worktree, según el agente: la del checkout principal en ese agente o, con
 * `vouched`, la del orquestador, que ya confía en el checkout principal.
 */
export function inheritTrust(kind: string, main: string, worktree: string, files: TrustFiles = trustFiles(), vouched = false): TrustResult {
	if (kind === "pi") return inheritPiTrust(main, worktree, files.pi, vouched);
	if (kind === "claude") return inheritClaudeTrust(main, worktree, files.claude, vouched);
	if (kind === "agy") return inheritAgyTrust(main, worktree, files.agy, vouched);
	return "no aplica";
}
