// bond hub: prepara y gestiona un repo hub (un repo compartido que agrupa varios repos,
// p. ej. frontend y backend) para trabajar en sesión. La sesión la forman el hub y sus repos,
// declarados en hub.toml, cada uno con su rama base y su modo de enlace (submodule o symlink).
// Lo propio de cada máquina va en .bond/hub.local.toml.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parse } from "smol-toml";
import { canonical, catchDie, die, dim, HOME, log, run, warn } from "./util.mts";

export const HUB_HELP = `Uso: bond hub [opciones]

Un hub es un repo git compartido que agrupa varios repos (p. ej. frontend y backend)
declarados en hub.toml, cada uno como submódulo o como enlace (symlink) a un clon local.
La sesión la forman el hub y sus repos, cada uno con su rama base y su modo de enlace.
Lo propio de cada máquina va en .bond/hub.local.toml.

  bond hub        Enseña la sesión del hub: repos, ruta, base, enlace y rama actual
`;

const git = (cwd: string, args: string[]) => run("git", ["-C", cwd, ...args]);

/** Raíz del repo de `dir`, o undefined fuera de un repo. */
const toplevel = (dir: string) => {
	const r = git(dir, ["rev-parse", "--show-toplevel"]);
	return r.status === 0 && r.stdout.trim() ? canonical(r.stdout.trim()) : undefined;
};

/** Superproyecto del repo `root` (si es un submódulo), o undefined. */
const superproject = (root: string) => {
	const r = git(root, ["rev-parse", "--show-superproject-working-tree"]);
	return r.status === 0 && r.stdout.trim() ? canonical(r.stdout.trim()) : undefined;
};

/** El repo de `dir` y sus superproyectos, de dentro hacia fuera. */
function repoChain(dir: string): string[] {
	const out: string[] = [];
	for (let r = toplevel(dir); r && !out.includes(r); r = superproject(r)) out.push(r);
	return out;
}

/** Rama actual de un repo, o undefined en HEAD separado (lo normal en un submódulo). */
export const currentBranch = (dir: string) => {
	const r = git(dir, ["symbolic-ref", "--short", "-q", "HEAD"]);
	return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : undefined;
};

export interface HubRepo {
	/** Ruta relativa al hub con / ("." para el propio hub). */
	path: string;
	/** Carpeta del repo. */
	dir: string;
	base: string;
	/** Rama actual; undefined en HEAD separado. */
	branch?: string;
	/** ¿Está el repo en disco? (un submódulo que se desinicializó o symlink roto no lo está) */
	present: boolean;
	/** Modo de enlace: "submodule" o "symlink" (undefined para "."). */
	link?: "submodule" | "symlink";
	/** URL del repo remoto (si se declaró en hub.toml). */
	url?: string;
	/** Ruta al clon local (para link = "symlink", de .bond/hub.local.toml). */
	source?: string;
	/** Agente por defecto para este repo en el hub (si se declaró en hub.toml). */
	agent?: string;
}

export interface HubSession {
	root: string;
	name: string;
	/** El hub primero (".") y después sus repos por ruta. */
	repos: HubRepo[];
}

export interface HubTomlRepo {
	path: string;
	base: string;
	link: "submodule" | "symlink";
	url?: string;
	agent?: string;
}

export interface HubToml {
	name: string;
	base: string;
	repos: Record<string, HubTomlRepo>;
}

export interface HubLocalToml {
	repos: Record<string, { source?: string }>;
}

/** ¿Ruta relativa dentro del repo, con / y sin ..? Así se guardan en hub.toml. */
export const insidePath = (p: string) => p !== "" && p !== "." && !isAbsolute(p) && !/^[A-Za-z]:/.test(p) && !p.includes("\\") && !p.split("/").some((x) => x === ".." || x === "");

