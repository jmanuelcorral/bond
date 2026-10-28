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
import { cleanCache, ensureFetched, gitKey, isGitUrl, type Lock, readLock, repoRelative, resolveRef, writeLock } from "./catalog-git.mts";
import { assetsPath } from "./runtime.mts";
import { bad, caution, die, dim, isDryRun, log, ok, run, warn } from "./util.mts";

export const CATALOG_HELP = `Uso: bond catalog <subcomando> [opciones]

Catálogos de skills, comandos y servidores MCP para compartir entre repos.

Crear un catálogo (en su propio repo):
  create [--name n]   Prepara el repo actual como catálogo: catalog.toml y las carpetas
                      skills/, commands/ y mcps/, cada una con un README.md que explica cómo
                      añadir lo suyo. Pregunta el nombre (por defecto, el de la carpeta). Si ya
                      hay catalog.toml, no lo toca: solo añade lo que falte.
  check [dir]         Comprueba un catálogo (por defecto, el del repo actual). Sale con 1 si
                      hay errores, para CI.

Usarlo en un repo con bond (.bond/bond.toml):
  add <url|carpeta>   Lo declara en bond.toml ([[catalog]]). Por git, fija el commit en
                      .bond/lock.json: --ref tag, rama o sha (por defecto, la rama por defecto).
                      --name n le da otro nombre (por defecto, el de su catalog.toml).
  list                El de bond y los del repo, con su ref y commit.
  update [nombre]     Vuelve a resolver la ref de los catálogos por git y mueve el lock;
                      --ref cambia la ref (con nombre).
  remove <nombre>     Lo quita de bond.toml, del lock y de lo que el repo tenía elegido de él.
  clean               Vacía la caché (~/.bond/catalogs), salvo los commits que fija este repo.

add y update enseñan antes los servidores MCP que llegan o cambian (ejecutan programas en tu
máquina) y lo que pasa a venir de otro catálogo, y piden confirmación (--yes la da).

  --dry-run           (create) Enseña lo que haría sin escribir`;

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

/**
 * Validación YAML estricta del frontmatter de una skill. `frontmatter()` es tolerante y
 * saca los campos pase lo que pase; esto comprueba que el bloque es YAML de verdad, porque
 * pi rechaza cargar una skill con frontmatter inválido (Claude Code lo tolera). Un valor
 * plano sin comillas no puede contener `: ` ni terminar en `:` (p. ej. `Agent: and
 * Decision:` dentro de una description), y no hay continuaciones multilínea fuera de los
 * bloques escalares `|` / `>`. Devuelve los errores encontrados (vacío si todo vale).
 */
