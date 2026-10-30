// bond hub init, add, sync: creación e importación guiada de repositorios en un hub.
// Gestiona hub.toml (versionado), .bond/hub.local.toml (personal) y el registro global.

import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
	act,
	brokenLink,
	canonical,
	catchDie,
	die,
	dim,
	isDryRun,
	log,
	ok,
	run,
	samePath,
	warn,
	STAMP,
} from "./util.mts";
import {
	currentBranch,
	expandSource,
	hubRoot,
	type HubLocalToml,
	type HubToml,
	type HubTomlRepo,
	insidePath,
	parseHubLocalToml,
	parseHubToml,
	registerHubRepo,
	submodules,
} from "./hub.mts";
import { agentsMd, init, loadRepoAgents, syncRepo } from "./repo.mts";

export const HUB_INIT_HELP = `Uso: bond hub init [dir] [repos...] [opciones]

Crea un hub o lo prepara en un repo git existente e importa repositorios:
por URL (submódulo) o desde un clon local (symlink). En un repo con submódulos,
los importa a hub.toml con su rama base.

Los repos nuevos entran en repos/<nombre> (D16); al importar submódulos
que ya existían se conserva su ruta. Cada repo puede llevar una descripción
opcional (el asistente la pregunta; en bond hub add, --description): alimenta
el bloque que bond genera en el AGENTS.md del hub (D18).

Opciones:
  --yes, -y       No pregunta: usa valores detectados y añade los repos indicados
  --dry-run       Muestra qué haría sin escribir en disco ni ejecutar comandos
  --dir <ruta>    Directorio del hub (por defecto, el directorio actual)
  --name <nombre> Nombre del hub (por defecto, el nombre de la carpeta)
  --base <rama>   Rama base del hub (por defecto, la rama actual o main)
  --repo <origen> Repositorio a importar (URL o ruta local; puede repetirse)

Antes de nada hace bond init en el propio hub si no lo tiene (con terminal, con sus
preguntas; con --yes, lo de bond setup), con las skills por defecto y plan-team.

Un hub recién creado (sin ningún commit) queda con su config de agente generada y un
commit inicial de los ficheros del hub, para que 'bond hub check' encuentre la base.
En un hub preexistente con commits no se commitea: los cambios se dejan para ti.

Los repos de la sesión sin bond reciben un bond init con la config del hub (sus
agentes y las skills por defecto del catálogo); los que ya lo tienen conservan la
suya. Su config se commitea en la rama actual del repo si estaba limpio; en un
submódulo ese commit es local: haz git push en él antes de subir el hub.
`;

export const HUB_ADD_HELP = `Uso: bond hub add <url|ruta> [opciones]

Añade un repositorio al hub: como submódulo si es una URL o como enlace (symlink)
si es una ruta a un clon local.

Opciones:
  --name <nombre>  Identificador del repo en hub.toml (por defecto, derivado del origen)
  --path <ruta>    Ruta dentro del hub (por defecto, repos/<nombre>; D16)
  --base <rama>    Rama base del repo (por defecto, la rama actual o main)
  --link <modo>    Modo de enlace: "submodule" o "symlink"
  --agent <agente> Agente por defecto para este repo en el hub
  --description <texto>  Qué es el repo (opcional); alimenta el bloque que bond genera en el AGENTS.md del hub (D18)
  --yes, -y        No pregunta
  --dry-run        Muestra qué haría sin escribir en disco
`;

export const HUB_SYNC_HELP = `Uso: bond hub sync [opciones]

Deja el disco como dice hub.toml: monta submódulos, crea enlaces (symlinks o
junctions en Windows), pregunta la ruta local que falte u ofrece clonar, y
actualiza el registro global ~/.bond/hubs.toml. Al hub y a los repos de la
sesión que no tienen bond les hace bond init (como bond hub init).

Opciones:
  --yes, -y   Falla si falta alguna ruta local en vez de preguntar
  --dry-run   Muestra qué haría sin modificar nada
`;

const git = (cwd: string, args: string[]) => run("git", ["-c", "protocol.file.allow=always", "-C", cwd, ...args]);

/** ¿Es una URL remota de repositorio (https, git, ssh, file)? */
export function isRepoUrl(s: string): boolean {
	return (
		/^(https?|git|ssh|file):\/\//i.test(s) ||
		/^git@[^:]+:.+/i.test(s) ||
		/^[^/]+@[^:]+:.+/i.test(s)
	);
}

/** Detecta la rama por defecto de un repo remoto mediante ls-remote. */
export function detectRemoteBranch(url: string): string | undefined {
	const r = run("git", ["-c", "protocol.file.allow=always", "ls-remote", "--symref", url, "HEAD"]);
	if (r.status === 0 && r.stdout) {
		const m = /ref:\s+refs\/heads\/([^\s]+)\s+HEAD/.exec(r.stdout);
		if (m) return m[1];
	}
	return undefined;
}

/** Detecta la rama base de un submódulo existente. */
export function detectSubmoduleBase(root: string, subPath: string): string {
	const b = git(root, ["config", "-f", ".gitmodules", `submodule.${subPath}.branch`]);
	if (b.status === 0 && b.stdout.trim()) return b.stdout.trim();
	const subDir = join(root, ...subPath.split("/"));
	const branch = currentBranch(subDir);
	if (branch) return branch;
	return "main";
}

