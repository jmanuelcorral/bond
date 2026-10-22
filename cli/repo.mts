// `bond init` y `bond sync`: configuración de agentes de un repo, declarada una vez en
// .bond/bond.toml y generada para cada agente (pi, Claude Code, Copilot, Codex, opencode, Crush
// y Gemini).
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
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { parse } from "smol-toml";
import { parseJsonc } from "./agents.mts";
import { assetsPath, ensureBondLink } from "./runtime.mts";
import { bad, caution, die, dim, isDryRun, log, ok, run, STAMP, warn, which } from "./util.mts";

export const SUPPORTED_AGENTS = ["pi", "claude", "copilot", "codex", "opencode", "crush", "gemini"];
/** Catálogo: carpeta del repo o extraída del binario. */
const catalogPath = (...p: string[]) => assetsPath("catalog", ...p);

export const INIT_HELP = `Uso: bond init [opciones]

Prepara el repo actual para tus agentes. Pregunta con cuáles integrarlo (de los instalados,
partiendo de los elegidos en bond setup), cuál abre \`bond\` por defecto y qué herramientas del
catálogo usar. Crea .bond/bond.toml, un AGENTS.md (si falta) y la config de cada agente; con
pi, además las Bond Extensions. En un repo ya inicializado, permite cambiar la selección.

  --agents <a,b>      Agentes, sin preguntar (${SUPPORTED_AGENTS.join(", ")})
  --default <a>       Agente por defecto
  --mcp <a,b>         Servidores MCP del catálogo (defecto: todos)
  --skills <a,b>      Skills del catálogo (defecto: las marcadas por defecto, sin las opcionales)
  --commands <a,b>    Comandos del catálogo (defecto: todos)
  --yes               Sin preguntas: lo elegido en bond setup y el catálogo por defecto
  --list              Enseña el catálogo y sale
  --dry-run           Enseña lo que haría sin escribir`;

export const SYNC_HELP = `Uso: bond sync [opciones]

Genera la configuración de cada agente del repo a partir de .bond/bond.toml.

  --dry-run   Enseña qué cambiaría sin escribir
  --check     No escribe; sale con 1 si algo está desfasado (para CI)
  --force     Sobrescribe ficheros de bond editados a mano (guarda copia .bak)`;

// --- catálogo ---------------------------------------------------------------------------

interface McpServer {
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	url?: string;
	headers?: Record<string, string>;
	description?: string;
}

const catalog = {
	mcp: () => JSON.parse(readFileSync(catalogPath("mcp.json"), "utf8")) as Record<string, McpServer>,
	/** En el orden de catalog.toml; las que no estén ahí, al final por nombre. */
	skills: () => {
		const found = readdirSync(catalogPath("skills")).filter((d) => existsSync(catalogPath("skills", d, "SKILL.md")));
		const order = Object.keys(catalogMeta().skills).filter((n) => found.includes(n));
		return [...order, ...found.filter((n) => !order.includes(n)).sort()];
	},
	commands: () =>
		readdirSync(catalogPath("commands"))
			.filter((f) => f.endsWith(".md"))
			.map((f) => f.slice(0, -3))
			.sort(),
};

interface CatalogEntry {
	/** Resumen breve (en inglés) para bond init. */
	summary?: string;
	/** false: aparece en bond init sin marcar (p. ej. las que necesitan GitHub). */
	default?: boolean;
}

/** catalog/catalog.toml: resumen y marca por defecto de cada skill. */
function catalogMeta(): { skills: Record<string, CatalogEntry> } {
	try {
		const raw = parse(readFileSync(catalogPath("catalog.toml"), "utf8")) as { skills?: Record<string, CatalogEntry> };
		return { skills: raw.skills ?? {} };
	} catch {
		return { skills: {} };
	}
}

/** Skills del catálogo que salen marcadas por defecto. */
const defaultSkills = () => {
	const meta = catalogMeta().skills;
	return catalog.skills().filter((n) => meta[n]?.default !== false);
};

/** Resumen de una skill: el de catalog.toml o, si no hay, el principio de su description. */
function skillSummary(name: string, max: number): string {
	return catalogMeta().skills[name]?.summary ?? describe(readFileSync(catalogPath("skills", name, "SKILL.md"), "utf8")).slice(0, max);
}