/** Valida y devuelve el contenido de un hub.toml. Muere con un mensaje claro si no es válido. */
export function parseHubToml(text: string, pathForError = "hub.toml"): HubToml {
	let raw: Record<string, unknown>;
	try {
		raw = parse(text) as Record<string, unknown>;
	} catch (e) {
		die(`${pathForError} no es TOML válido: ${(e as Error).message}`);
	}
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		die(`${pathForError} tiene que ser una tabla: define name, base y [repos]`);
	}
	if (typeof raw.name !== "string" || !raw.name.trim()) {
		die(`${pathForError}: falta name (el nombre del hub, p. ej. name = "mi-hub")`);
	}
	if (typeof raw.base !== "string" || !raw.base.trim()) {
		die(`${pathForError}: falta base (la rama base del hub, p. ej. base = "main")`);
	}
	const reposRaw = raw.repos;
	if (reposRaw !== undefined && (typeof reposRaw !== "object" || reposRaw === null || Array.isArray(reposRaw))) {
		die(`${pathForError}: repos tiene que ser una tabla de repositorios: [repos.<nombre>]`);
	}
	const repos: Record<string, HubTomlRepo> = {};
	const seenPaths = new Set<string>();
	for (const [key, val] of Object.entries((reposRaw ?? {}) as Record<string, unknown>)) {
		if (typeof val !== "object" || val === null || Array.isArray(val)) {
			die(`${pathForError}: repos.${key} tiene que ser una tabla: [repos.${key}]`);
		}
		const r = val as Record<string, unknown>;
		if (typeof r.path !== "string" || !r.path.trim()) {
			die(`${pathForError}: repos.${key} necesita path (la ruta dentro del hub, con /)`);
		}
		const path = r.path.trim().replace(/\\/g, "/");
		if (!insidePath(path)) {
			die(`${pathForError}: repos.${key}.path tiene que ser una ruta relativa dentro del hub, con / y sin ..`);
		}
		if (seenPaths.has(path)) {
			die(`${pathForError}: la ruta "${path}" está repetida en repos`);
		}
		seenPaths.add(path);
		if (typeof r.base !== "string" || !r.base.trim()) {
			die(`${pathForError}: repos.${key} necesita base (la rama base del repo)`);
		}
		const link = r.link;
		if (link !== "submodule" && link !== "symlink") {
			die(`${pathForError}: repos.${key}.link tiene que ser "submodule" o "symlink"`);
		}
		if (r.url !== undefined && (typeof r.url !== "string" || !r.url.trim())) {
			die(`${pathForError}: repos.${key}.url tiene que ser una cadena`);
		}
		if (r.agent !== undefined && (typeof r.agent !== "string" || !r.agent.trim())) {
			die(`${pathForError}: repos.${key}.agent tiene que ser una cadena`);
		}
		repos[key] = {
			path,
			base: (r.base as string).trim(),
			link,
			url: typeof r.url === "string" ? r.url.trim() : undefined,
			agent: typeof r.agent === "string" ? r.agent.trim() : undefined,
		};
	}
	return {
		name: (raw.name as string).trim(),
		base: (raw.base as string).trim(),
		repos,
	};
}

/** Valida y devuelve el contenido de un .bond/hub.local.toml. */
export function parseHubLocalToml(text: string, pathForError = ".bond/hub.local.toml"): HubLocalToml {
	let raw: Record<string, unknown>;
	try {
		raw = parse(text) as Record<string, unknown>;
	} catch (e) {
		die(`${pathForError} no es TOML válido: ${(e as Error).message}`);
	}
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		die(`${pathForError} tiene que ser una tabla: [repos.<nombre>]`);
	}
	const reposRaw = raw.repos;
	if (reposRaw !== undefined && (typeof reposRaw !== "object" || reposRaw === null || Array.isArray(reposRaw))) {
		die(`${pathForError}: repos tiene que ser una tabla: [repos.<nombre>]`);
	}
	const repos: Record<string, { source?: string }> = {};
	for (const [key, val] of Object.entries((reposRaw ?? {}) as Record<string, unknown>)) {
		if (typeof val !== "object" || val === null || Array.isArray(val)) {
			die(`${pathForError}: repos.${key} tiene que ser una tabla`);
		}
		const r = val as Record<string, unknown>;
		if (r.source !== undefined && (typeof r.source !== "string" || !r.source.trim())) {
			die(`${pathForError}: repos.${key}.source tiene que ser una ruta`);
		}
		repos[key] = { source: typeof r.source === "string" ? r.source.trim() : undefined };
	}
	return { repos };
}