/** Detecta la URL de un submódulo existente en .gitmodules o git config. */
export function detectSubmoduleUrl(root: string, subPath: string): string | undefined {
	const u = git(root, ["config", "-f", ".gitmodules", `submodule.${subPath}.url`]);
	if (u.status === 0 && u.stdout.trim()) return u.stdout.trim();
	const u2 = git(root, ["config", `submodule.${subPath}.url`]);
	if (u2.status === 0 && u2.stdout.trim()) return u2.stdout.trim();
	return undefined;
}

/**
 * Ruta por defecto de un repo nuevo en el hub: repos/<nombre> (D16). El asistente la
 * propone como valor inicial (editable) y `hub init`/`hub add` la usan sin preguntar;
 * `--path` y la ruta de los submódulos ya existentes mandan sobre ella.
 */
export const defaultRepoPath = (key: string) => `repos/${key}`;

/** Serializa HubToml a texto TOML. */
export function renderHubToml(hub: HubToml): string {
	const lines: string[] = [
		`name = ${JSON.stringify(hub.name)}`,
		`base = ${JSON.stringify(hub.base)}`,
		"",
	];
	for (const [key, repo] of Object.entries(hub.repos).sort(([a], [b]) => a.localeCompare(b))) {
		lines.push(`[repos.${key}]`);
		if (repo.url) lines.push(`url   = ${JSON.stringify(repo.url)}`);
		lines.push(`path  = ${JSON.stringify(repo.path)}`);
		lines.push(`base  = ${JSON.stringify(repo.base)}`);
		lines.push(`link  = ${JSON.stringify(repo.link)}`);
		if (repo.agent) lines.push(`agent = ${JSON.stringify(repo.agent)}`);
		if (repo.description) lines.push(`description = ${JSON.stringify(repo.description)}`);
		lines.push("");
	}
	return lines.join("\n").trimEnd() + "\n";
}

/** Serializa HubLocalToml a texto TOML. */
export function renderHubLocalToml(local: HubLocalToml): string {
	const lines: string[] = [];
	for (const [key, repo] of Object.entries(local.repos).sort(([a], [b]) => a.localeCompare(b))) {
		if (repo.source) {
			lines.push(`[repos.${key}]`);
			lines.push(`source = ${JSON.stringify(repo.source)}`);
			lines.push("");
		}
	}
	return lines.join("\n").trimEnd() + "\n";
}

/** Actualiza .gitignore para ignorar rutas de symlinks y .bond/hub.local.toml. */
export function updateGitignore(hubRoot: string, pathsToIgnore: string[]): void {
	const gitignorePath = join(hubRoot, ".gitignore");
	let content = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
	const lines = content.split("\n");
	let changed = false;

	for (const p of pathsToIgnore) {
		const pattern = p.startsWith("/") ? p : `/${p}`;
		if (!lines.includes(pattern) && !lines.includes(p)) {
			lines.push(pattern);
			changed = true;
		}
	}

	if (changed) {
		const newContent = lines.filter((l, i, arr) => l.trim() !== "" || i < arr.length - 1).join("\n") + "\n";
		act("actualizar .gitignore", () => {
			writeFileSync(gitignorePath, newContent);
		});
	}
}

/** ¿Es un symlink o junction (reparse point en Windows)? */
export function isLink(p: string): boolean {
	try {
		const stat = lstatSync(p);
		if (stat.isSymbolicLink()) return true;
		readlinkSync(p);
		return true;
	} catch {
		return false;
	}
}

/** ¿Es un enlace roto (symlink o junction cuyo destino no existe)? */
export function isBrokenLink(p: string): boolean {
	try {
		if (!isLink(p)) return false;
		return !existsSync(p);
	} catch {
		return false;
	}
}

/** Enlaza src en dest (symlink o fallback a junction en Windows). */
export function linkRepo(
	src: string,
	dest: string,
	opts: {
		platform?: NodeJS.Platform;
		symlinkFn?: (target: string, path: string, type?: string) => void;
	} = {},
): "symlink" | "junction" {
	const platform = opts.platform ?? process.platform;
	const symlink = opts.symlinkFn ?? symlinkSync;

	if (existsSync(dest) && samePath(dest, src)) {
		log(`ya enlazado: ${dest}`);
		return "symlink";
	}

	if (isBrokenLink(dest)) {
		rmSync(dest, { recursive: true, force: true });
	} else if (existsSync(dest)) {
		try {
			if (!isLink(dest)) {
				if (existsSync(join(dest, ".git"))) {
					warn(`${dest} ya existe como repositorio real; no se sustituye`);
					return "symlink";
				}
				warn(`${dest} ya existe; lo guardo como ${basename(dest)}.bak.${STAMP}`);
				renameSync(dest, `${dest}.bak.${STAMP}`);
			} else {
				rmSync(dest, { recursive: true, force: true });
			}
		} catch {
			rmSync(dest, { recursive: true, force: true });
		}
	}

	mkdirSync(dirname(dest), { recursive: true });

	try {
		symlink(src, dest, "dir");
		log(`enlazado: ${dest} -> ${src}`);
		return "symlink";
	} catch (e) {
		if (platform === "win32") {
			try {
				symlink(resolve(src), dest, "junction");
				log(`junction creada: ${dest} -> ${src}`);
				return "junction";
			} catch (je) {
				die(`no se pudo crear symlink ni junction en ${dest}: ${(je as Error).message}`);
			}
		}
		throw e;
	}
}

