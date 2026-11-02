// Pruebas de bond hub init, bond hub add y bond hub sync (P6 de 2026-10-30-hub-guided)

import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

// hub init monta submódulos, enlaces y hace bond init en cada repo: en Windows tarda varios segundos.
setDefaultTimeout(30_000);

// BOND_HOME incondicional a carpeta temporal para no tocar nunca el real del entorno
process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));

Object.assign(process.env, {
	GIT_AUTHOR_NAME: "t",
	GIT_AUTHOR_EMAIL: "t@t",
	GIT_COMMITTER_NAME: "t",
	GIT_COMMITTER_EMAIL: "t@t",
});

const { BOND_HOME } = await import("../cli/runtime.mts");
const { hubRoot, hubSession, hubsPath, parseHubToml, parseHubLocalToml } = await import("../cli/hub.mts");
const { isLink, isBrokenLink, linkRepo, localCloneError, renderHubToml, renderHubLocalToml, defaultRepoPath, repoKeyError, repoNameFromUrl, repoSourceError } = await import("../cli/hub-init.mts");
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
		// D16: los repos nuevos entran en repos/<nombre> por defecto.
		expect(frontEntry?.path).toBe(`repos/${basename(frontReal)}`);

		const backEntry = Object.values(hubToml.repos).find((r) => r.link === "symlink");
		expect(backEntry).toBeDefined();
		expect(backEntry?.base).toBe("main");
		expect(backEntry?.path).toBe(`repos/${basename(backReal)}`);

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

	test("bond hub init deja un commit inicial y memoria de decisiones; hub check pasa (H1, H5)", () => {
		const hubDir = join(tmp, "h1-hub");
		bond(["hub", "init", hubDir, `file://${frontReal}`, backReal], tmp);
		// H1: el hub queda con al menos un commit, así que la base existe para `bond hub check`.
		expect(spawnSync("git", ["-C", hubDir, "rev-parse", "--verify", "--quiet", "HEAD"], { encoding: "utf8" }).status).toBe(0);
		// H5: el bond.toml del hub trae la skill decision-record y la sección [decisions].
		const bondToml = readFileSync(join(hubDir, ".bond", "bond.toml"), "utf8");
		expect(bondToml).toContain("decision-record");
		expect(bondToml).toContain("[decisions]");
		// El hub tiene su propio bond init: las skills por defecto y plan-team, ya generadas.
		expect(bondToml).toContain("plan-team");
		expect(existsSync(join(hubDir, ".agents", "skills", "plan-team", "SKILL.md"))).toBe(true);
		// H1: `bond hub check` ya no reporta que falte la base en ninguno de los repos.
		const chk = JSON.parse(bond(["hub", "check", "--json"], hubDir).stdout) as { repos: Array<{ checks: Array<{ check: string; level: string }> }> };
		const baseFail = chk.repos.flatMap((r) => r.checks).filter((c) => c.check === "base" && c.level === "fail");
		expect(baseFail).toEqual([]);
	});

	test("bond hub init hace bond init en los repos sin bond y commitea su config si estaban limpios", () => {
		const hubDir = join(tmp, "init-hub");
		// back-real con un cambio sin commitear: su config se queda sin commitear y se avisa.
		writeFileSync(join(backReal, "dirty.txt"), "x\n");
		const res = bond(["hub", "init", hubDir, "--yes", `file://${frontReal}`, backReal], tmp);
		expect(res.status).toBe(0);
		const front = join(hubDir, "repos", basename(frontReal));
		expect(existsSync(join(front, ".bond", "bond.toml"))).toBe(true);
		expect(g(front, "log", "-1", "--format=%s")).toBe("chore: add bond config");
		expect(g(front, "status", "--porcelain")).toBe("");
		// El hub apunta al commit con la config del submódulo.
		expect(g(hubDir, "ls-tree", "HEAD", `repos/${basename(frontReal)}`)).toContain(g(front, "rev-parse", "HEAD"));
		expect(existsSync(join(backReal, ".bond", "bond.toml"))).toBe(true);
		expect(g(backReal, "log", "-1", "--format=%s")).toBe("init");
		expect(res.stderr).toContain("sin commitear");
		// Sin el bloque de pasos siguientes de bond init: el hub ya lo hace.
		expect(res.stdout).not.toContain("Siguiente:");
	});

	test("bond hub sync hace el bond init del hub si le falta", () => {
		const hubDir = join(tmp, "noinit-hub");
		bond(["hub", "init", hubDir, "--yes", backReal], tmp);
		rmSync(join(hubDir, ".bond", "bond.toml"));
		expect(bond(["hub", "check"], hubDir).stdout).toContain("bond hub sync");
		bond(["hub", "sync", "--yes"], hubDir);
		expect(readFileSync(join(hubDir, ".bond", "bond.toml"), "utf8")).toContain("plan-team");
	});

	test("bond hub init respeta la config de un repo que ya tiene bond", () => {
		const hubDir = join(tmp, "own-hub");
		mkdirSync(join(backReal, ".bond"));
		writeFileSync(join(backReal, ".bond", "bond.toml"), 'agents = ["claude"]\n');
		g(backReal, "add", "-A");
		g(backReal, "commit", "-qm", "own bond");
		bond(["hub", "init", hubDir, "--yes", backReal], tmp);
		expect(readFileSync(join(backReal, ".bond", "bond.toml"), "utf8")).toBe('agents = ["claude"]\n');
		expect(g(backReal, "log", "-1", "--format=%s")).toBe("own bond");
	});

	test("bond hub init --dry-run muestra qué haría, llega al resumen y no crea nada (B1)", () => {
		const hubDir = join(tmp, "dry-hub");
		const res = bond(["hub", "init", hubDir, "--dry-run", `file://${frontReal}`, backReal], tmp);
		expect(res.status).toBe(0);
		expect(res.stdout).toContain("[dry-run]");
		expect(res.stdout).toMatch(/hub dry-hub listo/);
		expect(existsSync(join(hubDir, "hub.toml"))).toBe(false);
		expect(existsSync(join(hubDir, ".git"))).toBe(false);
		expect(existsSync(join(hubDir, ".bond"))).toBe(false);
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

describe("selector del clon local", () => {
	test("solo acepta una carpeta que existe y es un repo git", () => {
		const hubDir = join(tmp, "sel-hub");
		mkdirSync(hubDir);
		const plain = join(tmp, "no-git");
		mkdirSync(plain);
		expect(localCloneError("", hubDir)).toContain("indica");
		expect(localCloneError(join(tmp, "no-existe"), hubDir)).toContain("no existe");
		expect(localCloneError(plain, hubDir)).toContain("no es un repo git");
		expect(localCloneError(backReal, hubDir)).toBeUndefined();
		// Relativa al hub, como la escribiría el usuario.
		expect(localCloneError(join("..", basename(backReal)), hubDir)).toBeUndefined();
	});
});

describe("bond hub add", () => {
	test("defaultRepoPath: la ruta que propone el asistente y usan init/add por defecto (D16)", () => {
		// El asistente la pasa como initialValue editable de «Ruta dentro del hub» y
		// init/add la aplican sin preguntar; --path y los submódulos existentes la cambian.
		expect(defaultRepoPath("front")).toBe("repos/front");
		expect(defaultRepoPath("mi-api")).toBe("repos/mi-api");
	});

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
		// D16: ruta por defecto repos/<nombre> para submódulo y symlink.
		expect(s?.repos.some((r) => r.path === "repos/front" && r.link === "submodule")).toBe(true);
		expect(s?.repos.some((r) => r.path === "repos/back" && r.link === "symlink")).toBe(true);

		// .gitignore contiene la ruta del symlink bajo repos/
		const gitignore = readFileSync(join(hubDir, ".gitignore"), "utf8");
		expect(gitignore).toContain("/repos/back");
	});

	test("bond hub add --path manda sobre la ruta por defecto (D16)", () => {
		const hubDir = repo("hub-add-path");
		expect(bond(["hub", "init", "--yes"], hubDir).status).toBe(0);

		const addCustom = bond(["hub", "add", `file://${frontReal}`, "--name", "front", "--path", "apps/front"], hubDir);
		expect(addCustom.status).toBe(0);
		const s = hubSession(hubDir);
		expect(s?.repos.some((r) => r.path === "apps/front" && r.link === "submodule")).toBe(true);
		expect(s?.repos.some((r) => r.path === "repos/front")).toBe(false);
	});

	test("bond hub add falla si repos.<name> ya existe con otra configuración o la ruta está duplicada (S2)", () => {
		const hubDir = repo("hub-add-dup");
		bond(["hub", "init", "--yes"], hubDir);
		const res1 = bond(["hub", "add", `file://${frontReal}`, "--name", "front"], hubDir);
		expect(res1.status).toBe(0);

		// Mismo nombre pero distinta URL -> error
		const resDup = bond(["hub", "add", `file://${backReal}`, "--name", "front"], hubDir);
		expect(resDup.status).not.toBe(0);
		expect(resDup.stderr).toContain("ya existe en hub.toml con otra configuración");

		// Distinto nombre pero misma ruta -> error (la ruta por defecto de front es repos/front, D16)
		const resPathDup = bond(["hub", "add", `file://${backReal}`, "--name", "other", "--path", "repos/front"], hubDir);
		expect(resPathDup.status).not.toBe(0);
		expect(resPathDup.stderr).toContain("ya está usada por repos.front");
	});
});

