// bond init/sync (cli/repo.mts): lo que escribe en repos ajenos. Cada prueba trabaja en un repo
// git temporal; bond se ejecuta desde el código fuente, así que el catálogo es el del repo.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
const { syncRepo, updateBondToml, withBlock } = await import("../cli/repo.mts");

const origCwd = process.cwd();
let repo: string;

beforeEach(() => {
	repo = realpathSync(mkdtempSync(join(tmpdir(), "bond-repo-")));
	spawnSync("git", ["init", "-q"], { cwd: repo });
	process.chdir(repo);
});

afterEach(() => {
	process.chdir(origCwd);
	rmSync(repo, { recursive: true, force: true });
});

const at = (p: string) => join(repo, p);
const read = (p: string) => readFileSync(at(p), "utf8");
const write = (p: string, s: string) => {
	mkdirSync(join(at(p), ".."), { recursive: true });
	writeFileSync(at(p), s);
};
const json = (p: string) => JSON.parse(read(p));

function bondToml(o: { agents: string[]; mcp?: string[]; skills?: string[]; commands?: string[] }): void {
	const arr = (a: string[]) => JSON.stringify(a);
	write(
		".bond/bond.toml",
		`agents = ${arr(o.agents)}\nmcp = ${arr(o.mcp ?? ["context7", "duckduckgo"])}\nskills = ${arr(o.skills ?? ["code-context"])}\ncommands = ${arr(o.commands ?? ["review", "commit"])}\n`,
	);
}

const sync = (opts: { check?: boolean; force?: boolean } = {}) => syncRepo({ quiet: true, ...opts });

describe("withBlock", () => {
	test("en un fichero vacío deja solo el bloque", () => {
		expect(withBlock("", "@AGENTS.md", "md", "nota")).toBe("<!-- >>> bond >>> nota -->\n@AGENTS.md\n<!-- <<< bond <<< -->\n");
	});

	test("añade el bloque al final sin tocar lo demás", () => {
		expect(withBlock("# Mío\n\ntexto\n", "@AGENTS.md", "md", "n")).toBe("# Mío\n\ntexto\n\n<!-- >>> bond >>> n -->\n@AGENTS.md\n<!-- <<< bond <<< -->\n");
	});

	test("sustituye el bloque existente, sea cual sea su nota", () => {
		const before = "a = 1\n\n# >>> bond >>> nota vieja\nviejo\n# <<< bond <<<\n";
		expect(withBlock(before, "nuevo", "hash", "n")).toBe("a = 1\n\n# >>> bond >>> n\nnuevo\n# <<< bond <<<\n");
	});

	test("con cuerpo vacío quita el bloque y conserva lo demás", () => {
		expect(withBlock("# Mío\n\n<!-- >>> bond >>> n -->\nx\n<!-- <<< bond <<< -->\n", "", "md")).toBe("# Mío\n");
	});

	test("es idempotente", () => {
		const once = withBlock("texto\n", "cuerpo", "md");
		expect(withBlock(once, "cuerpo", "md")).toBe(once);
	});
});

describe("updateBondToml", () => {
	const sel = { agents: ["claude"], default_agent: "claude", mcp: [], skills: ["code-context"], commands: ["review"] };

	test("cambia la selección y conserva comentarios y mcp_servers", () => {
		const text = `# mi comentario\nagents = ["pi"]\ndefault_agent = "pi"\nmcp = ["context7"]\nskills = []\ncommands = []\n\n[mcp_servers.db]\ncommand = "x"\n`;
		const out = updateBondToml(text, sel);
		expect(out).toContain("# mi comentario");
		expect(out).toContain('agents = ["claude"]');
		expect(out).toContain('default_agent = "claude"');
		expect(out).toContain("mcp = []");
		expect(out).toContain('[mcp_servers.db]\ncommand = "x"');
	});

	test("una clave que falta va antes de la primera tabla", () => {
		const out = updateBondToml(`agents = ["pi"]\n\n[mcp_servers.db]\ncommand = "x"\n`, sel);
		expect(out.indexOf("commands = ")).toBeLessThan(out.indexOf("[mcp_servers.db]"));
	});
});

