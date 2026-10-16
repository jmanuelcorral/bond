// `bond init` y `bond sync`: configuración de agentes de un repo, declarada una vez en
// .bond/bond.toml y generada para cada agente (pi, Claude Code).
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
import { basename, dirname, join, relative } from "node:path";
import { parse } from "smol-toml";
import { parseJsonc } from "./agents.mts";
import { bad, caution, die, dim, isDryRun, log, ok, REPO_DIR, run, STAMP, warn } from "./util.mts";

export const SUPPORTED_AGENTS = ["pi", "claude"];
const CATALOG = join(REPO_DIR, "catalog");

export const INIT_HELP = `Uso: bond init [opciones]

Prepara el repo actual para los agentes: crea .bond/bond.toml con lo elegido, un AGENTS.md
(si falta) y genera la configuración de cada agente con \`bond sync\`.

  --agents <a,b>      Agentes (defecto: los instalados de: ${SUPPORTED_AGENTS.join(", ")})
  --mcp <a,b>         Servidores MCP del catálogo (defecto: todos)
  --skills <a,b>      Skills del catálogo (defecto: todos)
  --commands <a,b>    Comandos del catálogo (defecto: todos)
  --list              Enseña el catálogo y sale
  --dry-run           Enseña lo que haría sin escribir

Después: edita .bond/bond.toml y ejecuta \`bond sync\`.`;

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
	mcp: () => JSON.parse(readFileSync(join(CATALOG, "mcp.json"), "utf8")) as Record<string, McpServer>,
	skills: () => readdirSync(join(CATALOG, "skills")).filter((d) => existsSync(join(CATALOG, "skills", d, "SKILL.md"))),
	commands: () =>
		readdirSync(join(CATALOG, "commands"))
			.filter((f) => f.endsWith(".md"))
			.map((f) => f.slice(0, -3)),
};

function describe(md: string): string {
	return /^description:\s*(.+)$/m.exec(md)?.[1]?.replace(/^["']|["']$/g, "") ?? "";
}

function printCatalog(): void {
	console.log("Servidores MCP:");
	for (const [name, s] of Object.entries(catalog.mcp())) console.log(`  ${name.padEnd(14)} ${dim(s.description ?? "")}`);
	console.log("Skills:");
	for (const name of catalog.skills()) console.log(`  ${name.padEnd(14)} ${dim(describe(readFileSync(join(CATALOG, "skills", name, "SKILL.md"), "utf8")).slice(0, 90))}`);
	console.log("Comandos:");
	for (const name of catalog.commands()) console.log(`  ${name.padEnd(14)} ${dim(describe(readFileSync(join(CATALOG, "commands", `${name}.md`), "utf8")))}`);
	console.log(`Agentes: ${SUPPORTED_AGENTS.join(", ")}`);
}

// --- configuración del repo -------------------------------------------------------------

interface RepoConfig {
	agents: string[];
	mcp: string[];
	skills: string[];
	commands: string[];
	mcp_servers: Record<string, McpServer>;
}

function repoRoot(): string {
	const r = run("git", ["rev-parse", "--show-toplevel"]);
	return r.status === 0 ? r.stdout.trim() : process.cwd();
}

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
		mcp: list("mcp"),
		skills: list("skills"),
		commands: list("commands"),
		mcp_servers: (raw.mcp_servers ?? {}) as Record<string, McpServer>,
	};
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
	| { kind: "json"; path: string; parent: string | null; entries: Record<string, unknown> }
	| { kind: "block"; path: string; body: string };

interface Manifest {
	files: Record<string, string>;
	links: Record<string, string>;
	json: Record<string, { parent: string | null; keys: string[] }>;
	blocks: string[];
}

const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

function walk(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
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
		const src = join(CATALOG, "skills", name);
		for (const f of walk(src)) {
			out.push({ kind: "file", path: join(".agents", "skills", name, relative(src, f)), content: readFileSync(f, "utf8"), mode: statSync(f).mode & 0o777 });
		}
	}
	// Todos los skills del repo, para enlazarlos a Claude: los del catálogo elegidos y los
	// propios (carpetas con SKILL.md que no copió bond; las que copió y ya no se piden, se van).
	const skillsDir = join(root, ".agents", "skills");
	const own = existsSync(skillsDir)
		? readdirSync(skillsDir).filter((d) => existsSync(join(skillsDir, d, "SKILL.md")) && !prev.files[join(".agents", "skills", d, "SKILL.md")])
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
		out.push({ kind: "json", path: join(".pi", "mcp.json"), parent: "mcpServers", entries: piServers });
		out.push({ kind: "json", path: join(".pi", "settings.json"), parent: null, entries: { defaultTools: ["+grep", "+find", "+ls"] } });
		// Los comandos del catálogo le llegan a pi por el paquete global de bond; aquí, solo los propios.
		for (const f of ownCommands) out.push({ kind: "file", path: join(".pi", "prompts", f), content: readFileSync(join(ownDir, f), "utf8") });
	}

	if (agents.has("claude")) {
		out.push({ kind: "block", path: "CLAUDE.md", body: "@AGENTS.md" });
		const claudeServers = Object.fromEntries(
			Object.entries(servers).map(([n, s]) => [
				n,
				s.url
					? { type: "http", url: s.url, ...(s.headers ? { headers: s.headers } : {}) }
					: { command: s.command, args: s.args ?? [], ...(s.env ? { env: s.env } : {}) },
			]),
		);
		out.push({ kind: "json", path: ".mcp.json", parent: "mcpServers", entries: claudeServers });
		// Claude no lee .agents/skills: un symlink por skill.
		for (const name of allSkills) out.push({ kind: "link", path: join(".claude", "skills", name), target: join("..", "..", ".agents", "skills", name) });
		for (const name of cfg.commands) {
			out.push({ kind: "file", path: join(".claude", "commands", `${name}.md`), content: readFileSync(join(CATALOG, "commands", `${name}.md`), "utf8") });
		}
		for (const f of ownCommands) out.push({ kind: "file", path: join(".claude", "commands", f), content: readFileSync(join(ownDir, f), "utf8") });
	}
	return out;
}