describe("bond hub sync", () => {
	test("clonar el hub en otra carpeta y pasar bond hub sync monta el submódulo; para symlink sin ruta local, con --yes falla diciendo cómo darla", () => {
		const hubDir = join(tmp, "original-hub");
		mkdirSync(hubDir, { recursive: true });

		const frontUrl = `file://${frontReal}`;
		bond(["hub", "init", "--yes", frontUrl, backReal], hubDir);
		// bond hub init ya deja el hub con su commit inicial (H1); el add+commit extra de
		// antes ya no hace falta y daría 'nada que commitear'. Se tolera por si acaso.
		g(hubDir, "add", "-A");
		spawnSync("git", ["-C", hubDir, "commit", "-qm", "commit hub config"], { encoding: "utf8" });
		// hub init commiteó la config de bond en el submódulo (solo local): se publica en su origen,
		// como haría el usuario con git push antes de subir el hub, para que el clon la encuentre.
		g(frontReal, "fetch", "-q", join(hubDir, "repos", basename(frontReal)), "main:bond-config");

		// Clonar el hub en otra carpeta (no lleva .bond/hub.local.toml porque está en .gitignore)
		const clonedHub = join(tmp, "cloned-hub");
		g(tmp, "clone", "-q", hubDir, "cloned-hub");

		// Con --yes, falla diciendo cómo dar la ruta local del symlink
		const syncFail = bond(["hub", "sync", "--yes"], clonedHub);
		expect(syncFail.status).not.toBe(0);
		expect(syncFail.stderr).toContain("falta la ruta local para");
		expect(syncFail.stderr).toContain("hub.local.toml");

		// Pero el submódulo sí se montó
		const clonedToml = parseHubToml(readFileSync(join(clonedHub, "hub.toml"), "utf8"));
		const frontKey = Object.keys(clonedToml.repos).find((k) => clonedToml.repos[k].link === "submodule")!;
		expect(existsSync(join(clonedHub, clonedToml.repos[frontKey].path, ".git"))).toBe(true);

		// Al indicarle la ruta local en .bond/hub.local.toml, sync tiene éxito y monta el symlink
		const backKey = Object.keys(clonedToml.repos).find((k) => clonedToml.repos[k].link === "symlink")!;
		mkdirSync(join(clonedHub, ".bond"), { recursive: true });
		writeFileSync(join(clonedHub, ".bond", "hub.local.toml"), `[repos.${backKey}]\nsource = ${JSON.stringify(backReal)}\n`);

		const syncSuccess = bond(["hub", "sync", "--yes"], clonedHub);
		expect(syncSuccess.status).toBe(0);
		expect(existsSync(join(clonedHub, clonedToml.repos[backKey].path))).toBe(true);
		expect(lstatSync(join(clonedHub, clonedToml.repos[backKey].path)).isSymbolicLink()).toBe(true);
	});

	test("sync --dry-run dice qué haría y no toca nada; nunca borra un repo ni un clon existente", () => {
		const hubDir = repo("hub-dry-test");
		const toml = `name = "hub-dry-test"
base = "main"

[repos.front]
path = "front"
base = "main"
link = "submodule"
url  = ${JSON.stringify(`file://${frontReal}`)}

[repos.back]
path = "back"
base = "main"
link = "symlink"
`;
		writeFileSync(join(hubDir, "hub.toml"), toml);
		mkdirSync(join(hubDir, ".bond"), { recursive: true });
		writeFileSync(join(hubDir, ".bond", "hub.local.toml"), `[repos.back]\nsource = ${JSON.stringify(backReal)}\n`);

		const dryRes = bond(["hub", "sync", "--dry-run"], hubDir);
		expect(dryRes.status).toBe(0);
		expect(dryRes.stdout).toContain("[dry-run]");

		// No creó front ni back
		expect(existsSync(join(hubDir, "front"))).toBe(false);
		expect(existsSync(join(hubDir, "back"))).toBe(false);
	});
	describe("el bloque del hub en AGENTS.md (D18)", () => {
		const agents = (dir: string) => readFileSync(join(dir, "AGENTS.md"), "utf8");
		const check = (dir: string) => bond(["sync", "--check"], dir);
		const frontUrl = () => `file://${frontReal}`;

		test("bond hub init --yes deja el bloque al dia: tabla, reglas y punteros a plans y decisiones", () => {
			const hubDir = repo("block-init");
			bond(["hub", "init", "--yes", frontUrl(), backReal], hubDir);
			const text = agents(hubDir);
			expect(text).toContain("<!-- >>> bond:hub >>>");
			expect(text).toContain("| REPO | RUTA | BASE | ENLACE | AGENTE | DESCRIPCIÓN |");
			expect(text).toContain("*(el hub)*");
			expect(text).toContain("`repos/" + basename(backReal) + "`");
			expect(text).toContain("No edites los repos enlazados");
			expect(text).toContain("bond team");
			expect(text).toContain("docs/plans/");
			expect(text).toContain("docs/decisions/");
			expect(check(hubDir).status).toBe(0);
		});

		test("bond hub add --description lo escribe en hub.toml y actualiza el bloque", () => {
			const hubDir = repo("block-add");
			bond(["hub", "init", "--yes", frontUrl()], hubDir);
			const add = bond(["hub", "add", backReal, "--description", "el backend de la API"], hubDir);
			expect(add.status).toBe(0);
			expect(readFileSync(join(hubDir, "hub.toml"), "utf8")).toContain('description = "el backend de la API"');
			expect(agents(hubDir)).toContain("el backend de la API");
			expect(check(hubDir).status).toBe(0);
		});

		test("cambiar la descripcion en hub.toml: --check falla (bloque obsoleto), sync lo actualiza y conserva lo escrito a mano", () => {
			const hubDir = repo("block-edit");
			bond(["hub", "init", "--yes", frontUrl(), backReal], hubDir);
			// Anadimos texto a mano delante del bloque (fuera de el) y cambiamos solo la descripcion
			// de repos.front-real: --check tiene que fallar por bloque obsoleto, no por otra cosa.
			writeFileSync(join(hubDir, "AGENTS.md"), "# Mis notas del hub\n\n" + readFileSync(join(hubDir, "AGENTS.md"), "utf8"));
			const tomlPath = join(hubDir, "hub.toml");
			const before = readFileSync(tomlPath, "utf8");
			expect(before).toContain("[repos.front-real]");
			writeFileSync(tomlPath, before.replace("[repos.front-real]\n", '[repos.front-real]\ndescription = "el frontend rico"\n'));
			const drift = check(hubDir);
			expect(drift.status).toBe(1);
			expect(drift.stdout + drift.stderr).toContain("AGENTS.md");
			expect(bond(["sync"], hubDir).status).toBe(0);
			expect(check(hubDir).status).toBe(0);
			const text = agents(hubDir);
			expect(text.startsWith("# Mis notas del hub")).toBe(true);
			expect(text).toContain("el frontend rico");
			// La clave del repo no se renombro: solo cambia la linea de descripcion.
			expect(readFileSync(tomlPath, "utf8")).toContain("[repos.front-real]");
			// Idempotencia: otra pasada no vuelve a tocar nada.
			expect(agents(hubDir)).toBe(text);
			expect(check(hubDir).status).toBe(0);
		});

		test("repetir bond hub add sin --description es no-op: conserva descripcion, agente y base", () => {
			const hubDir = repo("add-idem");
			bond(["hub", "init", "--yes", frontUrl()], hubDir);
			bond(["hub", "add", backReal, "--base", "develop", "--agent", "pi", "--description", "el backend"], hubDir);
			const tomlPath = join(hubDir, "hub.toml");
			const before = readFileSync(tomlPath, "utf8");
			expect(before).toMatch(/base\s+= "develop"/);
			expect(before).toMatch(/agent\s+= "pi"/);
			expect(before).toContain('description = "el backend"');
			const again = bond(["hub", "add", backReal], hubDir);
			expect(again.status).toBe(0);
			expect(again.stdout).toContain("ya existe");
			// Ni la descripcion, ni el agente, ni la base (que se recalcularia con la rama actual del clon).
			expect(readFileSync(tomlPath, "utf8")).toBe(before);
			expect(check(hubDir).status).toBe(0);
		});

		test("bond hub add --description sobre repo existente solo cambia la descripcion", () => {
			const hubDir = repo("add-desc");
			bond(["hub", "init", "--yes", frontUrl()], hubDir);
			bond(["hub", "add", backReal, "--base", "develop", "--agent", "pi", "--description", "el backend viejo"], hubDir);
			const tomlPath = join(hubDir, "hub.toml");
			const r = bond(["hub", "add", backReal, "--description", "el backend nuevo"], hubDir);
			expect(r.status).toBe(0);
			const toml = readFileSync(tomlPath, "utf8");
			expect(toml).toContain('description = "el backend nuevo"');
			expect(toml).not.toContain("viejo");
			expect(toml).toMatch(/base\s+= "develop"/);
			expect(toml).toMatch(/agent\s+= "pi"/);
			// Y el bloque del AGENTS.md se refresca con la descripcion nueva.
			expect(agents(hubDir)).toContain("el backend nuevo");
			expect(agents(hubDir)).not.toContain("viejo");
			expect(check(hubDir).status).toBe(0);
		});

		test("con hub.toml invalido, el bloque existente en AGENTS.md se conserva intacto (no se vacia)", () => {
			const hubDir = repo("block-invalid");
			bond(["hub", "init", "--yes", frontUrl(), backReal], hubDir);
			const before = agents(hubDir);
			expect(before).toContain("<!-- >>> bond:hub >>>");
			writeFileSync(join(hubDir, "hub.toml"), "esto no es TOML =\n");
			const r = bond(["sync"], hubDir);
			expect(r.status).toBe(0);
			expect(r.stdout + r.stderr).toContain("no se actualiza");
			expect(agents(hubDir)).toBe(before);
			expect(check(hubDir).status).toBe(0);
		});

		test("el bloque del hub no pisa otros bloques de bond en el mismo fichero", () => {
			const hubDir = repo("block-coexist");
			bond(["hub", "init", "--yes", frontUrl(), backReal], hubDir);
			writeFileSync(join(hubDir, "AGENTS.md"), "# Mio\n\n<!-- >>> bond >>> nota propia\nsigue intacto\n<!-- <<< bond <<< -->\n");
			expect(bond(["sync"], hubDir).status).toBe(0);
			const text = agents(hubDir);
			expect(text).toContain("sigue intacto");
			expect(text).toContain("<!-- >>> bond:hub >>>");
			expect(check(hubDir).status).toBe(0);
		});

		test("quitar la descripcion de hub.toml se detecta y el bloque vuelve a su hueco", () => {
			const hubDir = repo("block-rm");
			bond(["hub", "init", "--yes", frontUrl()], hubDir);
			bond(["hub", "add", backReal, "--description", "temporal"], hubDir);
			const tomlPath = join(hubDir, "hub.toml");
			writeFileSync(tomlPath, readFileSync(tomlPath, "utf8").replace(/^description = .*\n/m, ""));
			expect(check(hubDir).status).toBe(1);
			expect(bond(["sync"], hubDir).status).toBe(0);
			expect(agents(hubDir)).not.toContain("temporal");
			expect(check(hubDir).status).toBe(0);
		});
	});

	test("en Windows, si el symlink falla, crea una junction y lo dice (S3)", () => {
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

		// isLink reconoce el destino
		expect(isLink(dest) || junctionCreated).toBe(true);
	});
});

