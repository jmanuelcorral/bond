// Catálogos del equipo en bond init/sync ([[catalog]] con path en .bond/bond.toml). Cada prueba
// trabaja en un repo git temporal con un catálogo montado con bond catalog create.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
const { syncRepo, updateBondToml } = await import("../cli/repo.mts");

const MAIN = join(import.meta.dir, "..", "cli", "main.mts");
const origCwd = process.cwd();
let base: string;
let repo: string;

/** Ejecuta bond en `cwd` sin terminal. */
function bond(args: string[], cwd = repo): { code: number; out: string; err: string } {
	const r = spawnSync(process.execPath, [MAIN, ...args], { cwd, env: { ...process.env, NO_COLOR: "1" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	return { code: r.status ?? -1, out: r.stdout, err: r.stderr };
}

const at = (p: string) => join(repo, p);
const read = (p: string) => readFileSync(at(p), "utf8");
const json = (p: string) => JSON.parse(read(p));
const write = (p: string, s: string) => {
	mkdirSync(join(at(p), ".."), { recursive: true });
	writeFileSync(at(p), s);
};

/** Un catálogo en `dir` (relativo al repo) con una skill, un comando y un servidor MCP. */
function teamCatalog(dir: string, name = "equipo", skill = "revisar"): void {
	// create escribe en la raíz del repo git: el catálogo es su propio repo, como el de un equipo.
	mkdirSync(at(dir), { recursive: true });
	spawnSync("git", ["init", "-q"], { cwd: at(dir) });
	expect(bond(["catalog", "create", "--name", name], at(dir)).code).toBe(0);
	write(`${dir}/skills/${skill}/SKILL.md`, `---\nname: ${skill}\ndescription: Revisar migraciones del equipo\n---\n# Revisar\n`);
	write(`${dir}/skills/${skill}/references/detalle.md`, "detalle\n");
	write(`${dir}/commands/notas.md`, "---\ndescription: Notas de la release\n---\nNotas de $1\n");
	write(`${dir}/mcps/db.json`, JSON.stringify({ command: "npx", args: ["-y", "srv@1.0.0", "${DATABASE_URL}"], description: "Base de datos" }));
}

function bondToml(o: { agents: string[]; mcp?: string[]; skills?: string[]; commands?: string[]; catalogs?: string }): void {
	const arr = (a: string[]) => JSON.stringify(a);
	write(
		".bond/bond.toml",
		`agents = ${arr(o.agents)}\nmcp = ${arr(o.mcp ?? [])}\nskills = ${arr(o.skills ?? [])}\ncommands = ${arr(o.commands ?? [])}\n\n${o.catalogs ?? '[[catalog]]\nname = "equipo"\npath = "catalogo"\n'}`,
	);
}

beforeEach(() => {
	base = realpathSync(mkdtempSync(join(tmpdir(), "bond-catalogs-")));
	repo = join(base, "repo");
	mkdirSync(repo);
	spawnSync("git", ["init", "-q"], { cwd: repo });
	process.chdir(repo);
});

afterEach(() => {
	process.chdir(origCwd);
	rmSync(base, { recursive: true, force: true });
});

describe("catálogo del equipo con path", () => {
	test("sus skills, comandos y MCP llegan a los 7 agentes; una segunda pasada no cambia nada", () => {
		teamCatalog("catalogo");
		bondToml({ agents: ["pi", "claude", "copilot", "codex", "opencode", "crush", "gemini"], mcp: ["context7", "db"], skills: ["code-context", "revisar"], commands: ["review", "notas"] });
		syncRepo({ quiet: true });

		expect(read(".agents/skills/revisar/SKILL.md")).toContain("Revisar migraciones del equipo");
		expect(existsSync(at(".agents/skills/revisar/references/detalle.md"))).toBe(true);
		expect(existsSync(at(".agents/skills/code-context/SKILL.md"))).toBe(true);
		if (process.platform !== "win32") expect(lstatSync(at(".claude/skills/revisar")).isSymbolicLink()).toBe(true);
		else expect(existsSync(at(".claude/skills/revisar/SKILL.md"))).toBe(true);

		// Comandos: los de bond le llegan a pi por las Bond Extensions; los del equipo, por .pi/prompts.
		expect(read(".pi/prompts/notas.md")).toContain("Notas de $1");
		expect(existsSync(at(".pi/prompts/review.md"))).toBe(false);
		for (const p of [".claude/commands/notas.md", ".claude/commands/review.md", ".opencode/commands/notas.md"]) expect(existsSync(at(p))).toBe(true);
		expect(read(".gemini/commands/notas.toml")).toContain("{{args}}");

		const db = { command: "npx", args: ["-y", "srv@1.0.0", "${DATABASE_URL}"] };
		expect(json(".mcp.json").mcpServers.db).toEqual(db);
		expect(json(".mcp.json").mcpServers.context7.url).toBeDefined();
		expect(json(".pi/mcp.json").mcpServers.db).toMatchObject(db);
		expect(json("opencode.json").mcp.servers.db).toEqual({ type: "local", command: ["npx", "-y", "srv@1.0.0", "${DATABASE_URL}"] });
		expect(json(".crush.json").mcp.db).toMatchObject({ type: "stdio", command: "npx" });
		expect(json(".gemini/settings.json").mcpServers.db).toEqual(db);
		expect(read(".codex/config.toml")).toContain("[mcp_servers.db]");

		expect(syncRepo({ check: true, quiet: true })).toEqual([]);
	});

	test("quitar el catálogo y lo suyo de bond.toml borra lo que generó", () => {
		teamCatalog("catalogo");
		bondToml({ agents: ["pi", "claude"], mcp: ["db"], skills: ["revisar"], commands: ["notas"] });
		syncRepo({ quiet: true });
		bondToml({ agents: ["pi", "claude"], catalogs: "" });
		syncRepo({ quiet: true });
		for (const p of [".agents/skills/revisar", ".claude/skills/revisar", ".pi/prompts/notas.md", ".claude/commands/notas.md"]) expect(existsSync(at(p))).toBe(false);
		// Sin servidores, el .mcp.json que solo tenía los de bond se va entero.
		expect(existsSync(at(".mcp.json")) ? json(".mcp.json").mcpServers?.db : undefined).toBeUndefined();
	});

	test("el nombre sale de su catalog.toml si [[catalog]] no lo da", () => {
		teamCatalog("catalogo", "plataforma");
		bondToml({ agents: ["claude"], skills: ["plataforma:revisar"], catalogs: '[[catalog]]\npath = "catalogo"\n' });
		syncRepo({ quiet: true });
		expect(existsSync(at(".agents/skills/revisar/SKILL.md"))).toBe(true);
	});

	test("bond init --list enseña los catálogos y el origen de cada cosa", () => {
		teamCatalog("catalogo");
		bondToml({ agents: ["claude"] });
		const r = bond(["init", "--list"]);
		expect(r.code).toBe(0);
		expect(r.out).toContain("Catálogos: bond, equipo (catalogo)");
		expect(r.out).toMatch(/revisar +Revisar migraciones del equipo \[equipo\]/);
		expect(r.out).toMatch(/notas +Notas de la release \[equipo\]/);
		expect(r.out).toMatch(/db +Base de datos \[equipo\]/);
		expect(r.out).toMatch(/code-context +.*[^\]]\n/);
	});

	test("bond init con flags en un repo con catálogo conserva [[catalog]] y elige lo suyo", () => {
		teamCatalog("catalogo");
		bondToml({ agents: ["claude"] });
		const r = bond(["init", "--agents", "claude", "--skills", "revisar", "--commands", "notas", "--mcp", "db"]);
		expect(r.code).toBe(0);
		const toml = read(".bond/bond.toml");
		expect(toml).toContain('[[catalog]]\nname = "equipo"\npath = "catalogo"');
		expect(toml).toContain('skills = ["revisar"]');
		expect(existsSync(at(".claude/commands/notas.md"))).toBe(true);
	});
});

describe("nombres en varios catálogos", () => {
	test("el del equipo sustituye al de bond; bond:nombre pide el de bond", () => {
		teamCatalog("catalogo", "equipo", "code-context");
		bondToml({ agents: ["claude"], skills: ["code-context"] });
		syncRepo({ quiet: true });
		expect(read(".agents/skills/code-context/SKILL.md")).toContain("Revisar migraciones del equipo");

		bondToml({ agents: ["claude"], skills: ["bond:code-context"] });
		syncRepo({ quiet: true });
		expect(read(".agents/skills/code-context/SKILL.md")).not.toContain("Revisar migraciones del equipo");
	});

	test("en dos catálogos del equipo es ambiguo, y catalogo:nombre elige", () => {
		teamCatalog("catalogo", "equipo");
		teamCatalog("otro", "plataforma");
		const both = '[[catalog]]\npath = "catalogo"\n[[catalog]]\npath = "otro"\n';
		bondToml({ agents: ["claude"], skills: ["revisar"], catalogs: both });
		const r = bond(["sync"]);
		expect(r.code).toBe(1);
		expect(r.err).toContain('"revisar" está en los catálogos equipo y plataforma');
		expect(r.err).toContain('"equipo:revisar" o "plataforma:revisar"');

		bondToml({ agents: ["claude"], skills: ["plataforma:revisar"], catalogs: both });
		syncRepo({ quiet: true });
		expect(existsSync(at(".agents/skills/revisar/SKILL.md"))).toBe(true);
	});

	test("pedir el mismo nombre de dos sitios es error", () => {
		teamCatalog("catalogo", "equipo", "code-context");
		bondToml({ agents: ["claude"], skills: ["bond:code-context", "code-context"] });
		const r = bond(["sync"]);
		expect(r.code).toBe(1);
		expect(r.err).toContain('"code-context" pedido de bond y equipo');
	});

	test("bond init --list: la de bond sustituida sale con prefijo y lo ambiguo, con el suyo", () => {
		teamCatalog("catalogo", "equipo", "code-context");
		teamCatalog("otro", "plataforma");
		bondToml({ agents: ["claude"], catalogs: '[[catalog]]\npath = "catalogo"\n[[catalog]]\npath = "otro"\n' });
		const out = bond(["init", "--list"]).out;
		expect(out).toMatch(/bond:code-context +.*\(la sustituye equipo\)/);
		expect(out).toMatch(/\n  code-context +Revisar migraciones del equipo \[equipo\]/);
		expect(out).toMatch(/equipo:notas +Notas de la release \[equipo\]/);
		expect(out).toMatch(/plataforma:db +Base de datos \[plataforma\]/);
		expect(out).toMatch(/\n  revisar +Revisar migraciones del equipo \[plataforma\]/);
		expect(out).toMatch(/plan-create +Plan a task/);
	});
});

describe("catálogos mal declarados", () => {
	test("un catálogo que no pasa check para sync con los mismos errores", () => {
		teamCatalog("catalogo");
		write("catalogo/skills/revisar/SKILL.md", "---\nname: otro\ndescription: x\n---\n");
		write("catalogo/mcps/roto.json", "{}");
		bondToml({ agents: ["claude"], skills: ["revisar"] });
		const r = bond(["sync"]);
		const check = bond(["catalog", "check", "catalogo"]);
		expect(r.code).toBe(1);
		expect(check.code).toBe(1);
		for (const line of check.err.split("\n").filter((l) => l.startsWith("error: ") && !l.includes("tiene 2 errores"))) {
			expect(r.err).toContain(line.replace("error: ", "error: catálogo equipo (catalogo): "));
		}
		expect(r.err).toContain("bond catalog check catalogo");
		expect(existsSync(at(".agents/skills/revisar"))).toBe(false);
	});

	test("path que no existe, sin path, o con el nombre de bond o repetido", () => {
		const cases: Array<[string, string]> = [
			['[[catalog]]\nname = "x"\npath = "no-existe"\n', "no existe la carpeta no-existe"],
			['[[catalog]]\nname = "x"\n', "falta path"],
			['[[catalog]]\nname = "bond"\npath = "catalogo"\n', "es el de bond"],
			['[[catalog]]\npath = "catalogo"\n[[catalog]]\npath = "catalogo"\n', 'ya hay un catálogo "equipo"'],
			['[[catalog]]\nname = "Mi Equipo"\npath = "catalogo"\n', "no vale"],
		];
		teamCatalog("catalogo");
		for (const [catalogs, msg] of cases) {
			bondToml({ agents: ["claude"], catalogs });
			const r = bond(["sync"]);
			expect(r.code).toBe(1);
			expect(r.err).toContain(msg);
		}
	});

	test("un catálogo fuera del repo funciona, con aviso", () => {
		const outside = join(base, "skills-equipo");
		mkdirSync(outside);
		spawnSync("git", ["init", "-q"], { cwd: outside });
		expect(bond(["catalog", "create", "--name", "equipo"], outside).code).toBe(0);
		writeFileSync(join(outside, "commands", "notas.md"), "---\ndescription: Notas\n---\nNotas\n");
		bondToml({ agents: ["claude"], commands: ["notas"], catalogs: '[[catalog]]\npath = "../skills-equipo"\n' });
		const r = bond(["sync"]);
		expect(r.code).toBe(0);
		expect(r.err).toContain("está fuera del repo");
		expect(existsSync(at(".claude/commands/notas.md"))).toBe(true);
	});
});

describe("updateBondToml", () => {
	test("conserva [[catalog]] al cambiar la selección", () => {
		const text = 'agents = ["pi"]\nmcp = []\nskills = []\ncommands = []\n\n[[catalog]]\nname = "equipo"\npath = "../skills"\n';
		const out = updateBondToml(text, { agents: ["claude"], default_agent: "claude", mcp: ["db"], skills: ["equipo:revisar"], commands: [] });
		expect(out).toContain('skills = ["equipo:revisar"]');
		expect(out).toContain('default_agent = "claude"\n');
		expect(out).toContain('[[catalog]]\nname = "equipo"\npath = "../skills"\n');
		expect(out.indexOf("default_agent")).toBeLessThan(out.indexOf("[[catalog]]"));
	});
});
