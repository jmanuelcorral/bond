// bond hub: prepara un repo hub (un repo con submódulos de git, p. ej. frontend y backend) para
// trabajar en sesión. La sesión la forman el hub y sus submódulos inicializados, también los
// anidados, cada uno con su rama base; se guarda en la sección [hub] de .bond/bond.toml.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { parse } from "smol-toml";
import { type HubConfig, parseHub, repoHub, repoToml } from "./repo.mts";
import { canonical, catchDie, die, dim, isDryRun, log, ok, run, warn } from "./util.mts";

export const HUB_HELP = `Uso: bond hub [sync] [opciones]

Un hub es un repo con submódulos de git (p. ej. frontend y backend). bond hub prepara su
sesión: el hub y sus submódulos inicializados (también los anidados), cada uno con su rama
base, en la sección [hub] de .bond/bond.toml. Desde un submódulo trabaja sobre el hub de
arriba. El hub necesita .bond/bond.toml (bond init).

  bond hub        Sin [hub], la prepara: pregunta la base de cada repo (por defecto, su rama
                  actual). Con [hub], enseña la sesión: repos, ruta, base y rama actual
  bond hub sync   Añade los submódulos nuevos y quita los que ya no están

  --base <ruta>=<ref>  Base de un repo de la sesión ("." es el hub); repetible. Sin preguntas,
                       hace falta para los repos en HEAD separado
  -y, --yes            Sin preguntas: la base de un repo nuevo es su rama actual
  --dry-run            Enseña lo que escribiría, sin escribir

Los submódulos sin inicializar se avisan y no entran (git submodule update --init
--recursive). Para dejar uno fuera, añade su ruta a exclude en [hub]. Sin la sección, bond
team funciona como siempre.`;

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

/** ¿Tiene `root` una sección [hub] válida? Un bond.toml roto aquí no aborta: no es un hub. */
const hasHub = (root: string) => catchDie(() => repoHub(root)).value !== undefined;

/**
 * El hub de `dir`: subiendo por los superproyectos, el de más arriba con [hub] en su
 * bond.toml (también el propio repo). undefined si ninguno lo es.
 */
export function hubRoot(dir = process.cwd()): string | undefined {
	return repoChain(dir).reverse().find(hasHub);
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
	/** ¿Está el repo en disco? (un submódulo que se desinicializó no lo está) */
	present: boolean;
}

export interface HubSession {
	root: string;
	name: string;
	/** El hub primero (".") y después sus submódulos por ruta. */
	repos: HubRepo[];
}

/** ¿`path` es una de `prefixes` o cuelga de ella? */
const under = (path: string, prefixes: string[]) => prefixes.some((e) => path === e || path.startsWith(`${e}/`));