/** Cancela operación con @clack/prompts si el usuario pulsa Ctrl+C */
function cancelled(v: unknown): void {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	if (v && typeof v === "symbol") {
		process.exit(130);
	}
}

const ask = async <T,>(v: Promise<T | symbol>): Promise<T> => {
	const r = await v;
	cancelled(r);
	return r as T;
};

/** Por qué una ruta no vale como clon local (no existe o no es un repo git), o undefined si vale. */
export function localCloneError(value: string | undefined, hubDir: string): string | undefined {
	const v = value?.trim();
	if (!v) return "indica la carpeta del clon local";
	const dir = expandSource(v, hubDir);
	if (!existsSync(dir)) return `no existe: ${dir}`;
	if (git(dir, ["rev-parse", "--show-toplevel"]).status !== 0) return `no es un repo git: ${dir}`;
	return undefined;
}

/**
 * Pide la ruta a un clon local navegando por disco: autocompleta carpetas mientras se escribe
 * (flechas para elegir, Tab completa el nombre, / entra en la carpeta y Enter la acepta).
 * Empieza en la carpeta que contiene el hub, donde suelen vivir los clones hermanos, acepta `~`
 * y solo da por buena una carpeta que sea un repo git.
 */
async function askLocalClone(p: typeof import("@clack/prompts"), message: string, hubDir: string): Promise<string> {
	const start = dirname(resolve(hubDir));
	const chosen = await ask(
		p.path({
			message: `${message} ${dim("(↑/↓ elige, Tab completa, / entra en la carpeta)")}`,
			root: start,
			initialValue: start + sep,
			directory: true,
			validate: (v) => localCloneError(v, hubDir),
		}),
	);
	return chosen.trim().replace(/[\\/]+$/, "");
}

/** Sincroniza el disco con hub.toml y .bond/hub.local.toml. */
export async function syncHub(
	root: string,
	opts: {
		yes?: boolean;
		dryRun?: boolean;
		platform?: NodeJS.Platform;
		symlinkFn?: (target: string, path: string, type?: string) => void;
		hubToml?: HubToml;
		hubLocalToml?: HubLocalToml;
	} = {},
): Promise<void> {
	let hubToml = opts.hubToml;
	if (!hubToml) {
		const tomlPath = join(root, "hub.toml");
		if (!existsSync(tomlPath)) {
			die("no es un hub: falta hub.toml (bond hub --help)");
		}
		hubToml = parseHubToml(readFileSync(tomlPath, "utf8"), relative(process.cwd(), tomlPath) || "hub.toml");
	}

	const localPath = join(root, ".bond", "hub.local.toml");
	let hubLocalToml: HubLocalToml = opts.hubLocalToml ?? { repos: {} };
	if (!opts.hubLocalToml && existsSync(localPath)) {
		hubLocalToml = parseHubLocalToml(readFileSync(localPath, "utf8"), relative(process.cwd(), localPath) || ".bond/hub.local.toml");
	}

	const symlinkPaths: string[] = [];
	let localChanged = false;
	const isGitRepo = git(root, ["rev-parse", "--show-toplevel"]).status === 0;

	// Procesar submódulos primero y luego symlinks
	const entries = Object.entries(hubToml.repos).sort(([_keyA, a], [_keyB, b]) => {
		if (a.link !== b.link) {
			return a.link === "submodule" ? -1 : 1;
		}
		return a.path.localeCompare(b.path);
	});

	for (const [key, entry] of entries) {
		const dest = join(root, ...entry.path.split("/"));

		if (entry.link === "submodule") {
			const subs = isGitRepo ? submodules(root) : [];
			const found = subs.find((s) => s.path === entry.path);
			if (found && found.initialized && existsSync(join(dest, ".git"))) {
				log(`submódulo al día: ${entry.path}`);
			} else if (found) {
				act(`git submodule update --init --recursive -- ${entry.path}`, () => {
					const r = git(root, ["submodule", "update", "--init", "--recursive", "--", entry.path]);
					if (r.status !== 0) die(`git submodule update falló para ${entry.path}: ${r.stderr.trim() || r.stdout.trim()}`);
					log(`submódulo inicializado: ${entry.path}`);
				});
			} else {
				const url = entry.url;
				if (!url) die(`repos.${key}: falta url para clonar el submódulo`);
				act(`git submodule add ${url} ${entry.path}`, () => {
					const r = git(root, ["submodule", "add", url, entry.path]);
					if (r.status !== 0) die(`git submodule add falló para ${url}: ${r.stderr.trim() || r.stdout.trim()}`);
					log(`submódulo añadido: ${entry.path} (${url})`);
				});
			}
			if (existsSync(dest)) {
				registerHubRepo(dest, root);
			}
		} else if (entry.link === "symlink") {
			symlinkPaths.push(entry.path);
			let rawSource = hubLocalToml.repos[key]?.source ?? hubLocalToml.repos[entry.path]?.source;

			if (!rawSource) {
				if (opts.yes || !process.stdin.isTTY) {
					die(`falta la ruta local para ${entry.path} (${key}): indícala en .bond/hub.local.toml ([repos.${key}].source = "...") o ejecuta bond hub sync de forma interactiva`);
				}

				const p = await import("@clack/prompts");
				p.log.info(`El repo "${key}" (${entry.path}) está configurado como enlace (symlink) pero falta su ruta local.`);
				let chosen: string;

				if (entry.url) {
					const url = entry.url;
					const action = await ask(
						p.select({
							message: `¿Cómo quieres configurar ${key}?`,
							options: [
								{ value: "path", label: "Indicar la ruta a un clon local existente" },
								{ value: "clone", label: `Clonar desde ${url}` },
							],
						}),
					);
					if (action === "clone") {
						const defaultDir = join(dirname(root), key);
						const cloneDir = await ask(
							p.text({
								message: "¿Dónde clonar el repositorio?",
								initialValue: defaultDir,
							}),
						);
						act(`git clone ${url} ${cloneDir}`, () => {
							const r = git(root, ["clone", url, cloneDir]);
							if (r.status !== 0) die(`git clone falló: ${r.stderr.trim()}`);
						});
						chosen = cloneDir;
					} else {
						chosen = await askLocalClone(p, `Ruta al clon local de ${key}:`, root);
					}
				} else {
					chosen = await askLocalClone(p, `Ruta al clon local de ${key}:`, root);
				}

				rawSource = chosen;
				hubLocalToml.repos[key] = { source: rawSource };
				localChanged = true;
			}

			const source = expandSource(rawSource, root);
			if (!isDryRun() && !existsSync(source)) {
				die(`la ruta local de ${key} no existe: ${source} (corrígela en .bond/hub.local.toml)`);
			}

			act(`enlazar ${dest} -> ${source}`, () => {
				linkRepo(source, dest, { platform: opts.platform, symlinkFn: opts.symlinkFn });
			});
			registerHubRepo(source, root);
			registerHubRepo(dest, root);
		}
	}

	if (localChanged) {
		act("guardar .bond/hub.local.toml", () => {
			mkdirSync(join(root, ".bond"), { recursive: true });
			writeFileSync(localPath, renderHubLocalToml(hubLocalToml));
		});
	}

	updateGitignore(root, [".bond/hub.local.toml", ...symlinkPaths]);
}

