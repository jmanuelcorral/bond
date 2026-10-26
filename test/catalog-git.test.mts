// Catálogos del equipo por git (bond catalog add/list/update/remove/clean, .bond/lock.json y la
// caché). El catálogo es un repo git local servido por file://: sin red.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Las pruebas comparten proceso: BOND_HOME de runtime.mts es el del primer fichero que lo
// importó. bond se lanza con este HOME, y las rutas de la caché se traducen a él.
const HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
process.env.BOND_HOME = HOME;
const git_ = await import("../cli/catalog-git.mts");
const { BOND_HOME } = await import("../cli/runtime.mts");
const { gitKey, isGitUrl, resolveRef } = git_;
const cacheDir = (u: string, sha: string) => join(HOME, git_.cacheDir(u, sha).slice(BOND_HOME.length));

const MAIN = join(import.meta.dir, "..", "cli", "main.mts");
let base: string;
let cat: string;
let url: string;
let repo: string;

function bond(args: string[], cwd = repo): { code: number; out: string; err: string } {
	const r = spawnSync(process.execPath, [MAIN, ...args], { cwd, env: { ...process.env, BOND_HOME: HOME, NO_COLOR: "1" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	return { code: r.status ?? -1, out: r.stdout, err: r.stderr };
}

function git(args: string[], cwd = cat): string {
	const r = spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false", ...args], { cwd, encoding: "utf8" });
	if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
	return r.stdout.trim();
}

const inCat = (p: string, s: string) => {
	mkdirSync(join(cat, p, ".."), { recursive: true });
	writeFileSync(join(cat, p), s);
};
const commit = (msg: string) => {
	git(["add", "-A"]);
	git(["commit", "-q", "-m", msg]);
	return git(["rev-parse", "HEAD"]);
};
const at = (p: string) => join(repo, p);
const read = (p: string) => readFileSync(at(p), "utf8");
const lock = () => JSON.parse(read(".bond/lock.json")).catalogs;
const mcp = (version: string) => JSON.stringify({ command: "npx", args: ["-y", `srv@${version}`], description: "DB" });

let v1: string;

beforeEach(() => {
	base = realpathSync(mkdtempSync(join(tmpdir(), "bond-catgit-")));
	cat = join(base, "skills-equipo");
	repo = join(base, "app");
	mkdirSync(cat);
	mkdirSync(repo);
	git(["init", "-q", "-b", "main"]);
	expect(bond(["catalog", "create", "--name", "equipo"], cat).code).toBe(0);
	inCat("skills/revisar/SKILL.md", "---\nname: revisar\ndescription: Revisar migraciones\n---\n");
	inCat("commands/notas.md", "---\ndescription: Notas\n---\nNotas de $1\n");
	inCat("mcps/db.json", mcp("1.0.0"));
	v1 = commit("v1");
	git(["tag", "-a", "v1", "-m", "v1"]);
	url = pathToFileURL(cat).href;
	spawnSync("git", ["init", "-q"], { cwd: repo });
	expect(bond(["init", "--agents", "claude", "--yes"]).code).toBe(0);
});

afterEach(() => rmSync(base, { recursive: true, force: true }));

describe("URLs y refs", () => {
	test("ssh y https del mismo repo son el mismo catálogo", () => {
		const same = ["git@github.com:Acme/skills.git", "https://github.com/Acme/skills", "https://user@github.com:443/Acme/skills.git/", "ssh://git@github.com/Acme/skills.git"];
		expect(new Set(same.map(gitKey))).toEqual(new Set(["github.com/Acme/skills"]));
		expect(cacheDir(same[0], "a".repeat(40))).toBe(cacheDir(same[1], "a".repeat(40)));
		expect(isGitUrl("git@github.com:a/b")).toBe(true);
		expect(isGitUrl("https://x/y")).toBe(true);
		expect(isGitUrl("../skills")).toBe(false);
	});

	test("un tag anotado se resuelve a su commit; sin ref, la rama por defecto", () => {
		expect(resolveRef(url, "v1")).toBe(v1);
		inCat("skills/revisar/SKILL.md", "---\nname: revisar\ndescription: Otra\n---\n");
		const v2 = commit("v2");
		expect(resolveRef(url)).toBe(v2);
		expect(resolveRef(url, "main")).toBe(v2);
		expect(resolveRef(url, v1)).toBe(v1);
	});
});

describe("bond catalog add", () => {
	test("por git: bond.toml, lock y caché; sync instala lo elegido", () => {
		const r = bond(["catalog", "add", url, "--ref", "v1", "--yes"]);
		expect(r.code).toBe(0);
		expect(r.out).toContain("+ mcp db: npx -y srv@1.0.0");
		expect(read(".bond/bond.toml")).toContain(`[[catalog]]\nname = "equipo"\ngit = ${JSON.stringify(url)}\nref = "v1"\n`);
		expect(lock().equipo).toEqual({ git: url, ref: "v1", sha: v1 });
		expect(existsSync(join(cacheDir(url, v1), "skills", "revisar", "SKILL.md"))).toBe(true);
		expect(existsSync(join(cacheDir(url, v1), ".git"))).toBe(false);

		const toml = read(".bond/bond.toml").replace(/^skills = \[/m, 'skills = ["revisar", ').replace(/^mcp = \[/m, 'mcp = ["db", ');
		writeFileSync(at(".bond/bond.toml"), toml);
		expect(bond(["sync"]).code).toBe(0);
		expect(read(".agents/skills/revisar/SKILL.md")).toContain("Revisar migraciones");
		expect(JSON.parse(read(".mcp.json")).mcpServers.db.args).toEqual(["-y", "srv@1.0.0"]);
	});

	test("sin --yes ni terminal, con MCP que revisar, no escribe nada", () => {
		const before = read(".bond/bond.toml");
		const r = bond(["catalog", "add", url]);
		expect(r.code).toBe(1);
		expect(r.err).toContain("--yes");
		expect(read(".bond/bond.toml")).toBe(before);
		expect(existsSync(at(".bond/lock.json"))).toBe(false);
	});

	test("enseña lo que pasa a venir del catálogo (una skill de bond que sustituye)", () => {
		inCat("skills/plan-create/SKILL.md", "---\nname: plan-create\ndescription: Plan del equipo\n---\n");
		commit("plan-create");
		const r = bond(["catalog", "add", url, "--yes"]);
		expect(r.out).toContain("plan-create: de bond pasa a equipo");
		expect(read(".agents/skills/plan-create/SKILL.md")).toContain("Plan del equipo");
		expect(lock().equipo.ref).toBeUndefined();
	});

	test("--name le da otro nombre", () => {
		expect(bond(["catalog", "add", url, "--name", "plataforma", "--yes"]).code).toBe(0);
		expect(lock().plataforma.sha).toBe(v1);
	});

	test("una carpeta: [[catalog]] path, sin lock", () => {
		const r = bond(["catalog", "add", "../skills-equipo", "--yes"]);
		expect(r.code).toBe(0);
		expect(read(".bond/bond.toml")).toContain('[[catalog]]\npath = "../skills-equipo"\n');
		expect(existsSync(at(".bond/lock.json"))).toBe(false);
	});

	test("un tag que no existe, un catálogo roto o la misma URL dos veces: no se añade", () => {
		const before = read(".bond/bond.toml");
		const missing = bond(["catalog", "add", url, "--ref", "v9", "--yes"]);
		expect(missing.code).toBe(1);
		expect(missing.err).toContain('no hay ningún tag ni rama "v9"');

		inCat("skills/roto/SKILL.md", "sin frontmatter\n");
		commit("roto");
		const broken = bond(["catalog", "add", url, "--ref", "main", "--yes"]);
		expect(broken.code).toBe(1);
		expect(broken.err).toContain("skills/roto/SKILL.md: falta el frontmatter");
		expect(read(".bond/bond.toml")).toBe(before);
		expect(existsSync(at(".bond/lock.json"))).toBe(false);

		expect(bond(["catalog", "add", url, "--ref", "v1", "--yes"]).code).toBe(0);
		const twice = bond(["catalog", "add", `${url}/`, "--name", "otro", "--yes"]);
		expect(twice.code).toBe(1);
		expect(twice.err).toContain("ya está como el catálogo equipo");
	});
});

describe("sync con catálogos por git", () => {
	test("sin caché descarga el commit del lock, no la punta de la rama", () => {
		expect(bond(["catalog", "add", url, "--yes"]).code).toBe(0);
		inCat("skills/revisar/SKILL.md", "---\nname: revisar\ndescription: Otra versión\n---\n");
		commit("v2");
		rmSync(join(HOME, "catalogs"), { recursive: true, force: true });
		const r = bond(["sync", "--check"]);
		expect(r.code).toBe(0);
		expect(existsSync(cacheDir(url, v1))).toBe(true);
		expect(readFileSync(join(cacheDir(url, v1), "skills", "revisar", "SKILL.md"), "utf8")).toContain("Revisar migraciones");
	});

	test("con la caché llena funciona aunque el repo no esté", () => {
		expect(bond(["catalog", "add", url, "--yes"]).code).toBe(0);
		renameSync(cat, `${cat}.off`);
		expect(bond(["sync", "--check"]).code).toBe(0);
		renameSync(`${cat}.off`, cat);
	});

	test("un lock que no corresponde con bond.toml, o que falta, pide bond catalog update", () => {
		expect(bond(["catalog", "add", url, "--ref", "v1", "--yes"]).code).toBe(0);
		writeFileSync(at(".bond/bond.toml"), read(".bond/bond.toml").replace('ref = "v1"', 'ref = "main"'));
		let r = bond(["sync"]);
		expect(r.code).toBe(1);
		expect(r.err).toContain("bond catalog update equipo");
		rmSync(at(".bond/lock.json"));
		r = bond(["sync"]);
		expect(r.code).toBe(1);
		expect(r.err).toContain("no está fijado en .bond/lock.json");
		writeFileSync(at(".bond/lock.json"), "{ roto");
		expect(bond(["sync"]).err).toContain(".bond/lock.json no se puede leer");
	});

	test("un catálogo por git sin name es error", () => {
		writeFileSync(at(".bond/bond.toml"), `${read(".bond/bond.toml")}\n[[catalog]]\ngit = ${JSON.stringify(url)}\n`);
		const r = bond(["sync"]);
		expect(r.code).toBe(1);
		expect(r.err).toContain("necesita name");
	});
});

describe("bond catalog update", () => {
	beforeEach(() => {
		expect(bond(["catalog", "add", url, "--ref", "v1", "--yes"]).code).toBe(0);
	});

	test("sin cambios no toca nada", () => {
		const r = bond(["catalog", "update"]);
		expect(r.code).toBe(0);
		expect(r.out).toContain("equipo: al día");
		expect(lock().equipo.sha).toBe(v1);
	});

	test("con el tag movido enseña los MCP que cambian; sin --yes el lock queda igual", () => {
		inCat("mcps/db.json", mcp("2.0.0"));
		const v2 = commit("v2");
		git(["tag", "-f", "-a", "v1", "-m", "v1 movido"]);
		let r = bond(["catalog", "update"]);
		expect(r.code).toBe(1);
		expect(r.out).toContain("~ mcp db: npx -y srv@1.0.0  →  npx -y srv@2.0.0");
		expect(lock().equipo.sha).toBe(v1);
		r = bond(["catalog", "update", "equipo", "--yes"]);
		expect(r.code).toBe(0);
		expect(lock().equipo.sha).toBe(v2);
	});

	test("--ref cambia la ref en bond.toml y en el lock", () => {
		inCat("commands/otra.md", "---\ndescription: Otra\n---\nx\n");
		const v2 = commit("v2");
		expect(bond(["catalog", "update", "equipo", "--ref", "main", "--yes"]).code).toBe(0);
		expect(read(".bond/bond.toml")).toContain('ref = "main"');
		expect(lock().equipo).toEqual({ git: url, ref: "main", sha: v2 });
		expect(bond(["sync", "--check"]).code).toBe(0);
	});

	test("un catálogo local no se actualiza", () => {
		writeFileSync(at(".bond/bond.toml"), `${read(".bond/bond.toml")}\n[[catalog]]\nname = "local"\npath = "../skills-equipo"\n`);
		const r = bond(["catalog", "update", "local"]);
		expect(r.code).toBe(1);
		expect(r.err).toContain("es un catálogo local");
	});
});

describe("bond catalog list, remove y clean", () => {
	test("list enseña el de bond y cada catálogo con su ref y commit", () => {
		expect(bond(["catalog", "add", url, "--ref", "v1", "--yes"]).code).toBe(0);
		const out = bond(["catalog", "list"]).out;
		expect(out).toMatch(/bond +incluido en bond/);
		expect(out).toContain(`equipo        ${url}  v1 @ ${v1.slice(0, 7)}`);
	});

	test("remove quita el catálogo, su lock y lo elegido de él", () => {
		expect(bond(["catalog", "add", url, "--yes"]).code).toBe(0);
		writeFileSync(at(".bond/bond.toml"), read(".bond/bond.toml").replace(/^skills = \[/m, 'skills = ["equipo:revisar", ').replace(/^commands = \[/m, 'commands = ["notas", '));
		expect(bond(["sync"]).code).toBe(0);
		expect(existsSync(at(".claude/commands/notas.md"))).toBe(true);
		const r = bond(["catalog", "remove", "equipo"]);
		expect(r.code).toBe(0);
		expect(r.out).toContain("quitado también de la selección: equipo:revisar, notas");
		const toml = read(".bond/bond.toml");
		expect(toml).not.toMatch(/^\[\[catalog\]\]/m);
		expect(toml).not.toContain("revisar");
		expect(existsSync(at(".bond/lock.json"))).toBe(false);
		expect(existsSync(at(".agents/skills/revisar"))).toBe(false);
		expect(existsSync(at(".claude/commands/notas.md"))).toBe(false);
		expect(bond(["sync", "--check"]).code).toBe(0);
	});

	test("clean deja solo los commits que fija el repo", () => {
		expect(bond(["catalog", "add", url, "--ref", "v1", "--yes"]).code).toBe(0);
		inCat("commands/otra.md", "---\ndescription: Otra\n---\nx\n");
		commit("v2");
		expect(bond(["catalog", "update", "equipo", "--ref", "main", "--yes"]).code).toBe(0);
		expect(existsSync(cacheDir(url, v1))).toBe(true);
		const r = bond(["catalog", "clean"]);
		expect(r.code).toBe(0);
		expect(r.out).toMatch(/commits? borrados?.*se queda el que fija este repo/);
		expect(existsSync(cacheDir(url, v1))).toBe(false);
		expect(existsSync(cacheDir(url, lock().equipo.sha))).toBe(true);
		expect(readdirSync(join(cacheDir(url, v1), "..")).length).toBe(1);
	});
});
