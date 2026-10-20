// Utilidades comunes de la CLI: salida, modo --dry-run, ejecución de comandos y symlinks.

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const HOME = homedir();
export const AGENT_DIR = process.env.PI_CODING_AGENT_DIR || join(HOME, ".pi", "agent");

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string, s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);

export const log = (msg: string) => console.log(`${paint("1;36", "==>")} ${msg}`);
export const warn = (msg: string) => console.error(`${paint("1;33", "aviso:")} ${msg}`);
export function die(msg: string, code = 1): never {
	console.error(`${paint("1;31", "error:")} ${msg}`);
	process.exit(code);
}
export const dim = (s: string) => paint("2", s);
export const ok = (s: string) => paint("32", s);
export const bad = (s: string) => paint("31", s);
export const caution = (s: string) => paint("33", s);

let dryRun = false;
export const setDryRun = (v: boolean) => {
	dryRun = v;
};
export const isDryRun = () => dryRun;

/** Ejecuta una acción que cambia algo, o la describe en --dry-run. */
export function act(description: string, fn: () => void): void {
	if (dryRun) console.log(`    ${dim("[dry-run]")} ${description}`);
	else fn();
}

export interface RunResult {
	status: number;
	stdout: string;
	stderr: string;
}

/** Ejecuta un comando sin shell y devuelve su salida; status 127 si no existe. */
export function run(cmd: string, args: string[] = [], opts: { cwd?: string; timeout?: number; input?: string } = {}): RunResult {
	const r = spawnSync(cmd, args, { encoding: "utf8", cwd: opts.cwd, timeout: opts.timeout ?? 60_000, input: opts.input });
	if (r.error) return { status: 127, stdout: "", stderr: String(r.error.message) };
	return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** Ejecuta un comando que cambia algo (respeta --dry-run) y falla si no termina bien. */
export function runAct(cmd: string, args: string[], opts: { cwd?: string } = {}): void {
	act([cmd, ...args].join(" "), () => {
		const r = spawnSync(cmd, args, { stdio: "inherit", cwd: opts.cwd });
		if (r.status !== 0) die(`falló: ${cmd} ${args.join(" ")}`);
	});
}

/**
 * Ruta del ejecutable en el PATH, o undefined. En Windows los ejecutables llevan extensión
 * (claude.exe, codex.cmd...): se prueban las de PATHEXT.
 */
export function which(cmd: string, env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): string | undefined {
	const win = platform === "win32";
	const exts = win ? [...(env.PATHEXT || ".COM;.EXE;.BAT;.CMD").toLowerCase().split(";").filter(Boolean), ""] : [""];
	for (const dir of (env.PATH ?? env.Path ?? "").split(win ? ";" : ":")) {
		if (!dir) continue;
		for (const ext of exts) {
			const p = join(dir, cmd + ext);
			if (existsSync(p) && !statSync(p).isDirectory()) return p;
		}
	}
	return undefined;
}

// Hora local, como `date +%Y%m%d-%H%M%S`.
const now = new Date();
const p2 = (n: number) => String(n).padStart(2, "0");
export const STAMP = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}-${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`;

const exists = (p: string) => {
	try {
		lstatSync(p);
		return true;
	} catch {
		return false;
	}
};

function samePath(a: string, b: string): boolean {
	try {
		return realpathSync(a) === realpathSync(b);
	} catch {
		return false;
	}
}

/** ¿Es un symlink cuyo destino ya no existe (p. ej. tras mover el repo)? */
export function brokenLink(p: string): boolean {
	try {
		return lstatSync(p).isSymbolicLink() && !existsSync(p);
	} catch {
		return false;
	}
}

/** Deja `dest` como symlink a `src`; lo que hubiera antes se guarda como .bak.<fecha>. */
export function linkPath(src: string, dest: string): void {
	if (exists(dest) && lstatSync(dest).isSymbolicLink() && samePath(dest, src)) {
		log(`ya enlazado: ${dest}`);
		return;
	}
	if (brokenLink(dest)) {
		// Un enlace roto no guarda nada: se sustituye sin copia.
		act(`rm ${dest}`, () => rmSync(dest));
	} else if (exists(dest)) {
		warn(`${dest} ya existe; lo guardo como ${basename(dest)}.bak.${STAMP}`);
		act(`mv ${dest} ${dest}.bak.${STAMP}`, () => renameSync(dest, `${dest}.bak.${STAMP}`));
	}
	act(`ln -s ${src} ${dest}`, () => symlinkSync(src, dest));
	log(`enlazado: ${dest} -> ${src}`);
}

/** Marca de las carpetas que copia bond (donde no enlaza): se pueden sustituir sin copia .bak. */
export const COPY_MARK = ".bond-copy";

function files(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
}

/** ¿`dest` es una copia de bond con los mismos ficheros que `src`? */
export function isCopyOf(src: string, dest: string): boolean {
	if (!existsSync(join(dest, COPY_MARK))) return false;
	try {
		const want = files(src).map((f) => relative(src, f));
		const have = files(dest).map((f) => relative(dest, f)).filter((f) => f !== COPY_MARK);
		return want.length === have.length && want.every((f) => readFileSync(join(src, f)).equals(readFileSync(join(dest, f))));
	} catch {
		return false;
	}
}

/**
 * Deja en `dest` una copia de la carpeta `src`, para Windows, donde un symlink pide permisos
 * especiales. Una copia anterior de bond se sustituye; cualquier otra cosa se guarda como .bak.<fecha>.
 */
export function copyPath(src: string, dest: string): void {
	if (isCopyOf(src, dest)) {
		log(`ya copiado: ${dest}`);
		return;
	}
	if (brokenLink(dest) || existsSync(join(dest, COPY_MARK))) {
		act(`rm -r ${dest}`, () => rmSync(dest, { recursive: true, force: true }));
	} else if (exists(dest)) {
		warn(`${dest} ya existe; lo guardo como ${basename(dest)}.bak.${STAMP}`);
		act(`mv ${dest} ${dest}.bak.${STAMP}`, () => renameSync(dest, `${dest}.bak.${STAMP}`));
	}
	act(`cp -r ${src} ${dest}`, () => {
		cpSync(src, dest, { recursive: true });
		writeFileSync(join(dest, COPY_MARK), `copia de bond: ${src}\n`);
	});
	log(`copiado: ${dest} <- ${src}`);
}

/** Destino de un symlink, o undefined si no lo es. */
export function linkTarget(p: string): string | undefined {
	try {
		return lstatSync(p).isSymbolicLink() ? readlinkSync(p) : undefined;
	} catch {
		return undefined;
	}
}

export { exists, samePath };
