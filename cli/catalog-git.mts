// Catálogos del equipo por git: resolver una ref a su commit, descargar ese commit a la caché
// compartida (~/.bond/catalogs/<host>/<ruta>/<sha>/, solo los ficheros, sin .git) y el lock del
// repo (.bond/lock.json), que fija el commit de cada catálogo. Solo `bond catalog add` y
// `update` mueven el lock; sync descarga el commit fijado si falta en la caché.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BOND_HOME } from "./runtime.mts";
import { die, run } from "./util.mts";

export interface LockEntry {
	git: string;
	ref?: string;
	sha: string;
}

export interface Lock {
	catalogs: Record<string, LockEntry>;
}

const SHA = /^[0-9a-f]{40}$/;

/** ¿Es una URL de git (https, ssh, git, file o usuario@host:ruta) y no una carpeta? */
export const isGitUrl = (s: string) => /^(https?|ssh|git|file):\/\//.test(s) || /^[\w.-]+@[\w.-]+:/.test(s);

/**
 * Identidad de un repo, igual para sus URLs ssh y https: host/ruta, sin usuario, puerto,
 * .git ni barra final (git@github.com:acme/x.git = https://github.com/acme/x).
 */
export function gitKey(url: string): string {
	let host: string;
	let path: string;
	const scp = /^[\w.-]+@([\w.-]+):(?!\/\/)(.*)$/.exec(url);
	if (scp) [host, path] = [scp[1], scp[2]];
	else {
		const m = /^[a-z+]+:\/\/(?:[^@/]*@)?([^/:]*)(?::\d+)?(\/.*)?$/i.exec(url);
		if (!m) return url;
		[host, path] = [m[1] || "file", m[2] ?? ""];
	}
	path = path.replace(/\\/g, "/").replace(/\/+$/, "").replace(/\.git$/, "").replace(/^\/+/, "");
	return `${host.toLowerCase()}/${path}`;
}

const segment = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "_") || "_";
const cacheRoot = () => join(BOND_HOME, "catalogs");

/** Carpeta de la caché para un commit de un repo. */
export function cacheDir(url: string, sha: string): string {
	return join(cacheRoot(), ...gitKey(url).split("/").filter(Boolean).map(segment), sha);
}

// git sin preguntas: sin credenciales, falla en vez de esperar a que alguien escriba.
process.env.GIT_TERMINAL_PROMPT = "0";

function git(args: string[], cwd?: string) {
	return run("git", args, { cwd, timeout: 120_000 });
}

function needGit(): void {
	if (run("git", ["--version"]).status !== 0) die("hace falta git para los catálogos del equipo por URL (instálalo y vuelve a probar)");
}

/** Commit al que apunta una ref (tag, rama o sha) del repo; sin ref, su rama por defecto. */
export function resolveRef(url: string, ref?: string): string {
	if (ref && SHA.test(ref)) return ref;
	needGit();
	const r = git(["ls-remote", url, ...(ref ? [`refs/tags/${ref}`, `refs/tags/${ref}^{}`, `refs/heads/${ref}`] : ["HEAD"])]);
	if (r.status !== 0) die(`no se puede leer ${url}: ${(r.stderr || r.stdout).trim().split("\n").pop()}`);
	const refs = new Map(
		r.stdout
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((l) => l.split("\t") as [string, string])
			.map(([sha, name]) => [name, sha]),
	);
	if (!ref) return refs.get("HEAD") ?? die(`${url} no tiene rama por defecto: indica --ref`);
	// Un tag anotado apunta a su objeto; ^{} es el commit.
	const sha = refs.get(`refs/tags/${ref}^{}`) ?? refs.get(`refs/tags/${ref}`) ?? refs.get(`refs/heads/${ref}`);
	return sha ?? die(`no hay ningún tag ni rama "${ref}" en ${url}`);
}

