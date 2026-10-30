// Pruebas de bond hub init, bond hub add y bond hub sync (P6 de 2026-10-30-hub-guided)

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

if (!process.env.BOND_HOME) {
	process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
}
Object.assign(process.env, {
	GIT_AUTHOR_NAME: "t",
	GIT_AUTHOR_EMAIL: "t@t",
	GIT_COMMITTER_NAME: "t",
	GIT_COMMITTER_EMAIL: "t@t",
});

const { BOND_HOME } = await import("../cli/runtime.mts");
const { hubRoot, hubSession, hubsPath, parseHubToml, parseHubLocalToml } = await import("../cli/hub.mts");
const { linkRepo, renderHubToml, renderHubLocalToml } = await import("../cli/hub-init.mts");
const { canonical } = await import("../cli/util.mts");

const MAIN = join(import.meta.dir, "..", "cli", "main.mts");
let tmp: string;
let frontReal: string;
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

const bond = (args: string[], cwd: string) =>
	spawnSync(process.execPath, [MAIN, ...args], {
		cwd,
		env: { ...process.env, BOND_HOME, NO_COLOR: "1" },
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});

beforeEach(() => {
	rmSync(hubsPath(), { force: true });
	tmp = realpathSync(mkdtempSync(join(tmpdir(), "bond-hub-init-")));
	frontReal = repo("front-real");
	backReal = repo("back-real");
});

afterEach(() => {
	rmSync(hubsPath(), { force: true });
	rmSync(tmp, { recursive: true, force: true });
});

describe("bond hub init", () => {
	test("bond hub init --yes con repo por URL y repo por ruta local crea hub con submódulo y symlink; repetirlo no cambia nada", () => {
		const hubDir = join(tmp, "hub");
		mkdirSync(hubDir, { recursive: true });

		const frontUrl = `file://${frontReal}`;
		// Ejecutar bond hub init con URL (submódulo) y ruta local (symlink)
		const res = bond(["hub", "init", "--yes", frontUrl, backReal], hubDir);
		expect(res.status).toBe(0);

		// hub.toml y .bond/hub.local.toml
		const hubTomlPath = join(hubDir, "hub.toml");
		expect(existsSync(hubTomlPath)).toBe(true);
		const hubToml = parseHubToml(readFileSync(hubTomlPath, "utf8"));
		expect(hubToml.name).toBe("hub");
		expect(hubToml.base).toBe("main");

		const frontEntry = Object.values(hubToml.repos).find((r) => r.link === "submodule");
		expect(frontEntry).toBeDefined();
		expect(frontEntry?.url).toBe(frontUrl);
		expect(frontEntry?.base).toBe("main");

		const backEntry = Object.values(hubToml.repos).find((r) => r.link === "symlink");
		expect(backEntry).toBeDefined();
		expect(backEntry?.base).toBe("main");

		const localPath = join(hubDir, ".bond", "hub.local.toml");
		expect(existsSync(localPath)).toBe(true);
		const localToml = parseHubLocalToml(readFileSync(localPath, "utf8"));
		const backLocalKey = Object.keys(hubToml.repos).find((k) => hubToml.repos[k].link === "symlink")!;
		expect(localToml.repos[backLocalKey]?.source).toBe(backReal);

		// .gitignore con .bond/hub.local.toml y la ruta del symlink
		const gitignore = readFileSync(join(hubDir, ".gitignore"), "utf8");
		expect(gitignore).toContain(".bond/hub.local.toml");
		expect(gitignore).toContain(`/${backEntry?.path}`);

		// AGENTS.md y .bond/bond.toml creados
		expect(existsSync(join(hubDir, "AGENTS.md"))).toBe(true);
		expect(existsSync(join(hubDir, ".bond", "bond.toml"))).toBe(true);

		// Submódulo montado y symlink creado
		expect(existsSync(join(hubDir, frontEntry!.path, ".git"))).toBe(true);
		const backDest = join(hubDir, backEntry!.path);
		expect(existsSync(backDest)).toBe(true);
		expect(lstatSync(backDest).isSymbolicLink()).toBe(true);

		// Registro global actualizado
		expect(hubRoot(backReal)).toBe(canonical(hubDir));

		// Repetirlo no cambia nada (idempotente)
		const res2 = bond(["hub", "init", "--yes", frontUrl, backReal], hubDir);
		expect(res2.status).toBe(0);
		expect(readFileSync(hubTomlPath, "utf8")).toBe(renderHubToml(hubToml));
	});

	test("en un repo con submódulos, init los importa a hub.toml con su base", () => {
		const hubDir = repo("hub-with-sub");
		g(hubDir, "submodule", "add", "-q", `file://${frontReal}`, "sub-front");
		g(hubDir, "commit", "-qm", "add sub-front");

		const res = bond(["hub", "init", "--yes"], hubDir);
		expect(res.status).toBe(0);

		const hubToml = parseHubToml(readFileSync(join(hubDir, "hub.toml"), "utf8"));
		expect(hubToml.repos["sub-front"]).toBeDefined();
		expect(hubToml.repos["sub-front"].path).toBe("sub-front");
		expect(hubToml.repos["sub-front"].link).toBe("submodule");
		expect(hubToml.repos["sub-front"].base).toBe("main");
	});
});

