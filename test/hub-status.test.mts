// bond hub: estado en vivo por repo (#42) — cambios sin commitear y commits por delante/
// detrás de su remoto, calculados contra las refs locales del remoto (sin red); --fetch
// refresca antes de calcular. El cálculo compartido vive en cli/hub-status.mts y lo usan
// también `bond hub check` y `bond hub pull`.

import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Montar el hub (bare origins, clones, submódulo, symlink) y lanzar bond tarda en Windows.
setDefaultTimeout(30_000);

if (!process.env.BOND_HOME) {
	process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
}
Object.assign(process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" });
const { BOND_HOME } = await import("../cli/runtime.mts");
const { hubSession, hubsPath } = await import("../cli/hub.mts");
const { aheadBehind, dirtyCount, repoState, upstreamOf } = await import("../cli/hub-status.mts");

const MAIN = join(import.meta.dir, "..", "cli", "main.mts");
let tmp: string;
let hub: string;
let front: string; // submódulo del hub, clonado de frontOrigin
let backReal: string; // clon local enlazado por symlink, clonado de backOrigin
let frontWorker: string; // clone extra para commitear al origen de front sin tocar la sesión
let backWorker: string;

const g = (cwd: string, ...args: string[]) => {
	const r = spawnSync("git", ["-c", "protocol.file.allow=always", "-C", cwd, ...args], { encoding: "utf8" });
	if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
	return r.stdout.trim();
};
const bare = (name: string) => {
	const dir = join(tmp, name);
	mkdirSync(dir, { recursive: true });
	g(dir, "init", "-q", "--bare");
	return dir;
};
/** Clon del bare con un commit inicial empujado y upstream puesto (origin/main). */
const seededClone = (name: string, origin: string) => {
	const dir = join(tmp, name);
	g(tmp, "clone", "-q", origin, dir);
	writeFileSync(join(dir, "README"), `${name}\n`);
	g(dir, "add", "README");
	g(dir, "commit", "-qm", "init");
	g(dir, "push", "-q", "-u", "origin", "main");
	return dir;
};
const bond = (args: string[], cwd = hub) =>
	spawnSync(process.execPath, [MAIN, ...args], { cwd, env: { ...process.env, BOND_HOME, NO_COLOR: "1" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

/** La fila de la tabla del repo `name` (empieza por su nombre tras la sangría). */
const rowOf = (out: string, name: string) => out.split("\n").find((l) => new RegExp(`^  ${name}(\\s|$)`).test(l)) ?? "";

/** Commit nuevo en el origen de front o back, hecho desde su worker (no toca la sesión). */
const pushToOrigin = (worker: string, fname: string) => {
	writeFileSync(join(worker, fname), `${fname}\n`);
	g(worker, "add", fname);
	g(worker, "commit", "-qm", `nuevo en remoto: ${fname}`);
	g(worker, "push", "-q", "origin", "main");
};

beforeEach(() => {
	rmSync(hubsPath(), { force: true });
	tmp = realpathSync(mkdtempSync(join(tmpdir(), "bond-hubstatus-")));

	const frontOrigin = bare("front-origin.git");
	const backOrigin = bare("back-origin.git");
	frontWorker = seededClone("front-worker", frontOrigin);
	backWorker = seededClone("back-worker", backOrigin);

	hub = join(tmp, "hub");
	mkdirSync(hub, { recursive: true });
	g(hub, "init", "-q", "-b", "main");
	writeFileSync(join(hub, "README"), "hub\n");
	g(hub, "add", "README");
	g(hub, "commit", "-qm", "init");

	// front entra como submódulo: su checkout se clona del bare, con origin/main por upstream.
	g(hub, "submodule", "add", "-q", frontOrigin, "front");
	front = join(hub, "front");

	// back entra como symlink a su clon local, también con upstream.
	backReal = join(tmp, "back-real");
	g(tmp, "clone", "-q", backOrigin, backReal);
	symlinkSync(backReal, join(hub, "back"), process.platform === "win32" ? "junction" : "dir");

	mkdirSync(join(hub, ".bond"), { recursive: true });
	writeFileSync(join(hub, ".bond", "bond.toml"), "agents = []\n");
	writeFileSync(
		join(hub, "hub.toml"),
		`name = "hub"
base = "main"

[repos.front]
path = "front"
base = "main"
link = "submodule"

[repos.back]
path = "back"
base = "main"
link = "symlink"
`,
	);
	writeFileSync(join(hub, ".gitignore"), ".bond/hub.local.toml\nback\n");
	writeFileSync(join(hub, ".bond", "hub.local.toml"), `[repos.back]\nsource = ${JSON.stringify(backReal)}\n`);
	g(hub, "add", "-A");
	g(hub, "commit", "-qm", "hub setup");
});

afterEach(() => {
	rmSync(hubsPath(), { force: true });
	rmSync(tmp, { recursive: true, force: true });
});

describe("columna de estado en bond hub", () => {
	test("(a) repo limpio y al dia: punto verde sin flechas; el hub sin remoto tambien", () => {
		const r = bond(["hub"]);
		expect(r.status).toBe(0);
		for (const name of ["front", "back", "hub"]) {
			const row = rowOf(r.stdout, name);
			expect(row).toContain("·");
			expect(row).not.toContain("↑");
			expect(row).not.toContain("↓");
		}
		// Sin --fetch se dice contra que se habla (refs locales, ultimo fetch conocido).
		expect(r.stdout).toContain("último fetch");
		expect(r.stdout).toContain("bond hub --fetch");
	});

	test("(b) cambios sin commitear: se marcan con ·N", () => {
		writeFileSync(join(front, "sucia.txt"), "x\n");
		const row = rowOf(bond(["hub"]).stdout, "front");
		expect(row).toContain("·1");
	});

	test("(c) por delante de su remoto: N↑", () => {
		writeFileSync(join(front, "a.txt"), "a\n");
		g(front, "add", "a.txt");
		g(front, "commit", "-qm", "commit local");
		const row = rowOf(bond(["hub"]).stdout, "front");
		expect(row).toContain("1↑");
		expect(row).not.toContain("↓");
		// Limpio: el punto va sin numero.
		expect(row).not.toContain("·1");
	});

	test("(d) por detras de su remoto: N↓ (contra el ultimo fetch conocido)", () => {
		pushToOrigin(frontWorker, "remoto1.txt");
		g(front, "fetch", "-q"); // el ultimo fetch conocido ya trae el commit
		const row = rowOf(bond(["hub"]).stdout, "front");
		expect(row).toContain("1↓");
		expect(row).not.toContain("↑");
	});

	test("(e) divergido: N↑ y N↓ a la vez", () => {
		pushToOrigin(frontWorker, "remoto1.txt");
		g(front, "fetch", "-q");
		writeFileSync(join(front, "local.txt"), "l\n");
		g(front, "add", "local.txt");
		g(front, "commit", "-qm", "commit local");
		const row = rowOf(bond(["hub"]).stdout, "front");
		expect(row).toContain("1↑ 1↓");
	});

	test("(f) --fetch actualiza el dato: lo que no se veia sin red aparece tras el fetch", () => {
		pushToOrigin(frontWorker, "remoto1.txt");
		const stale = rowOf(bond(["hub"]).stdout, "front");
		expect(stale).not.toContain("↓"); // aun no hay fetch: la ref local no se ha movido
		const fresh = bond(["hub", "--fetch"]);
		expect(rowOf(fresh.stdout, "front")).toContain("1↓");
		expect(fresh.stdout).toContain("tras git fetch");
		expect(fresh.stdout).not.toContain("último fetch");
	});

	test("(g) sin --fetch no se hace ninguna llamada de red: la ref remota no se mueve", () => {
		pushToOrigin(frontWorker, "remoto1.txt");
		const before = g(front, "rev-parse", "refs/remotes/origin/main");
		bond(["hub"]);
		expect(g(front, "rev-parse", "refs/remotes/origin/main")).toBe(before);
		expect(JSON.parse(bond(["hub", "--json"]).stdout).repos.find((x: { path: string }) => x.path === "front").fetched).toBe(false);
		// Con --fetch la ref si se mueve.
		bond(["hub", "--fetch"]);
		expect(g(front, "rev-parse", "refs/remotes/origin/main")).not.toBe(before);
	});

	test("(h) repo enlazado por symlink: mismo estado, mismo formato", () => {
		writeFileSync(join(backReal, "sucia.txt"), "x\n");
		let row = rowOf(bond(["hub"]).stdout, "back");
		expect(row).toContain("·1");
		g(backReal, "add", "sucia.txt");
		g(backReal, "commit", "-qm", "commit local en el symlink");
		row = rowOf(bond(["hub"]).stdout, "back");
		expect(row).toContain("1↑");
		pushToOrigin(backWorker, "remoto1.txt");
		g(backReal, "fetch", "-q");
		row = rowOf(bond(["hub"]).stdout, "back");
		expect(row).toContain("1↑ 1↓");
	});

	test("(i) --json incluye dirty, ahead, behind, upstream y fetched", () => {
		pushToOrigin(frontWorker, "remoto1.txt");
		g(front, "fetch", "-q");
		writeFileSync(join(front, "local.txt"), "l\n");
		g(front, "add", "local.txt");
		g(front, "commit", "-qm", "commit local");
		writeFileSync(join(front, "sucia.txt"), "s\n");
		const j = JSON.parse(bond(["hub", "--json"]).stdout);
		expect(j.hub).toBe("hub");
		const f = j.repos.find((x: { path: string }) => x.path === "front");
		expect(f.repo).toBe("front");
		expect(f.dirty).toBe(1);
		expect(f.ahead).toBe(1);
		expect(f.behind).toBe(1);
		expect(f.upstream).toBe("origin/main");
		expect(f.fetched).toBe(false);
		// El hub, sin remoto: sin upstream ni ahead/behind, pero dirty si cuenta.
		const self = j.repos.find((x: { path: string }) => x.path === ".");
		expect(self.upstream).toBe(null);
		expect(self.ahead).toBe(null);
		expect(self.behind).toBe(null);
		expect(self.fetched).toBe(false);
	});

	test("(j) not present y detached HEAD siguen igual, con la columna expresandolo", () => {
		// HEAD separado (lo normal en un submódulo): la rama lo dice y el estado se calcula igual.
		g(front, "checkout", "-q", "--detach");
		writeFileSync(join(front, "sucia.txt"), "x\n");
		let row = rowOf(bond(["hub"]).stdout, "front");
		expect(row).toContain("(HEAD separado)");
		expect(row).toContain("·1");
		g(front, "checkout", "-q", "main");

		// No esta en disco: "(no está)" y guion en la columna de estado, sin parecer un olvido.
		rmSync(front, { recursive: true, force: true });
		rmSync(join(hub, ".git", "modules", "front"), { recursive: true, force: true });
		row = rowOf(bond(["hub"]).stdout, "front");
		expect(row).toContain("(no está)");
		expect(row.trimEnd().endsWith("-")).toBe(true);
		const j = JSON.parse(bond(["hub", "--json"]).stdout);
		const f = j.repos.find((x: { path: string }) => x.path === "front");
		expect(f.present).toBe(false);
		expect(f.dirty).toBe(null);
		expect(f.ahead).toBe(null);
		expect(f.behind).toBe(null);
		expect(f.fetched).toBe(false);
	});
});

describe("calcul compartido (cli/hub-status.mts)", () => {
	test("repoState da dirty, upstream, ahead y behind contra las refs locales", () => {
		writeFileSync(join(front, "sucia.txt"), "x\n");
		g(front, "add", "sucia.txt");
		g(front, "commit", "-qm", "commit local");
		pushToOrigin(frontWorker, "remoto1.txt");
		g(front, "fetch", "-q");
		const st = repoState(front, "main");
		expect(st.dirty).toBe(0);
		expect(st.upstream).toBe("origin/main");
		expect(st.ahead).toBe(1);
		expect(st.behind).toBe(1);
		expect(st.fetched).toBe(false);
		expect(st.fetchFailed).toBeUndefined();
	});

	test("repoState con fetch:true marca fetched y refresca el dato", () => {
		pushToOrigin(frontWorker, "remoto2.txt");
		expect(repoState(front, "main").behind).toBe(0); // sin fetch: ref local vieja
		const st = repoState(front, "main", { fetch: true });
		expect(st.fetched).toBe(true);
		expect(st.behind).toBe(1);
	});

	test("repo sin remoto: sin upstream, y pedir fetch no es un fallo", () => {
		const st = repoState(hub, "main", { fetch: true });
		expect(st.upstream).toBeUndefined();
		expect(st.fetched).toBe(false);
		expect(st.fetchFailed).toBeUndefined();
	});

	test("dirtyCount, upstreamOf y aheadBehind por separado", () => {
		expect(dirtyCount(front)).toBe(0);
		writeFileSync(join(front, "x.txt"), "x\n");
		expect(dirtyCount(front)).toBe(1);
		rmSync(join(front, "x.txt"));
		expect(upstreamOf(front, "main")).toBe("origin/main");
		expect(upstreamOf(hub, "main")).toBeUndefined();
		expect(aheadBehind(front, "main", "origin/main")).toEqual({ ahead: 0, behind: 0 });
	});
});
