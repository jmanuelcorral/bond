// bond hub check (cli/hub-check.mts): revisión guiada de la sesión del hub y su --fix.
// Nunca toca el ~/.bond real: BOND_HOME temporal, como en test/hub.test.mts.

import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Montar el hub (git init, submódulo, symlink) y lanzar bond tarda varios segundos en Windows.
setDefaultTimeout(30_000);

if (!process.env.BOND_HOME) {
	process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
}
Object.assign(process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" });
const { BOND_HOME } = await import("../cli/runtime.mts");
const { hubSession, hubsPath, readHubsRegistry, registerHubRepo } = await import("../cli/hub.mts");
const { checkHubSession } = await import("../cli/hub-check.mts");
const { canonical } = await import("../cli/util.mts");

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
	spawnSync(process.execPath, [MAIN, ...args], { cwd, env: { ...process.env, BOND_HOME, NO_COLOR: "1", GIT_ALLOW_PROTOCOL: "file" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

// Repo preparado como si pasara por bond init: .bond/bond.toml, config sincronizada y commiteado.
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
	tmp = realpathSync(mkdtempSync(join(tmpdir(), "bond-hubcheck-")));
	const front = repo("front");
	backReal = repo("back-real");
	bondInit(front);
	bondInit(backReal);

	hub = repo("hub");
	g(hub, "submodule", "add", "-q", "../front", "front");
	// En Windows, junction: no necesita permisos de administrador ni modo desarrollador.
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
	// Los symlinks y el fichero local del hub van ignorados en git (D13).
	writeFileSync(join(hub, ".gitignore"), ".bond/hub.local.toml\nback\n");
	writeFileSync(join(hub, ".bond", "hub.local.toml"), `[repos.back]\nsource = ${JSON.stringify(backReal)}\n`);
	const s = bond(["sync"], hub);
	expect(s.status).toBe(0);
	g(hub, "add", "-A");
	g(hub, "commit", "-qm", "hub setup");
});

afterEach(() => {
	rmSync(hubsPath(), { force: true });
	rmSync(tmp, { recursive: true, force: true });
});

describe("hub sano", () => {
	test("check da todo en verde y sale con 0", () => {
		const r = bond(["hub", "check"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("hub hub");
		expect(r.stdout).toContain("listo para trabajar");

		const rep = checkHubSession(hubSession(hub)!);
		// Sin fallos; los repos en la raíz solo dan avisos de ruta.
		expect(rep.level).toBe("warn");
		expect(rep.failures).toBe(0);
		expect(rep.repos.map((x) => x.path)).toEqual([".", "back", "front"]);
		expect(rep.repos[0].level).toBe("ok");
		// Enlace reportado igual para submódulo que para symlink.
		const front = rep.repos.find((x) => x.path === "front")!;
		expect(front.checks.some((c) => c.check === "enlace" && c.level === "ok" && c.detail === "submódulo")).toBe(true);
		const back = rep.repos.find((x) => x.path === "back")!;
		expect(back.checks.some((c) => c.check === "enlace" && c.level === "ok")).toBe(true);
	});

	test("--json enseña el informe completo, sin las funciones de arreglo", () => {
		const r = bond(["hub", "check", "--json"]);
		expect(r.status).toBe(0);
		const rep = JSON.parse(r.stdout);
		expect(rep.hub).toBe("hub");
		expect(rep.level).toBe("warn");
		expect(rep.failures).toBe(0);
		expect(rep).not.toHaveProperty("ok");
		expect(rep).not.toHaveProperty("problems");
		expect(rep.repos).toHaveLength(3);
		expect(rep.repos[0].checks.some((c: { check: string; level: string }) => c.check === "base" && c.level === "ok")).toBe(true);
		expect(r.stdout).not.toContain("fixFn");
	});
});

describe("nivel de aviso (D17): repos fuera de repos/", () => {
	test("un hub con los repos en la raíz avisa por cada uno y sale con 0, en texto y en --json", () => {
		// El hub de prueba tiene front y back en la raíz (layout anterior a D16).
		const r = bond(["hub", "check"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("fuera de repos/");
		expect(r.stdout).toContain("2 aviso(s) que no impiden trabajar");

		const rep = checkHubSession(hubSession(hub)!);
		expect(rep.level).toBe("warn");
		expect(rep.failures).toBe(0);
		expect(rep.warnings).toBe(2);

		const j = JSON.parse(bond(["hub", "check", "--json"]).stdout) as {
			level: string;
			warnings: number;
			failures: number;
			repos: { path: string; level: string; checks: { check: string; level: string }[] }[];
		};
		expect(j.level).toBe("warn");
		expect(j.warnings).toBe(2);
		expect(j.failures).toBe(0);
		// Cada repo lleva el peor nivel de sus comprobaciones.
		expect(j.repos.find((x) => x.path === ".")!.level).toBe("ok");
		expect(j.repos.find((x) => x.path === "back")!.level).toBe("warn");
		const rutas = j.repos.flatMap((x) => x.checks).filter((c) => c.check === "ruta");
		expect(rutas).toHaveLength(2);
		expect(rutas.every((c) => c.level === "warn")).toBe(true);
	});

	test("un hub con los repos en repos/ no tiene avisos y doctor lo da al día", () => {
		const hub2 = repo("hub-en-repos");
		bondInit(hub2);
		mkdirSync(join(hub2, "repos"), { recursive: true });
		symlinkSync(backReal, join(hub2, "repos", "back"), process.platform === "win32" ? "junction" : "dir");
		writeFileSync(
			hub2 + "/hub.toml",
			`name = "hub-en-repos"
base = "main"

[repos.back]
path = ${JSON.stringify("repos/back")}
base = "main"
link = "symlink"
`,
		);
		writeFileSync(join(hub2, ".gitignore"), ".bond/hub.local.toml\n/repos/back\n");
		writeFileSync(join(hub2, ".bond", "hub.local.toml"), `[repos.back]\nsource = ${JSON.stringify(backReal)}\n`);
		expect(bond(["sync"], hub2).status).toBe(0);
		g(hub2, "add", "-A");
		g(hub2, "commit", "-qm", "hub con los repos en repos/");

		const r = bond(["hub", "check"], hub2);
		expect(r.status).toBe(0);
		expect(r.stdout).not.toContain("fuera de repos/");
		expect(r.stdout).toContain("back (repos/back)");
		expect(r.stdout).not.toContain("repos/back (repos/back)");
		expect(checkHubSession(hubSession(hub2)!).warnings).toBe(0);

		const j = JSON.parse(bond(["hub", "check", "--json"], hub2).stdout) as {
			repos: { repo: string; path: string }[];
		};
		const backRepo = j.repos.find((x) => x.path === "repos/back");
		expect(backRepo?.repo).toBe("back");
		expect(backRepo?.path).toBe("repos/back");

		const doc = bond(["doctor", "--quick"], hub2);
		expect(doc.stdout).toContain("hub hub-en-repos");
		expect(doc.stdout).toContain("al día");
	});

	test("avisa si la base está por detrás de su remoto tras un fetch, y deja de avisar al ponerse al día (D17/D19)", () => {
		// Creamos un upstream remoto para backReal clonándolo como bare
		const backUpstream = join(tmp, "back-upstream.git");
		g(tmp, "clone", "--bare", backReal, backUpstream);
		g(backReal, "remote", "add", "origin", backUpstream);
		g(backReal, "push", "-u", "origin", "main");

		// Clonamos para añadir un commit en el upstream remoto
		const worker = join(tmp, "worker");
		g(tmp, "clone", backUpstream, worker);
		writeFileSync(join(worker, "nuevo.txt"), "nuevo\n");
		g(worker, "add", "nuevo.txt");
		g(worker, "commit", "-qm", "nuevo en remoto");
		g(worker, "push", "origin", "main");

		// Antes del fetch en el clon local, check no avisa (según el último fetch está al día)
		const antesFetch = bond(["hub", "check"]);
		expect(antesFetch.stdout).not.toContain("base atrasada");

		// Fetch en el clon local: ahora va 1 por detrás de origin/main
		g(backReal, "fetch", "origin");

		const conAviso = bond(["hub", "check"]);
		expect(conAviso.status).toBe(0);
		expect(conAviso.stdout).toContain("base atrasada");
		expect(conAviso.stdout).toContain("1 commit(s) por detrás de origin/main");
		expect(conAviso.stdout).toContain("bond hub pull");

		const rep = checkHubSession(hubSession(hub)!);
		expect(rep.level).toBe("warn");
		expect(rep.warnings).toBe(3);
		const baseWarnings = rep.repos.flatMap((x) => x.checks).filter((c) => c.check === "base atrasada");
		expect(baseWarnings).toHaveLength(1);
		const backRep = rep.repos.find((x) => x.path === "back")!;
		expect(backRep.checks.some((c) => c.check === "base atrasada" && c.level === "warn")).toBe(true);

		// bond hub pull avanza la base
		const p = bond(["hub", "pull"]);
		expect(p.status).toBe(0);
		expect(p.stdout).toContain("avanzado 1 commit(s)");

		// Ahora check deja de avisar
		const trasPull = bond(["hub", "check"]);
		expect(trasPull.status).toBe(0);
		expect(trasPull.stdout).not.toContain("base atrasada");
		const repTras = checkHubSession(hubSession(hub)!);
		const backTras = repTras.repos.find((x) => x.path === "back")!;
		expect(backTras.checks.some((c) => c.check === "base atrasada")).toBe(false);
	});
});

describe("comprobaciones con la sesión rota", () => {
	test("symlink roto: nombra el repo, dice que falta el enlace y sale con 1", () => {
		rmSync(join(hub, "back"));
		const r = bond(["hub", "check"]);
		expect(r.status).toBe(1);
		expect(r.stdout).toContain("back");
		expect(r.stdout).toContain("falta el enlace");
		expect(r.stdout).toContain("1 problema");
	});

	test("base que no existe en un repo de la sesión", () => {
		writeFileSync(join(hub, "hub.toml"), readFileSync(join(hub, "hub.toml"), "utf8").replace('path = "back"\nbase = "main"', 'path = "back"\nbase = "no-existe"'));
		const r = bond(["hub", "check"]);
		expect(r.status).toBe(1);
		expect(r.stdout).toContain("no-existe");
		expect(r.stdout).toContain("base");
	});

	test("repo sin bond init: lo dice desde un repo enlazado registrado en ~/.bond/hubs.toml", () => {
		rmSync(join(backReal, ".bond", "bond.toml"));
		registerHubRepo(backReal, hub);
		const r = bond(["hub", "check"], backReal);
		expect(r.status).toBe(1);
		expect(r.stdout).toContain("bond init");
		expect(r.stdout).toContain("back");
	});

	test("agente no instalado: checkHubSession con hasAgent falso lo nombra", () => {
		writeFileSync(join(backReal, ".bond", "bond.toml"), 'agents = ["pi"]\ndefault_agent = "pi"\n');
		g(backReal, "add", "-A");
		g(backReal, "commit", "-qm", "agent pi");
		const rep = checkHubSession(hubSession(hub)!, { hasAgent: () => false });
		const back = rep.repos.find((x) => x.path === "back")!;
		const agentes = back.checks.find((c) => c.check === "agentes")!;
		expect(agentes.level).toBe("fail");
		expect(agentes.detail).toContain("pi");
		// Un fallo manda sobre los avisos, en el repo y en el informe.
		expect(back.level).toBe("fail");
		expect(rep.level).toBe("fail");
		// El total del informe es la suma de los fallos de cada repo.
		expect(rep.failures).toBe(rep.repos.flatMap((x) => x.checks).filter((c) => c.level === "fail").length);
		expect(rep.failures).toBeGreaterThan(0);
	});

	test("cambios sin commitear en un repo de la sesión", () => {
		writeFileSync(join(backReal, "sucia.txt"), "x\n");
		const r = bond(["hub", "check"]);
		expect(r.status).toBe(1);
		expect(r.stdout).toContain("back");
		expect(r.stdout).toContain("sin commitear");
	});

	test("rama vertical a medias: worktree en un repo sin rama en el hub", () => {
		g(join(hub, "front"), "worktree", "add", "-q", "-b", "fix/x", join(tmp, "wt-front-x"));
		const r = bond(["hub", "check"]);
		expect(r.status).toBe(1);
		expect(r.stdout).toContain("fix/x");
		expect(r.stdout).toContain("no existe en el hub");

		// Creada la rama en el hub, la sesión vuelve a estar sana.
		g(hub, "branch", "fix/x", "main");
		const ok2 = bond(["hub", "check"]);
		expect(ok2.status).toBe(0);
	});

	test("varias ramas verticales abiertas: más de una no cabe (D10)", () => {
		g(join(hub, "front"), "worktree", "add", "-q", "-b", "fix/x", join(tmp, "wt-front-x"));
		g(join(hub, "front"), "worktree", "add", "-q", "-b", "fix/y", join(tmp, "wt-front-y"));
		// Ambas existen en el hub: lo que sobra es que haya dos abiertas a la vez.
		g(hub, "branch", "fix/x", "main");
		g(hub, "branch", "fix/y", "main");
		const r = bond(["hub", "check"]);
		expect(r.status).toBe(1);
		expect(r.stdout).toContain("varias ramas verticales abiertas");
		expect(r.stdout).toContain("fix/x, fix/y");
	});
});

describe("--fix", () => {
	test("arregla el symlink que falta, lo registra en ~/.bond/hubs.toml y sale con 0", () => {
		rmSync(join(hub, "back"));
		const r = bond(["hub", "check", "--fix"]);
		expect(r.status).toBe(0);
		expect(readlinkSync(join(hub, "back"))).toBe(backReal);
		expect(r.stdout).toContain("enlazado");
		// D14: el clon y el enlace quedan anotados en el registro global.
		const reg = readHubsRegistry();
		expect(reg[canonical(backReal)]).toBe(canonical(hub));
		expect(reg[canonical(join(hub, "back"))]).toBe(canonical(hub));
	});

	test("arregla el submódulo sin inicializar", () => {
		g(hub, "submodule", "deinit", "-f", "front");
		const r = bond(["hub", "check", "--fix"]);
		expect(r.status).toBe(0);
		expect(existsSync(join(hub, "front", "README"))).toBe(true);
		expect(r.stdout).toContain("submódulo inicializado");
	});

	test("--dry-run no toca nada", () => {
		rmSync(join(hub, "back"));
		const r = bond(["hub", "check", "--fix", "--dry-run"]);
		expect(r.status).toBe(1);
		expect(existsSync(join(hub, "back"))).toBe(false);
		expect(r.stdout).toContain("[dry-run]");
	});

	test("bond hub check acepta --yes y -y para arreglar sin preguntar (H2)", () => {
		// Antes fallaba con "opción desconocida: --yes"; ahora se acepta (y -y) y aplica los seguros.
		for (const args of [["--fix", "--yes"], ["-y"]]) {
			const r = bond(["hub", "check", ...args]);
			expect(r.stdout + r.stderr).not.toContain("opción desconocida");
		}
	});

	test("--fix con --json: la stdout es solo el informe y los mensajes del arreglo van a stderr", () => {
		rmSync(join(hub, "back"));
		const r = bond(["hub", "check", "--fix", "--json"]);
		expect(r.status).toBe(0);
		const rep = JSON.parse(r.stdout);
		expect(rep.level).not.toBe("fail");
		expect(r.stdout).not.toContain("enlazado");
		expect(r.stderr).toContain("enlazado");
	});

	test("nunca descarta cambios ni cambia de rama: arregla el enlace y deja el repo sucio como estaba", () => {
		writeFileSync(join(backReal, "sucia.txt"), "x\n");
		rmSync(join(hub, "back"));
		const branchBefore = g(backReal, "rev-parse", "--abbrev-ref", "HEAD");
		const r = bond(["hub", "check", "--fix"]);
		// El enlace se crea; lo demás (cambios sin commitear) sigue siendo problema.
		expect(readlinkSync(join(hub, "back"))).toBe(backReal);
		expect(existsSync(join(backReal, "sucia.txt"))).toBe(true);
		expect(g(backReal, "rev-parse", "--abbrev-ref", "HEAD")).toBe(branchBefore);
		expect(r.status).toBe(1);
		expect(r.stdout).toContain("sin commitear");
	});
});

describe("bond doctor y el hub", () => {
	test("bond doctor fuera de un hub no añade la fila del hub", () => {
		const solo = repo("solo");
		const r = bond(["doctor", "--quick"], solo);
		expect(r.stdout).not.toContain("bond hub check");
	});

	test("bond doctor con un hub con avisos: fila de aviso, sin problema (D17)", () => {
		// El hub de prueba tiene los repos en la raíz: la fila refleja los avisos sin pasar a fallo.
		const r = bond(["doctor", "--quick"], hub);
		expect(r.stdout).toContain("hub hub");
		expect(r.stdout).toContain("2 aviso(s):");
		expect(r.stdout).not.toContain("problema(s)");
	});

	test("bond doctor con el hub roto ofrece bond hub check", () => {
		rmSync(join(hub, "back"));
		const r = bond(["doctor", "--quick"], hub);
		expect(r.stdout).toContain("hub hub");
		expect(r.stdout).toContain("bond hub check");
	});

	test("bond doctor con hub.toml inválido lo reporta como fallo con el error de parseo", () => {
		writeFileSync(join(hub, "hub.toml"), "esto no es TOML válido [[[");
		const r = bond(["doctor", "--quick"], hub);
		expect(r.stdout).toContain("hub.toml inválido");
		expect(r.stdout).toContain("corrige hub.toml");
	});
});
