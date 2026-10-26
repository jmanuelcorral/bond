// `bond catalog`: catálogos de skills, comandos y servidores MCP. El de bond va en `catalog/`;
// un equipo crea el suyo en un repo con `bond catalog create` y lo valida con `bond catalog check`.
//
// Estructura (la misma para todos):
//   catalog.toml               name y, por skill, summary/default para bond init
//   skills/<nombre>/SKILL.md   frontmatter name (= carpeta) y description
//   commands/<nombre>.md       frontmatter description; $ARGUMENTS, $1...
//   mcps/<nombre>.json         command/args/env o url/headers, y description
// Los README.md de cada carpeta son documentación: no cuentan como skill, comando ni MCP.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parse } from "smol-toml";
import { assetsPath } from "./runtime.mts";
import { bad, die, dim, isDryRun, log, ok, run, warn } from "./util.mts";

export const CATALOG_HELP = `Uso: bond catalog <create|check> [opciones]

Catálogos de skills, comandos y servidores MCP para compartir entre repos.

  create [--name n]   Prepara el repo actual como catálogo: catalog.toml y las carpetas
                      skills/, commands/ y mcps/, cada una con un README.md que explica cómo
                      añadir lo suyo. Pregunta el nombre (por defecto, el de la carpeta). Si ya
                      hay catalog.toml, no lo toca: solo añade lo que falte.
  check [dir]         Comprueba un catálogo (por defecto, el del repo actual). Sale con 1 si
                      hay errores, para CI.

  --dry-run           Enseña lo que haría sin escribir`;

export interface McpServer {
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	url?: string;
	headers?: Record<string, string>;
	description?: string;
}

const README = "README.md";
const NAME = /^[a-z0-9][a-z0-9_-]*$/;

/** Servidores MCP de un catálogo: mcps/<nombre>.json, por nombre. */
export function readMcps(dir: string): Record<string, McpServer> {
	const mcps = join(dir, "mcps");
	if (!existsSync(mcps)) return {};
	return Object.fromEntries(
		readdirSync(mcps)
			.filter((f) => f.endsWith(".json"))
			.sort()
			.map((f) => [f.slice(0, -5), JSON.parse(readFileSync(join(mcps, f), "utf8")) as McpServer]),
	);
}

/** Comandos de un catálogo: commands/<nombre>.md, por nombre (sin el README). */
export function readCommandNames(dir: string): string[] {
	const commands = join(dir, "commands");
	if (!existsSync(commands)) return [];
	return readdirSync(commands)
		.filter((f) => f.endsWith(".md") && f !== README)
		.map((f) => f.slice(0, -3))
		.sort();
}

