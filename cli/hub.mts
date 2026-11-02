// bond hub: prepara y gestiona un repo hub (un repo compartido que agrupa varios repos,
// p. ej. frontend y backend) para trabajar en sesión. La sesión la forman el hub y sus repos,
// declarados en hub.toml, cada uno con su rama base y su modo de enlace (submodule o symlink).
// Lo propio de cada máquina va en .bond/hub.local.toml.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parse } from "smol-toml";
import { BOND_HOME } from "./runtime.mts";
import { act, canonical, catchDie, die, dim, HOME, log, run, warn } from "./util.mts";
import { t } from "./messages.mts";

export const hubHelp = (): string => t("hub.help");

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
export function repoChain(dir: string): string[] {
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
	/** Nombre o clave del repo en hub.toml (el nombre del hub para "."). */
	name?: string;
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
	/** Qué es este repo (si se declaró en hub.toml); alimenta el bloque del hub en AGENTS.md (D18). */
	description?: string;
}

export interface HubSession {
	root: string;
	name: string;
	/** El hub primero (".") y después sus repos por ruta. */
	repos: HubRepo[];
}

/** Etiqueta visible de un repo de la sesión: su clave en hub.toml (o el nombre del hub para "."). */
export const hubRepoLabel = (s: HubSession, r: HubRepo) => (r.path === "." ? s.name : (r.name ?? r.path));

export interface HubTomlRepo {
	path: string;
	base: string;
	link: "submodule" | "symlink";
	url?: string;
	agent?: string;
	description?: string;
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
		die(t("hub.toml_invalid", { file: pathForError, error: (e as Error).message }));
	}
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		die(t("hub.toml_not_table", { file: pathForError }));
	}
	if (typeof raw.name !== "string" || !raw.name.trim()) {
		die(t("hub.toml_missing_name", { file: pathForError }));
	}
	if (typeof raw.base !== "string" || !raw.base.trim()) {
		die(t("hub.toml_missing_base", { file: pathForError }));
	}
	const reposRaw = raw.repos;
	if (reposRaw !== undefined && (typeof reposRaw !== "object" || reposRaw === null || Array.isArray(reposRaw))) {
		die(t("hub.toml_repos_not_table", { file: pathForError }));
	}
	const repos: Record<string, HubTomlRepo> = {};
	const seenPaths = new Set<string>();
	for (const [key, val] of Object.entries((reposRaw ?? {}) as Record<string, unknown>)) {
		if (typeof val !== "object" || val === null || Array.isArray(val)) {
			die(t("hub.toml_repo_not_table", { file: pathForError, key }));
		}
		const r = val as Record<string, unknown>;
		if (typeof r.path !== "string" || !r.path.trim()) {
			die(t("hub.toml_repo_needs_path", { file: pathForError, key }));
		}
		const path = r.path.trim().replace(/\\/g, "/");
		if (!insidePath(path)) {
			die(t("hub.toml_repo_path_relative", { file: pathForError, key }));
		}
		if (seenPaths.has(path)) {
			die(t("hub.toml_repo_path_duplicate", { file: pathForError, path }));
		}
		seenPaths.add(path);
		if (typeof r.base !== "string" || !r.base.trim()) {
			die(t("hub.toml_repo_needs_base", { file: pathForError, key }));
		}
		const link = r.link;
		if (link !== "submodule" && link !== "symlink") {
			die(t("hub.toml_repo_invalid_link", { file: pathForError, key }));
		}
		if (r.url !== undefined && (typeof r.url !== "string" || !r.url.trim())) {
			die(t("hub.toml_repo_url_string", { file: pathForError, key }));
		}
		if (r.agent !== undefined && (typeof r.agent !== "string" || !r.agent.trim())) {
			die(t("hub.toml_repo_agent_string", { file: pathForError, key }));
		}
		if (r.description !== undefined && (typeof r.description !== "string" || !r.description.trim())) {
			die(t("hub.toml_repo_desc_string", { file: pathForError, key }));
		}
		repos[key] = {
			path,
			base: (r.base as string).trim(),
			link,
			url: typeof r.url === "string" ? r.url.trim() : undefined,
			agent: typeof r.agent === "string" ? r.agent.trim() : undefined,
			description: typeof r.description === "string" ? r.description.trim() : undefined,
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
		die(t("hub.toml_invalid", { file: pathForError, error: (e as Error).message }));
	}
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		die(t("hub.local_toml_not_table", { file: pathForError }));
	}
	const reposRaw = raw.repos;
	if (reposRaw !== undefined && (typeof reposRaw !== "object" || reposRaw === null || Array.isArray(reposRaw))) {
		die(t("hub.local_toml_repos_not_table", { file: pathForError }));
	}
	const repos: Record<string, { source?: string }> = {};
	for (const [key, val] of Object.entries((reposRaw ?? {}) as Record<string, unknown>)) {
		if (typeof val !== "object" || val === null || Array.isArray(val)) {
			die(t("hub.local_toml_repo_not_table", { file: pathForError, key }));
		}
		const r = val as Record<string, unknown>;
		if (r.source !== undefined && (typeof r.source !== "string" || !r.source.trim())) {
			die(t("hub.local_toml_repo_source_path", { file: pathForError, key }));
		}
		repos[key] = { source: typeof r.source === "string" ? r.source.trim() : undefined };
	}
	return { repos };
}