function describe(md: string): string {
	return /^description:\s*(.+)$/m.exec(md)?.[1]?.replace(/^["']|["']$/g, "") ?? "";
}

function printCatalog(): void {
	console.log("Servidores MCP:");
	for (const [name, s] of Object.entries(catalog.mcp())) console.log(`  ${name.padEnd(14)} ${dim(s.description ?? "")}`);
	console.log("Skills:");
	const meta = catalogMeta().skills;
	const width = Math.max(14, ...catalog.skills().map((n) => n.length + 1));
	for (const name of catalog.skills()) console.log(`  ${name.padEnd(width)} ${dim(skillSummary(name, 90))}${meta[name]?.default === false ? dim(" (opcional)") : ""}`);
	console.log("Comandos:");
	for (const name of catalog.commands()) console.log(`  ${name.padEnd(14)} ${dim(describe(readFileSync(catalogPath("commands", `${name}.md`), "utf8")))}`);
	console.log(`Agentes: ${SUPPORTED_AGENTS.join(", ")}`);
}

// --- configuración del repo -------------------------------------------------------------

interface RepoConfig {
	agents: string[];
	/** Agente que abre `bond` en este repo. */
	default_agent?: string;
	mcp: string[];
	skills: string[];
	commands: string[];
	mcp_servers: Record<string, McpServer>;
}

function repoRoot(): string {
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

function loadRepoConfig(root: string): RepoConfig {
	const file = join(bondDir(root), "bond.toml");
	if (!existsSync(file)) die(`no hay ${relative(process.cwd(), file) || file}: ejecuta bond init`);
	let raw: Record<string, unknown>;
	try {
		raw = parse(readFileSync(file, "utf8")) as Record<string, unknown>;
	} catch (e) {
		die(`.bond/bond.toml no es TOML válido: ${(e as Error).message}`);
	}
	const list = (k: string) => (Array.isArray(raw[k]) ? (raw[k] as string[]) : []);
	const cfg: RepoConfig = {
		agents: list("agents"),
		default_agent: typeof raw.default_agent === "string" ? raw.default_agent : undefined,
		mcp: list("mcp"),
		skills: list("skills"),
		commands: list("commands"),
		mcp_servers: (raw.mcp_servers ?? {}) as Record<string, McpServer>,
	};
	// Nombres antiguos del catálogo: "web" chocaba con un espacio de nombres reservado de OpenAI.
	const ALIASES: Record<string, string> = { web: "duckduckgo" };
	cfg.mcp = cfg.mcp.map((n) => {
		if (!ALIASES[n]) return n;
		warn(`bond.toml: el servidor MCP "${n}" ahora se llama "${ALIASES[n]}"; cámbialo en .bond/bond.toml`);
		return ALIASES[n];
	});
	const check = (kind: string, wanted: string[], known: string[]) => {
		const unknown = wanted.filter((w) => !known.includes(w));
		if (unknown.length) die(`bond.toml: ${kind} desconocidos: ${unknown.join(", ")} (bond init --list)`);
	};
	check("agentes", cfg.agents, SUPPORTED_AGENTS);
	check("servidores MCP", cfg.mcp, Object.keys(catalog.mcp()));
	check("skills", cfg.skills, catalog.skills());
	check("comandos", cfg.commands, catalog.commands());
	for (const [name, s] of Object.entries(cfg.mcp_servers)) {
		if (!s.command && !s.url) die(`bond.toml: mcp_servers.${name} necesita command o url`);
	}
	return cfg;
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

function plan(root: string, cfg: RepoConfig, prev: Manifest): Output[] {
	const out: Output[] = [];
	const agents = new Set(cfg.agents);
	const servers: Record<string, McpServer> = {
		...Object.fromEntries(cfg.mcp.map((n) => [n, catalog.mcp()[n]])),
		...cfg.mcp_servers,
	};

	// Skills: se copian a .agents/skills/, que leen pi y casi todos los agentes.
	for (const name of cfg.skills) {
		const src = catalogPath("skills", name);
		for (const f of walk(src)) {
			out.push({ kind: "file", path: repoPath(".agents", "skills", name, relative(src, f)), content: readFileSync(f, "utf8"), mode: statSync(f).mode & 0o777 });
		}
	}
	// Todos los skills del repo, para enlazarlos a Claude: los del catálogo elegidos y los
	// propios (carpetas con SKILL.md que no copió bond; las que copió y ya no se piden, se van).
	const skillsDir = join(root, ".agents", "skills");
	const own = existsSync(skillsDir)
		? readdirSync(skillsDir).filter((d) => existsSync(join(skillsDir, d, "SKILL.md")) && !prev.files[repoPath(".agents", "skills", d, "SKILL.md")])
		: [];
	const allSkills = new Set([...cfg.skills, ...own]);

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
		// Los comandos del catálogo le llegan a pi por el paquete global de bond; aquí, solo los propios.
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
		for (const name of cfg.commands) {
			out.push({ kind: "file", path: repoPath(".claude", "commands", `${name}.md`), content: readFileSync(catalogPath("commands", `${name}.md`), "utf8") });
		}
		for (const f of ownCommands) out.push({ kind: "file", path: repoPath(".claude", "commands", f), content: readFileSync(join(ownDir, f), "utf8") });
	}

	if (agents.has("claude")) {
		out.push({ kind: "block", path: "CLAUDE.md", body: "@AGENTS.md", style: "md" });
		// Claude no lee .agents/skills: un symlink por skill. En Windows los symlinks necesitan
		// permisos especiales, así que se copian los ficheros (desde el catálogo o del repo).
		for (const name of allSkills) {
			if (process.platform !== "win32") {
				out.push({ kind: "link", path: repoPath(".claude", "skills", name), target: join("..", "..", ".agents", "skills", name) });
				continue;
			}
			const src = cfg.skills.includes(name) ? catalogPath("skills", name) : join(skillsDir, name);
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
		for (const name of cfg.commands) {
			out.push({ kind: "file", path: repoPath(".opencode", "commands", `${name}.md`), content: readFileSync(catalogPath("commands", `${name}.md`), "utf8") });
		}
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
			...cfg.commands.map((n) => [n, readFileSync(catalogPath("commands", `${n}.md`), "utf8")] as const),
			...ownCommands.map((f) => [f.slice(0, -3), readFileSync(join(ownDir, f), "utf8")] as const),
		];
		for (const [name, md] of commands) out.push({ kind: "file", path: repoPath(".gemini", "commands", `${name}.toml`), content: geminiCommand(md) });
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
	if (!actions.length) say(ok("al día"));
	const conflicts = actions.filter((a) => a.sign === "!");
	if (conflicts.length) warn(`${conflicts.length} conflicto(s): revisa los marcados con ! (o bond sync --force)`);
	return actions;
}

export function sync(args: string[]): void {
	for (const a of args) if (!["--check", "--force", "--dry-run"].includes(a)) die(`opción desconocida: ${a} (bond sync --help)`);
	const actions = syncRepo({ check: args.includes("--check"), force: args.includes("--force") });
	if (args.includes("--check") && actions.length) process.exitCode = 1;
}

// --- init ---------------------------------------------------------------------------------

function agentsMd(name: string): string {
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

type Selection = Omit<RepoConfig, "mcp_servers">;
const tomlArr = (a: string[]) => `[${a.map((x) => JSON.stringify(x)).join(", ")}]`;

function bondToml(cfg: Selection): string {
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
	return t;
}

const AGENT_NAMES: Record<string, string> = { pi: "pi", claude: "Claude Code", copilot: "Copilot CLI", codex: "Codex", opencode: "opencode", crush: "Crush", gemini: "Gemini CLI" };

/** Preguntas de init: agentes (de los instalados), agente por defecto y herramientas del catálogo. */
async function askSelection(current: Selection, installed: string[]): Promise<Selection | undefined> {
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
	const describeCommand = (n: string) => describe(readFileSync(catalogPath("commands", `${n}.md`), "utf8"));
	const meta = catalogMeta().skills;
	const groups: Array<[string, Array<[string, string]>]> = [
		["Servidores MCP", Object.entries(catalog.mcp()).map(([n, s]) => [n, s.description ?? ""])],
		["Skills", catalog.skills().map((n) => [n, skillSummary(n, 200) + (meta[n]?.default === false ? " (opcional)" : "")])],
		["Comandos", catalog.commands().map((n) => [`/${n}`, describeCommand(n)])],
	];
	const width = Math.max(...groups.flatMap(([, rows]) => rows.map(([n]) => n.length))) + 2;
	const room = Math.max(20, (process.stdout.columns || 100) - width - 8);
	const fit = (t: string) => (t.length > room ? `${t.slice(0, room - 1)}…` : t);
	p.note(groups.map(([g, rows]) => [g, ...rows.map(([n, t]) => `  ${n.padEnd(width)}${dim(fit(t))}`)].join("\n")).join("\n\n"), "Catálogo");
	const tools = cancel(
		await p.groupMultiselect({
			message: "¿Qué herramientas del catálogo? (espacio para marcar o desmarcar)",
			options: {
				"Servidores MCP": Object.keys(catalog.mcp()).map((n) => ({ value: `mcp:${n}`, label: n })),
				Skills: catalog.skills().map((n) => ({ value: `skills:${n}`, label: n })),
				Comandos: catalog.commands().map((n) => ({ value: `commands:${n}`, label: n })),
			},
			initialValues: [...current.mcp.map((n) => `mcp:${n}`), ...current.skills.map((n) => `skills:${n}`), ...current.commands.map((n) => `commands:${n}`)],
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

	// Agentes instalados, y lo elegido en bond setup como punto de partida.
	const installed = SUPPORTED_AGENTS.filter((a) => which(a));
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
	const current: Selection = exists
		? loadRepoConfig(root)
		: {
				agents: global.agents.filter((a) => installed.includes(a)).length ? global.agents.filter((a) => installed.includes(a)) : installed,
				default_agent: global.default_agent,
				mcp: Object.keys(catalog.mcp()),
				skills: defaultSkills(),
				commands: catalog.commands(),
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
		sel = (await askSelection(current, installed))!;
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
	console.log(`
Siguiente:
  1. Completa AGENTS.md (instrucciones del proyecto para todos los agentes).
  2. Commitea la configuración: git add .bond AGENTS.md ${generated.join(" ")}
  3. La primera vez, cada agente pide confiar en el repo; bond no lo concede por ti:
${sel.agents
	.filter((a) => trust[a])
	.map((a) => `     - ${trust[a]}`)
	.join("\n")}
  4. Abre el puesto de trabajo: bond`);
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