/** Campos del frontmatter YAML de un Markdown, solo los de una línea o en bloque (`>`, `|`). */
export function frontmatter(md: string): Record<string, string> | undefined {
	const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
	if (!m) return undefined;
	const out: Record<string, string> = {};
	const lines = m[1].split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i]);
		if (!kv) continue;
		let value = kv[2].trim();
		if (/^[>|][+-]?$/.test(value)) {
			const block: string[] = [];
			while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) block.push(lines[++i].trim());
			value = block.join(" ");
		}
		out[kv[1]] = value.replace(/^(["'])(.*)\1$/, "$2");
	}
	return out;
}

export interface CatalogReport {
	name?: string;
	skills: string[];
	commands: string[];
	mcps: string[];
	errors: string[];
	warnings: string[];
}

/** Un valor de env/headers que parece un secreto escrito tal cual (y no una ${VARIABLE}). */
const looksSecret = (key: string, value: unknown) =>
	typeof value === "string" && value.trim() !== "" && !value.includes("${") && /key|token|secret|pass|auth|cookie/i.test(key);

/** Comprueba un catálogo. Los errores impiden usarlo; los avisos, no. */
export function validateCatalog(dir: string): CatalogReport {
	const r: CatalogReport = { skills: [], commands: [], mcps: [], errors: [], warnings: [] };
	const err = (s: string) => r.errors.push(s);

	let meta: Record<string, unknown> = {};
	const toml = join(dir, "catalog.toml");
	if (!existsSync(toml)) err("falta catalog.toml (bond catalog create lo prepara)");
	else {
		try {
			meta = parse(readFileSync(toml, "utf8")) as Record<string, unknown>;
		} catch (e) {
			err(`catalog.toml no es TOML válido: ${(e as Error).message.split("\n")[0]}`);
		}
	}
	if (meta.name !== undefined) {
		if (typeof meta.name !== "string" || !NAME.test(meta.name)) err(`catalog.toml: name ${JSON.stringify(meta.name)} no vale (minúsculas, dígitos, - o _)`);
		else r.name = meta.name;
	}

	const skillsDir = join(dir, "skills");
	if (existsSync(skillsDir)) {
		for (const d of readdirSync(skillsDir).sort()) {
			if (d.startsWith(".") || !statSync(join(skillsDir, d)).isDirectory()) continue;
			const file = join(skillsDir, d, "SKILL.md");
			if (!existsSync(file)) {
				err(`skills/${d}: falta SKILL.md`);
				continue;
			}
			r.skills.push(d);
			const fm = frontmatter(readFileSync(file, "utf8"));
			if (!fm) err(`skills/${d}/SKILL.md: falta el frontmatter (--- name y description ---)`);
			else {
				if (fm.name !== d) err(`skills/${d}/SKILL.md: name ${fm.name ? `"${fm.name}"` : "vacío"}, tiene que ser "${d}" (el nombre de la carpeta)`);
				if (!fm.description) err(`skills/${d}/SKILL.md: falta description (el agente la usa para decidir cuándo cargarla)`);
			}
			if (!NAME.test(d)) err(`skills/${d}: nombre no válido (minúsculas, dígitos, - o _)`);
		}
	}
	const entries = meta.skills;
	if (entries !== undefined && (typeof entries !== "object" || entries === null)) err("catalog.toml: skills tiene que ser una tabla ([skills.<nombre>])");
	else {
		for (const [n, e] of Object.entries((entries ?? {}) as Record<string, unknown>)) {
			if (!r.skills.includes(n)) err(`catalog.toml: [skills.${n}] no corresponde a ninguna skill de skills/`);
			const entry = (e ?? {}) as Record<string, unknown>;
			if (entry.summary !== undefined && typeof entry.summary !== "string") err(`catalog.toml: skills.${n}.summary tiene que ser texto`);
			if (entry.default !== undefined && typeof entry.default !== "boolean") err(`catalog.toml: skills.${n}.default tiene que ser true o false`);
		}
	}

	for (const n of readCommandNames(dir)) {
		r.commands.push(n);
		if (!NAME.test(n)) err(`commands/${n}.md: nombre no válido (minúsculas, dígitos, - o _)`);
		const fm = frontmatter(readFileSync(join(dir, "commands", `${n}.md`), "utf8"));
		if (!fm?.description) err(`commands/${n}.md: falta description en el frontmatter`);
	}

	const mcpsDir = join(dir, "mcps");
	if (existsSync(mcpsDir)) {
		for (const f of readdirSync(mcpsDir).filter((f) => f.endsWith(".json")).sort()) {
			const n = f.slice(0, -5);
			const where = `mcps/${f}`;
			let s: unknown;
			try {
				s = JSON.parse(readFileSync(join(mcpsDir, f), "utf8"));
			} catch (e) {
				err(`${where}: JSON inválido (${(e as Error).message})`);
				continue;
			}
			if (typeof s !== "object" || s === null || Array.isArray(s)) {
				err(`${where}: tiene que ser un objeto`);
				continue;
			}
			r.mcps.push(n);
			if (!NAME.test(n)) err(`${where}: nombre no válido (minúsculas, dígitos, - o _)`);
			const o = s as Record<string, unknown>;
			const isText = (v: unknown) => typeof v === "string" && v.trim() !== "";
			if (!isText(o.command) && !isText(o.url)) err(`${where}: necesita command (servidor local) o url (remoto)`);
			if (isText(o.command) && isText(o.url)) err(`${where}: command o url, no los dos`);
			if (o.args !== undefined && !(Array.isArray(o.args) && o.args.every((a) => typeof a === "string"))) err(`${where}: args tiene que ser una lista de textos`);
			for (const k of ["env", "headers"] as const) {
				const v = o[k];
				if (v === undefined) continue;
				if (typeof v !== "object" || v === null || Array.isArray(v) || !Object.values(v).every((x) => typeof x === "string")) {
					err(`${where}: ${k} tiene que ser un objeto de textos`);
					continue;
				}
				for (const [key, value] of Object.entries(v)) {
					if (looksSecret(key, value)) r.warnings.push(`${where}: ${k}.${key} parece un secreto escrito tal cual; usa \${VARIABLE}`);
				}
			}
			if (o.description === undefined) r.warnings.push(`${where}: sin description (bond init la enseña al elegir)`);
			else if (typeof o.description !== "string") err(`${where}: description tiene que ser texto`);
		}
	}
	return r;
}

/** Raíz del repo actual (o el directorio actual, fuera de git). */
function currentRoot(): string {
	const r = run("git", ["rev-parse", "--show-toplevel"]);
	// En Windows git responde C:/x/y: resolve() lo deja con las barras del sistema.
	return r.status === 0 ? resolve(r.stdout.trim()) : process.cwd();
}

/** Nombre de catálogo a partir del de una carpeta: minúsculas, dígitos, - y _. */
export const catalogSlug = (s: string) =>
	s
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^[-_]+|-+$/g, "") || "catalogo";

