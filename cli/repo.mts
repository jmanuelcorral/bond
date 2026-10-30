// `bond init` y `bond sync`: configuración de agentes de un repo, declarada una vez en
// .bond/bond.toml y generada para cada agente (pi, Claude Code, Copilot, Codex, opencode, Crush,
// Gemini y Antigravity).
//
// Lo que bond escribe queda apuntado en .bond/manifest.json:
// - ficheros propios (skills copiados, comandos): con su hash. Si alguien los edita a mano,
//   sync no los pisa (conflicto) salvo con --force, que guarda copia;
// - JSON compartidos (.mcp.json, .pi/mcp.json, .pi/settings.json): solo las claves de bond;
// - CLAUDE.md: un bloque entre marcas; el resto del fichero es tuyo;
// - symlinks (.claude/skills/<skill> -> .agents/skills/<skill>).
// AGENTS.md lo crea init si falta y a partir de ahí es tuyo.

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parse } from "smol-toml";
import { parseJsonc } from "./agents.mts";
import { agentInstalled } from "./catalog-agents.mts";
import { catalogSlug, count, type McpServer, readCommandNames, readMcps, validateCatalog } from "./catalog.mts";
import { ensureFetched, gitKey, type Lock, readLock, repoRelative } from "./catalog-git.mts";
import { assetsPath, ensureBondLink } from "./runtime.mts";
import { bad, catchingDie, caution, die, dim, isDryRun, log, ok, run, STAMP, warn } from "./util.mts";

export const SUPPORTED_AGENTS = ["pi", "claude", "copilot", "codex", "opencode", "crush", "gemini", "agy"];
/** Catálogo: carpeta del repo o extraída del binario. */
const catalogPath = (...p: string[]) => assetsPath("catalog", ...p);

export const INIT_HELP = `Uso: bond init [opciones]

Prepara el repo actual para tus agentes. Pregunta con cuáles integrarlo (de los instalados,
partiendo de los elegidos en bond setup), cuál abre \`bond\` por defecto y qué herramientas del
catálogo usar: el de bond y los de tu equipo declarados con [[catalog]] en bond.toml. Crea
.bond/bond.toml, un AGENTS.md (si falta) y la config de cada agente; con pi, además las Bond
Extensions. En un repo ya inicializado, permite cambiar la selección. Propone además la
memoria de decisiones (sección \`[decisions]\` de bond.toml, carpeta \`docs/decisions\` con
la skill \`decision-record\`): quita la sección para no usarla.

  --agents <a,b>      Agentes, sin preguntar (${SUPPORTED_AGENTS.join(", ")})
  --default <a>       Agente por defecto
  --mcp <a,b>         Servidores MCP del catálogo (defecto: todos)
  --skills <a,b>      Skills del catálogo (defecto: las marcadas por defecto, sin las opcionales)
  --commands <a,b>    Comandos del catálogo (defecto: todos)
  --yes               Sin preguntas: lo elegido en bond setup y el catálogo por defecto
  --list              Enseña el catálogo (y los del equipo de bond.toml) y sale
  --dry-run           Enseña lo que haría sin escribir`;

export const SYNC_HELP = `Uso: bond sync [opciones]

Genera la configuración de cada agente del repo a partir de .bond/bond.toml.

  --dry-run   Enseña qué cambiaría sin escribir
  --check     No escribe; sale con 1 si algo está desfasado (para CI)
  --force     Sobrescribe ficheros de bond editados a mano (guarda copia .bak)`;

// --- catálogos ----------------------------------------------------------------------------

/**
 * Un catálogo: el de bond (siempre, el primero) o uno del equipo declarado en bond.toml con
 * [[catalog]]. Todos tienen la misma estructura (cli/catalog.mts).
 */
export interface Catalog {
	name: string;
	/** Su carpeta: la del repo de bond, la de path o la de la caché del commit fijado. */
	dir: string;
	/** Carpeta tal cual en bond.toml (catálogo local). */
	path?: string;
	/** URL y ref de bond.toml, y el commit fijado en .bond/lock.json (catálogo por git). */
	git?: string;
	ref?: string;
	sha?: string;
}

interface CatalogEntry {
	/** Resumen breve (en inglés) para bond init. */
	summary?: string;
	/** false: aparece en bond init sin marcar (p. ej. las que necesitan GitHub). */
	default?: boolean;
}

/** Lo que ofrece un catálogo. Los comandos del de bond le llegan a pi por las Bond Extensions. */
interface CatalogContents {
	mcp: Record<string, McpServer>;
	/** En el orden de catalog.toml; las que no estén ahí, al final por nombre. */
	skills: string[];
	commands: string[];
	meta: Record<string, CatalogEntry>;
}

export const bondCatalog = (): Catalog => ({ name: "bond", dir: catalogPath() });
const isBond = (c: Catalog) => !c.path && !c.git;
/** Cómo se nombra un catálogo del equipo en los mensajes: su carpeta, o su URL y commit. */
export const catalogWhere = (c: Catalog) => c.path ?? `${c.git}${c.ref ? `#${c.ref}` : ""} @ ${c.sha?.slice(0, 7)}`;

const contentsCache = new Map<string, CatalogContents>();
function contents(c: Catalog): CatalogContents {
	const hit = contentsCache.get(c.dir);
	if (hit) return hit;
	let meta: Record<string, CatalogEntry> = {};
	try {
		meta = ((parse(readFileSync(join(c.dir, "catalog.toml"), "utf8")) as { skills?: Record<string, CatalogEntry> }).skills ?? {}) as Record<string, CatalogEntry>;
	} catch {
		// Sin catalog.toml legible: sin resúmenes (en los del equipo ya lo cazó el validador).
	}
	const skillsDir = join(c.dir, "skills");
	const found = existsSync(skillsDir) ? readdirSync(skillsDir).filter((d) => existsSync(join(skillsDir, d, "SKILL.md"))) : [];
	const order = Object.keys(meta).filter((n) => found.includes(n));
	const out = { mcp: readMcps(c.dir), skills: [...order, ...found.filter((n) => !order.includes(n)).sort()], commands: readCommandNames(c.dir), meta };
	contentsCache.set(c.dir, out);
	return out;
}

export type Kind = "mcp" | "skills" | "commands";
const KIND_LABEL: Record<Kind, string> = { mcp: "servidores MCP", skills: "skills", commands: "comandos" };

/** Una herramienta de un catálogo: un servidor MCP, una skill o un comando. */
export interface Tool {
	name: string;
	catalog: Catalog;
}

const names = (c: Catalog, kind: Kind) => (kind === "mcp" ? Object.keys(contents(c).mcp) : contents(c)[kind]);
export const toolsOf = (catalogs: Catalog[], kind: Kind): Tool[] => catalogs.flatMap((c) => names(c, kind).map((name) => ({ name, catalog: c })));

/**
 * A qué herramienta lleva un nombre sin prefijo: la de un catálogo del equipo sustituye a la de
 * bond (el equipo ha decidido usar la suya); en dos catálogos del equipo es ambiguo (varias).
 */
function byName(all: Tool[], name: string): Tool[] {
	const found = all.filter((t) => t.name === name);
	const team = found.filter((t) => !isBond(t.catalog));
	return team.length ? team : found;
}

/**
 * La misma herramienta: mismo catálogo y nombre. No vale comparar objetos, porque toolsOf
 * crea unos nuevos en cada llamada.
 */
const sameTool = (a: Tool, b: Tool) => a.name === b.name && a.catalog.name === b.catalog.name;

/** Cómo se escribe en bond.toml: el nombre a secas si lleva a ella, o catalogo:nombre. */
export function refOf(t: Tool, all: Tool[]): string {
	const plain = byName(all, t.name);
	return plain.length === 1 && sameTool(plain[0], t) ? t.name : `${t.catalog.name}:${t.name}`;
}

/** Herramientas pedidas en bond.toml (nombre o catalogo:nombre). Muere si no existen o son ambiguas. */
export function resolveTools(catalogs: Catalog[], kind: Kind, refs: string[]): Tool[] {
	const all = toolsOf(catalogs, kind);
	const out: Tool[] = [];
	const unknown: string[] = [];
	for (const ref of refs) {
		const i = ref.indexOf(":");
		const found = i < 0 ? byName(all, ref) : all.filter((t) => t.catalog.name === ref.slice(0, i) && t.name === ref.slice(i + 1));
		if (!found.length) unknown.push(ref);
		else if (found.length > 1) {
			const from = found.map((t) => t.catalog.name);
			die(`bond.toml: "${ref}" está en los catálogos ${from.join(" y ")}; elige uno: ${from.map((c) => `"${c}:${ref}"`).join(" o ")}`);
		} else out.push(found[0]);
	}
	if (unknown.length) die(`bond.toml: ${KIND_LABEL[kind]} desconocidos: ${unknown.join(", ")} (bond init --list)`);
	for (const t of out) {
		const twice = out.filter((x) => x.name === t.name);
		if (twice.length > 1) die(`bond.toml: ${KIND_LABEL[kind]}: "${t.name}" pedido de ${twice.map((x) => x.catalog.name).join(" y ")}; en el repo solo cabe uno`);
	}
	return out;
}