describe("una sola ruta en bond hub init (issue #40)", () => {
	test("fuera de un repo, una sola ruta es el HUB: avisa antes de crear nada y dice como importar", () => {
		const outside = join(tmp, "outside-40");
		mkdirSync(outside);
		const res = bond(["hub", "init", "../" + basename(backReal), "--yes"], outside);
		expect(res.status).toBe(0);
		// El comportamiento se mantiene (la ruta es el hub) pero deja de ser silencioso.
		expect(res.stderr).toContain("una sola ruta");
		expect(res.stderr).toContain(`bond hub init . ../${basename(backReal)}`);
		expect(existsSync(join(backReal, "hub.toml"))).toBe(true);
	});

	test("bond hub init . <ruta> importa la ruta en el hub del directorio actual, sin aviso", () => {
		const hubDir = join(tmp, "explicit-hub");
		mkdirSync(hubDir);
		const res = bond(["hub", "init", ".", "--yes", "../" + basename(backReal)], hubDir);
		expect(res.status).toBe(0);
		expect(res.stderr).not.toContain("una sola ruta");
		const toml = parseHubToml(readFileSync(join(hubDir, "hub.toml"), "utf8"));
		expect(toml.repos[basename(backReal)]?.link).toBe("symlink");
		expect(toml.repos[basename(backReal)]?.path).toBe(`repos/${basename(backReal)}`);
	});

	test("bond hub init --repo <ruta> importa sin ambiguedad desde una carpeta que no es un repo", () => {
		const hubDir = join(tmp, "flag-hub");
		mkdirSync(hubDir);
		const res = bond(["hub", "init", "--yes", "--repo", "../" + basename(backReal)], hubDir);
		expect(res.status).toBe(0);
		expect(res.stderr).not.toContain("una sola ruta");
		const toml = parseHubToml(readFileSync(join(hubDir, "hub.toml"), "utf8"));
		expect(toml.repos[basename(backReal)]?.link).toBe("symlink");
	});

	test("la ayuda de bond hub init dice que con una sola ruta esa ruta es el hub", () => {
		const h = bond(["hub", "init", "--help"], tmp);
		expect(h.status).toBe(0);
		expect(h.stdout).toContain("esa ruta es el HUB");
		expect(h.stdout).toContain("bond hub init --repo <ruta>");
	});
});

