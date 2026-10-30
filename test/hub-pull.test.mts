// bond hub pull (cli/hub-pull.mts): actualización en fast-forward de la sesión del hub.
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
const { hubSession, hubsPath } = await import("../cli/hub.mts");
const { pullHubSession } = await import("../cli/hub-pull.mts");

const MAIN = join(import.meta.dir, "..", "cli", "main.mts");
let tmp: string;
let hub: string;
let hubRemote: string;
let subReal: string;
let subRemote: string;

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
	const s = bond(["sync"], dir);
	expect(s.status).toBe(0);
	g(dir, "add", "-A");
	g(dir, "commit", "-qm", "bond init");
};

beforeEach(() => {
	rmSync(hubsPath(), { force: true });
	tmp = realpathSync(mkdtempSync(join(tmpdir(), "bond-hubpull-")));

	// Repo de origen para el submódulo/enlace
	subReal = repo("sub-real");
	bondInit(subReal);

	// Remoto bare para subReal
	subRemote = join(tmp, "sub-remote.git");
	g(tmp, "clone", "--bare", subReal, subRemote);
	g(subReal, "remote", "add", "origin", subRemote);
	g(subReal, "push", "-u", "origin", "main");

	// Hub
	hub = repo("hub");
	bondInit(hub);
	mkdirSync(join(hub, "repos"), { recursive: true });
	symlinkSync(subReal, join(hub, "repos", "sub"), process.platform === "win32" ? "junction" : "dir");

	writeFileSync(
		join(hub, "hub.toml"),
		`name = "hub"
base = "main"

[repos.sub]
path = ${JSON.stringify("repos/sub")}
base = "main"
link = "symlink"
`,
	);
	writeFileSync(join(hub, ".gitignore"), ".bond/hub.local.toml\n/repos/sub\n");
	writeFileSync(join(hub, ".bond", "hub.local.toml"), `[repos.sub]\nsource = ${JSON.stringify(subReal)}\n`);
	// Con hub.toml ya escrito, bond sync genera el bloque del hub en AGENTS.md (D18).
	expect(bond(["sync"], hub).status).toBe(0);
	g(hub, "add", "-A");
	g(hub, "commit", "-qm", "hub setup");

	// Remoto bare para el hub
	hubRemote = join(tmp, "hub-remote.git");
	g(tmp, "clone", "--bare", hub, hubRemote);
	g(hub, "remote", "add", "origin", hubRemote);
	g(hub, "push", "-u", "origin", "main");
});

afterEach(() => {
	rmSync(hubsPath(), { force: true });
	rmSync(tmp, { recursive: true, force: true });
});

