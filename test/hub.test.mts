// bond hub (cli/hub.mts): la sesión de un repo hub con submódulos, en [hub] de bond.toml.
// Cada prueba monta un hub de fixture en un directorio temporal: repos locales enlazados con
// git submodule add, uno de ellos con un submódulo anidado y otro sin inicializar.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
Object.assign(process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" });
const { hubBlock, hubRoot, hubSession, submodules, withHub } = await import("../cli/hub.mts");
const { parseHub, repoHub } = await import("../cli/repo.mts");
const { canonical } = await import("../cli/util.mts");

const MAIN = join(import.meta.dir, "..", "cli", "main.mts");
const TOML = 'agents = ["pi"]\n\n# memoria\n[decisions]\ndir = "docs/decisions"\n';
let tmp: string;
let hub: string;

const g = (cwd: string, ...args: string[]) => {
	const r = spawnSync("git", ["-c", "protocol.file.allow=always", "-C", cwd, ...args], { encoding: "utf8" });
	if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
	return r.stdout.trim();
};
const repo = (name: string) => {
	const dir = join(tmp, name);
	mkdirSync(dir);
	g(dir, "init", "-q", "-b", "main");
	writeFileSync(join(dir, "README"), `${name}\n`);
	g(dir, "add", "README");
	g(dir, "commit", "-qm", "init");
	return dir;
};
const bond = (args: string[], cwd = hub) =>
	spawnSync(process.execPath, [MAIN, ...args], { cwd, env: { ...process.env, NO_COLOR: "1" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const toml = () => readFileSync(join(hub, ".bond", "bond.toml"), "utf8");

beforeEach(() => {
	tmp = realpathSync(mkdtempSync(join(tmpdir(), "bond-hub-")));
	repo("lib");
	const front = repo("front");
	repo("back");
	hub = repo("hub");
	// front lleva lib anidada; el hub, front y back (back se queda sin inicializar).
	g(front, "submodule", "add", "-q", "../lib", "libs/lib");
	g(front, "commit", "-qm", "sub");
	g(hub, "submodule", "add", "-q", "../front", "front");
	g(hub, "submodule", "add", "-q", "../back", "back");
	g(hub, "commit", "-qm", "subs");
	g(hub, "submodule", "update", "--init", "--recursive", "-q");
	g(hub, "submodule", "deinit", "-q", "back");
	mkdirSync(join(hub, ".bond"));
	writeFileSync(join(hub, ".bond", "bond.toml"), TOML);
});

afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe("bond hub", () => {
	test("escribe [hub] con el hub, el submódulo y el anidado; repetirlo no cambia nada", () => {
		expect(submodules(hub)).toEqual([
			{ path: "back", initialized: false },
			{ path: "front", initialized: true },
			{ path: "front/libs/lib", initialized: true },
		]);
		const r = bond(["hub", "--yes", "--base", "front/libs/lib=main"]);
		expect(r.status).toBe(0);
		expect(r.stderr).toContain("back: submódulo sin inicializar");
		const written = toml();
		// Lo que había se conserva, comentarios incluidos.
		expect(written.startsWith(TOML)).toBe(true);
		expect(repoHub(hub)).toEqual({ base: "main", repos: { front: { base: "main" }, "front/libs/lib": { base: "main" } }, exclude: [] });
		for (const args of [["hub", "--yes"], ["hub", "--yes", "--base", "front/libs/lib=main"], ["hub", "sync", "--yes"]]) {
			const again = bond(args);
			expect(again.status).toBe(0);
			expect(toml()).toBe(written);
		}
		expect(bond(["hub", "sync", "--yes"]).stdout).toContain("sin cambios en [hub]");
	});

	test("un repo en HEAD separado necesita su base: con --yes falla, dice cómo y no escribe", () => {
		const r = bond(["hub", "--yes"]);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("front/libs/lib");
		expect(r.stderr).toContain("--base front/libs/lib=");
		expect(toml()).toBe(TOML);
	});

	test("--base con un repo que no es de la sesión o una ref que no existe, falla sin escribir", () => {
		expect(bond(["hub", "--yes", "--base", "back=main"]).stderr).toContain("no es un repo de la sesión");
		expect(bond(["hub", "--yes", "--base", "front/libs/lib=nope"]).stderr).toContain("nope no existe");
		expect(toml()).toBe(TOML);
	});

	test("--base trima la ruta y el ref", () => {
		const r = bond(["hub", "--yes", "--dry-run", "--base", " front = main ", "--base", "front/libs/lib=main"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain('"front" = { base = "main" }');
		expect(toml()).toBe(TOML);
	});

	test("--dry-run enseña el bloque que escribiría y no toca el fichero", () => {
		const r = bond(["hub", "--yes", "--dry-run", "--base", "front/libs/lib=main"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("[dry-run]");
		expect(r.stdout).toContain("[hub]");
		expect(r.stdout).toContain('"front/libs/lib" = { base = "main" }');
		expect(toml()).toBe(TOML);
	});

	test("en un repo sin submódulos explica qué hace falta y no escribe nada", () => {
		const solo = repo("solo");
		mkdirSync(join(solo, ".bond"));
		writeFileSync(join(solo, ".bond", "bond.toml"), TOML);
		const r = bond(["hub", "--yes"], solo);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("no tiene submódulos");
		expect(r.stderr).toContain("git submodule add");
		expect(readFileSync(join(solo, ".bond", "bond.toml"), "utf8")).toBe(TOML);
	});

	test("sin .bond/bond.toml pide bond init", () => {
		rmSync(join(hub, ".bond"), { recursive: true });
		const r = bond(["hub", "--yes"]);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("bond init");
	});

	test("con [hub], bond hub enseña la sesión y avisa de lo pendiente; sync lo aplica", () => {
		bond(["hub", "--yes", "--base", "front/libs/lib=main"]);
		const show = bond(["hub"]);
		expect(show.status).toBe(0);
		expect(show.stdout).toMatch(/REPO\s+RUTA\s+BASE\s+RAMA/);
		expect(show.stdout).toMatch(/lib\s+front\/libs\/lib\s+main\s+\(HEAD separado\)/);
		// back se inicializa: bond hub lo avisa sin tocar nada; sync lo añade (desde el anidado).
		g(hub, "submodule", "update", "--init", "-q", "back");
		const before = toml();
		expect(bond(["hub"]).stderr).toContain("back: submódulo nuevo");
		expect(toml()).toBe(before);
		const sync = bond(["hub", "sync", "--yes", "--base", "back=main"], join(hub, "front", "libs", "lib"));
		expect(sync.status).toBe(0);
		expect(repoHub(hub)?.repos.back).toEqual({ base: "main" });
		// Y si se desinicializa, sync lo quita.
		g(hub, "submodule", "deinit", "-q", "back");
		bond(["hub", "sync", "--yes"]);
		expect(repoHub(hub)?.repos.back).toBeUndefined();
	});

	test("exclude deja fuera un submódulo y lo que cuelga de él", () => {
		writeFileSync(join(hub, ".bond", "bond.toml"), `${TOML}\n[hub]\nbase = "main"\nexclude = ["front"]\n`);
		// Sin nada fuera de exclude, no hay sesión que escribir.
		expect(bond(["hub", "sync", "--yes"]).stderr).toContain("fuera de exclude");
		g(hub, "submodule", "update", "--init", "-q", "back");
		const r = bond(["hub", "sync", "--yes", "--base", "back=main"]);
		expect(r.status).toBe(0);
		expect(repoHub(hub)).toEqual({ base: "main", repos: { back: { base: "main" } }, exclude: ["front"] });
		expect(toml()).toContain('exclude = ["front"]');
	});

	test("una [hub] inválida: bond hub no escribe encima", () => {
		const bad = `${TOML}\n[hub]\nbase = 3\n`;
		writeFileSync(join(hub, ".bond", "bond.toml"), bad);
		const r = bond(["hub", "--yes"]);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("hub.base");
		expect(toml()).toBe(bad);
	});
});

describe("no regresión: un repo sin [hub] se comporta como siempre", () => {
	test("bond team status mira solo los worktrees de su propio repo, sin agregar los de los submódulos", () => {
		// Sin [hub] escrita: ni el hub agrega los submódulos ni el submódulo ve los del hub.
		g(hub, "worktree", "add", "-q", "-b", "feat/hub-wt", join(tmp, "wt-hub"));
		g(join(hub, "front"), "worktree", "add", "-q", "-b", "feat/front-wt", join(tmp, "wt-front"));
		const fromHub = bond(["team", "status", "--json"]);
		expect(fromHub.status).toBe(0);
		expect(JSON.parse(fromHub.stdout).map((r: { branch: string }) => r.branch)).toEqual(["feat/hub-wt"]);
		const fromSub = bond(["team", "status", "--json"], join(hub, "front"));
		expect(fromSub.status).toBe(0);
		expect(JSON.parse(fromSub.stdout).map((r: { branch: string }) => r.branch)).toEqual(["feat/front-wt"]);
	});
});

describe("hubRoot y hubSession", () => {
	test("desde un submódulo anidado, el hub de arriba; sin [hub], nada", () => {
		expect(hubRoot(join(hub, "front", "libs", "lib"))).toBeUndefined();
		bond(["hub", "--yes", "--base", "front/libs/lib=main"]);
		expect(hubRoot(join(hub, "front", "libs", "lib"))).toBe(canonical(hub));
		expect(hubRoot(join(hub, "front"))).toBe(canonical(hub));
		expect(hubRoot(hub)).toBe(canonical(hub));
		expect(hubRoot(join(tmp, "lib"))).toBeUndefined();
	});

	test("la sesión: el hub primero y sus repos con base y rama", () => {
		expect(hubSession(hub)).toBeUndefined();
		bond(["hub", "--yes", "--base", "front/libs/lib=main"]);
		const s = hubSession(hub)!;
		expect(s.name).toBe("hub");
		expect(s.repos.map((r) => [r.path, r.base, r.branch, r.present])).toEqual([
			[".", "main", "main", true],
			["front", "main", "main", true],
			["front/libs/lib", "main", undefined, true],
		]);
		expect(s.repos[2].dir).toBe(join(hub, "front", "libs", "lib"));
	});
});

describe("[hub] en bond.toml", () => {
	test("validación", () => {
		expect(parseHub(undefined)).toEqual({});
		expect(parseHub({ base: "main" }).hub).toEqual({ base: "main", repos: {}, exclude: [] });
		expect(parseHub("x").error).toContain("tabla");
		expect(parseHub({}).error).toContain("hub.base");
		expect(parseHub({ base: "main", repos: { "../x": { base: "main" } } }).error).toContain("ruta relativa");
		expect(parseHub({ base: "main", repos: { "/abs": { base: "main" } } }).error).toContain("ruta relativa");
		expect(parseHub({ base: "main", repos: { "a\\b": { base: "main" } } }).error).toContain("ruta relativa");
		expect(parseHub({ base: "main", repos: { a: {} } }).error).toContain("necesita su base");
		expect(parseHub({ base: "main", exclude: ["../x"] }).error).toContain("exclude");
	});

	test("leerla inválida avisa y la ignora, sin abortar", () => {
		writeFileSync(join(hub, ".bond", "bond.toml"), `${TOML}\n[hub]\nbase = "main"\nrepos = 3\n`);
		expect(repoHub(hub)).toBeUndefined();
		expect(hubRoot(hub)).toBeUndefined();
	});

	test("withHub sustituye la sección en su sitio y deja lo demás igual", () => {
		const block = hubBlock({ base: "dev", repos: { b: { base: "main" }, a: { base: "x" } }, exclude: [] });
		expect(block).toBe('[hub]\n# Sesión del hub: la escribe bond hub (y bond hub sync, si cambian los submódulos).\nbase = "dev"\n\n[hub.repos]\n"a" = { base = "x" }\n"b" = { base = "main" }');
		const text = 'agents = ["pi"]\n\n[hub]\nbase = "main"\n\n[hub.repos]\n"a" = { base = "main" }\n\n# servidores propios\n[mcp_servers.x]\ncommand = "x"\n';
		const out = withHub(text, block);
		expect(out).toBe(`agents = ["pi"]\n\n${block}\n\n# servidores propios\n[mcp_servers.x]\ncommand = "x"\n`);
		expect(withHub(out, block)).toBe(out);
		expect(withHub('agents = ["pi"]\n', block)).toBe(`agents = ["pi"]\n\n${block}\n`);
	});
});