/** Expande ~ a HOME y resuelve rutas relativas al hub. */
function expandSource(source: string, hubRoot: string): string {
	if (source.startsWith("~/") || source === "~") {
		return join(HOME, source.slice(source === "~" ? 1 : 2));
	}
	if (isAbsolute(source)) return source;
	return resolve(hubRoot, source);
}

/** La sesión de un hub según su hub.toml (y .bond/hub.local.toml si existe). undefined sin hub.toml. */
export function hubSession(root: string): HubSession | undefined {
	const tomlPath = join(root, "hub.toml");
	if (!existsSync(tomlPath)) return undefined;
	const text = readFileSync(tomlPath, "utf8");
	const hubToml = parseHubToml(text, relative(process.cwd(), tomlPath) || "hub.toml");

	const localPath = join(root, ".bond", "hub.local.toml");
	let localToml: HubLocalToml | undefined;
	if (existsSync(localPath)) {
		const localText = readFileSync(localPath, "utf8");
		localToml = parseHubLocalToml(localText, relative(process.cwd(), localPath) || ".bond/hub.local.toml");
	}

	const hubSelf: HubRepo = {
		path: ".",
		dir: root,
		base: hubToml.base,
		branch: currentBranch(root),
		present: true,
	};

	const subs: HubRepo[] = [];
	for (const [key, entry] of Object.entries(hubToml.repos).sort((a, b) => a[1].path.localeCompare(b[1].path))) {
		const dir = join(root, ...entry.path.split("/"));
		const present = existsSync(join(dir, ".git"));
		const rawSource = localToml?.repos[key]?.source ?? localToml?.repos[entry.path]?.source;
		const source = rawSource ? expandSource(rawSource, root) : undefined;
		subs.push({
			path: entry.path,
			dir,
			base: entry.base,
			link: entry.link,
			branch: present ? currentBranch(dir) : undefined,
			present,
			url: entry.url,
			source,
			agent: entry.agent,
		});
	}

	return {
		root,
		name: hubToml.name,
		repos: [hubSelf, ...subs],
	};
}

/** Ubicación del registro global ~/.bond/hubs.toml */
export const hubsPath = () => join(process.env.BOND_HOME || join(HOME, ".bond"), "hubs.toml");

/** Lee el registro global ~/.bond/hubs.toml: repo -> hub (rutas canónicas). */
export function readHubsRegistry(): Record<string, string> {
	const p = hubsPath();
	if (!existsSync(p)) return {};
	try {
		const parsed = parse(readFileSync(p, "utf8")) as Record<string, unknown>;
		const repos = parsed.repos;
		if (!repos || typeof repos !== "object" || Array.isArray(repos)) return {};
		const out: Record<string, string> = {};
		for (const [k, v] of Object.entries(repos as Record<string, unknown>)) {
			let h: string | undefined;
			if (typeof v === "string") h = v;
			else if (typeof v === "object" && v !== null && typeof (v as Record<string, unknown>).hub === "string") {
				h = (v as Record<string, unknown>).hub as string;
			}
			if (h) out[canonical(k)] = canonical(h);
		}
		return out;
	} catch {
		return {};
	}
}

/** Guarda el registro global ~/.bond/hubs.toml. */
export function writeHubsRegistry(registry: Record<string, string>): void {
	const p = hubsPath();
	mkdirSync(dirname(p), { recursive: true });
	const lines = [
		"# ~/.bond/hubs.toml",
		"# Registro global de repos enlazados a hubs (generado por bond)",
		"",
		"[repos]",
	];
	for (const [r, h] of Object.entries(registry).sort(([a], [b]) => a.localeCompare(b))) {
		lines.push(`${JSON.stringify(r)} = ${JSON.stringify(h)}`);
	}
	writeFileSync(p, `${lines.join("\n")}\n`);
}

