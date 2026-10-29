// bond team en un hub (cli/team.mts): una rama vertical, un agente por submódulo. Cada prueba
// monta un hub de fixture con dos submódulos (front y back) en un directorio temporal y lanza
// bond con un herdr simulado en el PATH: un script que guarda los paneles, los agentes y los
// prompts en un JSON y responde como Herdr. HOME también es temporal (los worktrees van en
// ~/.herdr/worktrees/<hub>/<sub>/<rama>).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
Object.assign(process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" });
const { pickRepos, tabWorktreePath, verticalNote } = await import("../cli/team.mts");
const { catchDie } = await import("../cli/util.mts");

const MAIN = join(import.meta.dir, "..", "cli", "main.mts");
const HUB_TOML = 'agents = ["pi"]\n\n[decisions]\ndir = "docs/decisions"\n\n[hub]\nbase = "main"\n\n[hub.repos]\n"back" = { base = "main" }\n"front" = { base = "main" }\n';

/** herdr simulado: lo justo de cada orden que usa bond team, con su estado en $FAKE_HERDR_STATE. */
const FAKE_HERDR = `#!${process.execPath}
const fs = require("node:fs");
const file = process.env.FAKE_HERDR_STATE;
const st = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { n: 1, panes: [{ pane_id: "p0", tab_id: "t1", workspace_id: "w1", focused: true }], agents: [], calls: [] };
const a = process.argv.slice(2);
st.calls.push(a);
const opt = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : undefined);
const out = (result) => process.stdout.write(JSON.stringify({ result }));
const [x, y] = a;
if (x === "status") process.stdout.write("server:\\n  status: running\\n");
else if (x === "pane" && y === "get") out({ pane: st.panes.find((p) => p.pane_id === a[2]) });
else if (x === "pane" && y === "list") out({ panes: st.panes });
else if (x === "pane" && y === "split") {
	const pane = { pane_id: "p" + st.n++, tab_id: "t1", workspace_id: "w1", cwd: opt("--cwd") };
	st.panes.push(pane);
	out({ pane });
} else if (x === "tab" && y === "create") {
	const pane = { pane_id: "p" + st.n++, tab_id: "t" + st.n++, workspace_id: "w1", cwd: opt("--cwd") };
	st.panes.push(pane);
	out({ root_pane: pane });
} else if (x === "pane" && y === "rename") {
	st.panes.find((p) => p.pane_id === a[2]).label = a[3];
	out({});
} else if (x === "pane" && y === "close") {
	st.panes = st.panes.filter((p) => p.pane_id !== a[2]);
	st.agents = st.agents.filter((g) => g.pane_id !== a[2]);
	out({});
} else if (x === "agent" && y === "start" && a.includes("--help")) process.stdout.write("");
else if (x === "agent" && y === "start") {
	const pane = st.panes.find((p) => p.pane_id === opt("--pane"));
	st.agents.push({ name: a[2], agent: opt("--kind"), agent_status: "idle", cwd: pane.cwd, pane_id: pane.pane_id, workspace_id: "w1" });
	out({});
} else if (x === "agent" && y === "list") out({ agents: st.agents });
else if (x === "agent" && y === "get") out({ agent: st.agents.find((g) => g.name === a[2]) });
else if (x === "agent" && y === "read") process.stdout.write(a.includes("recent-unwrapped") ? "informe de " + a[2] + "\\n" : "");
else if (x === "agent" && y === "prompt") {
	// bond los manda a la vez: cada uno en su línea, sin reescribir el estado.
	fs.appendFileSync(file + ".prompts", JSON.stringify({ name: a[2], task: a[3] }) + "\\n");
	out({ agent: { agent_status: "idle" } });
	process.exit(0);
} else if (x === "pane" && y === "process-info") out({ process_info: { foreground_processes: [] } });
else if (x === "worktree" && y === "list") out({ worktrees: [] });
else out({});
fs.writeFileSync(file, JSON.stringify(st));
`;

let tmp: string;
let hub: string;
let home: string;
let bin: string;
let state: string;

const g = (cwd: string, ...args: string[]) => {
	const r = spawnSync("git", ["-c", "protocol.file.allow=always", "-C", cwd, ...args], { encoding: "utf8" });
	if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
	return r.stdout.trim();
};
const repo = (name: string, files: Record<string, string> = {}) => {
	const dir = join(tmp, name);
	mkdirSync(dir);
	g(dir, "init", "-q", "-b", "main");
	for (const [f, text] of Object.entries({ README: `${name}\n`, ...files })) {
		mkdirSync(join(dir, f, ".."), { recursive: true });
		writeFileSync(join(dir, f), text);
	}
	g(dir, "add", ".");
	g(dir, "commit", "-qm", "init");
	return dir;
};
const exe = (name: string, text: string) => {
	writeFileSync(join(bin, name), text);
	chmodSync(join(bin, name), 0o755);
};
const bond = (args: string[], cwd = hub) =>
	spawnSync(process.execPath, [MAIN, ...args], {
		cwd,
		env: { ...process.env, HOME: home, USERPROFILE: home, PATH: `${bin}:${process.env.PATH}`, NO_COLOR: "1", BOND_NO_UPDATE: "1", HERDR_ENV: "1", HERDR_PANE_ID: "p0", FAKE_HERDR_STATE: state },
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
const herdrState = () => ({
	...(JSON.parse(readFileSync(state, "utf8")) as { agents: Array<{ name: string; agent: string; cwd: string }>; panes: Array<{ pane_id: string; label?: string }> }),
	prompts: existsSync(`${state}.prompts`) ? readFileSync(`${state}.prompts`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { name: string; task: string }) : [],
});
const worktrees = (dir: string) => g(dir, "worktree", "list", "--porcelain").split("\n").filter((l) => l.startsWith("worktree ")).length;
const branches = (dir: string) => g(dir, "branch", "--format=%(refname:short)").split("\n").sort();

beforeEach(() => {
	tmp = realpathSync(mkdtempSync(join(tmpdir(), "bond-team-hub-")));
	home = join(tmp, "home");
	bin = join(tmp, "bin");
	state = join(tmp, "herdr.json");
	mkdirSync(home);
	mkdirSync(bin);
	exe("herdr", FAKE_HERDR);
	exe("pi", "#!/bin/sh\n");
	exe("claude", "#!/bin/sh\n");
	// front tiene su propio bond.toml, con claude por defecto; back no tiene.
	repo("front", { ".bond/bond.toml": 'agents = ["claude"]\n' });
	repo("back");
	hub = repo("hub", { ".bond/bond.toml": HUB_TOML });
	g(hub, "submodule", "add", "-q", "../front", "front");
	g(hub, "submodule", "add", "-q", "../back", "back");
	g(hub, "commit", "-qm", "subs");
});

afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe.skipIf(process.platform === "win32")("bond team en un hub", () => {
	test("abre un agente por submódulo, cada uno con el suyo, y crea la rama en el hub sin worktree", () => {
		const r = bond(["team", "fix/x"]);
		expect(r.stderr).not.toContain("error");
		expect(r.status).toBe(0);
		// En el hub, solo la rama (D7).
		expect(branches(hub)).toEqual(["fix/x", "main"]);
		expect(worktrees(hub)).toBe(1);
		// Un worktree y un agente por submódulo, en ~/.herdr/worktrees/<hub>/<sub>/<rama> (D9).
		const st = herdrState();
		expect(st.agents.map((a) => [a.agent, a.cwd]).sort()).toEqual([
			["claude", tabWorktreePath(home, "hub", "fix/x", "front")],
			["pi", tabWorktreePath(home, "hub", "fix/x", "back")],
		].sort());
		for (const sub of ["front", "back"]) {
			expect(worktrees(join(hub, sub))).toBe(2);
			expect(g(tabWorktreePath(home, "hub", "fix/x", sub), "branch", "--show-current")).toBe("fix/x");
		}
		// Una sola tabla, la del hub.
		expect(st.panes.filter((p) => p.label?.startsWith("tabla · ")).map((p) => p.label)).toEqual(["tabla · hub"]);
		// Repetirlo no abre nada nuevo.
		expect(bond(["team", "fix/x"]).status).toBe(0);
		expect(herdrState().agents.length).toBe(2);
	});

	test("--repos abre solo esos; una segunda rama vertical se niega sin crear nada (D10)", () => {
		expect(bond(["team", "fix/x", "--repos", "back"]).status).toBe(0);
		expect(herdrState().agents.map((a) => a.cwd)).toEqual([tabWorktreePath(home, "hub", "fix/x", "back")]);
		const before = JSON.stringify(herdrState().agents);
		const r = bond(["team", "fix/y"]);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("ya tiene abierta la rama vertical fix/x");
		expect(r.stderr).toContain("bond team clean fix/x");
		expect(branches(hub)).toEqual(["fix/x", "main"]);
		expect(branches(join(hub, "front"))).toEqual(["main"]);
		expect(JSON.stringify(herdrState().agents)).toBe(before);
		// Varias ramas a la vez, tampoco.
		expect(bond(["team", "fix/a", "fix/b"]).stderr).toContain("una sola rama vertical");
	});

	test("prompt llega a los dos con la nota que nombra al otro; los runs van al hub", () => {
		bond(["team", "fix/x"]);
		const r = bond(["team", "prompt", "fix/x", "añade el campo email"]);
		expect(r.status).toBe(0);
		const st = herdrState();
		expect(st.prompts.length).toBe(2);
		const byCwd = (sub: string) => st.agents.find((a) => a.cwd === tabWorktreePath(home, "hub", "fix/x", sub))!.name;
		const [front, back] = [byCwd("front"), byCwd("back")];
		const to = (name: string) => st.prompts.find((p) => p.name === name)!.task;
		expect(to(front)).toStartWith("añade el campo email");
		expect(to(front)).toContain("Trabajas en front");
		expect(to(front)).toContain(`${back} en back`);
		expect(to(back)).toContain(`${front} en front`);
		// Los runs, en la memoria del hub (D5), no en los submódulos.
		const runs = readdirSync(join(hub, "docs", "decisions", "runs"));
		expect(runs.length).toBe(2);
		expect(existsSync(join(hub, "front", "docs"))).toBe(false);
		// --repo: solo a uno.
		expect(bond(["team", "prompt", "fix/x", "otra", "--repo", "back"]).status).toBe(0);
		expect(herdrState().prompts.slice(2).map((p) => p.name)).toEqual([back]);
	});

	test("collect pide --repo si la rama está en varios y guarda el informe en el hub", () => {
		bond(["team", "fix/x"]);
		bond(["team", "prompt", "fix/x", "tarea"]);
		const amb = bond(["team", "collect", "fix/x"]);
		expect(amb.status).toBe(1);
		expect(amb.stderr).toContain("--repo");
		// Un commit en el worktree de back: el run lo cuenta (está en el submódulo, no en el hub).
		const wt = tabWorktreePath(home, "hub", "fix/x", "back");
		writeFileSync(join(wt, "b.txt"), "b\n");
		g(wt, "add", "b.txt");
		g(wt, "commit", "-qm", "b");
		const r = bond(["team", "collect", "fix/x", "--repo", "back"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("1 commit(s) de fix/x");
		const dir = join(hub, "docs", "decisions", "runs");
		const back = herdrState().agents.find((a) => a.cwd === wt)!.name;
		const file = readdirSync(dir).find((f) => f.includes(back))!;
		const text = readFileSync(join(dir, file), "utf8");
		expect(text).toContain('status: "reported"');
		expect(text).toContain(`informe de ${back}`);
		expect(text).toMatch(/commits:\n {2}- "[0-9a-f]+ b"/);
	});

	test("clean fix/x deja el hub y los submódulos como estaban, con las ramas", () => {
		bond(["team", "fix/x"]);
		const r = bond(["team", "clean", "fix/x"]);
		expect(r.status).toBe(0);
		for (const dir of [hub, join(hub, "front"), join(hub, "back")]) expect(worktrees(dir)).toBe(1);
		expect(branches(hub)).toEqual(["fix/x", "main"]);
		expect(branches(join(hub, "front"))).toEqual(["fix/x", "main"]);
		expect(existsSync(join(home, ".herdr", "worktrees", "hub"))).toBe(false);
		expect(herdrState().agents).toEqual([]);
		// Sin agentes, la tabla se cierra; y ya se puede abrir otra rama vertical.
		expect(herdrState().panes.some((p) => p.label === "tabla · hub")).toBe(false);
		expect(bond(["team", "fix/y", "--repos", "front"]).status).toBe(0);
	});

	test("dentro de un submódulo, bond team abre solo ese repo, como siempre", () => {
		const r = bond(["team", "feat/a", "-a", "pi"], join(hub, "front"));
		expect(r.status).toBe(0);
		expect(branches(hub)).toEqual(["main"]);
		expect(herdrState().agents.map((a) => a.cwd)).toEqual([tabWorktreePath(home, "front", "feat/a")]);
	});

	test("--repos y --repo fuera de un hub, no", () => {
		expect(bond(["team", "feat/a", "--repos", "x"], join(hub, "front")).stderr).toContain("solo va en un hub");
		expect(bond(["team", "clean", "--repo", "x"], join(hub, "front")).stderr).toContain("solo va en un hub");
	});
});

describe("piezas del modo hub", () => {
	const repos = [
		{ path: "front", dir: "/h/front", base: "main", present: true },
		{ path: "front/libs/lib", dir: "/h/front/libs/lib", base: "main", present: true },
		{ path: "libs/lib", dir: "/h/libs/lib", base: "main", present: true },
	];

	test("worktrees de un hub en <hub>/<sub>/<rama>; fuera de un hub, como siempre", () => {
		expect(tabWorktreePath("/h", "hub", "fix/x", "front/libs/lib")).toBe(join("/h", ".herdr", "worktrees", "hub", "front-libs-lib", "fix-x"));
		expect(tabWorktreePath("/h", "fluzo", "fix/x")).toBe(join("/h", ".herdr", "worktrees", "fluzo", "fix-x"));
	});

	test("pickRepos: por ruta o por nombre si no se repite", () => {
		expect(pickRepos(repos, undefined, "--repos")).toBe(repos);
		expect(pickRepos(repos, ["front", "libs/lib/"], "--repos").map((r) => r.path)).toEqual(["front", "libs/lib"]);
		expect(catchDie(() => pickRepos(repos, ["lib"], "--repo")).error).toContain("hay varios");
		expect(catchDie(() => pickRepos(repos, ["nope"], "--repo")).error).toContain("no es un repo de la sesión");
	});

	test("la nota de coordinación nombra a los demás con su repo", () => {
		const team = [
			{ name: "kevin", repo: "front", path: "/w/front" },
			{ name: "stuart", repo: "back", path: "/w/back" },
		];
		const note = verticalNote("hub", "fix/x", { name: "kevin", repo: "front" }, team);
		expect(note).toContain("Trabajas en front, en la rama fix/x del hub hub");
		expect(note).toContain("stuart en back (/w/back)");
		expect(note).not.toContain("kevin en");
		expect(verticalNote("hub", "fix/x", { name: "kevin", repo: "front" }, team.slice(0, 1))).toContain("único agente");
	});
});
