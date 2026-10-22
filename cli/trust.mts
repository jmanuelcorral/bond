// Confianza heredada para los worktrees de bond team: si ya confías en el checkout principal,
// el worktree de una rama recibe la misma confianza en pi y en Claude Code, y su agente arranca
// sin preguntar. Nunca se da confianza que no tenías: sin ella, el agente pregunta como siempre.

import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { AGENT_DIR, HOME } from "./util.mts";

export interface TrustFiles {
	/** pi: ruta → true/false/null; vale la entrada más cercana subiendo carpetas. */
	pi: string;
	/** Claude Code: projects[ruta].hasTrustDialogAccepted. */
	claude: string;
}

export const trustFiles = (): TrustFiles => ({
	pi: join(AGENT_DIR, "trust.json"),
	claude: join(process.env.CLAUDE_CONFIG_DIR || HOME, ".claude.json"),
});

/** Agentes con confianza automática; el resto pregunta como siempre. */
export const TRUST_KINDS = ["pi", "claude"];

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

/** pi: si el checkout principal es de confianza, añade el worktree a trust.json. */
export function inheritPiTrust(main: string, worktree: string, file: string): TrustResult {
	if (!existsSync(file)) return "sin confianza";
	return withLock(file, () => {
		const original = readFileSync(file, "utf8");
		const data = readJson(file) ?? {};
		const entries = new Map(Object.entries(data).map(([k, v]) => [norm(k), v]));
		if (nearest(entries, main) !== true) return "sin confianza";
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
 * Claude Code: si el checkout principal o una carpeta superior tiene hasTrustDialogAccepted,
 * lo marca para el worktree. Claude reescribe ~/.claude.json mientras está abierto: se relee
 * justo antes de escribir y se escribe de forma atómica.
 */
export function inheritClaudeTrust(main: string, worktree: string, file: string): TrustResult {
	const original = existsSync(file) ? readFileSync(file, "utf8") : "";
	const data = original ? readJson(file) : undefined;
	const projects = data?.projects;
	if (!data || !projects || typeof projects !== "object") return "sin confianza";
	const byPath = projects as Record<string, { hasTrustDialogAccepted?: boolean } | undefined>;
	const accepted = new Map(Object.entries(byPath).map(([k, v]) => [norm(k), v?.hasTrustDialogAccepted === true ? true : undefined]));
	if (nearest(accepted, main) !== true) return "sin confianza";
	if (nearest(accepted, worktree) === true) return "ya la tenía";
	// La clave, con las barras de las que ya hay (Claude en Windows guarda C:/...).
	const key = Object.keys(byPath).some((k) => k.includes("\\")) ? worktree : norm(worktree);
	const existing = Object.entries(byPath).find(([k]) => norm(k) === norm(worktree));
	if (existing) byPath[existing[0]] = { ...existing[1], hasTrustDialogAccepted: true };
	else byPath[key] = claudeProject();
	writeJsonAtomic(file, data, original);
	return "heredada";
}

/** Confianza del checkout principal para el worktree, según el agente. */
export function inheritTrust(kind: string, main: string, worktree: string, files: TrustFiles = trustFiles()): TrustResult {
	if (kind === "pi") return inheritPiTrust(main, worktree, files.pi);
	if (kind === "claude") return inheritClaudeTrust(main, worktree, files.claude);
	return "no aplica";
}