/**
 * bond init en los repos de la sesión que no lo tienen, con los agentes del hub (y el `agent` del
 * repo en hub.toml como el de por defecto) y las skills por defecto del catálogo: sin eso, el
 * agente de ese repo no tiene sus skills ni sus instrucciones. Los repos que ya tienen bond
 * conservan su config. Como los worktrees de bond team salen de lo commiteado, la config se
 * commitea en la rama actual del repo, solo si el repo estaba limpio (el commit lleva solo lo
 * de bond); si no, se deja sin commitear y se avisa. Con terminal y sin --yes, pregunta antes.
 */
export async function initSessionRepos(root: string, hubToml: HubToml, opts: { interactive: boolean }): Promise<void> {
	const pending = Object.entries(hubToml.repos)
		.map(([key, r]) => ({ key, r, dir: join(root, r.path) }))
		.filter(({ dir }) => existsSync(dir) && !existsSync(join(dir, ".bond", "bond.toml")) && git(dir, ["rev-parse", "--show-toplevel"]).status === 0);
	if (!pending.length) return;

	const hub = existsSync(join(root, ".bond", "bond.toml")) ? catchDie(() => loadRepoAgents(root)).value : undefined;
	const p = opts.interactive ? await import("@clack/prompts") : undefined;

	for (const { key, r, dir } of pending) {
		const agents = [...new Set([...(hub?.agents.length ? hub.agents : []), ...(r.agent ? [r.agent] : [])])];
		const def = r.agent ?? hub?.default_agent;
		const desc = agents.length ? `agentes ${agents.join(", ")}` : "los agentes de bond setup";
		if (p) {
			const go = await ask(p.confirm({ message: `${key} no tiene bond: ¿bond init con la config del hub (${desc})?`, initialValue: true }));
			if (!go) {
				warn(`${key}: sin bond init, su agente no tendrá las skills ni las instrucciones de bond (bond hub check lo marca)`);
				continue;
			}
		}
		if (isDryRun()) {
			console.log(`    ${dim("[dry-run]")} bond init en ${r.path} (${desc}) y commit de su config si el repo está limpio`);
			continue;
		}
		const clean = git(dir, ["status", "--porcelain"]).stdout.trim() === "";
		const args = agents.length ? ["--agents", agents.join(","), ...(def ? ["--default", def] : [])] : ["--yes"];
		const prev = process.cwd();
		try {
			process.chdir(dir);
			log(`bond init en ${r.path}`);
			await init(args, { quiet: true });
		} finally {
			process.chdir(prev);
		}
		const branch = currentBranch(dir) ?? "HEAD";
		if (!clean) {
			warn(`${key}: tenía cambios sin commitear, así que su config de bond queda sin commitear; commitéala tú (los worktrees de bond team salen de lo commiteado)`);
			continue;
		}
		if (p) {
			const go = await ask(p.confirm({ message: `¿Commitear la config de bond en ${key} (${branch})?`, initialValue: true }));
			if (!go) {
				warn(`${key}: config de bond sin commitear; los worktrees de bond team no la verán hasta que la commitees`);
				continue;
			}
		}
		git(dir, ["add", "-A"]);
		const c = git(dir, ["commit", "-qm", "chore: add bond config"]);
		if (c.status !== 0) warn(`${key}: commit de la config de bond: ${c.stderr.trim() || c.stdout.trim()}`);
		else {
			console.log(`${ok("✓")} ${key}: config de bond commiteada en ${branch}`);
			// En un submódulo, el hub apunta a ese commit: sin push, un clon del hub no lo encuentra.
			if (r.link === "submodule") warn(`${key}: el commit es local; haz git push en ${r.path} antes de subir el hub, o sus clones no encontrarán ese commit`);
		}
	}
}