describe("syncRepo", () => {
	test("genera la config de cada agente y una segunda pasada no cambia nada", () => {
		bondToml({ agents: ["pi", "claude", "codex", "opencode", "gemini"] });
		sync();
		expect(read(".agents/skills/code-context/SKILL.md")).toBe(readFileSync(join(origCwd, "catalog/skills/code-context/SKILL.md"), "utf8"));
		expect(Object.keys(json(".mcp.json").mcpServers).sort()).toEqual(["context7", "duckduckgo"]);
		expect(json(".pi/settings.json").packages).toEqual(["~/.bond/pi"]);
		expect(read("CLAUDE.md")).toContain("@AGENTS.md");
		expect(read(".codex/config.toml")).toContain("[mcp_servers.context7]");
		expect(json("opencode.json").mcp.servers.duckduckgo.type).toBe("local");
		expect(json(".gemini/settings.json").context.fileName).toEqual(["AGENTS.md", "GEMINI.md"]);
		expect(read(".gemini/commands/review.toml")).toContain("prompt = ");
		if (process.platform !== "win32") expect(lstatSync(at(".claude/skills/code-context")).isSymbolicLink()).toBe(true);
		expect(sync({ check: true })).toEqual([]);
		expect(sync()).toEqual([]);
	});

	test("conserva lo que no es de bond en JSON y ficheros compartidos", () => {
		write(".mcp.json", JSON.stringify({ mcpServers: { mio: { command: "mio" } }, otra: 1 }));
		write("CLAUDE.md", "# Mis notas\n");
		bondToml({ agents: ["claude"] });
		sync();
		const mcp = json(".mcp.json");
		expect(mcp.otra).toBe(1);
		expect(Object.keys(mcp.mcpServers).sort()).toEqual(["context7", "duckduckgo", "mio"]);
		expect(read("CLAUDE.md").startsWith("# Mis notas\n")).toBe(true);

		// Quitar el agente quita solo lo de bond.
		bondToml({ agents: ["pi"] });
		sync();
		expect(json(".mcp.json")).toEqual({ mcpServers: { mio: { command: "mio" } }, otra: 1 });
		expect(read("CLAUDE.md")).toBe("# Mis notas\n");
		expect(existsSync(at(".claude/commands"))).toBe(false);
		expect(existsSync(at(".claude/skills/code-context"))).toBe(false);
	});

	test("un fichero editado a mano es un conflicto; --force lo pisa con copia .bak", () => {
		bondToml({ agents: ["claude"] });
		sync();
		write(".claude/commands/review.md", "mi versión\n");
		const actions = sync();
		expect(actions.map((a) => [a.sign, a.path])).toEqual([["!", ".claude/commands/review.md"]]);
		expect(read(".claude/commands/review.md")).toBe("mi versión\n");
		// El conflicto sigue registrado como de bond: se puede forzar después.
		sync({ force: true });
		expect(read(".claude/commands/review.md")).toBe(readFileSync(join(origCwd, "catalog/commands/review.md"), "utf8"));
		expect(readdirSync(at(".claude/commands")).some((f) => f.startsWith("review.md.bak."))).toBe(true);
	});

	test("un fichero ajeno con la misma ruta no se pisa", () => {
		write(".claude/commands/review.md", "ya estaba\n");
		bondToml({ agents: ["claude"] });
		const actions = sync();
		expect(actions.find((a) => a.path === ".claude/commands/review.md")?.sign).toBe("!");
		expect(read(".claude/commands/review.md")).toBe("ya estaba\n");
	});

	test("lo que bond deja de generar se borra, salvo si se editó a mano", () => {
		bondToml({ agents: ["opencode"], commands: ["review", "commit"] });
		sync();
		write(".opencode/commands/commit.md", "editado\n");
		bondToml({ agents: ["opencode"], commands: [] });
		const actions = sync();
		expect(existsSync(at(".opencode/commands/review.md"))).toBe(false);
		expect(read(".opencode/commands/commit.md")).toBe("editado\n");
		expect(actions.find((a) => a.path === ".opencode/commands/commit.md")?.sign).toBe("!");
	});

	test("los skills propios del repo se enlazan para Claude", () => {
		write(".agents/skills/mio/SKILL.md", "---\nname: mio\n---\n");
		bondToml({ agents: ["claude"], skills: [] });
		sync();
		expect(read(".claude/skills/mio/SKILL.md")).toContain("name: mio");
	});

	test("entiende el registro de bond 0.4", () => {
		bondToml({ agents: ["claude"], mcp: ["context7"], skills: [], commands: [] });
		sync();
		const m = json(".bond/manifest.json");
		// 0.4: un solo contenedor por fichero JSON y blocks como lista.
		write(".bond/manifest.json", JSON.stringify({ ...m, json: { ".mcp.json": m.json[".mcp.json"][0] }, blocks: ["CLAUDE.md"] }));
		expect(sync({ check: true })).toEqual([]);
		bondToml({ agents: ["pi"], mcp: [], skills: [], commands: [] });
		sync();
		expect(existsSync(at(".mcp.json"))).toBe(false);
		expect(existsSync(at("CLAUDE.md"))).toBe(false);
	});
});