/** Expande ~ a HOME y resuelve rutas relativas al hub. */
export function expandSource(source: string, hubRoot: string): string {
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
		name: hubToml.name,
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
			name: key,
			path: entry.path,
			dir,
			base: entry.base,
			link: entry.link,
			branch: present ? currentBranch(dir) : undefined,
			present,
			url: entry.url,
			source,
			agent: entry.agent,
			description: entry.description,
		});
	}

	return {
		root,
		name: hubToml.name,
		repos: [hubSelf, ...subs],
	};
}

/** Ubicación del registro global ~/.bond/hubs.toml */
export const hubsPath = () => join(BOND_HOME, "hubs.toml");

export let warnedCorruptRegistry = false;

/** Lee el registro global ~/.bond/hubs.toml: repo -> hub (rutas canónicas). */
export function readHubsRegistry(): Record<string, string> {
	const p = hubsPath();
	if (!existsSync(p)) return {};
	try {
		const parsed = parse(readFileSync(p, "utf8")) as Record<string, unknown>;
		const repos = parsed.repos;
		if (repos !== undefined && (typeof repos !== "object" || repos === null || Array.isArray(repos))) {
			if (!warnedCorruptRegistry) {
				warnedCorruptRegistry = true;
				warn(t("hub.registry_repos_not_table", { path: p }));
			}
			return {};
		}
		if (!repos) return {};
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
	} catch (e) {
		if (!warnedCorruptRegistry) {
			warnedCorruptRegistry = true;
			warn(t("hub.toml_invalid", { file: p, error: (e as Error).message }));
		}
		return {};
	}
}

/** Guarda el registro global ~/.bond/hubs.toml respetando --dry-run. */
export function writeHubsRegistry(registry: Record<string, string>): void {
	const p = hubsPath();
	const lines = [
		"# ~/.bond/hubs.toml",
		"# Registro global de repos enlazados a hubs (generado por bond)",
		"",
		"[repos]",
	];
	for (const [r, h] of Object.entries(registry).sort(([a], [b]) => a.localeCompare(b))) {
		lines.push(`${JSON.stringify(r)} = ${JSON.stringify(h)}`);
	}
	act(t("hub.act_write_registry", { path: p }), () => {
		mkdirSync(dirname(p), { recursive: true });
		writeFileSync(p, `${lines.join("\n")}\n`);
	});
}

/** Anota un repo y su hub en el registro global ~/.bond/hubs.toml. */
export function registerHubRepo(repoDir: string, hubRoot: string): void {
	const reg = readHubsRegistry();
	reg[canonical(repoDir)] = canonical(hubRoot);
	writeHubsRegistry(reg);
}

/** Hubs cuya config inválida ya se avisó en este proceso. */
export const warnedInvalidHub = new Set<string>();

/**
 * ¿Tiene `root` un hub.toml válido?
 * Si existe un hub.toml o hub.local.toml que no parsea o es inválido,
 * avisa una sola vez por proceso y devuelve false (degradación a repo normal).
 */
export const hasHub = (root: string): boolean => {
	const p = join(root, "hub.toml");
	if (!existsSync(p)) return false;
	const r = catchDie(() => hubSession(root));
	if (r.value !== undefined) return true;
	if (r.error && !warnedInvalidHub.has(root)) {
		warnedInvalidHub.add(root);
		warn(t("hub.warn_invalid_hub", { error: r.error }));
	}
	return false;
};

/** Los mensajes de parseo empiezan por el fichero: se quita para no nombrarlo dos veces. */
const withoutFile = (file: string, error: string) =>
	error.startsWith(file) ? error.slice(file.length).replace(/^[\s:]+/, "") : error;

/**
 * Por qué `dir` no da una sesión de hub, o undefined si sí la da (issue #39). Distingue «no
 * hay hub.toml» de «hay hub.toml y no se puede leer»: en el segundo caso el motivo lleva el
 * error de parseo, para no decir nunca «falta» lo que está delante.
 */
export function hubUnusableReason(dir: string = process.cwd()): string | undefined {
	const candidate = repoChain(dir).slice().reverse().find((d) => existsSync(join(d, "hub.toml")));
	if (!candidate) return undefined;
	const file = relative(process.cwd(), join(candidate, "hub.toml")) || "hub.toml";
	const toml = catchDie(() => parseHubToml(readFileSync(join(candidate, "hub.toml"), "utf8"), file));
	if (toml.error) return t("hub.hub_toml_unreadable", { file, error: withoutFile(file, toml.error) });
	const session = catchDie(() => hubSession(candidate));
	return session.error;
}