/**
 * bond init en el propio hub si no lo tiene. Con terminal, el de siempre, con sus preguntas;
 * sin ella, lo elegido en bond setup. En los dos, las skills por defecto más plan-team (la que
 * usa el orquestador en un hub), y pi si no hay ningún agente instalado.
 */
export async function initHub(root: string, opts: { interactive: boolean }): Promise<void> {
	if (existsSync(join(root, ".bond", "bond.toml"))) return;
	if (isDryRun()) {
		console.log(`    ${dim("[dry-run]")} bond init en el hub (skills por defecto y plan-team)`);
		return;
	}
	const prev = process.cwd();
	try {
		process.chdir(root);
		log("bond init en el hub");
		await init(opts.interactive ? [] : ["--yes"], { quiet: true, extraSkills: ["plan-team"], fallbackAgents: ["pi"] });
	} finally {
		process.chdir(prev);
	}
}

/** Comando bond hub init */
export async function hubInit(args: string[]): Promise<void> {
	if (args.includes("-h") || args.includes("--help")) {
		console.log(HUB_INIT_HELP.trimEnd());
		return;
	}

	let yes = false;
	let dir: string | undefined;
	let name: string | undefined;
	let base: string | undefined;
	const flagRepos: string[] = [];
	const pos: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "--yes" || a === "-y") {
			yes = true;
		} else if (a === "--dry-run") {
			// handled globally by setDryRun in main
		} else if (a === "--name") {
			if (args[i + 1] === undefined) die("--name necesita un valor");
			name = args[++i];
		} else if (a === "--base") {
			if (args[i + 1] === undefined) die("--base necesita un valor");
			base = args[++i];
		} else if (a === "--dir") {
			if (args[i + 1] === undefined) die("--dir necesita un valor");
			dir = args[++i];
		} else if (a === "--repo") {
			if (args[i + 1] === undefined) die("--repo necesita un valor");
			flagRepos.push(args[++i]);
		} else if (a.startsWith("-")) {
			die(`opción desconocida: ${a} (bond hub init --help)`);
		} else {
			pos.push(a);
		}
	}

	const reposToImport: string[] = [...flagRepos];
	if (!dir) {
		if (pos.length === 0) {
			dir = process.cwd();
		} else if (pos.length === 1) {
			if (isRepoUrl(pos[0])) {
				dir = process.cwd();
				reposToImport.push(pos[0]);
			} else if (existsSync(join(pos[0], "hub.toml")) || !existsSync(join(process.cwd(), ".git"))) {
				dir = pos[0];
			} else if (existsSync(join(pos[0], ".git")) && canonical(pos[0]) !== canonical(process.cwd())) {
				dir = process.cwd();
				reposToImport.push(pos[0]);
			} else {
				dir = pos[0];
			}
		} else {
			if (isRepoUrl(pos[0])) {
				dir = process.cwd();
				reposToImport.push(...pos);
			} else {
				dir = pos[0];
				reposToImport.push(...pos.slice(1));
			}
		}
	} else {
		reposToImport.push(...pos);
	}

	const root = resolve(dir);
	const isGitRepo = git(root, ["rev-parse", "--show-toplevel"]).status === 0;

	if (!isGitRepo) {
		act(`git init ${root}`, () => {
			mkdirSync(root, { recursive: true });
			const r = git(root, ["init", "-q", "-b", base ?? "main"]);
			if (r.status !== 0) die(`git init falló: ${r.stderr.trim()}`);
		});
	}

	// ¿Tenía ya commits el repo del hub al empezar? Solo los hubs recién creados (sin ningún
	// commit) se commitean al final; en un hub preexistente con commits no se commitea (H1).
	const hadCommits = git(root, ["rev-parse", "--verify", "--quiet", "HEAD"]).status === 0;

	// Directorio .bond
	act("crear .bond", () => {
		mkdirSync(join(root, ".bond"), { recursive: true });
	});

	const interactive = !yes && process.stdin.isTTY === true;

	// bond init en el propio hub antes que nada: sin él, el orquestador no tiene las skills del
	// catálogo (plan-team, decision-record con la memoria de decisiones del hub, D5...).
	await initHub(root, { interactive });

	// AGENTS.md si no existe
	const agentsPath = join(root, "AGENTS.md");
	if (!existsSync(agentsPath)) {
		act("crear AGENTS.md", () => {
			writeFileSync(agentsPath, agentsMd(name ?? basename(root)));
		});
	}

	// Cargar o inicializar hub.toml
	const hubTomlPath = join(root, "hub.toml");
	let hubToml: HubToml;
	if (existsSync(hubTomlPath)) {
		hubToml = parseHubToml(readFileSync(hubTomlPath, "utf8"), "hub.toml");
		if (name) hubToml.name = name;
		if (base) hubToml.base = base;
	} else {
		hubToml = {
			name: name ?? basename(root),
			base: base ?? currentBranch(root) ?? "main",
			repos: {},
		};
	}

	// Cargar o inicializar hub.local.toml
	const localTomlPath = join(root, ".bond", "hub.local.toml");
	let hubLocalToml: HubLocalToml = { repos: {} };
	if (existsSync(localTomlPath)) {
		hubLocalToml = parseHubLocalToml(readFileSync(localTomlPath, "utf8"), ".bond/hub.local.toml");
	}

	if (interactive) {
		const p = await import("@clack/prompts");
		p.intro(dim(`hub init · ${basename(root)}`));


		hubToml.name = await ask(
			p.text({
				message: "Nombre del hub",
				initialValue: hubToml.name,
			}),
		);
		hubToml.base = await ask(
			p.text({
				message: "Rama base del hub",
				initialValue: hubToml.base,
			}),
		);

		// Submódulos existentes
		const existingSubs = isGitRepo ? submodules(root).filter((s) => !hubToml.repos[basename(s.path)]) : [];
		if (existingSubs.length > 0) {
			const chosenSubs = await ask(
				p.multiselect({
					message: "¿Qué submódulos quieres importar a hub.toml?",
					options: existingSubs.map((s) => ({
						value: s.path,
						label: s.path,
						hint: `base ${detectSubmoduleBase(root, s.path)}`,
					})),
					initialValues: existingSubs.map((s) => s.path),
					required: false,
				}),
			);
			for (const subPath of chosenSubs) {
				const key = basename(subPath);
				hubToml.repos[key] = {
					path: subPath,
					base: detectSubmoduleBase(root, subPath),
					link: "submodule",
					url: detectSubmoduleUrl(root, subPath),
				};
			}
		}

		// Asistente para añadir repositorios
		for (;;) {
			const choice = await ask(
				p.select({
					message: "¿Añadir un repositorio al hub?",
					options: [
						{ value: "submodule", label: "Por URL (submódulo)" },
						{ value: "symlink", label: "Desde un clon local (symlink)" },
						{ value: "done", label: "Listo (no añadir más)" },
					],
				}),
			);
			if (choice === "done") break;

			if (choice === "submodule") {
				const url = await ask(p.text({ message: "URL del repositorio (git@... o https://...):" }));
				const defaultName = basename(url.replace(/\.git$/, ""));
				const key = await ask(p.text({ message: "Nombre en hub.toml:", initialValue: defaultName }));
				const path = await ask(p.text({ message: "Ruta dentro del hub:", initialValue: defaultRepoPath(key) }));
				const defaultBase = detectRemoteBranch(url) ?? "main";
				const repoBase = await ask(p.text({ message: "Rama base:", initialValue: defaultBase }));
				const agent = await ask(p.text({ message: "Agente por defecto (opcional):", placeholder: "pi, claude, codex..." }));
				const description = await ask(p.text({ message: "Descripción del repo (opcional):", placeholder: "p. ej. el frontend del producto" }));
				hubToml.repos[key] = {
					path,
					base: repoBase,
					link: "submodule",
					url,
					...(agent.trim() ? { agent: agent.trim() } : {}),
					...(description.trim() ? { description: description.trim() } : {}),
				};
			} else if (choice === "symlink") {
				const localPath = await askLocalClone(p, "Ruta al clon local:", root);
				const resolved = expandSource(localPath, root);
				const defaultName = basename(localPath);
				const key = await ask(p.text({ message: "Nombre en hub.toml:", initialValue: defaultName }));
				const path = await ask(p.text({ message: "Ruta dentro del hub:", initialValue: defaultRepoPath(key) }));
				const defaultBase = currentBranch(resolved) ?? "main";
				const repoBase = await ask(p.text({ message: "Rama base:", initialValue: defaultBase }));
				const agent = await ask(p.text({ message: "Agente por defecto (opcional):", placeholder: "pi, claude, codex..." }));
				const description = await ask(p.text({ message: "Descripción del repo (opcional):", placeholder: "p. ej. el backend de la API" }));
				const originUrl = git(resolved, ["remote", "get-url", "origin"]).stdout.trim() || undefined;
				hubToml.repos[key] = {
					path,
					base: repoBase,
					link: "symlink",
					...(originUrl ? { url: originUrl } : {}),
					...(agent.trim() ? { agent: agent.trim() } : {}),
					...(description.trim() ? { description: description.trim() } : {}),
				};
				hubLocalToml.repos[key] = { source: localPath };
			}
		}
	} else {
		// Importar submódulos existentes automáticamente (D4)
		const existingSubs = isGitRepo ? submodules(root) : [];
		for (const sub of existingSubs) {
			const key = basename(sub.path);
			if (!hubToml.repos[key] && !Object.values(hubToml.repos).some((r) => r.path === sub.path)) {
				hubToml.repos[key] = {
					path: sub.path,
					base: detectSubmoduleBase(root, sub.path),
					link: "submodule",
					url: detectSubmoduleUrl(root, sub.path),
				};
			}
		}

		// Importar repos indicados por argumento
		for (const target of reposToImport) {
			if (isRepoUrl(target)) {
				const key = basename(target.replace(/\.git$/, ""));
				if (!hubToml.repos[key]) {
					hubToml.repos[key] = {
						path: defaultRepoPath(key),
						base: detectRemoteBranch(target) ?? "main",
						link: "submodule",
						url: target,
					};
				}
			} else {
				const resolved = resolve(target);
				const key = basename(target);
				if (!hubToml.repos[key]) {
					const originUrl = git(resolved, ["remote", "get-url", "origin"]).stdout.trim() || undefined;
					hubToml.repos[key] = {
						path: defaultRepoPath(key),
						base: currentBranch(resolved) ?? "main",
						link: "symlink",
						...(originUrl ? { url: originUrl } : {}),
					};
					hubLocalToml.repos[key] = { source: target.startsWith("~") ? target : resolved };
				}
			}
		}
	}

	act("guardar hub.toml", () => {
		writeFileSync(hubTomlPath, renderHubToml(hubToml));
	});

	if (Object.keys(hubLocalToml.repos).length > 0) {
		act("guardar .bond/hub.local.toml", () => {
			writeFileSync(localTomlPath, renderHubLocalToml(hubLocalToml));
		});
	}

	const symlinkPaths = Object.values(hubToml.repos)
		.filter((r) => r.link === "symlink")
		.map((r) => r.path);
	updateGitignore(root, [".bond/hub.local.toml", ...symlinkPaths]);

	await syncHub(root, { yes: !interactive, hubToml, hubLocalToml });
	await initSessionRepos(root, hubToml, { interactive });

	// H1: un hub recién creado (sin ningún commit) queda sin la base que luego exige
	// `bond hub check` y con la config de agente sin generar. Generamos la config del hub
	// (equivalente a bond sync) y, si el repo no tenía commits, hacemos el commit inicial de
	// sus ficheros. En un hub preexistente con commits no commiteamos: los cambios se dejan
	// para que los revise el usuario. En dry-run solo se describe (el directorio puede no existir).
	if (!hadCommits) {
		act("bond sync en el hub y commit inicial de sus ficheros (hub.toml, .gitmodules, .gitignore, AGENTS.md, .bond/ y la config de agente)", () => {
			const prevCwd = process.cwd();
			try {
				process.chdir(root);
				syncRepo();
			} finally {
				process.chdir(prevCwd);
			}
			git(root, ["add", "-A"]);
			const c = git(root, ["commit", "-qm", "bond hub init"]);
			if (c.status !== 0) warn(`commit inicial del hub: ${c.stderr.trim() || c.stdout.trim()}`);
		});
	} else if (existsSync(root)) {
		// Hub preexistente: sincronizamos la config generada pero no commiteamos.
		const prevCwd = process.cwd();
		try {
			process.chdir(root);
			syncRepo({ quiet: true });
		} finally {
			process.chdir(prevCwd);
		}
	}
	log(`hub ${hubToml.name} listo en ${root}`);
}

