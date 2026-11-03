// bond hub bump (cli/hub-bump.mts): mover los punteros (gitlinks) de los submódulos del hub a
// su base y commitearlo en el hub sin push nunca.
// Nunca toca el ~/.bond real: BOND_HOME temporal.

import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

setDefaultTimeout(30_000);

if (!process.env.BOND_HOME) {
	process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
}
Object.assign(process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" });
const { BOND_HOME } = await import("../cli/runtime.mts");
const { hubsPath } = await import("../cli/hub.mts");

const MAIN = join(import.meta.dir, "..", "cli", "main.mts");
let tmp: string;
let hub: string;
let hubRemote: string;
let subOrigin: string;
let sub: string;
let linkReal: string;
let advances = 0;

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
	spawnSync(process.execPath, [MAIN, ...args], {
		cwd,
		env: { ...process.env, BOND_HOME, NO_COLOR: "1", GIT_ALLOW_PROTOCOL: "file" },
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});

const bondInit = (dir: string) => {
	mkdirSync(join(dir, ".bond"), { recursive: true });
	writeFileSync(join(dir, ".bond", "bond.toml"), "agents = []\n");
	expect(bond(["sync"], dir).status).toBe(0);
	g(dir, "add", "-A");
	g(dir, "commit", "-qm", "bond init");
};

/** Commit nuevo en el origen del submódulo; devuelve el SHA al que quedará la base. */
const advanceOrigin = () => {
	writeFileSync(join(subOrigin, `nuevo-${++advances}.txt`), "x\n");
	g(subOrigin, "add", "-A");
	g(subOrigin, "commit", "-qm", `nuevo en origin ${advances}`);
	return g(subOrigin, "rev-parse", "HEAD");
};

/** Base del submódulo (rama main) avanzada localmente al último commit de su origen. */
const ffBase = () => {
	const target = advanceOrigin();
	g(sub, "fetch", "-q", "origin");
	g(sub, "merge", "-q", "--ff-only", "origin/main");
	return target;
};

const gitlink = () => g(hub, "ls-files", "-s", "--", "repos/sub");

beforeEach(() => {
	rmSync(hubsPath(), { force: true });
	tmp = realpathSync(mkdtempSync(join(tmpdir(), "bond-hubbump-")));

	// Origen del submódulo y clon local del symlink
	subOrigin = repo("sub-origin");
	linkReal = repo("link-real");

	// Hub con un submódulo y un symlink
	hub = repo("hub");
	bondInit(hub);
	g(hub, "submodule", "add", "-q", subOrigin, "repos/sub");
	sub = join(hub, "repos", "sub");
	symlinkSync(linkReal, join(hub, "repos", "linked"), process.platform === "win32" ? "junction" : "dir");
	writeFileSync(
		join(hub, "hub.toml"),
		`name = "hub"
base = "main"

[repos.sub]
path = "repos/sub"
base = "main"
link = "submodule"

[repos.linked]
path = "repos/linked"
base = "main"
link = "symlink"
`,
	);
	writeFileSync(join(hub, ".gitignore"), ".bond/hub.local.toml\n/repos/linked\n");
	writeFileSync(join(hub, ".bond", "hub.local.toml"), `[repos.linked]\nsource = ${JSON.stringify(linkReal)}\n`);
	expect(bond(["sync"], hub).status).toBe(0);
	g(hub, "add", "-A");
	g(hub, "commit", "-qm", "hub setup");

	// Remoto bare del hub: si su main no se mueve, es que bump no hizo push
	hubRemote = join(tmp, "hub-remote.git");
	g(tmp, "clone", "--bare", hub, hubRemote);
	g(hub, "remote", "add", "origin", hubRemote);
	g(hub, "push", "-u", "origin", "main");
});

afterEach(() => {
	rmSync(hubsPath(), { force: true });
	rmSync(tmp, { recursive: true, force: true });
});

describe("bond hub bump", () => {
	test("ayuda con --help y -h", () => {
		const r = bond(["hub", "bump", "--help"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("Uso: bond hub bump");
		expect(r.stdout).toContain("--dry-run");
		expect(r.stdout).toContain("--json");
	});

	test("fuera de un hub falla con mensaje claro", () => {
		const solo = repo("solo");
		const r = bond(["hub", "bump"], solo);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("no es un hub");
	});

	test("opción desconocida falla con mensaje claro", () => {
		const r = bond(["hub", "bump", "--inexistente"]);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("opción desconocida: --inexistente");
	});

	test("puntero movido a la base: commit creado en el hub y nunca empujado", () => {
		// La base del submódulo avanza (lo que haría `bond hub pull` tras el merge en el origen)
		const target = ffBase();
		const before = g(hub, "rev-parse", "HEAD");

		const r = bond(["hub", "bump"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("sub (repos/sub)  movido");
		expect(r.stdout).toContain("1 movido(s)");
		expect(r.stdout).toContain("sin push");

		// El gitlink del hub apunta al commit de la base y hay un commit nuevo en el hub
		expect(gitlink()).toContain(target);
		const after = g(hub, "rev-parse", "HEAD");
		expect(after).not.toBe(before);
		expect(g(hub, "show", "--format=%s", "-s", "HEAD")).toBe("chore: bump submodules to base");

		// Sin push: el remoto del hub sigue en el commit anterior
		expect(g(hubRemote, "rev-parse", "refs/heads/main")).toBe(before);
		// Y el hub queda limpio
		expect(g(hub, "status", "--porcelain")).toBe("");
	});

	test("submódulo ya al día: se dice y no se commitea nada", () => {
		const before = g(hub, "rev-parse", "HEAD");
		const r = bond(["hub", "bump"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("sub (repos/sub)  al día");
		expect(r.stdout).toContain("1 al día");
		expect(g(hub, "rev-parse", "HEAD")).toBe(before);
	});

	test("repo enlazado por symlink: se dice explicitamente que no aplica", () => {
		const r = bond(["hub", "bump"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("linked (repos/linked)");
		expect(r.stdout).toContain("no aplica: enlazado por symlink, no hay gitlink que mover");
		expect(r.stdout).toContain("1 no aplica");
	});

	test("--dry-run no toca nada y muestra el de-a del puntero", () => {
		const target = ffBase();
		const before = g(hub, "rev-parse", "HEAD");
		const pointerBefore = gitlink();

		const r = bond(["hub", "bump", "--dry-run"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("movería");
		expect(r.stdout).toContain("[dry-run]");
		expect(g(hub, "rev-parse", "HEAD")).toBe(before);
		expect(gitlink()).toBe(pointerBefore);
		expect(gitlink()).not.toContain(target);
	});

	test("submódulo sucio: no se toca y se explica por qué", () => {
		const target = ffBase();
		writeFileSync(join(sub, "sucio.txt"), "x\n");
		const before = g(hub, "rev-parse", "HEAD");

		const r = bond(["hub", "bump"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("sub (repos/sub)  saltado: 1 cambio(s) sin commitear en el submódulo");
		expect(r.stdout).toContain("1 saltado(s)");
		expect(g(hub, "rev-parse", "HEAD")).toBe(before);
		expect(gitlink()).not.toContain(target);
	});

	test("submódulo desincronizado (HEAD en otra rama): no se toca y se explica", () => {
		g(sub, "checkout", "-qb", "feature");
		writeFileSync(join(sub, "feature.txt"), "x\n");
		g(sub, "add", "-A");
		g(sub, "commit", "-qm", "feature local");
		const before = g(hub, "rev-parse", "HEAD");

		const r = bond(["hub", "bump"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("sub (repos/sub)  saltado: desincronizado");
		expect(g(hub, "rev-parse", "HEAD")).toBe(before);
	});

	test("submódulo en HEAD separado sincronizado con el puntero: bump mueve puntero y checkout y el hub queda limpio", () => {
		const pointer = gitlink().split(/\s+/)[1];
		g(sub, "checkout", "-q", pointer); // HEAD separado, sincronizado con el gitlink
		const target = advanceOrigin();
		g(sub, "fetch", "-q", "origin");
		g(sub, "fetch", "-q", "origin", "main:main"); // avanza la ref de base sin checkout (como hub pull)

		const r = bond(["hub", "bump"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("sub (repos/sub)  movido");
		expect(gitlink()).toContain(target);
		// El checkout del submódulo se actualizó al nuevo puntero: el hub queda limpio
		expect(g(sub, "rev-parse", "HEAD")).toBe(target);
		expect(g(hub, "status", "--porcelain")).toBe("");
	});

	test("aborta si el hub tiene cambios ya staged y no commitea nada", () => {
		ffBase();
		writeFileSync(join(hub, "staged.txt"), "x\n");
		g(hub, "add", "staged.txt");
		const before = g(hub, "rev-parse", "HEAD");

		const r = bond(["hub", "bump"]);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("cambios ya staged");
		expect(g(hub, "rev-parse", "HEAD")).toBe(before);
	});

	test("--json devuelve el resultado estructurado por repo", () => {
		const target = ffBase();
		const r = bond(["hub", "bump", "--json"]);
		expect(r.status).toBe(0);
		const data = JSON.parse(r.stdout);
		expect(data.hub).toBe("hub");
		expect(data.ok).toBe(true);
		expect(data.repos).toHaveLength(2);
		const subRes = data.repos.find((x: { repo: string }) => x.repo === "sub");
		expect(subRes.status).toBe("moved");
		expect(target.startsWith(subRes.to)).toBe(true);
		const linkedRes = data.repos.find((x: { repo: string }) => x.repo === "linked");
		expect(linkedRes.status).toBe("not_applicable");
		expect(data.commit).toBeTruthy();
	});
});