/** Anota un repo y su hub en el registro global ~/.bond/hubs.toml. */
export function registerHubRepo(repoDir: string, hubRoot: string): void {
	const reg = readHubsRegistry();
	reg[canonical(repoDir)] = canonical(hubRoot);
	writeHubsRegistry(reg);
}

/** ¿Tiene `root` un hub.toml válido? Sin avisos en stderr. */
export const hasHub = (root: string): boolean => {
	const p = join(root, "hub.toml");
	if (!existsSync(p)) return false;
	return catchDie(() => hubSession(root)).value !== undefined;
};

/**
 * El hub de `dir`: subiendo por los superproyectos, el de más arriba con hub.toml válido.
 * Si git no encuentra ninguno (p. ej. un repo enlazado por symlink), consulta ~/.bond/hubs.toml.
 */
export function hubRoot(dir = process.cwd()): string | undefined {
	const chain = repoChain(dir);
	const fromGit = chain.slice().reverse().find(hasHub);
	if (fromGit) return fromGit;

	// Si git no encuentra superproyecto (p. ej. un repo enlazado por symlink),
	// busca la raíz del repo actual en ~/.bond/hubs.toml (D14).
	const top = chain[0] ?? toplevel(dir);
	if (!top) return undefined;
	const reg = readHubsRegistry();
	const mapped = reg[canonical(top)];
	if (mapped && hasHub(mapped)) return mapped;

	// Si es un worktree de un repo enlazado, prueba con el repo principal del worktree
	const common = git(top, ["rev-parse", "--git-common-dir"]);
	if (common.status === 0 && common.stdout.trim()) {
		const mainTop = canonical(join(resolve(top, common.stdout.trim()), ".."));
		const mappedMain = reg[mainTop];
		if (mappedMain && hasHub(mappedMain)) return mappedMain;
	}

	return undefined;
}

export interface Submodule {
	path: string;
	initialized: boolean;
}

/** Submódulos del repo, también los anidados (git submodule status --recursive). */
export function submodules(root: string): Submodule[] {
	const r = git(root, ["submodule", "status", "--recursive"]);
	if (r.status !== 0) die(`git submodule status falló en ${root}: ${r.stderr.trim()}`);
	return r.stdout
		.split("\n")
		.map((l) => /^([ +U-])[0-9a-f]+ (.+?)(?: \([^()]*\))?$/.exec(l))
		.filter((m): m is RegExpExecArray => m !== null)
		.map((m) => ({ path: m[2].replace(/\\/g, "/"), initialized: m[1] !== "-" }));
}

/** Tabla de la sesión: repo, ruta, base, modo de enlace y rama actual. */
export function printSession(s: HubSession): void {
	const rows = s.repos.map((r) => [
		r.path === "." ? s.name : basename(r.path),
		r.path,
		r.base,
		r.path === "." ? "-" : (r.link ?? "submodule"),
		!r.present ? "(no está)" : (r.branch ?? "(HEAD separado)"),
	]);
	const all = [["REPO", "RUTA", "BASE", "ENLACE", "RAMA"], ...rows];
	const widths = all[0].map((_, i) => Math.max(...all.map((r) => r[i].length)));
	const fmt = (r: string[]) => `  ${r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i]))).join("  ")}`;
	log(`hub ${s.name} ${dim(`(${s.root})`)}`);
	console.log(dim(fmt(all[0])));
	for (const r of rows) console.log(fmt(r));
}

export async function hub(args: string[]): Promise<void> {
	if (args.includes("-h") || args.includes("--help")) {
		console.log(HUB_HELP.trimEnd());
		return;
	}
	if (args.length > 0) {
		die(`opción desconocida: ${args[0]} (bond hub --help)`);
	}
	const cwd = process.cwd();
	const root = hubRoot(cwd);
	if (!root) {
		if (existsSync(join(cwd, "hub.toml"))) {
			// Si hub.toml existe pero tiene error, hubSession morirá con el motivo exacto
			hubSession(cwd);
		}
		die("no es un hub: falta hub.toml (bond hub --help)");
	}
	const s = hubSession(root);
	if (!s) die(`${basename(root)} no es un hub: falta hub.toml`);
	printSession(s);
}