/** Comando bond hub add */
export async function hubAdd(args: string[]): Promise<void> {
	if (args.includes("-h") || args.includes("--help")) {
		console.log(HUB_ADD_HELP.trimEnd());
		return;
	}

	let target: string | undefined;
	let name: string | undefined;
	let path: string | undefined;
	let base: string | undefined;
	let link: "submodule" | "symlink" | undefined;
	let agent: string | undefined;
	let description: string | undefined;
	let yes = false;

	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "--yes" || a === "-y") {
			yes = true;
		} else if (a === "--dry-run") {
			// handled globally
		} else if (a === "--name") {
			if (args[i + 1] === undefined) die("--name necesita un valor");
			name = args[++i];
		} else if (a === "--path") {
			if (args[i + 1] === undefined) die("--path necesita un valor");
			path = args[++i];
		} else if (a === "--base") {
			if (args[i + 1] === undefined) die("--base necesita un valor");
			base = args[++i];
		} else if (a === "--link") {
			if (args[i + 1] === undefined) die("--link necesita un valor");
			const val = args[++i];
			if (val !== "submodule" && val !== "symlink") die(`--link tiene que ser "submodule" o "symlink"`);
			link = val;
		} else if (a === "--agent") {
			if (args[i + 1] === undefined) die("--agent necesita un valor");
			agent = args[++i];
		} else if (a === "--description") {
			if (args[i + 1] === undefined) die("--description necesita un valor");
			description = args[++i];
		} else if (a.startsWith("-")) {
			die(`opción desconocida: ${a} (bond hub add --help)`);
		} else if (!target) {
			target = a;
		} else {
			die(`argumento inesperado: ${a} (bond hub add --help)`);
		}
	}

	if (!target) {
		die("bond hub add necesita una URL o ruta local (bond hub add --help)");
	}

	const root = hubRoot();
	if (!root) {
		die("no es un hub: falta hub.toml (bond hub --help)");
	}

	const tomlPath = join(root, "hub.toml");
	const hubToml = parseHubToml(readFileSync(tomlPath, "utf8"), "hub.toml");

	const localPath = join(root, ".bond", "hub.local.toml");
	let hubLocalToml: HubLocalToml = { repos: {} };
	if (existsSync(localPath)) {
		hubLocalToml = parseHubLocalToml(readFileSync(localPath, "utf8"), ".bond/hub.local.toml");
	}

	const detectedLink: "submodule" | "symlink" = link ?? (isRepoUrl(target) ? "submodule" : "symlink");
	const repoName = name ?? (detectedLink === "submodule" ? basename(target.replace(/\.git$/, "")) : basename(target));
	// D16: por defecto los repos van en repos/<nombre>; --path manda sobre el defecto.
	const repoPath = path ?? defaultRepoPath(repoName);

	if (!insidePath(repoPath)) {
		die(`la ruta "${repoPath}" tiene que ser relativa dentro del hub, con / y sin ..`);
	}

	const existing = hubToml.repos[repoName];
	if (existing) {
		const newSource = detectedLink === "symlink" ? (target.startsWith("~") ? target : resolve(target)) : undefined;
		if (
			existing.path !== repoPath ||
			existing.link !== detectedLink ||
			(detectedLink === "submodule" && existing.url !== target) ||
			(detectedLink === "symlink" && hubLocalToml.repos[repoName]?.source !== newSource)
		) {
			die(`repos.${repoName} ya existe en hub.toml con otra configuración (usa otro --name o edita hub.toml)`);
		}
		// El mismo repo: solo --description toca algo, y solo la descripcion. Reconstruir la
		// entrada perderia el agent, recalcularia la base contra la rama actual del clon y,
		// sin --description, se quedaba ademas sin la descripcion que ya habia.
		if (description === undefined || description === existing.description) {
			log(`repos.${repoName} ya existe en hub.toml`);
			return;
		}
		existing.description = description;
		act("guardar hub.toml", () => {
			writeFileSync(tomlPath, renderHubToml(hubToml));
		});
		syncHubAgentsBlock(root);
		log(`actualizada la descripcion de repos.${repoName}`);
		return;
	}
	const existingByPath = Object.entries(hubToml.repos).find(([k, r]) => k !== repoName && r.path === repoPath);
	if (existingByPath) {
		die(`la ruta "${repoPath}" ya está usada por repos.${existingByPath[0]}`);
	}

	if (detectedLink === "submodule") {
		const repoBase = base ?? (detectRemoteBranch(target) ?? "main");
		hubToml.repos[repoName] = {
			path: repoPath,
			base: repoBase,
			link: "submodule",
			url: target,
			...(agent ? { agent } : {}),
			...(description ? { description } : {}),
		};
	} else {
		const resolved = resolve(target);
		const repoBase = base ?? (currentBranch(resolved) ?? "main");
		const originUrl = git(resolved, ["remote", "get-url", "origin"]).stdout.trim() || undefined;
		hubToml.repos[repoName] = {
			path: repoPath,
			base: repoBase,
			link: "symlink",
			...(originUrl ? { url: originUrl } : {}),
			...(agent ? { agent } : {}),
			...(description ? { description } : {}),
		};
		hubLocalToml.repos[repoName] = { source: target.startsWith("~") ? target : resolved };
	}

	act("guardar hub.toml", () => {
		writeFileSync(tomlPath, renderHubToml(hubToml));
	});

	if (Object.keys(hubLocalToml.repos).length > 0) {
		act("guardar .bond/hub.local.toml", () => {
			mkdirSync(join(root, ".bond"), { recursive: true });
			writeFileSync(localPath, renderHubLocalToml(hubLocalToml));
		});
	}

	const symlinkPaths = Object.values(hubToml.repos)
		.filter((r) => r.link === "symlink")
		.map((r) => r.path);
	updateGitignore(root, [".bond/hub.local.toml", ...symlinkPaths]);

	await syncHub(root, { yes: true, hubToml, hubLocalToml });
	await initSessionRepos(root, hubToml, { interactive: !yes && process.stdin.isTTY === true });
	// D18: el bloque que bond genera en el AGENTS.md del hub se mantiene al día con hub.toml.
	syncHubAgentsBlock(root);
	log(`añadido ${repoName} a ${root}`);
}