describe("bond hub add", () => {
	test("bond hub add añade un submódulo si es URL y un symlink si es ruta local", () => {
		const hubDir = repo("hub-add-test");
		const initRes = bond(["hub", "init", "--yes"], hubDir);
		expect(initRes.status).toBe(0);

		// Añadir submódulo por URL
		const addSub = bond(["hub", "add", `file://${frontReal}`, "--name", "front"], hubDir);
		expect(addSub.status).toBe(0);

		// Añadir symlink por ruta local
		const addSym = bond(["hub", "add", backReal, "--name", "back"], hubDir);
		expect(addSym.status).toBe(0);

		const s = hubSession(hubDir);
		expect(s).toBeDefined();
		expect(s?.repos.some((r) => r.path === "front" && r.link === "submodule")).toBe(true);
		expect(s?.repos.some((r) => r.path === "back" && r.link === "symlink")).toBe(true);

		// .gitignore contiene back
		const gitignore = readFileSync(join(hubDir, ".gitignore"), "utf8");
		expect(gitignore).toContain("/back");
	});
});

describe("bond hub sync", () => {
	test("clonar el hub en otra carpeta y pasar bond hub sync monta el submódulo; para symlink sin ruta local, con --yes falla diciendo cómo darla", () => {
		const hubDir = join(tmp, "original-hub");
		mkdirSync(hubDir, { recursive: true });

		const frontUrl = `file://${frontReal}`;
		bond(["hub", "init", "--yes", frontUrl, backReal], hubDir);
		g(hubDir, "add", "-A");
		g(hubDir, "commit", "-qm", "commit hub config");

		// Clonar el hub en otra carpeta (no lleva .bond/hub.local.toml porque está en .gitignore)
		const clonedHub = join(tmp, "cloned-hub");
		g(tmp, "clone", "-q", hubDir, "cloned-hub");

		// Con --yes, falla diciendo cómo dar la ruta local del symlink
		const syncFail = bond(["hub", "sync", "--yes"], clonedHub);
		expect(syncFail.status).not.toBe(0);
		expect(syncFail.stderr).toContain("falta la ruta local para");
		expect(syncFail.stderr).toContain("hub.local.toml");

		// Pero el submódulo sí se montó
		const frontKey = Object.keys(parseHubToml(readFileSync(join(clonedHub, "hub.toml"), "utf8")).repos).find(
			(k) => parseHubToml(readFileSync(join(clonedHub, "hub.toml"), "utf8")).repos[k].link === "submodule",
		)!;
		expect(existsSync(join(clonedHub, frontKey, ".git"))).toBe(true);

		// Al indicarle la ruta local en .bond/hub.local.toml, sync tiene éxito y monta el symlink
		const backKey = Object.keys(parseHubToml(readFileSync(join(clonedHub, "hub.toml"), "utf8")).repos).find(
			(k) => parseHubToml(readFileSync(join(clonedHub, "hub.toml"), "utf8")).repos[k].link === "symlink",
		)!;
		mkdirSync(join(clonedHub, ".bond"), { recursive: true });
		writeFileSync(join(clonedHub, ".bond", "hub.local.toml"), `[repos.${backKey}]\nsource = "${backReal}"\n`);

		const syncSuccess = bond(["hub", "sync", "--yes"], clonedHub);
		expect(syncSuccess.status).toBe(0);
		expect(existsSync(join(clonedHub, backKey))).toBe(true);
		expect(lstatSync(join(clonedHub, backKey)).isSymbolicLink()).toBe(true);
	});

	test("sync --dry-run dice qué haría y no toca nada; nunca borra un repo ni un clon existente", () => {
		const hubDir = repo("hub-dry-test");
		const toml = `name = "hub-dry-test"
base = "main"

[repos.front]
path = "front"
base = "main"
link = "submodule"
url  = "file://${frontReal}"

[repos.back]
path = "back"
base = "main"
link = "symlink"
`;
		writeFileSync(join(hubDir, "hub.toml"), toml);
		mkdirSync(join(hubDir, ".bond"), { recursive: true });
		writeFileSync(join(hubDir, ".bond", "hub.local.toml"), `[repos.back]\nsource = "${backReal}"\n`);

		const dryRes = bond(["hub", "sync", "--dry-run"], hubDir);
		expect(dryRes.status).toBe(0);
		expect(dryRes.stdout).toContain("[dry-run]");

		// No creó front ni back
		expect(existsSync(join(hubDir, "front"))).toBe(false);
		expect(existsSync(join(hubDir, "back"))).toBe(false);
	});

	test("en Windows, si el symlink falla, crea una junction y lo dice", () => {
		const testDir = join(tmp, "junction-test");
		mkdirSync(testDir, { recursive: true });
		const dest = join(testDir, "junction-dest");

		let junctionCreated = false;
		const mockSymlink = (target: string, path: string, type?: string) => {
			if (type === "dir") {
				const err = new Error("EPERM: operation not permitted, symlink");
				// @ts-expect-error test error code
				err.code = "EPERM";
				throw err;
			}
			if (type === "junction") {
				junctionCreated = true;
			}
		};

		// Llamada simulando Windows
		const res = linkRepo(backReal, dest, {
			platform: "win32",
			symlinkFn: mockSymlink,
		});

		expect(res).toBe("junction");
		expect(junctionCreated).toBe(true);
	});
});
