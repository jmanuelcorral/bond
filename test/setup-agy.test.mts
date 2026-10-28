// bond setup con agy: el plugin global de bond en ~/.gemini/config/plugins/bond (manifiesto,
// reglas y skills). Cada caso corre en su proceso con un HOME temporal: HOME y BOND_HOME se
// fijan al cargar cli/util.mts y cli/runtime.mts.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const CLI = join(import.meta.dir, "..", "cli");
const win = process.platform === "win32";

let home: string;
beforeEach(() => {
	home = realpathSync(mkdtempSync(join(tmpdir(), "bond-setup-agy-")));
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

const url = (f: string) => JSON.stringify(pathToFileURL(join(CLI, f)).href);

/** Lo que hace bond setup con la lista de agentes: plugin de agy, skills globales y reglas. */
function setup(agents: string[]): { status: number; stdout: string; stderr: string } {
	return node(`
const { agyPlugin, globalSkills } = await import(${url("setup.mts")});
const { propagate } = await import(${url("instructions.mts")});
const agents = ${JSON.stringify(agents)};
if (agents.includes("agy")) agyPlugin();
globalSkills(agents.includes("agy"));
propagate(agents);
`);
}

/** Si las reglas del plugin están al día (lo que mira bond doctor). */
function rulesCurrent(): boolean {
	const r = node(`
const { blockCurrent } = await import(${url("instructions.mts")});
console.log(JSON.stringify(blockCurrent(${JSON.stringify(join(home, ".gemini", "config", "plugins", "bond", "rules", "AGENTS.md"))})));
`);
	return JSON.parse(r.stdout.trim().split("\n").pop() ?? "null");
}

function node(script: string): { status: number; stdout: string; stderr: string } {
	const r = spawnSync(process.execPath, ["-e", script], {
		env: { ...process.env, HOME: home, USERPROFILE: home, BOND_HOME: join(home, ".bond"), XDG_CONFIG_HOME: join(home, ".config"), NO_COLOR: "1" },
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: 60_000,
	});
	return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

/** Árbol de una carpeta: ruta relativa y, para cada fichero, su contenido. */
function tree(dir: string): Record<string, string> {
	const out: Record<string, string> = {};
	const walk = (d: string, rel: string) => {
		for (const e of readdirSync(d, { withFileTypes: true })) {
			const p = join(d, e.name);
			const r = rel ? `${rel}/${e.name}` : e.name;
			if (e.isSymbolicLink()) out[r] = `-> ${realpathSync(p)}`;
			else if (e.isDirectory()) walk(p, r);
			else out[r] = readFileSync(p, "utf8");
		}
	};
	walk(dir, "");
	return out;
}

describe("bond setup con agy", () => {
	const plugin = () => join(home, ".gemini", "config", "plugins", "bond");

	test("crea el plugin global con manifiesto, reglas y skills, y repetirlo no cambia nada", () => {
		mkdirSync(join(home, ".bond"), { recursive: true });
		writeFileSync(join(home, ".bond", "AGENTS.md"), "# Mis reglas\n\nResponde en verso.\n");
		// El skill de Herdr ya instalado (compartido) y otros ficheros de agy que no son de bond.
		mkdirSync(join(home, ".agents", "skills", "herdr"), { recursive: true });
		writeFileSync(join(home, ".agents", "skills", "herdr", "SKILL.md"), "---\nname: herdr\ndescription: x\n---\n");
		mkdirSync(join(home, ".gemini", "config", "plugins", "otro"), { recursive: true });
		writeFileSync(join(home, ".gemini", "config", "mcp_config.json"), '{"mcpServers":{}}\n');
		writeFileSync(join(home, ".gemini", "config", "plugins", "otro", "plugin.json"), "{}\n");
		const others = () => Object.fromEntries(Object.entries(tree(join(home, ".gemini", "config"))).filter(([k]) => !k.startsWith("plugins/bond/")));
		const before = others();

		const r = setup(["agy"]);
		expect(r.stderr).toBe("");
		expect(r.status).toBe(0);
		expect(JSON.parse(readFileSync(join(plugin(), "plugin.json"), "utf8"))).toEqual({ name: "bond-global" });
		const rules = readFileSync(join(plugin(), "rules", "AGENTS.md"), "utf8");
		expect(rules).toContain("Responde en verso.");
		expect(rules).toContain("## Bond: Herdr y otros agentes");
		expect(readdirSync(join(plugin(), "skills")).sort()).toEqual(["bond-delegate", "bond-team", "herdr"]);
		for (const name of ["bond-delegate", "bond-team", "herdr"]) {
			const dest = join(plugin(), "skills", name);
			expect(existsSync(join(dest, "SKILL.md"))).toBe(true);
			// En Windows se copian (los symlinks necesitan permisos); en el resto, se enlazan.
			expect(lstatSync(dest).isSymbolicLink()).toBe(!win);
		}
		if (!win) expect(realpathSync(join(plugin(), "skills", "herdr"))).toBe(join(home, ".agents", "skills", "herdr"));
		expect(others()).toEqual(before);
		expect(rulesCurrent()).toBe(true);

		const first = tree(plugin());
		const again = setup(["agy"]);
		expect(again.status).toBe(0);
		expect(tree(plugin())).toEqual(first);
		expect(again.stderr).not.toContain(".bak");
		expect(others()).toEqual(before);

		// Cambiar tus instrucciones deja las reglas desfasadas hasta el siguiente setup.
		writeFileSync(join(home, ".bond", "AGENTS.md"), "# Mis reglas\n\nResponde en prosa.\n");
		expect(rulesCurrent()).toBe(false);
		setup(["agy"]);
		expect(rulesCurrent()).toBe(true);
	});

	test("sin agy entre los agentes no crea nada en ~/.gemini", () => {
		const r = setup(["claude"]);
		expect(r.status).toBe(0);
		expect(existsSync(join(home, ".gemini"))).toBe(false);
		expect(existsSync(join(home, ".claude", "skills", "bond-delegate"))).toBe(true);
	});
});