// --- aplicar ------------------------------------------------------------------------------

const MD_BEGIN = "<!-- >>> bond >>> generado por `bond sync`; no editar -->";
const MD_END = "<!-- <<< bond <<< -->";

function withBlock(current: string, body: string): string {
	const start = current.indexOf(MD_BEGIN);
	let rest = current;
	if (start >= 0) {
		const end = current.indexOf(MD_END, start);
		rest = current.slice(0, start).replace(/\n+$/, "\n") + (end < 0 ? "" : current.slice(end + MD_END.length).replace(/^\n/, ""));
	}
	if (!body) return rest;
	const base = rest.trim() ? `${rest.replace(/\n*$/, "")}\n\n` : "";
	return `${base}${MD_BEGIN}\n${body}\n${MD_END}\n`;
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
		return { files: m.files ?? {}, links: m.links ?? {}, json: m.json ?? {}, blocks: m.blocks ?? [] };
	} catch {
		return { files: {}, links: {}, json: {}, blocks: [] };
	}
}

function diffActions(root: string, outputs: Output[], prev: Manifest, force: boolean): { actions: Action[]; next: Manifest } {
	const actions: Action[] = [];
	const next: Manifest = { files: {}, links: {}, json: {}, blocks: [] };
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
	for (const [p, j] of Object.entries(prev.json)) if (!planned.has(p)) outputs.push({ kind: "json", path: p, parent: j.parent, entries: {} });
	for (const p of prev.blocks) if (!planned.has(p)) outputs.push({ kind: "block", path: p, body: "" });

	for (const o of outputs) {
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
		} else if (o.kind === "json") {
			let obj: Record<string, unknown> = {};
			try {
				obj = cur?.trim() ? parseJsonc(cur) : {};
			} catch {
				actions.push({ sign: "!", path: o.path, why: "no es JSON válido; no lo toco" });
				continue;
			}
			const container = o.parent ? { ...((obj[o.parent] as Record<string, unknown>) ?? {}) } : obj;
			for (const k of prev.json[o.path]?.keys ?? []) delete container[k];
			Object.assign(container, o.entries);
			if (o.parent) {
				if (Object.keys(container).length) obj[o.parent] = container;
				else delete obj[o.parent];
			}
			const keys = Object.keys(o.entries);
			const empty = Object.keys(obj).length === 0;
			const text = empty ? "" : `${JSON.stringify(obj, null, 2)}\n`;
			if (keys.length) next.json[o.path] = { parent: o.parent, keys };
			if ((cur ?? "") === text) continue;
			if (empty && cur !== undefined) actions.push({ sign: "-", path: o.path, apply: () => rmSync(abs(o.path)) });
			else if (!empty) actions.push({ sign: cur === undefined ? "+" : "~", path: o.path, why: keys.length ? `${o.parent ?? "claves"}: ${keys.join(", ")}` : "sin claves de bond", apply: write(o.path, text) });
		} else {
			const text = withBlock(cur ?? "", o.body);
			if (o.body) next.blocks.push(o.path);
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

Instrucciones del proyecto para los agentes (pi, Claude Code y los que se añadan con bond).
Las personales de cada uno van en su configuración global; aquí, solo lo de este repo.

## Qué es

<!-- Una o dos frases: qué hace este proyecto y para quién. -->

## Cómo se trabaja aquí

<!-- Comandos exactos para instalar, compilar, probar y lintar. Convenciones que importan. -->

## Qué no hacer

<!-- Ficheros generados que no se editan, zonas delicadas, dependencias que no se añaden. -->
`;
}

function bondToml(cfg: Omit<RepoConfig, "mcp_servers">): string {
	const arr = (a: string[]) => `[${a.map((x) => JSON.stringify(x)).join(", ")}]`;
	return `# bond: configuración de los agentes de este repo. Tras editarla: bond sync
# Catálogo disponible: bond init --list

agents = ${arr(cfg.agents)}          # ${SUPPORTED_AGENTS.join(", ")}
mcp = ${arr(cfg.mcp)}                # servidores MCP del catálogo
skills = ${arr(cfg.skills)}          # se copian a .agents/skills/
commands = ${arr(cfg.commands)}      # comandos del catálogo

# Servidores MCP propios del repo (claves: command/args/env, o url/headers). Usa \${VAR}
# para secretos, nunca el valor:
# [mcp_servers.postgres]
# command = "npx"
# args = ["-y", "@modelcontextprotocol/server-postgres", "\${DATABASE_URL}"]

# Comandos propios: ficheros Markdown en .bond/commands/ ($ARGUMENTS, $1, $2...).
# Skills propios: carpetas con SKILL.md en .agents/skills/ (bond los enlaza para Claude).
`;
}

export function init(args: string[]): void {
	if (args.includes("--list")) return printCatalog();
	const opt = (name: string, all: string[]) => {
		const i = args.indexOf(name);
		if (i < 0) return all;
		const v = args[i + 1];
		if (v === undefined) die(`${name} necesita una lista separada por comas`);
		return v === "" ? [] : v.split(",").map((s) => s.trim()).filter(Boolean);
	};
	for (let i = 0; i < args.length; i++) {
		if (["--agents", "--mcp", "--skills", "--commands"].includes(args[i])) i++;
		else if (args[i] !== "--dry-run") die(`opción desconocida: ${args[i]} (bond init --help)`);
	}

	const root = repoRoot();
	const tomlPath = join(bondDir(root), "bond.toml");
	if (existsSync(tomlPath)) die(`${relative(process.cwd(), tomlPath)} ya existe: edítalo y ejecuta bond sync`);
	if (run("git", ["rev-parse", "--show-toplevel"]).status !== 0) warn(`${root} no es un repo git: los ficheros generados conviene versionarlos`);

	const installed = SUPPORTED_AGENTS.filter((a) => run("sh", ["-c", `command -v ${a}`]).status === 0);
	const cfg = {
		agents: opt("--agents", installed.length ? installed : SUPPORTED_AGENTS),
		mcp: opt("--mcp", Object.keys(catalog.mcp())),
		skills: opt("--skills", catalog.skills()),
		commands: opt("--commands", catalog.commands()),
	};
	log(`bond init en ${root}`);
	console.log(dim(`  agentes: ${cfg.agents.join(", ") || "-"} · mcp: ${cfg.mcp.join(", ") || "-"} · skills: ${cfg.skills.join(", ") || "-"} · comandos: ${cfg.commands.join(", ") || "-"}`));
	if (isDryRun()) {
		console.log(dim(`  [dry-run] escribiría .bond/bond.toml${existsSync(join(root, "AGENTS.md")) ? "" : " y AGENTS.md"}`));
		return;
	}
	mkdirSync(bondDir(root), { recursive: true });
	writeFileSync(tomlPath, bondToml(cfg));
	console.log(`${ok("+")} .bond/bond.toml`);
	if (!existsSync(join(root, "AGENTS.md"))) {
		writeFileSync(join(root, "AGENTS.md"), agentsMd(basename(root)));
		console.log(`${ok("+")} AGENTS.md  ${dim("plantilla: complétala")}`);
	}
	syncRepo();
	console.log(`
Siguiente:
  1. Completa AGENTS.md (instrucciones del proyecto para todos los agentes).
  2. Commitea .bond/ y lo generado: git add .bond AGENTS.md ${cfg.agents.includes("claude") ? "CLAUDE.md .mcp.json .claude " : ""}${cfg.agents.includes("pi") ? ".pi " : ""}${cfg.skills.length ? ".agents" : ""}
  3. La primera vez cada agente pide confiar en el repo:${cfg.agents.includes("pi") ? "\n     - pi pregunta si confías en el proyecto (carga .pi/ solo tras aceptar)" : ""}${cfg.agents.includes("claude") ? "\n     - Claude Code pide aprobar los servidores de .mcp.json (al abrir claude en el repo)" : ""}`);
}