const templateDir = () => assetsPath("templates", "catalog");

function walk(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

/**
 * Lo que le falta a `root` para ser un catálogo: rutas (con /) y contenido. Si ya hay
 * catalog.toml no se toca; los README.md que existan, tampoco.
 */
export function catalogScaffold(root: string, name: string): Array<{ path: string; content: string }> {
	return walk(templateDir())
		.map((f) => relative(templateDir(), f).split("\\").join("/"))
		.sort()
		.filter((rel) => !existsSync(join(root, rel)))
		.map((rel) => {
			const content = readFileSync(join(templateDir(), rel), "utf8");
			return { path: rel, content: rel === "catalog.toml" ? content.replace("{{name}}", name) : content };
		});
}

async function create(args: string[]): Promise<void> {
	let name: string | undefined;
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--name") {
			name = args[++i];
			if (name === undefined) die("--name necesita un valor");
		} else if (args[i] !== "--dry-run") die(`opción desconocida: ${args[i]} (bond catalog --help)`);
	}
	if (name !== undefined && !NAME.test(name)) die(`nombre de catálogo no válido: ${name} (minúsculas, dígitos, - o _)`);

	const root = currentRoot();
	if (run("git", ["rev-parse", "--show-toplevel"]).status !== 0) warn(`${root} no es un repo git: para compartir el catálogo, versiónalo y publícalo en git`);
	const toml = join(root, "catalog.toml");
	if (existsSync(toml)) {
		// Ya es un catálogo: su nombre manda y no se pregunta.
		if (name !== undefined) warn("catalog.toml ya existe: --name no lo cambia");
		name = validateCatalog(root).name ?? catalogSlug(basename(root));
	} else if (name === undefined) {
		const suggested = catalogSlug(basename(root));
		if (process.stdin.isTTY === true) {
			const p = await import("@clack/prompts");
			const answer = await p.text({
				message: "¿Nombre del catálogo? (el que verá el equipo al usarlo)",
				initialValue: suggested,
				validate: (v) => (NAME.test(v ?? "") ? undefined : "minúsculas, dígitos, - o _"),
			});
			if (typeof answer !== "string") die("cancelado", 130);
			name = answer;
		} else name = suggested;
	}

	log(`bond catalog create en ${root}`);
	const missing = catalogScaffold(root, name);
	if (!missing.length) {
		console.log(dim("  el catálogo ya tiene todo lo necesario: nada que añadir"));
		return;
	}
	for (const f of missing) {
		if (isDryRun()) {
			console.log(dim(`  [dry-run] crearía ${f.path}`));
			continue;
		}
		mkdirSync(dirname(join(root, f.path)), { recursive: true });
		writeFileSync(join(root, f.path), f.content);
		console.log(`${ok("+")} ${f.path}`);
	}
	if (isDryRun()) return;
	console.log(`
Catálogo "${name}". Siguiente:
  1. Añade skills, comandos y servidores MCP (el README.md de cada carpeta explica cómo).
  2. Compruébalo: bond catalog check
  3. Commitea y publícalo en git: git add catalog.toml skills commands mcps`);
}

function check(args: string[]): void {
	const dirs = args.filter((a) => !a.startsWith("-"));
	for (const a of args) if (a.startsWith("-") && a !== "--dry-run") die(`opción desconocida: ${a} (bond catalog --help)`);
	if (dirs.length > 1) die("bond catalog check admite un solo directorio");
	const dir = dirs[0] ? resolve(dirs[0]) : currentRoot();
	if (!existsSync(dir) || !statSync(dir).isDirectory()) die(`no existe el directorio ${dir}`);
	const r = validateCatalog(dir);
	for (const w of r.warnings) warn(w);
	for (const e of r.errors) console.error(`${bad("error:")} ${e}`);
	const label = r.name ? `"${r.name}"` : (relative(process.cwd(), dir) || ".");
	const counts = `${r.skills.length} skills, ${r.commands.length} comandos, ${r.mcps.length} servidores MCP`;
	if (r.errors.length) die(`el catálogo ${label} tiene ${r.errors.length} error${r.errors.length === 1 ? "" : "es"} (${counts})`);
	console.log(`${ok("✓")} catálogo ${label} correcto: ${counts}${r.warnings.length ? `, ${r.warnings.length} aviso${r.warnings.length === 1 ? "" : "s"}` : ""}`);
}

export async function catalogCommand(args: string[]): Promise<void> {
	const [sub, ...rest] = args;
	if (sub === "create") return create(rest);
	if (sub === "check") return check(rest);
	if (sub) die(`subcomando desconocido: ${sub} (bond catalog --help)`);
	console.log(CATALOG_HELP);
	process.exit(2);
}