/**
 * Muere explicando por qué `dir` no es un hub usable (issue #39): si no hay hub.toml en la
 * cadena de repos, que falta; si lo hay y no se lee, que existe y no se puede leer, con el error.
 */
export function dieNotAHub(dir: string = process.cwd()): never {
	die(hubUnusableReason(dir) ?? t("hub.not_a_hub"));
}

/**
 * El hub de `dir`: subiendo por los superproyectos, el de más arriba con hub.toml válido.
 * Si git no encuentra ninguno (p. ej. un repo enlazado por symlink), consulta ~/.bond/hubs.toml.
 */
export function hubRoot(dir = process.cwd()): string | undefined {
	const chain = repoChain(dir);
	const fromGit = chain.slice().reverse().find(hasHub);
	if (fromGit) {
		const common = git(fromGit, ["rev-parse", "--git-common-dir"]);
		if (common.status === 0 && common.stdout.trim()) {
			const mainTop = canonical(join(resolve(fromGit, common.stdout.trim()), ".."));
			if (mainTop !== fromGit && hasHub(mainTop)) return mainTop;
		}
		return fromGit;
	}

	// Si git no encuentra superproyecto (p. ej. un repo enlazado por symlink),
	// busca la raíz del repo actual en ~/.bond/hubs.toml (D14).
	const top = chain[0] ?? toplevel(dir);
	if (!top) return undefined;
	const reg = readHubsRegistry();
	const mapped = reg[canonical(top)];
	if (mapped && hasHub(mapped)) return mapped;

	// Si es un worktree de un repo enlazado o del propio hub
	const common = git(top, ["rev-parse", "--git-common-dir"]);
	if (common.status === 0 && common.stdout.trim()) {
		const mainTop = canonical(join(resolve(top, common.stdout.trim()), ".."));
		if (mainTop !== top && hasHub(mainTop)) return mainTop;
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
	if (r.status !== 0) die(t("hub.submodules_failed", { root, error: r.stderr.trim() }));
	return r.stdout
		.split("\n")
		.map((l) => /^([ +U-])[0-9a-f]+ (.+?)(?: \([^()]*\))?$/.exec(l))
		.filter((m): m is RegExpExecArray => m !== null)
		.map((m) => ({ path: m[2].replace(/\\/g, "/"), initialized: m[1] !== "-" }));
}

/** Tabla de la sesión: repo, ruta, base, modo de enlace y rama actual. */
export function printSession(s: HubSession): void {
	// La columna DESCRIPCION (D18) solo aparece si algún repo la declara: sin descripciones,
	// la tabla no se ensancha con huecos vacíos.
	const hasDesc = s.repos.some((r) => r.description);
	const rows = s.repos.map((r) => [
		r.path === "." ? s.name : (r.name ?? basename(r.path)),
		r.path,
		r.base,
		r.path === "." ? "-" : (r.link ?? "submodule"),
		!r.present ? t("hub.session_not_present") : (r.branch ?? t("hub.session_detached_head")),
		...(hasDesc ? [r.description ?? "-"] : []),
	]);
	const all = [
		[
			t("hub.session_col_repo"),
			t("hub.session_col_path"),
			t("hub.session_col_base"),
			t("hub.session_col_link"),
			t("hub.session_col_branch"),
			...(hasDesc ? [t("hub.session_col_desc")] : []),
		],
		...rows,
	];
	const widths = all[0].map((_, i) => Math.max(...all.map((r) => r[i].length)));
	const fmt = (r: string[]) => `  ${r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i]))).join("  ")}`;
	log(`hub ${s.name} ${dim(`(${s.root})`)}`);
	console.log(dim(fmt(all[0])));
	for (const r of rows) console.log(fmt(r));
}

export async function hub(args: string[]): Promise<void> {
	const [sub, ...rest] = args;
	if (sub === "init") {
		const { hubInit } = await import("./hub-init.mts");
		return hubInit(rest);
	}
	if (sub === "add") {
		const { hubAdd } = await import("./hub-init.mts");
		return hubAdd(rest);
	}
	if (sub === "sync") {
		const { hubSync } = await import("./hub-init.mts");
		return hubSync(rest);
	}
	if (sub === "check") {
		const c = await import("./hub-check.mts");
		return c.hubCheck(rest);
	}
	if (sub === "pull") {
		const p = await import("./hub-pull.mts");
		return p.hubPull(rest);
	}
	if (args.includes("-h") || args.includes("--help")) {
		console.log(hubHelp().trimEnd());
		return;
	}
	if (args.length > 0) {
		die(t("hub.unknown_opt", { opt: args[0] }));
	}
	const cwd = process.cwd();
	const root = hubRoot(cwd);
	if (!root) dieNotAHub(cwd);
	const s = hubSession(root);
	if (!s) die(t("hub.dir_not_a_hub", { name: basename(root) }));
	printSession(s);
}