export function strictFrontmatter(md: string): string[] {
	const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
	if (!m) return ["sin frontmatter (--- ... ---)"];
	const errors: string[] = [];
	const lines = m[1].split(/\r?\n/);
	let inBlock = false;
	let blockIndent = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const n = i + 2; // línea 1 del fichero es el `---` de apertura
		if (!line.trim()) {
			inBlock = false;
			continue;
		}
		const indent = /^ */.exec(line)![0].length;
		if (inBlock && indent > blockIndent) continue; // contenido literal del bloque escalar
		inBlock = false;
		if (/^\s*#/.test(line)) continue;
		const kv = /^([A-Za-z0-9_-]+):(.*)$/.exec(line);
		if (!kv) {
			errors.push(`línea ${n}: no es "clave: valor" ni comentario`);
			continue;
		}
		const v = kv[2].trim();
		if (v === "") continue; // valor vacío: nulo o bloque que sigue
		if (/^[|>][+-]?\d*$/.test(v)) {
			inBlock = true;
			blockIndent = indent;
			continue;
		}
		if ((v.startsWith('"') && v.endsWith('"') && v.length > 1) || (v.startsWith("'") && v.endsWith("'") && v.length > 1)) continue;
		if (v.startsWith('"') || v.startsWith("'")) {
			errors.push(`línea ${n}: comilla sin cerrar en ${kv[1]}`);
			continue;
		}
		if (v.includes(": ") || v.endsWith(":")) errors.push(`línea ${n}: valor sin comillas en ${kv[1]} contiene ": " (YAML lo rechaza); entrecomillalo ("...")`);
	}
	return errors;
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
			const text = readFileSync(file, "utf8");
			const fm = frontmatter(text);
			if (!fm) err(`skills/${d}/SKILL.md: falta el frontmatter (--- name y description ---)`);
			else {
				if (fm.name !== d) err(`skills/${d}/SKILL.md: name ${fm.name ? `"${fm.name}"` : "vacío"}, tiene que ser "${d}" (el nombre de la carpeta)`);
				if (!fm.description) err(`skills/${d}/SKILL.md: falta description (el agente la usa para decidir cuándo cargarla)`);
				// YAML estricto: con frontmatter inválido pi no carga la skill (Claude Code lo tolera).
				for (const e of strictFrontmatter(text)) err(`skills/${d}/SKILL.md: frontmatter no es YAML válido: ${e}`);
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

/** "1 skill", "2 skills". */
export const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

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
	const counts = `${count(r.skills.length, "skill", "skills")}, ${count(r.commands.length, "comando", "comandos")}, ${count(r.mcps.length, "servidor MCP", "servidores MCP")}`;
	if (r.errors.length) die(`el catálogo ${label} tiene ${count(r.errors.length, "error", "errores")} (${counts})`);
	console.log(`${ok("✓")} catálogo ${label} correcto: ${counts}${r.warnings.length ? `, ${count(r.warnings.length, "aviso", "avisos")}` : ""}`);
}

// --- catálogos del equipo en un repo: add, list, update, remove, clean --------------------

/** Bloques [[catalog]] de un bond.toml, en orden: dónde empieza y acaba cada uno (en caracteres). */
function catalogBlocks(text: string): Array<{ start: number; end: number }> {
	const blocks: Array<{ start: number; end: number }> = [];
	let offset = 0;
	let open: number | undefined;
	for (const line of text.split(/(?<=\n)/)) {
		if (/^\s*\[/.test(line)) {
			if (open !== undefined) blocks.push({ start: open, end: offset });
			open = /^\s*\[\[catalog\]\]\s*(#.*)?$/.test(line.trimEnd()) ? offset : undefined;
		}
		offset += line.length;
	}
	if (open !== undefined) blocks.push({ start: open, end: text.length });
	return blocks;
}

/** Añade un [[catalog]] al final de bond.toml. */
function appendCatalog(text: string, fields: Array<[string, string]>): string {
	return `${text.replace(/\s*$/, "")}\n\n[[catalog]]\n${fields.map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join("\n")}\n`;
}

/** Quita el [[catalog]] nº i (desde 0). */
function removeCatalogBlock(text: string, i: number): string {
	const b = catalogBlocks(text)[i];
	return `${(text.slice(0, b.start).replace(/\s*$/, "\n") + text.slice(b.end).replace(/^\s*/, "\n")).replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\s*$/, "")}\n`;
}

/** Pone (o quita, con undefined) una clave dentro del [[catalog]] nº i. */
function setInCatalog(text: string, i: number, key: string, value: string | undefined): string {
	const b = catalogBlocks(text)[i];
	let block = text.slice(b.start, b.end);
	const re = new RegExp(`^${key}\\s*=.*\\n?`, "m");
	const line = value === undefined ? "" : `${key} = ${JSON.stringify(value)}\n`;
	block = re.test(block) ? block.replace(re, line) : block.replace(/^(.*\n)/, `$1${line}`);
	return text.slice(0, b.start) + block + text.slice(b.end);
}

type Repo = typeof import("./repo.mts");

/** Raíz, bond.toml (texto y TOML) y lock de un repo con bond. */
async function repoState() {
	const repo: Repo = await import("./repo.mts");
	const root = repo.repoRoot();
	const file = join(root, ".bond", "bond.toml");
	if (!existsSync(file)) die("este repo no tiene .bond/bond.toml: ejecuta antes bond init");
	const toml = readFileSync(file, "utf8");
	let raw: Record<string, unknown>;
	try {
		raw = parse(toml) as Record<string, unknown>;
	} catch (e) {
		die(`.bond/bond.toml no es TOML válido: ${(e as Error).message}`);
	}
	const decl = (Array.isArray(raw.catalog) ? raw.catalog : []) as Array<Record<string, unknown>>;
	return { repo, root, file, toml, decl, lock: readLock(root) };
}

/** Una línea de servidor MCP para revisar: qué ejecuta o adónde se conecta. */
const mcpLine = (s: McpServer) => (s.url ? s.url : [s.command, ...(s.args ?? [])].join(" ")) + (s.env ? `  env: ${Object.keys(s.env).join(", ")}` : "");

/** Servidores MCP que trae o cambia un catálogo: ejecutan programas, así que se revisan (D4). */
function mcpReview(name: string, oldDir: string | undefined, newDir: string): string[] {
	const lines: string[] = [];
	const prev = oldDir ? readMcps(oldDir) : {};
	const next = readMcps(newDir);
	for (const [n, s] of Object.entries(next)) {
		if (!prev[n]) lines.push(`  ${ok("+")} mcp ${n}: ${mcpLine(s)}`);
		else if (JSON.stringify({ ...prev[n], description: undefined }) !== JSON.stringify({ ...s, description: undefined })) lines.push(`  ${bad("~")} mcp ${n}: ${mcpLine(prev[n])}  →  ${mcpLine(s)}`);
	}
	for (const n of Object.keys(prev)) if (!next[n]) lines.push(`  ${bad("-")} mcp ${n}`);
	if (lines.length) lines.unshift(`Servidores MCP del catálogo ${name} (se instalan solo si están en mcp = [...]):`);
	return lines;
}

type RepoConfig = import("./repo.mts").RepoConfig;

/** Lo que usa el repo y pasa a venir de otro catálogo (p. ej. una skill de bond que sustituye la del equipo). */
function movedReview(before: RepoConfig | undefined, after: RepoConfig): string[] {
	if (!before) return [];
	const moved: string[] = [];
	for (const kind of ["mcp", "skills", "commands"] as const) {
		after.tools[kind].forEach((t, i) => {
			const was = before.tools[kind][i];
			if (was && was.name === t.name && was.catalog.name !== t.catalog.name) moved.push(`  ${caution("~")} ${t.name}: de ${was.catalog.name} pasa a ${t.catalog.name}`);
		});
	}
	return moved.length ? ["Lo que usa este repo y pasa a venir de otro catálogo:", ...moved] : [];
}

/** Enseña lo que hay que revisar y pide confirmación (o --yes). Devuelve si se sigue. */
async function confirm(lines: string[], yes: boolean): Promise<boolean> {
	if (!lines.length) return true;
	console.log(lines.join("\n"));
	if (yes) return true;
	if (process.stdin.isTTY !== true) die("hay cambios que revisar (arriba): repite con --yes para aceptarlos");
	const p = await import("@clack/prompts");
	const answer = await p.confirm({ message: "¿Seguir?", initialValue: false });
	return answer === true;
}

function flags(args: string[], withValue: string[], bare: string[]): { opts: Record<string, string>; has: Set<string>; pos: string[] } {
	const opts: Record<string, string> = {};
	const has = new Set<string>();
	const pos: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (withValue.includes(a)) {
			if (args[i + 1] === undefined) die(`${a} necesita un valor`);
			opts[a] = args[++i];
		} else if (bare.includes(a)) has.add(a);
		else if (a.startsWith("-")) die(`opción desconocida: ${a} (bond catalog --help)`);
		else pos.push(a);
	}
	return { opts, has, pos };
}

async function add(args: string[]): Promise<void> {
	const { opts, has, pos } = flags(args, ["--name", "--ref"], ["--yes", "-y"]);
	if (pos.length !== 1) die("uso: bond catalog add <url|carpeta> [--name n] [--ref tag|rama|sha] [--yes]");
	const source = pos[0];
	const { repo, root, file, toml, lock } = await repoState();
	const before = repo.loadRepoConfig(root);
	let dir: string;
	let fields: Array<[string, string]>;
	const nextLock: Lock = { catalogs: { ...lock.catalogs } };
	if (isGitUrl(source)) {
		const twin = before.catalogs.find((c) => c.git && gitKey(c.git) === gitKey(source));
		if (twin) die(`${source} ya está como el catálogo ${twin.name}`);
		const sha = resolveRef(source, opts["--ref"]);
		dir = ensureFetched(source, sha);
		const name = opts["--name"] ?? validateCatalog(dir).name ?? catalogSlug(basename(gitKey(source)));
		fields = [["name", name], ["git", source], ...(opts["--ref"] ? [["ref", opts["--ref"]] as [string, string]] : [])];
		nextLock.catalogs[name] = { git: source, ...(opts["--ref"] ? { ref: opts["--ref"] } : {}), sha };
	} else {
		if (opts["--ref"]) die("--ref solo vale para un catálogo por git");
		dir = resolve(source);
		if (!existsSync(dir) || !statSync(dir).isDirectory()) die(`no existe la carpeta ${source}`);
		const path = repoRelative(root, dir);
		fields = [...(opts["--name"] ? [["name", opts["--name"]] as [string, string]] : []), ["path", path]];
	}
	// Se valida todo lo que quedaría (catálogo, nombres, lo que pide el repo) antes de escribir.
	const report = validateCatalog(dir);
	if (report.errors.length) {
		for (const e of report.errors) console.error(`${bad("error:")} ${e}`);
		die(`el catálogo de ${source} tiene ${count(report.errors.length, "error", "errores")}: no se añade (arréglalo en su repo y compruébalo con bond catalog check)`);
	}
	const nextToml = appendCatalog(toml, fields);
	const after = repo.loadRepoConfig(root, { toml: nextToml, lock: nextLock });
	const added = after.catalogs[after.catalogs.length - 1];
	if (!(await confirm([...mcpReview(added.name, undefined, added.dir), ...movedReview(before, after)], has.has("--yes") || has.has("-y")))) die("cancelado: no se ha cambiado nada", 130);
	writeFileSync(file, nextToml);
	writeLock(root, nextLock);
	console.log(`${ok("+")} catálogo ${added.name} (${repo.catalogWhere(added)}): ${count(report.skills.length, "skill", "skills")}, ${count(report.commands.length, "comando", "comandos")}, ${count(report.mcps.length, "servidor MCP", "servidores MCP")}`);
	repo.syncRepo();
	console.log(dim("  elige lo suyo con bond init (o en .bond/bond.toml) y commitea .bond/"));
}

async function list(args: string[]): Promise<void> {
	flags(args, [], []);
	const repo: Repo = await import("./repo.mts");
	const root = repo.repoRoot();
	const catalogs = existsSync(join(root, ".bond", "bond.toml")) ? repo.loadRepoConfig(root).catalogs : [];
	const width = Math.max(14, ...catalogs.map((c) => c.name.length + 2));
	console.log(`  ${"bond".padEnd(width)}${dim("incluido en bond")}`);
	for (const c of catalogs.slice(1)) {
		console.log(`  ${c.name.padEnd(width)}${c.git ? `${c.git}  ${dim(`${c.ref ?? "rama por defecto"} @ ${c.sha?.slice(0, 7)}`)}` : `${c.path}  ${dim("carpeta")}`}`);
	}
}

async function update(args: string[]): Promise<void> {
	const { opts, has, pos } = flags(args, ["--ref"], ["--yes", "-y"]);
	if (pos.length > 1) die("uso: bond catalog update [nombre] [--ref tag|rama|sha] [--yes]");
	const { repo, root, file, toml, decl, lock } = await repoState();
	const gits = decl.map((e, i) => ({ e, i })).filter(({ e }) => typeof e.git === "string");
	const targets = pos[0] ? gits.filter(({ e }) => e.name === pos[0]) : gits;
	if (pos[0] && !targets.length) die(decl.some((e) => e.name === pos[0]) ? `${pos[0]} es un catálogo local: no hay nada que actualizar` : `no hay ningún catálogo por git llamado ${pos[0]} (bond catalog list)`);
	if (!targets.length) return console.log(dim("no hay catálogos por git que actualizar"));
	if (opts["--ref"] && targets.length > 1) die("--ref necesita el nombre del catálogo: bond catalog update <nombre> --ref ...");
	// Con el lock al día se puede comparar con lo de antes; si no (falta o es de otra URL), no.
	const fresh = gits.every(({ e }) => {
		const l = lock.catalogs[e.name as string];
		return l && gitKey(l.git) === gitKey(e.git as string) && (l.ref ?? "") === ((e.ref as string | undefined) ?? "");
	});
	const before = fresh ? repo.loadRepoConfig(root) : undefined;
	let nextToml = toml;
	const nextLock: Lock = { catalogs: { ...lock.catalogs } };
	const changed: Array<{ name: string; oldDir?: string }> = [];
	for (const { e, i } of targets) {
		const name = e.name as string;
		const url = e.git as string;
		const ref = opts["--ref"] ?? (e.ref as string | undefined);
		const sha = resolveRef(url, ref);
		const old = lock.catalogs[name];
		if (old && old.sha === sha && gitKey(old.git) === gitKey(url) && (old.ref ?? "") === (ref ?? "")) {
			console.log(`${dim("=")} ${name}: al día (${ref ?? "rama por defecto"} @ ${sha.slice(0, 7)})`);
			continue;
		}
		ensureFetched(url, sha);
		if (opts["--ref"]) nextToml = setInCatalog(nextToml, i, "ref", opts["--ref"]);
		nextLock.catalogs[name] = { git: url, ...(ref ? { ref } : {}), sha };
		changed.push({ name, oldDir: old && gitKey(old.git) === gitKey(url) ? ensureFetched(old.git, old.sha) : undefined });
		console.log(`${caution("~")} ${name}: ${old ? old.sha.slice(0, 7) : "sin fijar"} → ${sha.slice(0, 7)} (${ref ?? "rama por defecto"})`);
	}
	if (!changed.length) return;
	const after = repo.loadRepoConfig(root, { toml: nextToml, lock: nextLock });
	const lines = [...changed.flatMap((c) => mcpReview(c.name, c.oldDir, after.catalogs.find((x) => x.name === c.name)!.dir)), ...movedReview(before, after)];
	if (!(await confirm(lines, has.has("--yes") || has.has("-y")))) die("cancelado: el lock queda como estaba", 130);
	if (nextToml !== toml) writeFileSync(file, nextToml);
	writeLock(root, nextLock);
	repo.syncRepo();
}

async function remove(args: string[]): Promise<void> {
	const { pos } = flags(args, [], []);
	if (pos.length !== 1) die("uso: bond catalog remove <nombre>");
	const name = pos[0];
	const { repo, root, file, toml, decl, lock } = await repoState();
	// Por su name, o por el que tiene su catalog.toml (los locales pueden no llevarlo en bond.toml).
	const i = decl.findIndex((e) => e.name === name || (e.name === undefined && typeof e.path === "string" && existsSync(resolve(root, e.path)) && (validateCatalog(resolve(root, e.path)).name ?? catalogSlug(basename(resolve(root, e.path)))) === name));
	if (i < 0) die(`no hay ningún catálogo ${name} en .bond/bond.toml (bond catalog list)`);
	let nextToml = removeCatalogBlock(toml, i);
	const nextLock: Lock = { catalogs: { ...lock.catalogs } };
	delete nextLock.catalogs[name];
	// Lo que el repo pedía de ese catálogo deja de existir: se quita de la selección.
	const known = repo.availableRefs(root, nextToml, nextLock);
	const raw = parse(nextToml) as Record<string, unknown>;
	const sel = (k: string) => (Array.isArray(raw[k]) ? (raw[k] as string[]) : []);
	const dropped: string[] = [];
	const keep = (k: "mcp" | "skills" | "commands") =>
		sel(k).filter((r) => {
			const found = known[k].has(r);
			if (!found) dropped.push(r);
			return found;
		});
	const kept = { mcp: keep("mcp"), skills: keep("skills"), commands: keep("commands") };
	if (dropped.length) nextToml = repo.updateBondToml(nextToml, { agents: sel("agents"), default_agent: typeof raw.default_agent === "string" ? raw.default_agent : undefined, ...kept });
	repo.loadRepoConfig(root, { toml: nextToml, lock: nextLock });
	writeFileSync(file, nextToml);
	writeLock(root, nextLock);
	console.log(`${bad("-")} catálogo ${name}${dropped.length ? dim(`  (quitado también de la selección: ${dropped.join(", ")})`) : ""}`);
	repo.syncRepo();
}

async function clean(args: string[]): Promise<void> {
	flags(args, [], []);
	const repo: Repo = await import("./repo.mts");
	const root = repo.repoRoot();
	const keep = Object.values(readLock(root).catalogs);
	const n = cleanCache(keep);
	console.log(`${n ? ok("-") : dim("=")} caché de catálogos: ${count(n, "commit borrado", "commits borrados")}${keep.length ? dim(keep.length === 1 ? " (se queda el que fija este repo)" : ` (se quedan los ${keep.length} que fija este repo)`) : ""}`);
}

export async function catalogCommand(args: string[]): Promise<void> {
	const [sub, ...rest] = args;
	if (sub === "create") return create(rest);
	if (sub === "check") return check(rest);
	if (sub === "add") return add(rest);
	if (sub === "list") return list(rest);
	if (sub === "update") return update(rest);
	if (sub === "remove") return remove(rest);
	if (sub === "clean") return clean(rest);
	if (sub) die(`subcomando desconocido: ${sub} (bond catalog --help)`);
	console.log(CATALOG_HELP);
	process.exit(2);
}
