// bond init/sync (cli/repo.mts): lo que escribe en repos ajenos. Cada prueba trabaja en un repo
// git temporal; bond se ejecuta desde el código fuente, así que el catálogo es el del repo.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
const { syncRepo, updateBondToml, withBlock, loadRepoConfig, bondToml: bondTomlTemplate } = await import("../cli/repo.mts");
const { catchDie } = await import("../cli/util.mts");

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

function bondToml(o: { agents: string[]; mcp?: string[]; skills?: string[]; commands?: string[]; decisions?: string }): void {
	const arr = (a: string[]) => JSON.stringify(a);
	write(
		".bond/bond.toml",
		`agents = ${arr(o.agents)}\nmcp = ${arr(o.mcp ?? ["context7", "duckduckgo"])}\nskills = ${arr(o.skills ?? ["code-context"])}\ncommands = ${arr(o.commands ?? ["review", "commit"])}\n${o.decisions ? `\n${o.decisions}\n` : ""}`,
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

	test("conserva la sección [decisions]", () => {
		const out = updateBondToml('agents = ["pi"]\n\n[decisions]\ndir = "docs/adrs"\n', sel);
		expect(out).toContain('[decisions]\ndir = "docs/adrs"');
	});

	test("updateBondToml: una [decisions] del usuario se conserva aunque se desmarque la skill", () => {
		const base = 'agents = ["pi"]\nmcp = []\nskills = ["code-context"]\ncommands = []\n\n[decisions]\ndir = "docs/adrs"\n';
		const out = updateBondToml(base, { agents: ["pi"], default_agent: "pi", mcp: [], skills: ["code-context"], commands: [] });
		expect(out).toContain('[decisions]\ndir = "docs/adrs"');
	});

	test("updateBondToml: añade [decisions] solo si decision-record está elegida", () => {
		const base = 'agents = ["pi"]\nmcp = []\nskills = ["code-context"]\ncommands = []\n';
		const added = updateBondToml(base, { agents: ["pi"], default_agent: "pi", mcp: [], skills: ["code-context", "decision-record"], commands: [] });
		expect(added).toContain('[decisions]\ndir = "docs/decisions"');
		const untouched = updateBondToml(base, { agents: ["pi"], default_agent: "pi", mcp: [], skills: ["code-context"], commands: [] });
		expect(untouched).not.toContain("[decisions]");
	});
});

describe("memoria de decisiones ([decisions])", () => {
	test("sync crea el README de decisiones si falta y no lo pisa si existe", () => {
		bondToml({ agents: ["pi"], decisions: '[decisions]\ndir = "docs/decisions"' });
		sync();
		expect(read("docs/decisions/README.md")).toContain("Memoria de decisiones");
		// Es del repo, como AGENTS.md: no entra en el manifiesto de bond.
		expect(json(".bond/manifest.json").files["docs/decisions/README.md"]).toBeUndefined();
		write("docs/decisions/README.md", "# mi índice\n");
		sync();
		expect(read("docs/decisions/README.md")).toBe("# mi índice\n");
		expect(sync({ check: true })).toEqual([]);
	});

	test("un dir propio funciona", () => {
		bondToml({ agents: ["pi"], decisions: '[decisions]\ndir = "docs/adrs"' });
		sync();
		expect(existsSync(at("docs/adrs/README.md"))).toBe(true);
		expect(existsSync(at("docs/decisions"))).toBe(false);
	});

	test("sin [decisions] no se crea nada", () => {
		bondToml({ agents: ["pi"] });
		sync();
		expect(existsSync(at("docs/decisions"))).toBe(false);
		expect(existsSync(at("docs/adrs"))).toBe(false);
		expect(sync({ check: true })).toEqual([]);
	});

	test("un dir que sale del repo se rechaza con un error claro", () => {
		for (const dir of ["../outside", "/tmp/decisions", ".."]) {
			bondToml({ agents: ["pi"], decisions: `[decisions]\ndir = "${dir}"` });
			const r = catchDie(() => loadRepoConfig(repo));
			expect(r.error).toContain("decisions.dir");
			expect(r.error).toContain("dentro del repo");
		}
	});

	test("la plantilla propone [decisions] solo si decision-record está elegida", () => {
		const withSkill = bondTomlTemplate({ agents: ["pi"], default_agent: "pi", mcp: [], skills: ["decision-record"], commands: [] });
		expect(withSkill).toContain('[decisions]\ndir = "docs/decisions"');
		const without = bondTomlTemplate({ agents: ["pi"], default_agent: "pi", mcp: [], skills: ["code-context"], commands: [] });
		expect(without).not.toContain("[decisions]");
		// El prefijo de catálogo no esconde la skill: cuenta igual.
		const prefixed = bondTomlTemplate({ agents: ["pi"], default_agent: "pi", mcp: [], skills: ["bond:decision-record"], commands: [] });
		expect(prefixed).toContain("[decisions]");
	});

	test("init sin decision-record: ni [decisions] en bond.toml ni README en el sync", () => {
		write(".bond/bond.toml", bondTomlTemplate({ agents: ["pi"], default_agent: "pi", mcp: [], skills: ["code-context"], commands: [] }));
		sync();
		expect(read(".bond/bond.toml")).not.toContain("[decisions]");
		expect(existsSync(at("docs/decisions"))).toBe(false);
		expect(sync({ check: true })).toEqual([]);
	});

	test("init con decision-record: la sección escrita y el README creado", () => {
		write(".bond/bond.toml", bondTomlTemplate({ agents: ["pi"], default_agent: "pi", mcp: [], skills: ["decision-record"], commands: [] }));
		sync();
		expect(read(".bond/bond.toml")).toContain('[decisions]\ndir = "docs/decisions"');
		expect(existsSync(at("docs/decisions/README.md"))).toBe(true);
		expect(sync({ check: true })).toEqual([]);
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

	test("el registro usa / en cualquier sistema y entiende uno escrito en Windows con \\", () => {
		bondToml({ agents: ["opencode"], commands: ["review"] });
		sync();
		const m = json(".bond/manifest.json");
		expect(Object.keys(m.files)).toContain(".opencode/commands/review.md");
		const files = Object.fromEntries(Object.entries(m.files).map(([p, h]) => [p.replaceAll("/", "\\"), h]));
		write(".bond/manifest.json", JSON.stringify({ ...m, files }));
		expect(sync({ check: true })).toEqual([]);
		// Sigue siendo de bond: se borra al dejar de pedirlo.
		bondToml({ agents: ["opencode"], commands: [] });
		sync();
		expect(existsSync(at(".opencode/commands/review.md"))).toBe(false);
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
