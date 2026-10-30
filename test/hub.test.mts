// bond hub (cli/hub.mts): la sesión de un repo hub, declarada en hub.toml (más
// .bond/hub.local.toml para rutas locales) y encontrada con ~/.bond/hubs.toml.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
Object.assign(process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" });
const {
	hubRoot,
	hubSession,
	parseHubToml,
	parseHubLocalToml,
	readHubsRegistry,
	writeHubsRegistry,
	registerHubRepo,
	submodules,
} = await import("../cli/hub.mts");
const { loadRepoConfig } = await import("../cli/repo.mts");
const { canonical, catchDie } = await import("../cli/util.mts");

const MAIN = join(import.meta.dir, "..", "cli", "main.mts");
let tmp: string;
let hub: string;
let backReal: string;

const g = (cwd: string, ...args: string[]) => {
	const r = spawnSync("git", ["-c", "protocol.file.allow=always", "-C", cwd, ...args], { encoding: "utf8" });
	if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
	return r.stdout.trim();
};
const repo = (name: string) => {
	const dir = join(tmp, name);
	mkdirSync(dir, { recursive: true });
	g(dir, "init", "-q", "-b", "main");
	writeFileSync(join(dir, "README"), `${name}\n`);
	g(dir, "add", "README");
	g(dir, "commit", "-qm", "init");
	return dir;
};
const bond = (args: string[], cwd = hub) =>
	spawnSync(process.execPath, [MAIN, ...args], { cwd, env: { ...process.env, NO_COLOR: "1" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

beforeEach(() => {
	tmp = realpathSync(mkdtempSync(join(tmpdir(), "bond-hub-")));
	const front = repo("front");
	backReal = repo("back-real");
	hub = repo("hub");

	// front entra como submódulo
	g(hub, "submodule", "add", "-q", "../front", "front");
	g(hub, "commit", "-qm", "add front submodule");

	// back entra como symlink
	if (process.platform !== "win32") {
		symlinkSync(backReal, join(hub, "back"));
	}

	mkdirSync(join(hub, ".bond"), { recursive: true });
	writeFileSync(join(hub, ".bond", "bond.toml"), 'agents = ["pi"]\n');

	// hub.toml en la raíz del hub
	const hubToml = `name = "hub"
base = "main"

[repos.front]
path = "front"
base = "main"
link = "submodule"
url  = "git@github.com:fluzo/front.git"

[repos.back]
path = "back"
base = "main"
link = "symlink"
`;
	writeFileSync(join(hub, "hub.toml"), hubToml);

	// .bond/hub.local.toml con la ruta local
	const hubLocalToml = `[repos.back]
source = "${backReal}"
`;
	writeFileSync(join(hub, ".bond", "hub.local.toml"), hubLocalToml);
});

afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe("hub.toml y .bond/hub.local.toml como fuente de la sesión", () => {
	test("un hub de prueba con un submódulo y un symlink en hub.toml da una sesión con los dos repos, sus bases y su modo de enlace", () => {
		const s = hubSession(hub);
		expect(s).toBeDefined();
		expect(s?.name).toBe("hub");
		expect(s?.repos.map((r) => [r.path, r.base, r.link, r.present])).toEqual([
			[".", "main", undefined, true],
			["back", "main", "symlink", process.platform !== "win32"],
			["front", "main", "submodule", true],
		]);

		const backRepo = s?.repos.find((r) => r.path === "back");
		expect(backRepo?.source).toBe(backReal);
		const frontRepo = s?.repos.find((r) => r.path === "front");
		expect(frontRepo?.url).toBe("git@github.com:fluzo/front.git");
	});

	test("bond hub enseña la sesión: repos, ruta, base, enlace y rama", () => {
		const show = bond(["hub"]);
		expect(show.status).toBe(0);
		expect(show.stdout).toMatch(/REPO\s+RUTA\s+BASE\s+ENLACE\s+RAMA/);
		expect(show.stdout).toContain("front");
		expect(show.stdout).toContain("submodule");
		expect(show.stdout).toContain("back");
		if (process.platform !== "win32") {
			expect(show.stdout).toContain("symlink");
		}
	});

	test(".bond/hub.local.toml expande ~ a HOME", () => {
		const local = `[repos.back]\nsource = "~/gitrepos/fluzo-backend"\n`;
		writeFileSync(join(hub, ".bond", "hub.local.toml"), local);
		const s = hubSession(hub)!;
		const backRepo = s.repos.find((r) => r.path === "back");
		expect(backRepo?.source?.startsWith("~")).toBe(false);
		expect(backRepo?.source).toBe(join(process.env.HOME || "", "gitrepos", "fluzo-backend"));
	});
});

describe("registro global ~/.bond/hubs.toml y hubRoot", () => {
	test("desde dentro del repo enlazado (por su ruta real, no por el symlink) hubRoot devuelve el hub gracias al registro; sin registro, nada", () => {
		// Antes de registrarlo: sin registro, nada
		expect(hubRoot(backReal)).toBeUndefined();

		// Anotar en ~/.bond/hubs.toml
		registerHubRepo(backReal, hub);

		// Ahora hubRoot devuelve el hub gracias al registro
		expect(hubRoot(backReal)).toBe(canonical(hub));

		// Y desde una subcarpeta dentro del repo enlazado también
		const sub = join(backReal, "some", "nested", "dir");
		mkdirSync(sub, { recursive: true });
		expect(hubRoot(sub)).toBe(canonical(hub));
	});

	test("hubRoot sube por superproyectos para submódulos", () => {
		expect(hubRoot(join(hub, "front"))).toBe(canonical(hub));
	});

	test("hubRoot devuelve undefined en un repo sin hub", () => {
		const solo = repo("solo");
		expect(hubRoot(solo)).toBeUndefined();
	});

	test("readHubsRegistry y writeHubsRegistry persisten mapeos", () => {
		const reg = { [canonical(backReal)]: canonical(hub) };
		writeHubsRegistry(reg);
		const read = readHubsRegistry();
		expect(read[canonical(backReal)]).toBe(canonical(hub));
	});
});

describe.skipIf(process.platform === "win32")("bond team status en un hub con submódulo y symlink", () => {
	test("enseña una sola tabla con los dos repos", () => {
		registerHubRepo(backReal, hub);
		g(join(hub, "front"), "worktree", "add", "-q", "-b", "fix/x", join(tmp, "wt-front-x"));
		g(backReal, "worktree", "add", "-q", "-b", "fix/x", join(tmp, "wt-back-x"));

		const fromHub = bond(["team", "status", "--json"]);
		expect(fromHub.status).toBe(0);
		const rows = JSON.parse(fromHub.stdout);
		expect(rows).toHaveLength(2);
		expect(rows.some((r: { repo: string; branch: string }) => r.repo === "front" && r.branch === "fix/x")).toBe(true);
		expect(rows.some((r: { repo: string; branch: string }) => r.repo === "back" && r.branch === "fix/x")).toBe(true);

		// En la salida formateada plana sale la cabecera REPO
		const plain = bond(["team", "status"]);
		expect(plain.status).toBe(0);
		expect(plain.stdout).toContain("REPO");
		expect(plain.stdout).toContain("front");
		expect(plain.stdout).toContain("back");

		// Desde el submódulo front da la misma tabla
		const fromSub = bond(["team", "status", "--json"], join(hub, "front"));
		expect(fromSub.status).toBe(0);
		expect(JSON.parse(fromSub.stdout)).toEqual(rows);
	});
});

describe("validación de hub.toml", () => {
	test("parseHubToml valida campos obligatorios y formato", () => {
		expect(catchDie(() => parseHubToml("")).error).toContain("falta name");
		expect(catchDie(() => parseHubToml('name = "x"\n')).error).toContain("falta base");
		expect(catchDie(() => parseHubToml('name = "x"\nbase = "main"\nrepos = 3\n')).error).toContain("tabla de repositorios");
		expect(catchDie(() => parseHubToml('name = "x"\nbase = "main"\n[repos.a]\nbase = "main"\nlink = "submodule"\n')).error).toContain("necesita path");
		expect(catchDie(() => parseHubToml('name = "x"\nbase = "main"\n[repos.a]\npath = "../out"\nbase = "main"\nlink = "submodule"\n')).error).toContain("ruta relativa");
		expect(catchDie(() => parseHubToml('name = "x"\nbase = "main"\n[repos.a]\npath = "a"\nlink = "submodule"\n')).error).toContain("necesita base");
		expect(catchDie(() => parseHubToml('name = "x"\nbase = "main"\n[repos.a]\npath = "a"\nbase = "main"\nlink = "otro"\n')).error).toContain('link tiene que ser "submodule" o "symlink"');
		expect(catchDie(() => parseHubToml('name = "x"\nbase = "main"\n[repos.a]\npath = "a"\nbase = "main"\nlink = "submodule"\n[repos.b]\npath = "a"\nbase = "main"\nlink = "submodule"\n')).error).toContain("repetida");
	});

	test("un hub.toml inválido se explica con un mensaje que dice qué arreglar; bond team lo trata como repo normal con un aviso", () => {
		writeFileSync(join(hub, "hub.toml"), 'name = "hub"\nbase = "main"\n[repos.front]\npath = "front"\nbase = "main"\nlink = "invalido"\n');
		const r = bond(["team", "status"]);
		expect(r.status).toBe(0);
		expect(r.stderr).toContain("link tiene que ser \"submodule\" o \"symlink\"");
		expect(r.stderr).toContain("sigo sin el modo hub");

		const rHub = bond(["hub"]);
		expect(rHub.status).toBe(1);
		expect(rHub.stderr).toContain("link tiene que ser \"submodule\" o \"symlink\"");
	});
});

describe("un bond.toml con [hub] ya no hace nada especial", () => {
	test("no produce error ni se interpreta como hub sin hub.toml", () => {
		const solo = repo("solo-hub-toml");
		mkdirSync(join(solo, ".bond"), { recursive: true });
		writeFileSync(join(solo, ".bond", "bond.toml"), 'agents = ["pi"]\n\n[hub]\nbase = "main"\n\n[hub.repos]\n"a" = { base = "main" }\n');

		expect(hubRoot(solo)).toBeUndefined();
		expect(hubSession(solo)).toBeUndefined();
		const cfg = loadRepoConfig(solo);
		expect(cfg.agents).toEqual(["pi"]);
		expect("hub" in cfg).toBe(false);

		const r = bond(["team", "status"], solo);
		expect(r.status).toBe(0);
		expect(r.stderr).not.toContain("error");
		expect(r.stderr).not.toContain("hub");
	});
});

describe("no regresión: un repo sin hub se comporta como siempre", () => {
	test("bond team status mira solo los worktrees de su propio repo", () => {
		const solo = repo("solo-normal");
		g(solo, "worktree", "add", "-q", "-b", "feat/solo-wt", join(tmp, "wt-solo"));
		const res = bond(["team", "status", "--json"], solo);
		expect(res.status).toBe(0);
		const rows = JSON.parse(res.stdout);
		expect(rows.map((r: { branch: string }) => r.branch)).toEqual(["feat/solo-wt"]);
		expect("repo" in rows[0]).toBe(false);
		expect("base" in rows[0]).toBe(false);

		const plain = bond(["team", "status"], solo);
		expect(plain.status).toBe(0);
		expect(plain.stdout).not.toContain("REPO");
	});
});

describe("ayuda y submodules", () => {
	test("bond hub --help enseña la ayuda", () => {
		const r = bond(["hub", "--help"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("Un hub es un repo git compartido");
		expect(r.stdout).toContain("hub.toml");
	});

	test("submodules detecta los submódulos inicializados del repo", () => {
		expect(submodules(hub)).toEqual([
			{ path: "front", initialized: true },
		]);
	});
});