describe("bond hub pull", () => {
	test("ayuda con --help y -h", () => {
		const r = bond(["hub", "pull", "--help"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("Uso: bond hub pull");
		expect(r.stdout).toContain("--dry-run");
		expect(r.stdout).toContain("--json");
	});

	test("fuera de un hub falla con mensaje claro", () => {
		const solo = repo("solo");
		const r = bond(["hub", "pull"], solo);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("no es un hub");
	});

	test("opción desconocida falla con mensaje claro", () => {
		const r = bond(["hub", "pull", "--inexistente"]);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("opción desconocida: --inexistente");
	});

	test("con remoto por delante, fetch y fast-forward ponen al día la base", () => {
		// Avanzamos el remoto de subReal
		const worker = join(tmp, "worker-sub");
		g(tmp, "clone", subRemote, worker);
		writeFileSync(join(worker, "file2.txt"), "nuevo\n");
		g(worker, "add", "file2.txt");
		g(worker, "commit", "-qm", "nuevo en subRemote");
		g(worker, "push", "origin", "main");
		const subRemoteSha = g(worker, "rev-parse", "HEAD");

		// Avanzamos también el remoto del hub
		const workerHub = join(tmp, "worker-hub");
		g(tmp, "clone", hubRemote, workerHub);
		writeFileSync(join(workerHub, "hubfile.txt"), "nuevo hub\n");
		g(workerHub, "add", "hubfile.txt");
		g(workerHub, "commit", "-qm", "nuevo en hubRemote");
		g(workerHub, "push", "origin", "main");
		const hubRemoteSha = g(workerHub, "rev-parse", "HEAD");

		// pull ejecuta el fetch y avance
		const r = bond(["hub", "pull"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("hub (.)  avanzado 1 commit(s)");
		expect(r.stdout).toContain("sub (repos/sub)  avanzado 1 commit(s)");
		expect(r.stdout).toContain("2 actualizado(s)");

		// Verificamos que ambos repos tienen el commit
		expect(g(hub, "rev-parse", "HEAD")).toBe(hubRemoteSha);
		expect(g(subReal, "rev-parse", "HEAD")).toBe(subRemoteSha);

		// Repetir pull ahora reporta que están al día
		const r2 = bond(["hub", "pull"]);
		expect(r2.status).toBe(0);
		expect(r2.stdout).toContain("al día");
		expect(r2.stdout).toContain("2 al día");
	});

	test("--dry-run no toca nada y muestra qué avanzaría", () => {
		// Avanzamos el remoto de subReal
		const worker = join(tmp, "worker-sub");
		g(tmp, "clone", subRemote, worker);
		writeFileSync(join(worker, "file2.txt"), "nuevo\n");
		g(worker, "add", "file2.txt");
		g(worker, "commit", "-qm", "nuevo en subRemote");
		g(worker, "push", "origin", "main");

		const subShaAntes = g(subReal, "rev-parse", "HEAD");
		const subBaseAntes = g(subReal, "rev-parse", "refs/heads/main");

		// Hacemos fetch manual en subReal para que su tracking ref sepa del commit (dry-run no hace fetch)
		g(subReal, "fetch", "origin");
		const subTrackingTrasFetch = g(subReal, "rev-parse", "refs/remotes/origin/main");

		// Avanzamos además el remoto del hub sin hacer fetch en el hub
		const workerHub = join(tmp, "worker-hub-dry");
		g(tmp, "clone", hubRemote, workerHub);
		writeFileSync(join(workerHub, "hubfile2.txt"), "hub\n");
		g(workerHub, "add", "hubfile2.txt");
		g(workerHub, "commit", "-qm", "nuevo en hubRemote");
		g(workerHub, "push", "origin", "main");
		const hubTrackingAntes = g(hub, "rev-parse", "refs/remotes/origin/main");

		const r = bond(["hub", "pull", "--dry-run"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("sub (repos/sub)  avanzaría 1 commit(s)");
		expect(r.stdout).toContain("[dry-run]");

		// Verificamos que HEAD, la rama local y las tracking refs (origin/main) permanecen idénticas (no hubo fetch en dry-run)
		expect(g(subReal, "rev-parse", "HEAD")).toBe(subShaAntes);
		expect(g(subReal, "rev-parse", "refs/heads/main")).toBe(subBaseAntes);
		expect(g(subReal, "rev-parse", "refs/remotes/origin/main")).toBe(subTrackingTrasFetch);
		expect(g(hub, "rev-parse", "refs/remotes/origin/main")).toBe(hubTrackingAntes);
	});

	test("--json devuelve el resultado estructurado por repo", () => {
		const r = bond(["hub", "pull", "--json"]);
		expect(r.status).toBe(0);
		const data = JSON.parse(r.stdout);
		expect(data.hub).toBe("hub");
		expect(data.ok).toBe(true);
		expect(data.repos).toHaveLength(2);
		expect(data.repos[0].repo).toBe("hub");
		expect(data.repos[0].path).toBe(".");
		expect(data.repos[0].status).toBe("up_to_date");
		expect(data.repos[1].repo).toBe("sub");
		expect(data.repos[1].path).toBe("repos/sub");
		expect(data.repos[1].status).toBe("up_to_date");
	});

	test("submódulo con HEAD separado por detrás de su remoto: pull actualiza la base, HEAD no se mueve y check deja de avisar (1)", () => {
		// Desconectamos HEAD en subReal (estado normal de un submódulo)
		const headBefore = g(subReal, "rev-parse", "HEAD");
		g(subReal, "checkout", headBefore);
		expect(spawnSync("git", ["-C", subReal, "symbolic-ref", "-q", "HEAD"]).status).not.toBe(0);

		// Avanzamos el remoto de subReal con un nuevo commit
		const worker = join(tmp, "worker-sub-detached");
		g(tmp, "clone", subRemote, worker);
		writeFileSync(join(worker, "file-sub.txt"), "nuevo en remoto\n");
		g(worker, "add", "file-sub.txt");
		g(worker, "commit", "-qm", "nuevo en subRemote");
		g(worker, "push", "origin", "main");
		const remoteSha = g(worker, "rev-parse", "HEAD");

		// Hacemos fetch en subReal para que check detecte base atrasada
		g(subReal, "fetch", "origin");

		// check avisa de base atrasada
		const chk1 = bond(["hub", "check"]);
		expect(chk1.status).toBe(0);
		expect(chk1.stdout).toContain("base atrasada");

		// bond hub pull actualiza la base ref sin tocar HEAD
		const p = bond(["hub", "pull"]);
		expect(p.status).toBe(0);
		expect(p.stdout).toContain("sub (repos/sub)  avanzado 1 commit(s)");

		// La rama base main se actualizó al commit remoto
		expect(g(subReal, "rev-parse", "refs/heads/main")).toBe(remoteSha);
		// HEAD sigue separado en el commit anterior
		expect(g(subReal, "rev-parse", "HEAD")).toBe(headBefore);

		// check ya no avisa de base atrasada
		const chk2 = bond(["hub", "check"]);
		expect(chk2.status).toBe(0);
		expect(chk2.stdout).not.toContain("base atrasada");
	});

	test("salta repos con cambios sin commitear en su base y explica el motivo sin fallar", () => {
		writeFileSync(join(subReal, "cambio-sucio.txt"), "sucio\n");

		const r = bond(["hub", "pull"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("sub (repos/sub)  saltado: 1 cambio(s) sin commitear");
		expect(r.stdout).toContain("1 saltado(s)");
	});

	test("salta si la base tiene checkout en otro worktree y explica el motivo sin fallar", () => {
		// Creamos un segundo worktree de subReal en otra carpeta con la rama main
		const wtDir = join(tmp, "wt-main");
		// Pasamos subReal a otra rama para que wtDir pueda hacer checkout de main
		g(subReal, "checkout", "-b", "rama-secundaria");
		g(subReal, "worktree", "add", wtDir, "main");

		// Avanzamos el remoto de subReal
		const worker = join(tmp, "worker-sub-wt");
		g(tmp, "clone", subRemote, worker);
		writeFileSync(join(worker, "file-wt.txt"), "nuevo\n");
		g(worker, "add", "file-wt.txt");
		g(worker, "commit", "-qm", "nuevo en subRemote");
		g(worker, "push", "origin", "main");

		const r = bond(["hub", "pull"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("sub (repos/sub)  saltado: la base \"main\" tiene checkout en otro worktree");
		expect(r.stdout).toContain("1 saltado(s)");
	});

	test("salta repos con base divergida y nunca hace merge ni rebase", () => {
		// Commit en subReal local
		writeFileSync(join(subReal, "local.txt"), "local\n");
		g(subReal, "add", "local.txt");
		g(subReal, "commit", "-qm", "commit local");

		// Commit en remoto
		const worker = join(tmp, "worker-sub");
		g(tmp, "clone", subRemote, worker);
		writeFileSync(join(worker, "remote.txt"), "remote\n");
		g(worker, "add", "remote.txt");
		g(worker, "commit", "-qm", "commit remoto");
		g(worker, "push", "origin", "main");

		const localShaAntes = g(subReal, "rev-parse", "HEAD");

		const r = bond(["hub", "pull"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("sub (repos/sub)  saltado: la base ha divergido de origin/main");
		expect(r.stdout).toContain("1 saltado(s)");

		// No hubo merge commit ni cambio de SHA
		expect(g(subReal, "rev-parse", "HEAD")).toBe(localShaAntes);
	});

	test("salta repos sin remoto configurado sin fallar", () => {
		g(subReal, "remote", "remove", "origin");

		const r = bond(["hub", "pull"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("sub (repos/sub)  saltado: sin remoto configurado");
		expect(r.stdout).toContain("1 saltado(s)");
	});

	test("salta repos cuya base no tiene upstream configurado sin fallar", () => {
		g(subReal, "config", "--unset", "branch.main.remote");
		g(subReal, "config", "--unset", "branch.main.merge");

		const r = bond(["hub", "pull"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain('sub (repos/sub)  saltado: la base "main" no tiene upstream configurado');
		expect(r.stdout).toContain("1 saltado(s)");
	});
});