/** Descarga un commit a la caché si no está, y devuelve su carpeta. */
export function ensureFetched(url: string, sha: string): string {
	const dest = cacheDir(url, sha);
	if (existsSync(dest)) return dest;
	needGit();
	const tmp = join(cacheRoot(), ".tmp", `${process.pid}-${Date.now()}`);
	const gitDir = join(tmp, "git");
	const work = join(tmp, "work");
	mkdirSync(work, { recursive: true });
	try {
		const g = (args: string[]) => git(["--git-dir", gitDir, ...args]);
		g(["init", "-q", "--bare"]);
		// Primero, solo ese commit; si el servidor no deja pedirlo por sha, todo y se busca.
		if (g(["fetch", "-q", "--depth", "1", url, sha]).status !== 0) {
			const all = g(["fetch", "-q", "--tags", url, "+refs/heads/*:refs/remotes/origin/*"]);
			if (all.status !== 0) die(`no se puede descargar ${url}: ${(all.stderr || all.stdout).trim().split("\n").pop()}`);
		}
		if (g(["cat-file", "-e", `${sha}^{commit}`]).status !== 0) die(`el commit ${sha.slice(0, 12)} no está en ${url} (¿se reescribió la historia? bond catalog update)`);
		const co = g(["--work-tree", work, "checkout", "-q", "-f", sha, "--", "."]);
		if (co.status !== 0) die(`no se puede extraer ${sha.slice(0, 12)} de ${url}: ${co.stderr.trim()}`);
		mkdirSync(dirname(dest), { recursive: true });
		// Otro proceso pudo llegar antes: la suya vale igual.
		if (!existsSync(dest)) renameSync(work, dest);
	} finally {
		try {
			rmSync(tmp, { recursive: true, force: true, maxRetries: 3 });
		} catch {
			// Una carpeta temporal que no se pudo borrar (Windows) no impide nada.
		}
	}
	return dest;
}

const lockPath = (root: string) => join(root, ".bond", "lock.json");

/** El lock del repo (vacío si no hay). Muere si no se puede leer: mejor que adivinar commits. */
export function readLock(root: string): Lock {
	const p = lockPath(root);
	if (!existsSync(p)) return { catalogs: {} };
	try {
		const raw = JSON.parse(readFileSync(p, "utf8")) as Partial<Lock>;
		const catalogs = raw.catalogs ?? {};
		for (const [n, e] of Object.entries(catalogs)) {
			if (typeof e?.git !== "string" || typeof e?.sha !== "string" || !SHA.test(e.sha)) throw new Error(`entrada ${n} incompleta`);
		}
		return { catalogs };
	} catch (e) {
		die(`.bond/lock.json no se puede leer (${(e as Error).message}): recupéralo de git o ejecuta bond catalog update`);
	}
}

/** Escribe el lock de una vez (fichero temporal y renombrar); sin catálogos git, lo borra. */
export function writeLock(root: string, lock: Lock): void {
	const p = lockPath(root);
	if (!Object.keys(lock.catalogs).length) {
		rmSync(p, { force: true });
		return;
	}
	const sorted = { catalogs: Object.fromEntries(Object.entries(lock.catalogs).sort(([a], [b]) => a.localeCompare(b))) };
	const tmp = `${p}.tmp-${process.pid}`;
	writeFileSync(tmp, `${JSON.stringify(sorted, null, 2)}\n`);
	renameSync(tmp, p);
}

/** Borra de la caché los commits que no estén en `keep`; devuelve cuántos borró. */
export function cleanCache(keep: Array<{ git: string; sha: string }>): number {
	const root = cacheRoot();
	if (!existsSync(root)) return 0;
	const kept = new Set(keep.map((k) => cacheDir(k.git, k.sha)));
	let removed = 0;
	const visit = (dir: string): void => {
		for (const e of readdirSync(dir, { withFileTypes: true })) {
			if (!e.isDirectory()) continue;
			const p = join(dir, e.name);
			if (SHA.test(e.name)) {
				if (!kept.has(p)) {
					rmSync(p, { recursive: true, force: true });
					removed++;
				}
			} else visit(p);
			if (existsSync(p) && !readdirSync(p).length) rmSync(p, { recursive: true });
		}
	};
	visit(root);
	return removed;
}