const skillDir = (t: Tool) => join(t.catalog.dir, "skills", t.name);
const commandText = (t: Tool) => readFileSync(join(t.catalog.dir, "commands", `${t.name}.md`), "utf8");

/** Catálogos del equipo ya avisados por estar fuera del repo (una vez por ejecución). */
const warnedOutside = new Set<string>();

/**
 * El de bond y los de [[catalog]] en bond.toml, validados. Los de git, del commit fijado en el
 * lock (descargado a la caché si falta). Muere si alguno está mal.
 */
function loadCatalogs(root: string, raw: Record<string, unknown>, lock: Lock = readLock(root)): Catalog[] {
	const decl = raw.catalog;
	if (decl === undefined) return [bondCatalog()];
	if (!Array.isArray(decl)) die("bond.toml: catalog tiene que ser una lista de tablas ([[catalog]])");
	const out = [bondCatalog()];
	const validName = (n: unknown): n is string => typeof n === "string" && /^[a-z0-9][a-z0-9_-]*$/.test(n);
	for (const [i, entry] of (decl as Array<Record<string, unknown>>).entries()) {
		const where = `bond.toml: [[catalog]] nº ${i + 1}`;
		const text = (k: string) => (typeof entry?.[k] === "string" && (entry[k] as string).trim() ? (entry[k] as string) : undefined);
		const path = text("path");
		const url = text("git");
		if (path && url) die(`${where}: path o git, no los dos`);
		if (!path && !url) die(`${where}: falta path (una carpeta, relativa al repo) o git (la URL del repo)`);
		let c: Catalog;
		if (url) {
			const name = entry.name;
			if (!validName(name)) die(`${where}: un catálogo por git necesita name (minúsculas, dígitos, - o _)`);
			const ref = text("ref");
			const locked = lock.catalogs[name];
			if (!locked) die(`${where}: ${name} no está fijado en .bond/lock.json: bond catalog update ${name}`);
			if (gitKey(locked.git) !== gitKey(url) || (locked.ref ?? "") !== (ref ?? "")) die(`${where}: .bond/lock.json fija ${name} para otra URL o ref: bond catalog update ${name}`);
			const twin = out.find((o) => o.git && gitKey(o.git) === gitKey(url));
			if (twin) die(`${where}: ${url} ya está como el catálogo ${twin.name}`);
			c = { name, dir: ensureFetched(url, locked.sha), git: url, ref, sha: locked.sha };
		} else {
			const dir = resolve(root, path!);
			if (!existsSync(dir) || !statSync(dir).isDirectory()) die(`${where}: no existe la carpeta ${path}`);
			c = { name: "", dir, path };
		}
		const report = validateCatalog(c.dir);
		const name = entry.name ?? report.name ?? catalogSlug(basename(c.dir));
		if (!validName(name)) die(`${where}: name ${JSON.stringify(name)} no vale (minúsculas, dígitos, - o _)`);
		if (out.some((o) => o.name === name)) die(`${where}: ya hay un catálogo "${name}"${name === "bond" ? " (es el de bond)" : ""}; ponle otro name`);
		c.name = name;
		if (report.errors.length) {
			if (!catchingDie()) for (const e of report.errors) console.error(`${bad("error:")} catálogo ${name} (${catalogWhere(c)}): ${e}`);
			die(`el catálogo ${name} tiene ${count(report.errors.length, "error", "errores")}: arréglalo y compruébalo con bond catalog check ${path ?? c.dir}`);
		}
		const rel = repoRelative(root, c.dir);
		if (path && (rel.startsWith("..") || isAbsolute(rel)) && !warnedOutside.has(c.dir)) {
			warnedOutside.add(c.dir);
			warn(`el catálogo ${name} (${path}) está fuera del repo: al resto del equipo no le sirve si no tiene esa misma carpeta`);
		}
		out.push(c);
	}
	return out;
}

/** Nombres que se pueden pedir en bond.toml con estos catálogos: a secas y catalogo:nombre. */
export function availableRefs(root: string, toml: string, lock: Lock): Record<Kind, Set<string>> {
	const catalogs = loadCatalogs(root, parse(toml) as Record<string, unknown>, lock);
	const refs = (kind: Kind) => new Set(toolsOf(catalogs, kind).flatMap((t) => [t.name, `${t.catalog.name}:${t.name}`]));
	return { mcp: refs("mcp"), skills: refs("skills"), commands: refs("commands") };
}

/** Los catálogos de un repo con bond.toml, o solo el de bond (sin repo, o sin bond.toml). */
function repoCatalogs(root: string): Catalog[] {
	const file = join(bondDir(root), "bond.toml");
	if (!existsSync(file)) return [bondCatalog()];
	try {
		return loadCatalogs(root, parse(readFileSync(file, "utf8")) as Record<string, unknown>);
	} catch (e) {
		die(`.bond/bond.toml no es TOML válido: ${(e as Error).message}`);
	}
}

/** Skills del catálogo de bond que salen marcadas por defecto. */
const defaultSkills = () => {
	const c = contents(bondCatalog());
	return c.skills.filter((n) => c.meta[n]?.default !== false);
};

/** Resumen de una skill: el de catalog.toml o, si no hay, el principio de su description. */
function skillSummary(t: Tool, max: number): string {
	return contents(t.catalog).meta[t.name]?.summary ?? describe(readFileSync(join(skillDir(t), "SKILL.md"), "utf8")).slice(0, max);
}

const isOptional = (t: Tool) => contents(t.catalog).meta[t.name]?.default === false;

