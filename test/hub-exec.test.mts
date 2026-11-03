// bond hub exec (cli/hub-exec.mts): ejecutar un comando en el hub y en cada repo de la
// sesion, en orden, con confirmacion, --dry-run, --shell y exit code peor.
// Nunca toca el ~/.bond real: BOND_HOME temporal.

import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

setDefaultTimeout(30_000);

if (!process.env.BOND_HOME) {
	process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
}
Object.assign(process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" });
const { BOND_HOME } = await import("../cli/runtime.mts");
const { hubsPath, hubSession } = await import("../cli/hub.mts");
const { hubExecRun } = await import("../cli/hub-exec.mts");

const MAIN = join(import.meta.dir, "..", "cli", "main.mts");
let tmp: string;
let hub: string;
let alphaReal: string; // destino del symlink alpha
let beta: string; // submodulo

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

beforeEach(() => {
	rmSync(hubsPath(), { force: true });
	tmp = realpathSync(mkdtempSync(join(tmpdir(), "bond-hubexec-")));

	// Hub con un symlink (alpha), un submodulo (beta) y un repo declarado que no esta en disco.
	hub = repo("hub");
	mkdirSync(join(hub, ".bond"), { recursive: true });
	writeFileSync(join(hub, ".bond", "bond.toml"), "agents = []\n");
	expect(bond(["sync"], hub).status).toBe(0);
	g(hub, "add", "-A");
	g(hub, "commit", "-qm", "bond init");

	alphaReal = repo("alpha-real");
	const betaOrigin = repo("beta-origin");
	g(hub, "submodule", "add", "-q", betaOrigin, "repos/beta");
	beta = join(hub, "repos", "beta");
	symlinkSync(alphaReal, join(hub, "repos", "alpha"), process.platform === "win32" ? "junction" : "dir");
	writeFileSync(
		join(hub, "hub.toml"),
		`name = "hub"
base = "main"

[repos.alpha]
path = "repos/alpha"
base = "main"
link = "symlink"

[repos.beta]
path = "repos/beta"
base = "main"
link = "submodule"

[repos.missing]
path = "repos/missing"
base = "main"
link = "symlink"
`,
	);
	writeFileSync(join(hub, ".gitignore"), ".bond/hub.local.toml\n/repos/alpha\n");
	writeFileSync(join(hub, ".bond", "hub.local.toml"), `[repos.alpha]\nsource = ${JSON.stringify(alphaReal)}\n`);
	expect(bond(["sync"], hub).status).toBe(0);
	g(hub, "add", "-A");
	g(hub, "commit", "-qm", "hub setup");
});

afterEach(() => {
	rmSync(hubsPath(), { force: true });
	rmSync(tmp, { recursive: true, force: true });
});

describe("bond hub exec", () => {
	test("ayuda con --help y -h", () => {
		for (const h of ["--help", "-h"]) {
			const r = bond(["hub", "exec", h]);
			expect(r.status).toBe(0);
			expect(r.stdout).toContain("Uso: bond hub exec");
			expect(r.stdout).toContain("--dry-run");
			expect(r.stdout).toContain("--shell");
			expect(r.stdout).toContain("--json");
		}
	});

	test("(a) el comando corre en el hub y en cada repo presente, en orden, con cabecera por repo", () => {
		const r = bond(["hub", "exec", "--yes", "--", "node", "-e", "console.log('salida-en-' + require('fs').realpathSync('.'))"]);
		expect(r.status).toBe(0);
		const hubDir = realpathSync(hub);
		const alphaDir = realpathSync(alphaReal);
		const betaDir = realpathSync(beta);
		// Cabeceras por repo y su salida, en el orden de la sesion: hub, alpha, beta.
		// La cabecera muestra la ruta de trabajo (el symlink tal como vive en el hub), no el realpath.
		const iHub = r.stdout.indexOf(`── hub (${hubDir}) ──`);
		const iHubOut = r.stdout.indexOf(`salida-en-${hubDir}`);
		const iAlpha = r.stdout.indexOf(`── alpha (${join(hubDir, "repos", "alpha")}) ──`);
		const iAlphaOut = r.stdout.indexOf(`salida-en-${alphaDir}`);
		const iBeta = r.stdout.indexOf(`── beta (${betaDir}) ──`);
		const iBetaOut = r.stdout.indexOf(`salida-en-${betaDir}`);
		expect(iHub).toBeGreaterThanOrEqual(0);
		expect(iHubOut).toBeGreaterThan(iHub);
		expect(iAlpha).toBeGreaterThan(iHubOut);
		expect(iAlphaOut).toBeGreaterThan(iAlpha);
		expect(iBeta).toBeGreaterThan(iAlphaOut);
		expect(iBetaOut).toBeGreaterThan(iBeta);
	});

	test("(b) sin `--` falla con mensaje claro y no ejecuta nada", () => {
		const r = bond(["hub", "exec", "node", "-e", "require('fs').writeFileSync('EJECUTADO','x')"]);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("falta `--` antes del comando");
		expect(existsSync(join(hub, "EJECUTADO"))).toBe(false);
	});

	test("(b2) `--` sin comando falla con mensaje claro", () => {
		const r = bond(["hub", "exec", "--yes", "--"]);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("no hay nada después de `--`");
	});

	test("(b3) opcion desconocida antes del `--` falla", () => {
		const r = bond(["hub", "exec", "--noexiste", "--", "node", "-e", "0"]);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("opción desconocida: --noexiste");
	});

	test("(c)+(d) sigue tras un fallo y el exit code global es el peor (3 sobre 1)", () => {
		writeFileSync(join(hub, "code"), "3\n");
		writeFileSync(join(alphaReal, "code"), "1\n");
		const r = bond(["hub", "exec", "--yes", "--", "node", "-e", "const fs=require('fs');process.exit(fs.existsSync('code')?Number(fs.readFileSync('code','utf8')):0)"]);
		// Los tres repos corrieron (no se corto tras el 3 del hub) y el global es el maximo.
		expect(r.stdout).toContain("── hub");
		expect(r.stdout).toContain("── alpha");
		expect(r.stdout).toContain("── beta");
		expect(r.stdout).toContain("exit 3");
		expect(r.stdout).toContain("exit 1");
		expect(r.stdout).toContain("peor exit code 3");
		expect(r.status).toBe(3);
	});

	test("(e) --dry-run no ejecuta nada y muestra el de-a", () => {
		const r = bond(["hub", "exec", "--dry-run", "--", "node", "-e", "require('fs').writeFileSync('EJECUTADO','x')"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("[dry-run] hub");
		expect(r.stdout).toContain("node -e require('fs').writeFileSync('EJECUTADO','x')");
		expect(r.stdout).toContain("no se ha ejecutado nada");
		expect(existsSync(join(hub, "EJECUTADO"))).toBe(false);
	});

	test("(f) --yes no pregunta: corre con stdin cerrado (sin TTY)", () => {
		const r = bond(["hub", "exec", "--yes", "--", "node", "-e", "console.log('corrio')"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("corrio");
	});

	test("(f2) sin TTY y sin --yes no ejecuta nada y pide --yes con mensaje claro", () => {
		const r = bond(["hub", "exec", "--", "node", "-e", "require('fs').writeFileSync('EJECUTADO','x')"]);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("sin terminal para confirmar");
		expect(existsSync(join(hub, "EJECUTADO"))).toBe(false);
	});

	test("(g) cancelar la confirmacion no ejecuta nada y sale con 130", async () => {
		const s = hubSession(hub);
		expect(s).toBeDefined();
		const report = await hubExecRun(s!, ["node", "-e", "require('fs').writeFileSync('EJECUTADO','x')"], { confirm: async () => false });
		expect(report.cancelled).toBe(true);
		expect(report.confirmed).toBe(false);
		expect(report.exitCode).toBe(130);
		expect(report.repos).toHaveLength(0);
		expect(existsSync(join(hub, "EJECUTADO"))).toBe(false);
	});

	test("(g2) confirmacion aceptada ejecuta y queda confirmed", async () => {
		const s = hubSession(hub);
		const report = await hubExecRun(s!, ["node", "-e", "require('fs').writeFileSync('EJECUTADO','x')"], { confirm: async () => true });
		expect(report.cancelled).toBeUndefined();
		expect(report.confirmed).toBe(true);
		expect(report.exitCode).toBe(0);
		expect(existsSync(join(hub, "EJECUTADO"))).toBe(true);
		expect(existsSync(join(alphaReal, "EJECUTADO"))).toBe(true);
		expect(existsSync(join(beta, "EJECUTADO"))).toBe(true);
		rmSync(join(hub, "EJECUTADO"), { force: true });
		rmSync(join(alphaReal, "EJECUTADO"), { force: true });
		rmSync(join(beta, "EJECUTADO"), { force: true });
	});

	test("(h) --shell interpreta un pipe; en modo argv el pipe es un argumento literal", () => {
		const pipeCmd = `node -e "console.log('hola')" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log('recibido:'+s.trim()))"`;
		const withShell = bond(["hub", "exec", "--yes", "--shell", "--", pipeCmd]);
		expect(withShell.status).toBe(0);
		expect(withShell.stdout).toContain("recibido:hola");

		// Sin --shell el `|` y lo que le sigue son argumentos literales del primer comando.
		const argv = bond(["hub", "exec", "--yes", "--", "node", "-e", "console.log(JSON.stringify(process.argv.slice(1)))", "|", "node", "-e", "0"]);
		expect(argv.stdout).toContain('["|","node","-e","0"]');
		expect(argv.stdout).not.toContain("recibido:");
	});

	test("(i) --json con comando, cwd, exit code, stdout, stderr y confirmed", () => {
		const r = bond(["hub", "exec", "--yes", "--json", "--", "node", "-e", "console.log('marca')"]);
		expect(r.status).toBe(0);
		const data = JSON.parse(r.stdout);
		expect(data.hub).toBe("hub");
		expect(data.shell).toBe(false);
		expect(data.confirmed).toBe(true);
		expect(data.command).toEqual(["node", "-e", "console.log('marca')"]);
		expect(data.exitCode).toBe(0);
		const alpha = data.repos.find((x: { repo: string }) => x.repo === "alpha");
		expect(alpha.cwd).toBe(join(realpathSync(hub), "repos", "alpha"));
		expect(alpha.status).toBe("executed");
		expect(alpha.exitCode).toBe(0);
		expect(alpha.stdout).toContain("marca");
		expect("stderr" in alpha).toBe(true);
	});

	test("(j) el repo no presente se omite y se dice", () => {
		const r = bond(["hub", "exec", "--yes", "--", "node", "-e", "console.log('ok')"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("missing");
		expect(r.stdout).toContain("no presente: se omite");
		expect(r.stdout).toContain("1 omitido(s)");
		const j = JSON.parse(bond(["hub", "exec", "--yes", "--json", "--", "node", "-e", "0"]).stdout);
		const missing = j.repos.find((x: { repo: string }) => x.repo === "missing");
		expect(missing.status).toBe("skipped_not_present");
		expect(missing.exitCode).toBeUndefined();
	});

	test("(k) un comando que intenta leer stdin termina con EOF en vez de colgarse", () => {
		// `cat` sin argumentos lee stdin hasta EOF: con el stdin en /dev/null del hijo,
		// termina al instante. Si el mecanismo fallara, esto colgaria hasta el timeout.
		const r = bond(["hub", "exec", "--yes", "--", "node", "-e", "const s=require('fs').readFileSync(0,'utf8');console.log('eof:'+s.length)"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("eof:0");
	});

	test("un comando inexistente se reporta con 127 y no corta el resto del informe", () => {
		const r = bond(["hub", "exec", "--yes", "--json", "--", "bond-no-existe-46"]);
		expect(r.status).toBe(127);
		const data = JSON.parse(r.stdout);
		expect(data.exitCode).toBe(127);
		expect(data.repos.filter((x: { status: string }) => x.status === "executed")).toHaveLength(3);
	});
});