/** La sesión de un hub según su [hub]: sus repos con su base y su rama actual; undefined sin [hub]. */
export function hubSession(root: string): HubSession | undefined {
	const hub = repoHub(root);
	if (!hub) return undefined;
	const repo = (path: string, base: string): HubRepo => {
		const dir = path === "." ? root : join(root, ...path.split("/"));
		const present = existsSync(join(dir, ".git"));
		return { path, dir, base, branch: present ? currentBranch(dir) : undefined, present };
	};
	const subs = Object.keys(hub.repos).filter((p) => !under(p, hub.exclude)).sort();
	return { root, name: basename(root), repos: [repo(".", hub.base), ...subs.map((p) => repo(p, hub.repos[p].base))] };
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

/** El texto de la sección [hub], con las rutas ordenadas: el mismo hub da siempre el mismo texto. */
export function hubBlock(hub: HubConfig): string {
	const lines = ["[hub]", "# Sesión del hub: la escribe bond hub (y bond hub sync, si cambian los submódulos).", `base = ${JSON.stringify(hub.base)}`];
	if (hub.exclude.length) lines.push(`exclude = [${hub.exclude.map((e) => JSON.stringify(e)).join(", ")}]`);
	lines.push("", "[hub.repos]");
	for (const p of Object.keys(hub.repos).sort()) lines.push(`${JSON.stringify(p)} = { base = ${JSON.stringify(hub.repos[p].base)} }`);
	return lines.join("\n");
}

/**
 * El bond.toml con la sección [hub] (y sus subtablas) sustituida por `block` donde estaba, o
 * al final si no la había. El resto del fichero, comentarios incluidos, queda igual.
 */
export function withHub(text: string, block: string): string {
	const lines = text.split("\n");
	const table = (l: string) => /^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*(#.*)?$/.exec(l)?.[1];
	const isHub = (name: string | undefined) => name !== undefined && (name === "hub" || /^hub\s*\./.test(name));
	const start = lines.findIndex((l) => isHub(table(l)));
	if (start < 0) return `${text.trimEnd()}\n\n${block}\n`;
	let end = start + 1;
	while (end < lines.length && (table(lines[end]) === undefined || isHub(table(lines[end])))) end++;
	// Los comentarios y líneas en blanco del final son de lo que sigue (la tabla siguiente o el final).
	while (end > start + 1 && /^\s*(#.*)?$/.test(lines[end - 1])) end--;
	return [...lines.slice(0, start), ...block.split("\n"), ...lines.slice(end)].join("\n");
}

const sameHub = (a: HubConfig, b: HubConfig) => hubBlock(a) === hubBlock(b);

/** ¿`ref` es un commit en el repo `dir`? */
const validRef = (dir: string, ref: string) => git(dir, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).status === 0;

/** Tabla de la sesión: repo, ruta, base y rama actual. */
function printSession(s: HubSession): void {
	const rows = s.repos.map((r) => [r.path === "." ? s.name : basename(r.path), r.path, r.base, !r.present ? "(no está)" : (r.branch ?? "(HEAD separado)")]);
	const all = [["REPO", "RUTA", "BASE", "RAMA"], ...rows];
	const widths = all[0].map((_, i) => Math.max(...all.map((r) => r[i].length)));
	const fmt = (r: string[]) => `  ${r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i]))).join("  ")}`;
	log(`hub ${s.name} ${dim(`(${s.root})`)}`);
	console.log(dim(fmt(all[0])));
	for (const r of rows) console.log(fmt(r));
}

interface HubArgs {
	sync: boolean;
	yes: boolean;
	bases: Map<string, string>;
}

function parseArgs(args: string[]): HubArgs {
	const o: HubArgs = { sync: false, yes: false, bases: new Map() };
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "sync" && i === 0) o.sync = true;
		else if (a === "-y" || a === "--yes") o.yes = true;
		else if (a === "--dry-run") continue;
		else if (a === "--base" || a.startsWith("--base=")) {
			const v = a === "--base" ? args[++i] : a.slice("--base=".length);
			const m = v === undefined ? null : /^(.+?)=(.+)$/.exec(v);
			if (!m) die('--base necesita <ruta>=<ref> (p. ej. --base frontend=main; "." es el hub)');
			o.bases.set(m[1].replace(/\\/g, "/").replace(/\/+$/, "") || ".", m[2].trim());
		} else die(`opción desconocida: ${a} (bond hub --help)`);
	}
	return o;
}

export async function hub(args: string[]): Promise<void> {
	const o = parseArgs(args);
	const chain = repoChain(process.cwd());
	if (!chain.length) die("bond hub va dentro de un repo git: el hub es un repo con submódulos");
	// El hub ya configurado más arriba, o si no hay ninguno, el superproyecto de más arriba.
	const root = chain.slice().reverse().find(hasHub) ?? chain[chain.length - 1];
	const name = basename(root);
	const tomlPath = join(root, ".bond", "bond.toml");
	if (!existsSync(tomlPath)) die(`${name} no tiene .bond/bond.toml: ejecuta bond init en ${root} y después bond hub`);
	const parsed = parseHub(repoToml(root)?.hub);
	if (parsed.error) die(`bond.toml: ${parsed.error}. Arréglala o quita la sección [hub] y vuelve a ejecutar bond hub`);
	const current = parsed.hub;

	const subs = submodules(root);
	if (!subs.length) die(`${name} no tiene submódulos: un hub es un repo con submódulos de git (git submodule add <url> <ruta>). Añádelos y vuelve a ejecutar bond hub`);
	const exclude = current?.exclude ?? [];
	const included = subs.filter((s) => !under(s.path, exclude));
	for (const s of included.filter((x) => !x.initialized)) warn(`${s.path}: submódulo sin inicializar, no entra en la sesión (git submodule update --init --recursive ${s.path})`);
	const detected = included.filter((s) => s.initialized).map((s) => s.path);
	if (!detected.length) die(`${name} no tiene submódulos inicializados${exclude.length ? " fuera de exclude" : ""}: git submodule update --init --recursive, y después bond hub`);
	const added = detected.filter((p) => !current?.repos[p]);
	const removed = Object.keys(current?.repos ?? {}).filter((p) => !detected.includes(p));

	// Con [hub] y sin nada que cambiar pedido: enseña la sesión y lo pendiente.
	if (current && !o.sync && !o.bases.size) {
		printSession(hubSession(root)!);
		for (const p of added) warn(`${p}: submódulo nuevo, fuera de la sesión: bond hub sync lo añade`);
		for (const p of removed) warn(`${p}: ya no es un submódulo inicializado: bond hub sync lo quita de la sesión`);
		return;
	}

	const dirOf = (p: string) => (p === "." ? root : join(root, ...p.split("/")));
	const known = [".", ...detected];
	for (const [p, ref] of o.bases) {
		if (!known.includes(p)) die(`--base ${p}: no es un repo de la sesión (${known.join(", ")})`);
		if (!validRef(dirOf(p), ref)) die(`--base ${p}=${ref}: ${ref} no existe en ${p === "." ? name : p}`);
	}
	// Base de cada repo: la de --base, la que ya tenía o, para uno nuevo, su rama actual.
	const bases = new Map<string, string | undefined>();
	for (const p of known) bases.set(p, o.bases.get(p) ?? (p === "." ? current?.base : current?.repos[p]?.base) ?? currentBranch(dirOf(p)));
	const interactive = !o.yes && process.stdin.isTTY === true;
	const toAsk = known.filter((p) => !o.bases.has(p) && (p === "." ? !current : !current?.repos[p]));
	if (interactive && toAsk.length) {
		const pr = await import("@clack/prompts");
		pr.intro(`bond hub · ${name}`);
		for (const p of toAsk) {
			const label = p === "." ? `${name} (el hub)` : p;
			const v = await pr.text({
				message: `Rama base de ${label}`,
				initialValue: bases.get(p) ?? "",
				placeholder: "main",
				validate: (x) => (!x?.trim() ? "hace falta una base" : validRef(dirOf(p), x.trim()) ? undefined : `${x.trim()} no existe en ${label}`),
			});
			if (pr.isCancel(v)) die("cancelado: no se ha escrito nada");
			bases.set(p, String(v).trim());
		}
	}
	const detached = known.filter((p) => !bases.get(p));
	if (detached.length) {
		die(`sin base para ${detached.map((p) => (p === "." ? `${name} (el hub)` : p)).join(", ")}: está en HEAD separado. Indícala con --base, p. ej. bond hub --yes ${detached.map((p) => `--base ${p}=main`).join(" ")}`);
	}

	const next: HubConfig = { base: bases.get(".")!, repos: Object.fromEntries(detected.map((p) => [p, { base: bases.get(p)! }])), exclude };
	if (current && sameHub(current, next)) {
		printSession(hubSession(root)!);
		console.log(dim("  sin cambios en [hub]"));
		return;
	}
	const text = readFileSync(tomlPath, "utf8");
	const updated = withHub(text, hubBlock(next));
	// Lo escrito tiene que leerse igual (p. ej. un hub = {...} en línea no se sustituye): si no, nada.
	let check: HubConfig | undefined;
	try {
		check = parseHub((parse(updated) as Record<string, unknown>).hub).hub;
	} catch {
		check = undefined;
	}
	if (!check || !sameHub(check, next)) die(`no sé reescribir la sección [hub] de ${relative(process.cwd(), tomlPath) || tomlPath}: déjala como tabla [hub] (o quítala) y vuelve a ejecutar bond hub`);

	log(`${current ? "actualizo" : "preparo"} el hub ${name} ${dim(`(${root})`)}`);
	for (const p of known) {
		const before = p === "." ? current?.base : current?.repos[p]?.base;
		const after = bases.get(p)!;
		const label = p === "." ? `${name} (el hub)` : p;
		if (before === undefined) console.log(`${ok("+")} ${label}  ${dim(`base ${after}`)}`);
		else if (before !== after) console.log(`${ok("~")} ${label}  ${dim(`base ${before} -> ${after}`)}`);
	}
	for (const p of removed) console.log(`${ok("-")} ${p}`);
	if (isDryRun()) {
		console.log(dim(`  [dry-run] escribiría en .bond/bond.toml:\n${hubBlock(next).replace(/^/gm, "    ")}`));
		return;
	}
	writeFileSync(tomlPath, updated);
	console.log(`${ok("~")} .bond/bond.toml  ${dim("sección [hub]")}`);
	printSession(hubSession(root)!);
}