describe("origenes y nombres vacios o malformados (issue #35)", () => {
	test("bond hub init con un origen vacio falla y no escribe nada en disco", () => {
		const hubDir = join(tmp, "empty-src");
		mkdirSync(hubDir);
		const res = bond(["hub", "init", ".", "--yes", "file://", backReal], hubDir);
		expect(res.status).not.toBe(0);
		expect(res.stderr).toContain("no nombra ningún repositorio");
		// Nada en disco: ni hub.toml, ni .bond, ni repo git, ni AGENTS.md.
		expect(existsSync(join(hubDir, "hub.toml"))).toBe(false);
		expect(existsSync(join(hubDir, ".bond"))).toBe(false);
		expect(existsSync(join(hubDir, ".git"))).toBe(false);
		expect(existsSync(join(hubDir, "AGENTS.md"))).toBe(false);
	});

	test("bond hub init rechaza antes de escribir cada origen o nombre vacio o malformado", () => {
		const hubDir = join(tmp, "bad-src");
		mkdirSync(hubDir);
		const plain = join(tmp, "plain-dir");
		mkdirSync(plain);
		const cases: [string[], string][] = [
			[["hub", "init", ".", "--yes", ""], "origen vacío"],
			[["hub", "init", ".", "--yes", "--repo", "   "], "origen vacío"],
			[["hub", "init", ".", "--yes", "https://github.com"], "no nombra ningún repositorio"],
			[["hub", "init", ".", "--yes", join(tmp, "no-existe")], "no existe"],
			[["hub", "init", ".", "--yes", plain], "no es un repo git"],
			[["hub", "init", ".", "--yes", "--name", ""], "nombre del hub"],
			[["hub", "init", ".", "--yes", "--base", ""], "rama base del hub"],
		];
		for (const [args, msg] of cases) {
			const res = bond(args, hubDir);
			expect(res.status, args.join(" ")).not.toBe(0);
			expect(res.stderr, args.join(" ")).toContain(msg);
			expect(existsSync(join(hubDir, "hub.toml")), args.join(" ")).toBe(false);
			expect(existsSync(join(hubDir, ".bond")), args.join(" ")).toBe(false);
		}
	});

	test("bond hub add rechaza origen vacio y clave invalida sin tocar hub.toml", () => {
		const hubDir = repo("add-validate");
		expect(bond(["hub", "init", "--yes"], hubDir).status).toBe(0);
		const tomlBefore = readFileSync(join(hubDir, "hub.toml"), "utf8");
		const cases: [string[], string][] = [
			[["hub", "add", ""], "necesita una URL o ruta local"],
			[["hub", "add", "file://"], "no nombra ningún repositorio"],
			[["hub", "add", join(tmp, "no-existe")], "no existe"],
			[["hub", "add", backReal, "--name", ""], "nombre del repo en hub.toml no puede estar vacío"],
			[["hub", "add", backReal, "--name", "mi.repo"], "no vale como nombre de repo"],
		];
		for (const [args, msg] of cases) {
			const res = bond(args, hubDir);
			expect(res.status, args.join(" ")).not.toBe(0);
			expect(res.stderr, args.join(" ")).toContain(msg);
			expect(readFileSync(join(hubDir, "hub.toml"), "utf8")).toBe(tomlBefore);
		}
	});

	test("repoNameFromUrl: el nombre que nombra una URL; vacio si la URL no llega a nombrar ninguno", () => {
		expect(repoNameFromUrl("git@github.com:fluzo/front.git")).toBe("front");
		expect(repoNameFromUrl("https://github.com/fluzo/front")).toBe("front");
		expect(repoNameFromUrl("file:///tmp/x/back-real")).toBe("back-real");
		// Windows: ruta absoluta con contrabarras, con y sin barra extra tras el esquema.
		expect(repoNameFromUrl("file://C:\\Users\\runner\\back-real")).toBe("back-real");
		expect(repoNameFromUrl("file:///C:/Users/runner/back-real")).toBe("back-real");
		expect(repoNameFromUrl("file://localhost/C$/repos/front")).toBe("front");
		expect(repoNameFromUrl("ssh://git@host/path/repo")).toBe("repo");
		expect(repoNameFromUrl("file://")).toBe("");
		expect(repoNameFromUrl("file:///")).toBe("");
		expect(repoNameFromUrl("https://github.com")).toBe("");
		expect(repoNameFromUrl("git@github.com:")).toBe("");
	});

	test("repoKeyError: una clave vacia o con puntos y barras no vale en hub.toml", () => {
		expect(repoKeyError("front")).toBeUndefined();
		expect(repoKeyError("mi_api-2")).toBeUndefined();
		expect(repoKeyError("  ")).toContain("vacío");
		expect(repoKeyError("mi.repo")).toContain("no vale");
		expect(repoKeyError("a/b")).toContain("no vale");
	});

	test("repoSourceError: cada origen dice por que no vale, y un origen bueno no dice nada", () => {
		expect(repoSourceError(backReal)).toBeUndefined();
		expect(repoSourceError(`file://${backReal}`)).toBeUndefined();
		expect(repoSourceError("")).toContain("vacío");
		expect(repoSourceError("file://")).toContain("no nombra ningún repositorio");
		expect(repoSourceError(join(tmp, "no-existe"))).toContain("no existe");
	});
});

describe("ayuda de subcomandos de bond hub (S4)", () => {
	test("bond hub init|add|sync --help enseñan su ayuda específica y no la genérica", () => {
		const cwd = tmp;

		const hInit = bond(["hub", "init", "--help"], cwd);
		expect(hInit.status).toBe(0);
		expect(hInit.stdout).toContain("Uso: bond hub init");
		expect(hInit.stdout).toContain("--dir");

		const hAdd = bond(["hub", "add", "--help"], cwd);
		expect(hAdd.status).toBe(0);
		expect(hAdd.stdout).toContain("Uso: bond hub add");

		const hSync = bond(["hub", "sync", "--help"], cwd);
		expect(hSync.status).toBe(0);
		expect(hSync.stdout).toContain("Uso: bond hub sync");

		const hGeneral = bond(["hub", "--help"], cwd);
		expect(hGeneral.status).toBe(0);
		expect(hGeneral.stdout).toContain("Uso: bond hub [subcomando]");
	});
});