/**
 * Regenera el bloque del hub en su AGENTS.md (equivalente a bond sync desde la raíz del hub).
 * Lo llaman `bond hub add` y `bond hub sync` para dejarlo al día con hub.toml; en un hub sin
 * hub.toml no hace nada (bond sync lo daría por fuera de la sesión).
 */
export function syncHubAgentsBlock(root: string): void {
	// Sin hub.toml no hay sesión; sin .bond/bond.toml (p. ej. en --dry-run, donde el bond init
	// del hub todavia no se ha hecho) no hay config que sincronizar: el bloque llegara con el.
	if (!existsSync(join(root, "hub.toml")) || !existsSync(join(root, ".bond", "bond.toml"))) return;
	const prev = process.cwd();
	try {
		process.chdir(root);
		syncRepo({ quiet: true });
	} finally {
		process.chdir(prev);
	}
}

/** Comando bond hub sync */
export async function hubSync(args: string[]): Promise<void> {
	if (args.includes("-h") || args.includes("--help")) {
		console.log(HUB_SYNC_HELP.trimEnd());
		return;
	}

	let yes = false;
	for (const a of args) {
		if (a === "--yes" || a === "-y") yes = true;
		else if (a === "--dry-run") {
			// handled globally
		} else {
			die(`opción desconocida: ${a} (bond hub sync --help)`);
		}
	}

	const root = hubRoot();
	if (!root) {
		die("no es un hub: falta hub.toml (bond hub --help)");
	}

	await syncHub(root, { yes });
	await initHub(root, { interactive: !yes && process.stdin.isTTY === true });
	await initSessionRepos(root, parseHubToml(readFileSync(join(root, "hub.toml"), "utf8"), "hub.toml"), { interactive: !yes && process.stdin.isTTY === true });
	// D18: tras cambiar la sesión, el bloque del AGENTS.md del hub se regenera desde hub.toml.
	syncHubAgentsBlock(root);
}