function describe(md: string): string {
	return /^description:\s*(.+)$/m.exec(md)?.[1]?.replace(/^["']|["']$/g, "") ?? "";
}

/** Una línea por herramienta: nombre (o catalogo:nombre), descripción y, si no es de bond, su catálogo. */
function catalogRows(catalogs: Catalog[], max: number): Record<Kind, Array<{ ref: string; text: string; tool: Tool }>> {
	const rows = (kind: Kind, text: (t: Tool) => string) => {
		const all = toolsOf(catalogs, kind);
		const origin = (t: Tool) => {
			if (!isBond(t.catalog)) return ` [${t.catalog.name}]`;
			const over = byName(all, t.name).filter((x) => !sameTool(x, t));
			return over.length ? ` (la sustituye ${over.map((x) => x.catalog.name).join(" o ")})` : "";
		};
		return all.map((t) => ({ ref: refOf(t, all), text: text(t) + origin(t), tool: t }));
	};
	return {
		mcp: rows("mcp", (t) => contents(t.catalog).mcp[t.name].description ?? ""),
		skills: rows("skills", (t) => skillSummary(t, max) + (isOptional(t) ? " (opcional)" : "")),
		commands: rows("commands", (t) => describe(commandText(t))),
	};
}

function printCatalog(): void {
	const catalogs = repoCatalogs(repoRoot());
	const rows = catalogRows(catalogs, 90);
	const print = (title: string, list: Array<{ ref: string; text: string }>) => {
		console.log(title);
		const width = Math.max(14, ...list.map((r) => r.ref.length + 1));
		for (const r of list) console.log(`  ${r.ref.padEnd(width)} ${dim(r.text)}`);
	};
	if (catalogs.length > 1) console.log(`Catálogos: ${catalogs.map((c) => (isBond(c) ? "bond" : `${c.name} (${catalogWhere(c)})`)).join(", ")}`);
	print("Servidores MCP:", rows.mcp);
	print("Skills:", rows.skills);
	print("Comandos:", rows.commands);
	console.log(`Agentes: ${SUPPORTED_AGENTS.join(", ")}`);
}

// --- configuración del repo -------------------------------------------------------------

export interface RepoConfig {
	agents: string[];
	/** Agente que abre `bond` en este repo. */
	default_agent?: string;
	/** Tal cual en bond.toml: nombre o catalogo:nombre. */
	mcp: string[];
	skills: string[];
	commands: string[];
	mcp_servers: Record<string, McpServer>;
	catalogs: Catalog[];
	/** Lo pedido, resuelto a su catálogo. */
	tools: Record<Kind, Tool[]>;
	/** Memoria de decisiones del repo ([decisions] en bond.toml); undefined si no la usa. */
	decisions?: { dir: string };
}

export function repoRoot(): string {
	const r = run("git", ["rev-parse", "--show-toplevel"]);
	// En Windows git responde C:/x/y: resolve() lo deja con las barras del sistema.
	return r.status === 0 ? resolve(r.stdout.trim()) : process.cwd();
}

/**
 * Ruta relativa al repo, siempre con /: el manifiesto se commitea y tiene que servir igual en
 * Windows que en Linux y macOS (join en el disco las convierte al separador del sistema).
 */
const repoPath = (...parts: string[]) => join(...parts).split(sep).join("/");

const bondDir = (root: string) => join(root, ".bond");

/**
 * bond.toml del repo, resuelto y validado. Con `toml`/`lock` se valida lo que se va a escribir
 * (bond catalog add, update...) antes de escribirlo: si algo no cuadra, muere sin tocar nada.
 */
export function loadRepoConfig(root: string, over: { toml?: string; lock?: Lock } = {}): RepoConfig {
	const file = join(bondDir(root), "bond.toml");
	if (over.toml === undefined && !existsSync(file)) die(`no hay ${relative(process.cwd(), file) || file}: ejecuta bond init`);
	let raw: Record<string, unknown>;
	try {
		raw = parse(over.toml ?? readFileSync(file, "utf8")) as Record<string, unknown>;
	} catch (e) {
		die(`.bond/bond.toml no es TOML válido: ${(e as Error).message}`);
	}
	const list = (k: string) => (Array.isArray(raw[k]) ? (raw[k] as string[]) : []);
	// Nombres antiguos del catálogo: "web" chocaba con un espacio de nombres reservado de OpenAI.
	const ALIASES: Record<string, string> = { web: "duckduckgo" };
	const mcp = list("mcp").map((n) => {
		if (!ALIASES[n]) return n;
		warn(`bond.toml: el servidor MCP "${n}" ahora se llama "${ALIASES[n]}"; cámbialo en .bond/bond.toml`);
		return ALIASES[n];
	});
	const agents = list("agents");
	const unknownAgents = agents.filter((a) => !SUPPORTED_AGENTS.includes(a));
	if (unknownAgents.length) die(`bond.toml: agentes desconocidos: ${unknownAgents.join(", ")} (bond init --list)`);
	const catalogs = loadCatalogs(root, raw, over.lock);
	const cfg: RepoConfig = {
		agents,
		default_agent: typeof raw.default_agent === "string" ? raw.default_agent : undefined,
		mcp,
		skills: list("skills"),
		commands: list("commands"),
		mcp_servers: (raw.mcp_servers ?? {}) as Record<string, McpServer>,
		catalogs,
		tools: { mcp: resolveTools(catalogs, "mcp", mcp), skills: resolveTools(catalogs, "skills", list("skills")), commands: resolveTools(catalogs, "commands", list("commands")) },
	};
	for (const [name, s] of Object.entries(cfg.mcp_servers)) {
		if (!s.command && !s.url) die(`bond.toml: mcp_servers.${name} necesita command o url`);
	}
	cfg.decisions = parseDecisions(root, raw.decisions);
	return cfg;
}

/**
 * La sección [decisions] del repo sin exigir el resto de la config: undefined si no hay
 * repo, ni bond.toml, ni sección. Con bond.toml inválido, muere como loadRepoConfig.
 * La usan `bond decisions` y `bond doctor` para no arrastrar el resto de la config.
 */
export function repoDecisions(root: string): { dir: string } | undefined {
	const file = join(bondDir(root), "bond.toml");
	if (!existsSync(file)) return undefined;
	let raw: Record<string, unknown>;
	try {
		raw = parse(readFileSync(file, "utf8")) as Record<string, unknown>;
	} catch (e) {
		die(`.bond/bond.toml no es TOML válido: ${(e as Error).message}`);
	}
	return parseDecisions(root, raw.decisions);
}

/**
 * Sección [decisions] del bond.toml: la memoria de decisiones del repo (skill
 * decision-record). Sin la sección, nada cambia. Con ella, `dir` es la carpeta donde van
 * las decisiones y los runs (por defecto docs/decisions); tiene que quedar dentro del repo:
 * una ruta absoluta o con .. que salga de él se rechaza.
 */
function parseDecisions(root: string, v: unknown): { dir: string } | undefined {
	if (v === undefined) return undefined;
	if (typeof v !== "object" || v === null || Array.isArray(v)) die('bond.toml: decisions tiene que ser una tabla: [decisions] con dir = "docs/decisions"');
	const d = v as Record<string, unknown>;
	const dir = typeof d.dir === "string" && d.dir.trim() ? d.dir.trim() : "docs/decisions";
	// Sin realpath: la carpeta puede no existir aún, y resolver solo la raíz (en macOS /var ->
	// /private/var; en Windows, rutas cortas) daría una ruta relativa con .. falsa.
	const rel = relative(resolve(root), resolve(root, dir)).split(sep).join("/") || ".";
	if (isAbsolute(dir) || isAbsolute(rel) || rel === "." || rel === ".." || rel.startsWith("../")) {
		die(`bond.toml: decisions.dir ${JSON.stringify(dir)} tiene que ser una carpeta dentro del repo: relativa, sin .. y sin ruta absoluta`);
	}
	return { dir: dir.split(sep).join("/") };
}

/** bond.toml del repo leído (sin validar el resto), o undefined si no hay. Muere si no es TOML. */
export function repoToml(root: string): Record<string, unknown> | undefined {
	const file = join(bondDir(root), "bond.toml");
	if (!existsSync(file)) return undefined;
	try {
		return parse(readFileSync(file, "utf8")) as Record<string, unknown>;
	} catch (e) {
		die(`.bond/bond.toml no es TOML válido: ${(e as Error).message}`);
	}
}

// --- plan: lo que debería existir ---------------------------------------------------------

type Output =
	| { kind: "file"; path: string; content: string; mode?: number }
	| { kind: "link"; path: string; target: string }
	/** Claves de bond dentro de un JSON; `parent` es una ruta con puntos ("mcp.servers") o null (raíz). */
	| { kind: "json"; path: string; parent: string | null; entries: Record<string, unknown> }
	/** Bloque entre marcas al final de un fichero de texto: comentario HTML (md) o almohadilla (hash). */
	| { kind: "block"; path: string; body: string; style: BlockStyle };

export type BlockStyle = "md" | "hash";

interface Manifest {
	files: Record<string, string>;
	links: Record<string, string>;
	json: Record<string, Array<{ parent: string | null; keys: string[] }>>;
	blocks: Record<string, BlockStyle>;
}

const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

function walk(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

const tomlKey = (k: string) => (/^[A-Za-z0-9_-]+$/.test(k) ? k : JSON.stringify(k));
const tomlInline = (o: Record<string, string>) => `{ ${Object.entries(o).map(([k, v]) => `${tomlKey(k)} = ${JSON.stringify(v)}`).join(", ")} }`;

/** Reglas `ask` que la 1.8.0 dejaba en .claude/settings.json (D21, ya sustituida): sync las quita. */
export const OLD_BOND_ASK_RULES = ["Bash(bond decisions accept:*)", "Bash(bond decisions reject:*)", "Bash(bond decisions supersede:*)"];

/** Comando en Markdown (frontmatter + cuerpo con $ARGUMENTS) a comando TOML de Gemini ({{args}}). */
function geminiCommand(md: string): string {
	const m = /^---\n([\s\S]*?)\n---\n?/.exec(md);
	const body = (m ? md.slice(m[0].length) : md).replace(/\$ARGUMENTS|\$@|\$[1-9]/g, "{{args}}").trim();
	const desc = describe(md);
	// Cadena literal multilínea de TOML (''' ... '''): no interpreta escapes ni comillas.
	const q = "'''";
	const prompt = body.includes(q) ? JSON.stringify(body) : `${q}\n${body}\n${q}`;
	return `${desc ? `description = ${JSON.stringify(desc)}\n` : ""}prompt = ${prompt}\n`;
}

/**
 * Comando en Markdown a skill de Antigravity (/nombre): frontmatter con name y description, y
 * $ARGUMENTS, $@ y $1... cambiados por una indicación de usar el texto que sigue al comando.
 */
export function agyCommand(name: string, md: string): string {
	const m = /^---\n([\s\S]*?)\n---\n?/.exec(md);
	const after = `el texto que el usuario escriba tras \`/${name}\``;
	const body = (m ? md.slice(m[0].length) : md)
		.replace(/\$ARGUMENTS|\$@/g, `(${after})`)
		.replace(/\$([1-9])/g, (_, n) => `(la palabra ${n} de ${after})`)
		.trim();
	// Cadenas JSON: son YAML válido con comillas dobles, con cualquier carácter dentro.
	const desc = describe(md) || `Comando /${name} del repo`;
	return `---\nname: ${JSON.stringify(name)}\ndescription: ${JSON.stringify(desc)}\n---\n\n${body}\n`;
}

function plan(root: string, cfg: RepoConfig, prev: Manifest): Output[] {
	const out: Output[] = [];
	const agents = new Set(cfg.agents);
	const servers: Record<string, McpServer> = {
		...Object.fromEntries(cfg.tools.mcp.map((t) => [t.name, contents(t.catalog).mcp[t.name]])),
		...cfg.mcp_servers,
	};

	// Skills: se copian a .agents/skills/, que leen pi y casi todos los agentes.
	for (const t of cfg.tools.skills) {
		const src = skillDir(t);
		for (const f of walk(src)) {
			out.push({ kind: "file", path: repoPath(".agents", "skills", t.name, relative(src, f)), content: readFileSync(f, "utf8"), mode: statSync(f).mode & 0o777 });
		}
	}
	// Todos los skills del repo, para enlazarlos a Claude: los del catálogo elegidos y los
	// propios (carpetas con SKILL.md que no copió bond; las que copió y ya no se piden, se van).
	const skillsDir = join(root, ".agents", "skills");
	const own = existsSync(skillsDir)
		? readdirSync(skillsDir).filter((d) => existsSync(join(skillsDir, d, "SKILL.md")) && !prev.files[repoPath(".agents", "skills", d, "SKILL.md")])
		: [];
	const chosen = new Map(cfg.tools.skills.map((t) => [t.name, t]));
	const allSkills = new Set([...chosen.keys(), ...own]);

	// Comandos propios del repo: .bond/commands/*.md (sintaxis común: $ARGUMENTS, $1...).
	const ownDir = join(bondDir(root), "commands");
	const ownCommands = existsSync(ownDir) ? readdirSync(ownDir).filter((f) => f.endsWith(".md")) : [];

	if (agents.has("pi")) {
		const piServers = Object.fromEntries(
			Object.entries(servers).map(([n, s]) => [
				n,
				{
					...(s.url ? { url: s.url, ...(s.headers ? { headers: s.headers } : {}) } : { command: s.command, args: s.args ?? [], ...(s.env ? { env: s.env } : {}) }),
					...(s.description ? { description: s.description } : {}),
					exposure: "direct",
				},
			]),
		);
		out.push({ kind: "json", path: repoPath(".pi", "mcp.json"), parent: "mcpServers", entries: piServers });
		// Bond Extensions (pie de estado, cabecera, repo_map, /delegate, /team, comandos del
		// catálogo): por ~/.bond/pi, un enlace estable a la versión instalada de bond, así la
		// ruta sirve en cualquier máquina con bond.
		out.push({ kind: "json", path: repoPath(".pi", "settings.json"), parent: null, entries: { defaultTools: ["+grep", "+find", "+ls"], packages: ["~/.bond/pi"] } });
		// Los comandos del catálogo de bond le llegan a pi por el paquete global de bond; aquí, los
		// de los catálogos del equipo y los propios.
		for (const t of cfg.tools.commands.filter((t) => !isBond(t.catalog))) out.push({ kind: "file", path: repoPath(".pi", "prompts", `${t.name}.md`), content: commandText(t) });
		for (const f of ownCommands) out.push({ kind: "file", path: repoPath(".pi", "prompts", f), content: readFileSync(join(ownDir, f), "utf8") });
	}

	// Claude y Copilot leen el mismo .mcp.json (Copilot, solo si confías en la carpeta).
	if (agents.has("claude") || agents.has("copilot")) {
		const shared = Object.fromEntries(
			Object.entries(servers).map(([n, s]) => [
				n,
				s.url
					? { type: "http", url: s.url, ...(s.headers ? { headers: s.headers } : {}) }
					: { command: s.command, args: s.args ?? [], ...(s.env ? { env: s.env } : {}) },
			]),
		);
		out.push({ kind: "json", path: ".mcp.json", parent: "mcpServers", entries: shared });
		// Copilot también lee .claude/commands como skills: un solo sitio para los dos.
		for (const t of cfg.tools.commands) out.push({ kind: "file", path: repoPath(".claude", "commands", `${t.name}.md`), content: commandText(t) });
		for (const f of ownCommands) out.push({ kind: "file", path: repoPath(".claude", "commands", f), content: readFileSync(join(ownDir, f), "utf8") });
	}

	if (agents.has("claude")) {
		out.push({ kind: "block", path: "CLAUDE.md", body: "@AGENTS.md", style: "md" });
		// Las reglas `ask` que la 1.8.0 dejaba para `bond decisions accept/reject/supersede` (D21)
		// se quitaron: si el usuario ya lo ha pedido por chat, validar otra vez el comando
		// sobra. Aquí solo se limpian: se van las de bond y se quedan las del usuario; si no
		// queda ninguna, la limpieza genérica del manifiesto se lleva la clave. Se lee el
		// fichero actual al planificar para que `--check` quede al día.
		const settingsPath = repoPath(".claude", "settings.json");
		let existingAsk: unknown[] = [];
		const curSettings = readText(join(root, settingsPath));
		if (curSettings?.trim()) {
			try {
				const parsed = parseJsonc(curSettings) as Record<string, unknown>;
				const ask = (parsed.permissions as Record<string, unknown> | undefined)?.ask;
				if (Array.isArray(ask)) existingAsk = ask;
			} catch {
				// JSON inválido: diffActions lo marcará como conflicto y no lo tocará.
			}
		}
		const withoutBond = existingAsk.filter((r) => !OLD_BOND_ASK_RULES.includes(r as string));
		const hasBondRules = existingAsk.some((r) => OLD_BOND_ASK_RULES.includes(r as string));
		// Si bond gestionaba la clave (manifiesto), hay que seguir planificándola mientras queden
		// reglas del usuario: si no, la limpieza genérica se llevaría también las suyas.
		const tracked = (prev.json[settingsPath] ?? []).some((j) => (j.parent ?? "") === "permissions");
		if ((hasBondRules || tracked) && withoutBond.length) {
			out.push({ kind: "json", path: settingsPath, parent: "permissions", entries: { ask: withoutBond } });
		}
		// Claude no lee .agents/skills: un symlink por skill. En Windows los symlinks necesitan
		// permisos especiales, así que se copian los ficheros (desde el catálogo o del repo).
		for (const name of allSkills) {
			if (process.platform !== "win32") {
				out.push({ kind: "link", path: repoPath(".claude", "skills", name), target: join("..", "..", ".agents", "skills", name) });
				continue;
			}
			const t = chosen.get(name);
			const src = t ? skillDir(t) : join(skillsDir, name);
			for (const f of walk(src)) {
				out.push({ kind: "file", path: repoPath(".claude", "skills", name, relative(src, f)), content: readFileSync(f, "utf8") });
			}
		}
	}

	if (agents.has("codex")) {
		// MCP en .codex/config.toml (Codex solo lo carga en proyectos de confianza). Sin comandos
		// de proyecto: Codex los tiene solo a nivel de usuario y obsoletos en favor de skills.
		let body = "";
		for (const [n, s] of Object.entries(servers)) {
			body += `[mcp_servers.${tomlKey(n)}]\n`;
			if (s.url) {
				body += `url = ${JSON.stringify(s.url)}\n`;
				if (s.headers) body += `http_headers = ${tomlInline(s.headers)}\n`;
			} else {
				body += `command = ${JSON.stringify(s.command)}\nargs = ${JSON.stringify(s.args ?? [])}\n`;
				if (s.env) body += `env = ${tomlInline(s.env)}\n`;
			}
			body += "\n";
		}
		out.push({ kind: "block", path: repoPath(".codex", "config.toml"), body: body.trimEnd(), style: "hash" });
	}

	if (agents.has("opencode")) {
		const oc = Object.fromEntries(
			Object.entries(servers).map(([n, s]) => [
				n,
				s.url
					? { type: "remote", url: s.url, ...(s.headers ? { headers: s.headers } : {}) }
					: { type: "local", command: [s.command, ...(s.args ?? [])], ...(s.env ? { environment: s.env } : {}) },
			]),
		);
		out.push({ kind: "json", path: "opencode.json", parent: "mcp.servers", entries: oc });
		for (const t of cfg.tools.commands) out.push({ kind: "file", path: repoPath(".opencode", "commands", `${t.name}.md`), content: commandText(t) });
		for (const f of ownCommands) out.push({ kind: "file", path: repoPath(".opencode", "commands", f), content: readFileSync(join(ownDir, f), "utf8") });
	}

	if (agents.has("crush")) {
		// Sin comandos: los de proyecto van en .crush/commands, dentro del directorio de datos de
		// Crush, que él mismo ignora en git. Crush ofrece además los skills como comandos.
		const cr = Object.fromEntries(
			Object.entries(servers).map(([n, s]) => [
				n,
				s.url
					? { type: "http", url: s.url, ...(s.headers ? { headers: s.headers } : {}) }
					: { type: "stdio", command: s.command, args: s.args ?? [], ...(s.env ? { env: s.env } : {}) },
			]),
		);
		out.push({ kind: "json", path: ".crush.json", parent: "mcp", entries: cr });
	}

	if (agents.has("gemini")) {
		const settings = repoPath(".gemini", "settings.json");
		// Gemini lee GEMINI.md por defecto: se le añade AGENTS.md.
		out.push({ kind: "json", path: settings, parent: "context", entries: { fileName: ["AGENTS.md", "GEMINI.md"] } });
		const gm = Object.fromEntries(
			Object.entries(servers).map(([n, s]) => [
				n,
				s.url
					? { httpUrl: s.url, ...(s.headers ? { headers: s.headers } : {}) }
					: { command: s.command, args: s.args ?? [], ...(s.env ? { env: s.env } : {}) },
			]),
		);
		out.push({ kind: "json", path: settings, parent: "mcpServers", entries: gm });
		const commands = [
			...cfg.tools.commands.map((t) => [t.name, commandText(t)] as const),
			...ownCommands.map((f) => [f.slice(0, -3), readFileSync(join(ownDir, f), "utf8")] as const),
		];
		for (const [name, md] of commands) out.push({ kind: "file", path: repoPath(".gemini", "commands", `${name}.toml`), content: geminiCommand(md) });
	}

	if (agents.has("agy")) {
		// Antigravity lee AGENTS.md y .agents/skills/ por su cuenta, pero no MCP ni comandos del
		// repo: van en un plugin de bond (.agents/plugins/bond/), y cada comando es una skill.
		const plugin = (...p: string[]) => repoPath(".agents", "plugins", "bond", ...p);
		out.push({ kind: "file", path: plugin("plugin.json"), content: `${JSON.stringify({ name: "bond" }, null, 2)}\n` });
		const ag = Object.fromEntries(
			Object.entries(servers).map(([n, s]) => [
				n,
				s.url ? { url: s.url, ...(s.headers ? { headers: s.headers } : {}) } : { command: s.command, args: s.args ?? [], ...(s.env ? { env: s.env } : {}) },
			]),
		);
		out.push({ kind: "file", path: plugin("mcp_config.json"), content: `${JSON.stringify({ mcpServers: ag }, null, 2)}\n` });
		const commands = [
			...cfg.tools.commands.map((t) => [t.name, commandText(t)] as const),
			...ownCommands.map((f) => [f.slice(0, -3), readFileSync(join(ownDir, f), "utf8")] as const),
		];
		for (const [name, md] of commands) out.push({ kind: "file", path: plugin("skills", name, "SKILL.md"), content: agyCommand(name, md) });
	}
	return out;
}

// --- aplicar ------------------------------------------------------------------------------

const DEFAULT_NOTE = "generado por `bond sync`; no editar";
const MARKER_TEXT: Record<BlockStyle, { open: string; begin: (note: string) => string; end: string }> = {
	md: { open: "<!-- >>> bond >>>", begin: (n) => `<!-- >>> bond >>> ${n} -->`, end: "<!-- <<< bond <<< -->" },
	hash: { open: "# >>> bond >>>", begin: (n) => `# >>> bond >>> ${n}`, end: "# <<< bond <<<" },
};

/**
 * El bloque de bond va al final; en TOML, unas tablas al final no cambian el resto. El bloque
 * existente se reconoce por el principio de la marca, sea cual sea su nota.
 */
export function withBlock(current: string, body: string, style: BlockStyle, note = DEFAULT_NOTE): string {
	const { open, begin, end } = MARKER_TEXT[style];
	const start = current.indexOf(open);
	let rest = current;
	if (start >= 0) {
		const stop = current.indexOf(end, start);
		const before = current.slice(0, start).replace(/\n+$/, "\n");
		const after = stop < 0 ? "" : current.slice(stop + end.length).replace(/^\n/, "");
		// Sin nada delante del bloque, lo de detrás no debe empezar con líneas en blanco.
		rest = before.trim() ? before + after : after.replace(/^\n+/, "");
	}
	rest = rest.replace(/^\n+/, "");
	if (!body) return rest;
	const base = rest.trim() ? `${rest.replace(/\n*$/, "")}\n\n` : "";
	return `${base}${begin(note)}\n${body}\n${end}\n`;
}

/** Contenedor en una ruta con puntos ("mcp.servers"), creando los niveles que falten. */
function containerAt(obj: Record<string, unknown>, path: string | null): Record<string, unknown> {
	let cur = obj;
	for (const k of path ? path.split(".") : []) {
		if (typeof cur[k] !== "object" || cur[k] === null || Array.isArray(cur[k])) cur[k] = {};
		cur = cur[k] as Record<string, unknown>;
	}
	return cur;
}

/** Quita los objetos vacíos que dejó bond a lo largo de la ruta. */
function pruneEmpty(obj: Record<string, unknown>, path: string | null): void {
	const keys = path ? path.split(".") : [];
	for (let n = keys.length; n > 0; n--) {
		const parent = containerAt(obj, n > 1 ? keys.slice(0, n - 1).join(".") : null);
		const child = parent[keys[n - 1]] as Record<string, unknown>;
		if (child && Object.keys(child).length === 0) delete parent[keys[n - 1]];
		else break;
	}
}

function readText(p: string): string | undefined {
	try {
		return readFileSync(p, "utf8");
	} catch {
		return undefined;
	}
}

function linkAt(p: string): string | undefined {
	try {
		return lstatSync(p).isSymbolicLink() ? readlinkSync(p) : undefined;
	} catch {
		return undefined;
	}
}

const existsAny = (p: string) => {
	try {
		lstatSync(p);
		return true;
	} catch {
		return false;
	}
};

interface Action {
	sign: "+" | "~" | "-" | "!";
	path: string;
	why?: string;
	apply?: () => void;
}

function loadManifest(root: string): Manifest {
	try {
		const m = JSON.parse(readFileSync(join(bondDir(root), "manifest.json"), "utf8"));
		// Registro de bond 0.4: json con un solo contenedor por fichero y blocks como lista.
		const json = Object.fromEntries(Object.entries(m.json ?? {}).map(([p, v]) => [p, Array.isArray(v) ? v : [v]])) as Manifest["json"];
		const blocks = Array.isArray(m.blocks) ? Object.fromEntries((m.blocks as string[]).map((p) => [p, "md"])) : (m.blocks ?? {});
		// Registro de bond <= 1.0.1 escrito en Windows: rutas con \.
		const slashes = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).map(([p, v]) => [p.replaceAll("\\", "/"), v])) as Record<string, T>;
		return { files: slashes(m.files ?? {}), links: slashes(m.links ?? {}), json: slashes(json), blocks: slashes(blocks) };
	} catch {
		return { files: {}, links: {}, json: {}, blocks: {} };
	}
}

function diffActions(root: string, outputs: Output[], prev: Manifest, force: boolean): { actions: Action[]; next: Manifest } {
	const actions: Action[] = [];
	const next: Manifest = { files: {}, links: {}, json: {}, blocks: {} };
	const abs = (p: string) => join(root, p);
	const write = (p: string, content: string, mode?: number) => () => {
		mkdirSync(dirname(abs(p)), { recursive: true });
		if (existsAny(abs(p)) && linkAt(abs(p)) !== undefined) rmSync(abs(p));
		writeFileSync(abs(p), content);
		if (mode) run("chmod", [mode.toString(8), abs(p)]);
	};
	const backup = (p: string) => () => copyFileSync(abs(p), `${abs(p)}.bak.${STAMP}`);

	// Lo que estaba gestionado y ya no se genera: JSON y bloques se vacían; ficheros y links se borran.
	const planned = new Set(outputs.map((o) => o.path));
	const jsonPlanned = new Set(outputs.filter((o) => o.kind === "json").map((o) => `${o.path}\0${o.parent ?? ""}`));
	for (const [p, list] of Object.entries(prev.json)) {
		for (const j of list) if (!jsonPlanned.has(`${p}\0${j.parent ?? ""}`)) outputs.push({ kind: "json", path: p, parent: j.parent, entries: {} });
	}
	for (const [p, style] of Object.entries(prev.blocks)) if (!planned.has(p)) outputs.push({ kind: "block", path: p, body: "", style });

	// JSON: todas las salidas de un mismo fichero se aplican juntas sobre su contenido actual.
	const jsonByPath = new Map<string, Array<Extract<Output, { kind: "json" }>>>();
	for (const o of outputs) if (o.kind === "json") jsonByPath.set(o.path, [...(jsonByPath.get(o.path) ?? []), o]);
	for (const [p, group] of jsonByPath) {
		const cur = readText(abs(p));
		let obj: Record<string, unknown>;
		try {
			obj = cur?.trim() ? parseJsonc(cur) : {};
		} catch {
			actions.push({ sign: "!", path: p, why: "no es JSON válido; no lo toco" });
			continue;
		}
		const created = cur === undefined;
		const touched: string[] = [];
		for (const o of group) {
			const container = containerAt(obj, o.parent);
			const before = prev.json[p]?.find((j) => (j.parent ?? "") === (o.parent ?? ""))?.keys ?? [];
			for (const k of before) delete container[k];
			Object.assign(container, o.entries);
			pruneEmpty(obj, o.parent);
			const keys = Object.keys(o.entries);
			if (keys.length) {
				next.json[p] = [...(next.json[p] ?? []), { parent: o.parent, keys }];
				touched.push(`${o.parent ?? "raíz"}: ${keys.join(", ")}`);
			}
		}
		// opencode.json nuevo: con su $schema, como lo crea opencode.
		if (created && p === "opencode.json" && Object.keys(obj).length) obj = { $schema: "https://opencode.ai/config.json", ...obj };
		const empty = Object.keys(obj).length === 0;
		const text = empty ? "" : `${JSON.stringify(obj, null, 2)}\n`;
		if ((cur ?? "") === text) continue;
		if (empty && cur !== undefined) actions.push({ sign: "-", path: p, apply: () => rmSync(abs(p)) });
		else if (!empty) actions.push({ sign: created ? "+" : "~", path: p, why: touched.join("; ") || "sin claves de bond", apply: write(p, text) });
	}

	for (const o of outputs) {
		if (o.kind === "json") continue;
		const cur = readText(abs(o.path));
		if (o.kind === "file") {
			const recorded = prev.files[o.path];
			const target = sha(o.content);
			if (cur === o.content) {
				next.files[o.path] = target;
			} else if (cur === undefined || (recorded && sha(cur) === recorded)) {
				actions.push({ sign: cur === undefined ? "+" : "~", path: o.path, apply: write(o.path, o.content, o.mode) });
				next.files[o.path] = target;
			} else if (force) {
				actions.push({ sign: "~", path: o.path, why: "editado a mano; se guarda copia .bak", apply: () => (backup(o.path)(), write(o.path, o.content, o.mode)()) });
				next.files[o.path] = target;
			} else {
				actions.push({ sign: "!", path: o.path, why: recorded ? "editado a mano desde el último sync (--force para sobrescribir)" : "ya existe y no es de bond (--force para sobrescribir)" });
				if (recorded) next.files[o.path] = recorded;
			}
		} else if (o.kind === "link") {
			const have = linkAt(abs(o.path));
			if (have === o.target) next.links[o.path] = o.target;
			else if (!existsAny(abs(o.path))) {
				actions.push({ sign: "+", path: o.path, why: `-> ${o.target}`, apply: () => (mkdirSync(dirname(abs(o.path)), { recursive: true }), symlinkSync(o.target, abs(o.path))) });
				next.links[o.path] = o.target;
			} else actions.push({ sign: "!", path: o.path, why: "ya existe y no es el enlace de bond" });
		} else {
			const text = withBlock(cur ?? "", o.body, o.style);
			if (o.body) next.blocks[o.path] = o.style;
			if ((cur ?? "") === text) continue;
			if (!text.trim() && cur !== undefined) actions.push({ sign: "-", path: o.path, apply: () => rmSync(abs(o.path)) });
			else actions.push({ sign: cur === undefined ? "+" : "~", path: o.path, why: "bloque de bond", apply: write(o.path, text) });
		}
	}

	// Ficheros y enlaces de bond que ya no se generan.
	for (const [p, h] of Object.entries(prev.files)) {
		if (planned.has(p) || !existsAny(abs(p))) continue;
		if (sha(readText(abs(p)) ?? "") === h) actions.push({ sign: "-", path: p, apply: () => rmSync(abs(p)) });
		else actions.push({ sign: "!", path: p, why: "ya no lo genera bond, pero se editó a mano: no lo borro" });
	}
	for (const [p, t] of Object.entries(prev.links)) {
		if (planned.has(p)) continue;
		if (linkAt(abs(p)) === t) actions.push({ sign: "-", path: p, apply: () => rmSync(abs(p)) });
	}
	return { actions, next };
}

/** Sincroniza el repo; devuelve las acciones pendientes (para --check y doctor). */
export function syncRepo(opts: { check?: boolean; force?: boolean; quiet?: boolean } = {}): Action[] {
	const root = repoRoot();
	const cfg = loadRepoConfig(root);
	const prev = loadManifest(root);
	const { actions, next } = diffActions(root, plan(root, cfg, prev), prev, !!opts.force);
	const say = (s: string) => !opts.quiet && console.log(s);
	const color = { "+": ok, "~": caution, "-": bad, "!": bad };
	for (const a of actions) say(`${color[a.sign](a.sign)} ${a.path}${a.why ? dim(`  ${a.why}`) : ""}`);
	const pending = actions.filter((a) => a.apply);
	if (opts.check || isDryRun()) {
		if (!actions.length) say(ok("al día"));
		return actions;
	}
	for (const a of pending) a.apply!();
	// Tras borrar, se quitan los directorios que hayan quedado vacíos, subiendo hasta la raíz.
	for (const a of pending.filter((x) => x.sign === "-")) {
		let d = dirname(join(root, a.path));
		while (d.startsWith(root) && d !== root && existsSync(d) && readdirSync(d).length === 0) {
			rmSync(d, { recursive: true });
			d = dirname(d);
		}
	}
	writeFileSync(join(bondDir(root), "manifest.json"), `${JSON.stringify(next, null, 2)}\n`);
	// Memoria de decisiones: crea el README (formato) si falta. Como AGENTS.md, no se registra en
	// el manifiesto: a partir de aquí es del repo y sync no lo pisa ni lo da por desfasado.
	let decisionsReadmeCreated = false;
	if (cfg.decisions) {
		const readme = join(root, ...cfg.decisions.dir.split("/"), "README.md");
		if (!existsSync(readme)) {
			mkdirSync(dirname(readme), { recursive: true });
			writeFileSync(readme, decisionsReadme());
			say(`${ok("+")} ${repoPath(cfg.decisions.dir, "README.md")}${dim("  formato de decisiones: a partir de aquí es tuyo (el listado lo da bond decisions)")}`);
			decisionsReadmeCreated = true;
		}
	}
	if (!actions.length && !decisionsReadmeCreated) say(ok("al día"));
	const conflicts = actions.filter((a) => a.sign === "!");
	if (conflicts.length) warn(`${conflicts.length} conflicto(s): revisa los marcados con ! (o bond sync --force)`);
	return actions;
}

export function sync(args: string[]): void {
	for (const a of args) if (!["--check", "--force", "--dry-run"].includes(a)) die(`opción desconocida: ${a} (bond sync --help)`);
	const actions = syncRepo({ check: args.includes("--check"), force: args.includes("--force") });
	if (args.includes("--check") && actions.length) process.exitCode = 1;
}

/** El README (formato del registro) que bond deja en la carpeta de decisiones cuando no existe. */
export function decisionsReadme(): string {
	return `# Decisiones

Memoria de decisiones de este repo (bond). Cada decisión no trivial —del usuario o de un
agente— queda aquí en un fichero Markdown versionado con git, para poder auditar después qué
se decidió, quién y por qué. La skill \`decision-record\` explica cuándo y cómo registrarla.

No hay índice que mantener: el listado lo da \`bond decisions\` (también con \`--json\`).
Registrar, aceptar o sustituir decisiones no reescribe este README, así que dos ramas
paralelas que registran decisiones se fusionan sin conflictos de memoria.

## Formato

Un fichero por decisión: \`YYYY-MM-DD-slug.md\`; el id es el nombre del fichero sin extensión
(si el mismo slug se repite el mismo día, sufijo \`-2\`).

\`\`\`yaml
---
id: "2026-01-01-ejemplo"
title: "Título corto de la decisión"
status: "proposed"   # proposed | accepted | rejected | superseded
date: "2026-01-01"
decided_by: "user"   # user | agent:<kind>[/<nombre>]
accepted_by: ""      # referencia a la aceptación del usuario, si la hay
supersedes: ""       # id de la decisión que esta sustituye
superseded_by: ""    # id de la decisión que la sustituye
links: []            # plan, fase, commits, PR, run
---
\`\`\`

Cuerpo (los apartados que escribe \`bond decisions add\`, en inglés, como las skills):
*Context*, *Decision*, *Rejected alternatives*, *Consequences* (este último solo si
se pasan consecuencias al registrar).

Una decisión tomada por un agente sin confirmar entra como \`proposed\`; solo el usuario la
pasa a \`accepted\`. Puede hacerlo desde la terminal (\`bond decisions accept <id>\`, con
confirmación interactiva) o desde la conversación con su agente (comando \`/accept\`):
\`bond decisions accept <id>... --confirmed-by "<lo que dijo el usuario>"\` guarda esa
referencia en \`accepted_by\` y deja en \`accepted_via\` quién lo ejecutó
(\`agent:<kind>/<nombre>\` desde un panel de Herdr, \`user\` fuera). Sin terminal y sin
\`--confirmed-by\`, el comando se niega: la barrera evita que un agente acepte por
descuido; no es una medida de seguridad: la integridad del registro la da git, y una
aceptación indebida se ve en el diff y se revierte con \`supersede\` o \`git revert\`.
Si el usuario ya aprobó la decisión (por ejemplo, con el plan), se registra directamente
aceptada: \`bond decisions add ... --confirmed-by "<lo que dijo>"\`.

## Runs

En \`runs/\` quedan los encargos hechos a agentes (equipos con \`bond team\`, delegaciones):
un fichero por run, \`YYYY-MM-DD-<agente>-<slug>.md\`, con el texto exacto enviado y el
informe recibido. Los escribe el orquestador, nunca el agente de la rama.
`;
}

// --- init ---------------------------------------------------------------------------------

export function agentsMd(name: string): string {
	return `# ${name}

Instrucciones del proyecto para todos los agentes de código que lo usan (vía bond).
Las personales de cada uno van en su configuración global; aquí, solo lo de este repo.

## Qué es

<!-- Una o dos frases: qué hace este proyecto y para quién. -->

## Cómo se trabaja aquí

<!-- Comandos exactos para instalar, compilar, probar y lintar. Convenciones que importan. -->

## Qué no hacer

<!-- Ficheros generados que no se editan, zonas delicadas, dependencias que no se añaden. -->
`;
}

type Selection = Pick<RepoConfig, "agents" | "default_agent" | "mcp" | "skills" | "commands">;
const tomlArr = (a: string[]) => `[${a.map((x) => JSON.stringify(x)).join(", ")}]`;

/**
 * ¿Entre las skills pedidas está decision-record (a secas o catalogo:decision-record)?
 * Es la que da sentido a la sección [decisions]: sin ella, los agentes no tienen cómo
 * registrar y bond no debe proponer la memoria.
 */
const hasDecisionSkill = (skills: string[]) => skills.some((s) => s.slice(s.lastIndexOf(":") + 1) === "decision-record");

/** La sección [decisions] que bond escribe cuando decision-record está elegida. */
const DECISIONS_SECTION = `# Memoria de decisiones de los agentes (skill decision-record): las decisiones no triviales
# quedan en ficheros de esta carpeta (bond decisions add) y los commits pueden llevar los
# trailers Agent: y Decision:. bond sync crea el README con el formato si falta; a partir de
# ahí es tuyo. Para no usarla, quita esta sección.
[decisions]
dir = "docs/decisions"           # carpeta dentro del repo, ajustable
`;

export function bondToml(cfg: Selection): string {
	return `# bond: configuración de los agentes de este repo. Tras editarla: bond sync
# Catálogo disponible: bond init --list

agents = ${tomlArr(cfg.agents)}          # ${SUPPORTED_AGENTS.join(", ")}
default_agent = ${JSON.stringify(cfg.default_agent ?? cfg.agents[0] ?? "")}   # el que abre \`bond\`
mcp = ${tomlArr(cfg.mcp)}                # servidores MCP del catálogo
skills = ${tomlArr(cfg.skills)}          # se copian a .agents/skills/
commands = ${tomlArr(cfg.commands)}      # comandos del catálogo

# Servidores MCP propios del repo (claves: command/args/env, o url/headers). Usa \${VAR}
# para secretos, nunca el valor:
# [mcp_servers.postgres]
# command = "npx"
# args = ["-y", "@modelcontextprotocol/server-postgres", "\${DATABASE_URL}"]

# Comandos propios: ficheros Markdown en .bond/commands/ ($ARGUMENTS, $1, $2...).
# Skills propios: carpetas con SKILL.md en .agents/skills/ (bond los enlaza para Claude).

${hasDecisionSkill(cfg.skills) ? `${DECISIONS_SECTION}\n` : ""}# Catálogos de tu equipo, además del de bond (se crean con bond catalog create). Lo suyo se
# elige igual, por nombre; si un nombre está en dos catálogos: "catalogo:nombre".
# [[catalog]]
# name = "equipo"
# path = "../skills-equipo"
`;
}

/** Cambia solo las líneas de la selección en un bond.toml existente: comentarios y mcp_servers se conservan. */
export function updateBondToml(text: string, cfg: Selection): string {
	const set = (t: string, key: string, value: string) => {
		const re = new RegExp(`^${key}\\s*=.*$`, "m");
		// Las claves de primer nivel van antes de cualquier tabla.
		return re.test(t) ? t.replace(re, `${key} = ${value}`) : t.replace(/^(?=\[)/m, `${key} = ${value}\n`) || `${t}\n${key} = ${value}\n`;
	};
	let t = text;
	t = set(t, "agents", tomlArr(cfg.agents));
	t = set(t, "default_agent", JSON.stringify(cfg.default_agent ?? cfg.agents[0] ?? ""));
	t = set(t, "mcp", tomlArr(cfg.mcp));
	t = set(t, "skills", tomlArr(cfg.skills));
	t = set(t, "commands", tomlArr(cfg.commands));
	// [decisions]: si el usuario ya la tiene, se conserva pase lo que pase (no la quitamos en
	// silencio, aunque se desmarque la skill); si no existe y decision-record está elegida,
	// se añade al final (una tabla al final no cambia el resto del TOML).
	if (!/^\s*\[decisions\]/m.test(t) && hasDecisionSkill(cfg.skills)) t = `${t.replace(/\s*$/, "")}\n\n${DECISIONS_SECTION}`;
	return t;
}

const AGENT_NAMES: Record<string, string> = { pi: "pi", claude: "Claude Code", copilot: "Copilot CLI", codex: "Codex", opencode: "opencode", crush: "Crush", gemini: "Gemini CLI", agy: "Antigravity" };

/** Preguntas de init: agentes (de los instalados), agente por defecto y herramientas del catálogo. */
async function askSelection(current: Selection, installed: string[], catalogs: Catalog[]): Promise<Selection | undefined> {
	const p = await import("@clack/prompts");
	const cancel = <T,>(v: T | symbol): T => {
		if (p.isCancel(v)) {
			p.cancel("cancelado: no se ha cambiado nada");
			process.exit(130);
		}
		return v as T;
	};
	const agents = cancel(
		await p.multiselect({
			message: "¿Con qué agentes integrar este repo?",
			options: installed.map((a) => ({ value: a, label: AGENT_NAMES[a] ?? a })),
			initialValues: current.agents.filter((a) => installed.includes(a)),
			required: true,
		}),
	);
	const def =
		agents.length === 1
			? agents[0]
			: cancel(
					await p.select({
						message: "¿Agente por defecto? (el que abre `bond` en este repo)",
						options: agents.map((a) => ({ value: a, label: AGENT_NAMES[a] ?? a })),
						initialValue: current.default_agent && agents.includes(current.default_agent) ? current.default_agent : agents[0],
					}),
				);
	// Qué hace cada herramienta, antes de elegir: clack solo enseña el hint de las marcadas y de
	// la que tiene el cursor, y al confirmar junta las etiquetas, así que estas van sin texto.
	// Los de un catálogo del equipo llevan su nombre al final; si un nombre está en dos
	// catálogos, va como catalogo:nombre (así se escribe en bond.toml).
	const rows = catalogRows(catalogs, 200);
	const groups: Array<[string, Array<[string, string]>]> = [
		["Servidores MCP", rows.mcp.map((r) => [r.ref, r.text])],
		["Skills", rows.skills.map((r) => [r.ref, r.text])],
		["Comandos", rows.commands.map((r) => [`/${r.ref}`, r.text])],
	];
	const width = Math.max(...groups.flatMap(([, rows]) => rows.map(([n]) => n.length))) + 2;
	const room = Math.max(20, (process.stdout.columns || 100) - width - 8);
	const fit = (t: string) => (t.length > room ? `${t.slice(0, room - 1)}…` : t);
	p.note(groups.map(([g, rows]) => [g, ...rows.map(([n, t]) => `  ${n.padEnd(width)}${dim(fit(t))}`)].join("\n")).join("\n\n"), "Catálogo");
	const tools = cancel(
		await p.groupMultiselect({
			message: "¿Qué herramientas del catálogo? (espacio para marcar o desmarcar)",
			options: {
				"Servidores MCP": rows.mcp.map((r) => ({ value: `mcp:${r.ref}`, label: r.ref })),
				Skills: rows.skills.map((r) => ({ value: `skills:${r.ref}`, label: r.ref })),
				Comandos: rows.commands.map((r) => ({ value: `commands:${r.ref}`, label: r.ref })),
			},
			initialValues: (["mcp", "skills", "commands"] as const).flatMap((k) => {
				const all = toolsOf(catalogs, k);
				return resolveTools(catalogs, k, current[k]).map((t) => `${k}:${refOf(t, all)}`);
			}),
			required: false,
		}),
	);
	const pick = (prefix: string) => tools.filter((t) => t.startsWith(`${prefix}:`)).map((t) => t.slice(prefix.length + 1));
	return { agents, default_agent: def, mcp: pick("mcp"), skills: pick("skills"), commands: pick("commands") };
}

export async function init(args: string[]): Promise<void> {
	if (args.includes("--list")) return printCatalog();
	const opt = (name: string) => {
		const i = args.indexOf(name);
		if (i < 0) return undefined;
		const v = args[i + 1];
		if (v === undefined) die(`${name} necesita un valor`);
		return v;
	};
	const list = (name: string) => {
		const v = opt(name);
		return v === undefined ? undefined : v === "" ? [] : v.split(",").map((s) => s.trim()).filter(Boolean);
	};
	const flags = ["--agents", "--default", "--mcp", "--skills", "--commands"];
	for (let i = 0; i < args.length; i++) {
		if (flags.includes(args[i])) i++;
		else if (!["--dry-run", "--yes", "-y"].includes(args[i])) die(`opción desconocida: ${args[i]} (bond init --help)`);
	}

	const root = repoRoot();
	const tomlPath = join(bondDir(root), "bond.toml");
	const exists = existsSync(tomlPath);
	if (run("git", ["rev-parse", "--show-toplevel"]).status !== 0) warn(`${root} no es un repo git: los ficheros generados conviene versionarlos`);

	// Agentes instalados (agy también en ~/.local/bin), y lo elegido en bond setup como punto de partida.
	const installed = SUPPORTED_AGENTS.filter(agentInstalled);
	// Con --agents se puede preparar la config de agentes que aquí no están instalados (p. ej.
	// para el resto del equipo, o en CI); sin él, se parte de los instalados.
	const askedAgents = list("--agents");
	if (!installed.length && !askedAgents) die("no hay ningún agente instalado (bond setup te dice cómo instalar uno; o usa --agents)");
	for (const a of askedAgents ?? []) if (!installed.includes(a)) warn(`${a} no está instalado aquí: se genera su config igualmente`);
	let global: { agents: string[]; default_agent?: string } = { agents: [] };
	try {
		const { configExists, loadConfig } = await import("./config.mts");
		if (configExists()) global = loadConfig();
	} catch {
		// Sin configuración global: se parte de lo instalado.
	}
	// Sin bond.toml no hay catálogos del equipo todavía: se parte del de bond.
	const repoCfg = exists ? loadRepoConfig(root) : undefined;
	const catalogs = repoCfg?.catalogs ?? [bondCatalog()];
	const current: Selection = repoCfg ?? {
		agents: global.agents.filter((a) => installed.includes(a)).length ? global.agents.filter((a) => installed.includes(a)) : installed,
		default_agent: global.default_agent,
		mcp: Object.keys(contents(bondCatalog()).mcp),
		skills: defaultSkills(),
		commands: contents(bondCatalog()).commands,
	};

	// Con flags o --yes, sin preguntas; si no, preguntas (si hay terminal).
	const explicit = flags.some((f) => args.includes(f));
	const interactive = !explicit && !args.includes("--yes") && !args.includes("-y") && process.stdin.isTTY === true;
	let sel: Selection = {
		agents: askedAgents ?? current.agents,
		default_agent: opt("--default") ?? current.default_agent,
		mcp: list("--mcp") ?? current.mcp,
		skills: list("--skills") ?? current.skills,
		commands: list("--commands") ?? current.commands,
	};
	if (exists && !interactive && !explicit) die(`${relative(process.cwd(), tomlPath)} ya existe: edítalo y ejecuta bond sync (o bond init para cambiarlo con preguntas)`);
	if (interactive) {
		const p = await import("@clack/prompts");
		const { renderSmall } = await import("../lib/bond-logo.mts");
		p.intro(renderSmall(56, `init · ${basename(root)}`));
		if (exists) p.log.info("Este repo ya tiene .bond/bond.toml: cambia lo que quieras (se conservan tus comentarios y servidores MCP propios)");
		sel = (await askSelection(current, installed, catalogs))!;
	}
	if (!sel.agents.length) die("hace falta al menos un agente");
	if (!sel.default_agent || !sel.agents.includes(sel.default_agent)) sel.default_agent = sel.agents[0];

	log(`bond init en ${root}`);
	console.log(dim(`  agentes: ${sel.agents.join(", ")} (por defecto: ${sel.default_agent}) · mcp: ${sel.mcp.join(", ") || "-"} · skills: ${sel.skills.join(", ") || "-"} · comandos: ${sel.commands.join(", ") || "-"}`));
	if (isDryRun()) {
		console.log(dim(`  [dry-run] escribiría .bond/bond.toml${existsSync(join(root, "AGENTS.md")) ? "" : " y AGENTS.md"}`));
		return;
	}
	mkdirSync(bondDir(root), { recursive: true });
	writeFileSync(tomlPath, exists ? updateBondToml(readFileSync(tomlPath, "utf8"), sel) : bondToml(sel));
	console.log(`${ok(exists ? "~" : "+")} .bond/bond.toml`);
	if (!existsSync(join(root, "AGENTS.md"))) {
		writeFileSync(join(root, "AGENTS.md"), agentsMd(basename(root)));
		console.log(`${ok("+")} AGENTS.md  ${dim("plantilla: complétala")}`);
	}
	if (sel.agents.includes("pi")) await ensureBondLink();
	syncRepo();
	const generated = [...new Set(plan(root, loadRepoConfig(root), loadManifest(root)).map((o) => o.path.split("/")[0]))].sort();
	const trust: Record<string, string> = {
		pi: "pi pregunta si confías en el proyecto (sin eso no carga .pi/ ni las Bond Extensions)",
		claude: "Claude Code pide aprobar los servidores de .mcp.json",
		copilot: "Copilot pide confiar en la carpeta (sin eso no carga .mcp.json)",
		codex: "Codex solo carga .codex/config.toml en proyectos de confianza",
		opencode: "opencode reconoce el proyecto cuando el repo tiene al menos un commit",
		gemini: "Gemini pide confiar en la carpeta (security.folderTrust)",
	};
	// Sin ningún agente que pregunte (p. ej. solo agy), el paso de la confianza no sale.
	const asks = sel.agents.filter((a) => trust[a]).map((a) => `     - ${trust[a]}`);
	const steps = [
		"Completa AGENTS.md (instrucciones del proyecto para todos los agentes).",
		`Commitea la configuración: git add .bond AGENTS.md ${generated.join(" ")}`,
		...(asks.length ? [`La primera vez, cada agente pide confiar en el repo; bond no lo concede por ti:\n${asks.join("\n")}`] : []),
		"Abre el puesto de trabajo: bond",
	];
	console.log(`\nSiguiente:\n${steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}`);
}

/** Agente por defecto del repo (default_agent de bond.toml, si es uno de sus agentes). */
export function loadRepoDefault(root: string): string | undefined {
	return loadRepoAgents(root).default_agent;
}

/** Agentes del repo y el de por defecto, de bond.toml. */
export function loadRepoAgents(root: string): { agents: string[]; default_agent?: string } {
	const cfg = loadRepoConfig(root);
	return { agents: cfg.agents, default_agent: cfg.default_agent && cfg.agents.includes(cfg.default_agent) ? cfg.default_agent : cfg.agents[0] };
}
