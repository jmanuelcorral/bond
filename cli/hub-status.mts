// Estado en vivo de los repos de una sesión de hub (cli/hub-status.mts): cambios sin
// commitear y commits por delante/detrás de su remoto. Es el cálculo compartido que
// `bond hub`, `bond hub check` y `bond hub pull` usaban cada uno por su cuenta.
//
// Regla (decidida para #42): el estado se calcula SIEMPRE contra las refs locales del
// remoto (p. ej. origin/main tal como están en disco), sin tocar la red. Quien quiera
// datos frescos hace un fetch explícito antes (`bond hub --fetch`); fetchRemote es
// esa llamada. Así `bond hub` es rápido y funciona offline, y la salida dice contra
// qué se está hablando.

import { run } from "./util.mts";

const git = (cwd: string, args: string[]) => run("git", ["-C", cwd, ...args]);

/** Cambios sin commitear: líneas de `git status --porcelain`. */
export const dirtyCount = (dir: string): number =>
	git(dir, ["status", "--porcelain"]).stdout.split("\n").filter(Boolean).length;

/** Upstream configurado de `base` (p. ej. "origin/main"); undefined si no tiene. */
export const upstreamOf = (dir: string, base: string): string | undefined => {
	const r = git(dir, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", `${base}@{upstream}`]);
	return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : undefined;
};

/** Commits de `base` por delante y por detrás de `upstream`; undefined si no se puede comparar. */
export const aheadBehind = (dir: string, base: string, upstream: string): { ahead: number; behind: number } | undefined => {
	const r = git(dir, ["rev-list", "--left-right", "--count", `${base}...${upstream}`]);
	if (r.status !== 0) return undefined;
	const [ahead = 0, behind = 0] = r.stdout.trim().split(/\s+/).map(Number);
	return { ahead, behind };
};

/** Remoto desde el que traer `base`: el de su config, el de su upstream o el primero del repo. */
export const remoteOf = (dir: string, base: string): string | undefined => {
	const cfg = git(dir, ["config", `branch.${base}.remote`]).stdout.trim();
	if (cfg) return cfg;
	const up = upstreamOf(dir, base);
	if (up?.includes("/")) return up.split("/")[0];
	return git(dir, ["remote"]).stdout.split("\n").filter(Boolean)[0];
};

/** `git fetch` de un remoto; dice si fue bien. */
export const fetchRemote = (dir: string, remote: string): boolean =>
	git(dir, ["fetch", "--quiet", remote]).status === 0;

export interface RepoState {
	/** Cambios sin commitear. */
	dirty: number;
	/** Upstream resuelto de la base; undefined si la base no apunta a ningún remoto. */
	upstream?: string;
	/** Commits de la base por delante/detrás del upstream, según las refs locales. */
	ahead?: number;
	behind?: number;
	/** ¿Se hizo `git fetch` con éxito antes de calcular? false = último fetch conocido. */
	fetched: boolean;
	/** Se pidió fetch y falló (sin remoto no se pide: no es un fallo). */
	fetchFailed?: boolean;
}

/**
 * Estado en vivo de un repo en disco: cambios sin commitear y base contra su upstream.
 * Con `fetch: true` hace antes `git fetch` del remoto de la base para dar el dato fresco.
 */
export function repoState(dir: string, base: string, opts: { fetch?: boolean } = {}): RepoState {
	const st: RepoState = { dirty: dirtyCount(dir), fetched: false };
	if (opts.fetch) {
		const remote = remoteOf(dir, base);
		if (remote !== undefined) {
			st.fetched = fetchRemote(dir, remote);
			if (!st.fetched) st.fetchFailed = true;
		}
	}
	const upstream = upstreamOf(dir, base);
	if (!upstream) return st;
	st.upstream = upstream;
	const ab = aheadBehind(dir, base, upstream);
	if (ab) {
		st.ahead = ab.ahead;
		st.behind = ab.behind;
	}
	return st;
}
