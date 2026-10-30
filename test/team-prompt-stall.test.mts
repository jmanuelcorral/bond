// H4: el primer prompt a un agente recién arrancado puede perderse. Herdr responde
// `agent_prompt_stalled` (no observó actividad en la ventana) y el panel no muestra la tarea.
// bond debe reintentar UNA vez y, si vuelve a estancarse sin señales en el panel, fallar con
// un mensaje claro en lugar de solo avisar. Si el panel ya muestra la tarea, se da por
// entregada y no se reenvía. Se prueba en modo hub, que es donde el fallo solo avisaba.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
Object.assign(process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" });

const MAIN = join(import.meta.dir, "..", "cli", "main.mts");
const HUB_TOML = 'name = "hub"\nbase = "main"\n\n[repos.front]\npath = "front"\nbase = "main"\nlink = "submodule"\n';
const BOND_TOML = 'agents = ["pi"]\n\n[decisions]\ndir = "docs/decisions"\n';

/**
 * herdr simulado con la secuencia de stall controlable por entorno:
 *  - FAKE_STALL_TIMES: cuántas veces seguidas `agent prompt` responde stalled antes de ceder.
 *  - FAKE_PANE_SHOWS_TASK: si "1", `agent read` devuelve la última tarea del agente (el panel
 *    la muestra); si no, devuelve vacío (el panel no da señales).
 */
const FAKE_HERDR = `#!${process.execPath}
const fs = require("node:fs");
const file = process.env.FAKE_HERDR_STATE;
const st = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { n: 1, panes: [{ pane_id: "p0", tab_id: "t1", workspace_id: "w1", focused: true }], agents: [] };
const a = process.argv.slice(2);
const opt = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : undefined);
const out = (result) => process.stdout.write(JSON.stringify({ result }));
const prompts = () => (fs.existsSync(file + ".prompts") ? fs.readFileSync(file + ".prompts", "utf8").trim().split("\\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const [x, y] = a;
if (x === "status") process.stdout.write("server:\\n  status: running\\n");
else if (x === "pane" && y === "get") out({ pane: st.panes.find((p) => p.pane_id === a[2]) });
else if (x === "pane" && y === "list") out({ panes: st.panes });
else if (x === "pane" && y === "split") { const pane = { pane_id: "p" + st.n++, tab_id: "t1", workspace_id: "w1", cwd: opt("--cwd") }; st.panes.push(pane); out({ pane }); }
else if (x === "tab" && y === "create") { const pane = { pane_id: "p" + st.n++, tab_id: "t" + st.n++, workspace_id: "w1", cwd: opt("--cwd") }; st.panes.push(pane); out({ root_pane: pane }); }
else if (x === "pane" && y === "rename") { st.panes.find((p) => p.pane_id === a[2]).label = a[3]; out({}); }
else if (x === "pane" && y === "close") { st.panes = st.panes.filter((p) => p.pane_id !== a[2]); st.agents = st.agents.filter((g) => g.pane_id !== a[2]); out({}); }
else if (x === "agent" && y === "start" && a.includes("--help")) process.stdout.write("");
else if (x === "agent" && y === "start") { const pane = st.panes.find((p) => p.pane_id === opt("--pane")); st.agents.push({ name: a[2], agent: opt("--kind"), agent_status: "idle", cwd: pane.cwd, pane_id: pane.pane_id, workspace_id: "w1" }); out({}); }
else if (x === "agent" && y === "list") out({ agents: st.agents });
else if (x === "agent" && y === "get") out({ agent: st.agents.find((g) => g.name === a[2]) });
else if (x === "agent" && y === "read") {
	if (process.env.FAKE_PANE_SHOWS_TASK === "1" && a.includes("recent-unwrapped")) {
		const mine = prompts().filter((p) => p.name === a[2]);
		process.stdout.write(mine.length ? mine[mine.length - 1].task : "");
	} else process.stdout.write("");
} else if (x === "agent" && y === "prompt") {
	fs.appendFileSync(file + ".prompts", JSON.stringify({ name: a[2], task: a[3] }) + "\\n");
	const stallFile = file + ".stall." + a[2];
	const remaining = fs.existsSync(stallFile) ? Number(fs.readFileSync(stallFile, "utf8")) : Number(process.env.FAKE_STALL_TIMES ?? "0");
	if (remaining > 0) {
		fs.writeFileSync(stallFile, String(remaining - 1));
		process.stderr.write(JSON.stringify({ error: { code: "agent_prompt_stalled", message: "no observed working or blocked state within 5000 ms; current status is idle" }, id: "cli:agent:prompt" }) + "\\n");
		process.exit(1);
	}
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
const bond = (args: string[], extraEnv: Record<string, string> = {}) =>
	spawnSync(process.execPath, [MAIN, ...args], {
		cwd: hub,
		env: { ...process.env, HOME: home, USERPROFILE: home, PATH: `${bin}:${process.env.PATH}`, NO_COLOR: "1", BOND_NO_UPDATE: "1", HERDR_ENV: "1", HERDR_PANE_ID: "p0", FAKE_HERDR_STATE: state, ...extraEnv },
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
const promptCount = () => (existsSync(state + ".prompts") ? readFileSync(state + ".prompts", "utf8").trim().split("\n").filter(Boolean).length : 0);

beforeEach(() => {
	tmp = realpathSync(mkdtempSync(join(tmpdir(), "bond-stall-")));
	home = join(tmp, "home");
	bin = join(tmp, "bin");
	state = join(tmp, "herdr.json");
	mkdirSync(home);
	mkdirSync(bin);
	exe("herdr", FAKE_HERDR);
	exe("pi", "#!/bin/sh\n");
	repo("front");
	hub = repo("hub", { "hub.toml": HUB_TOML, ".bond/bond.toml": BOND_TOML });
	g(hub, "submodule", "add", "-q", "../front", "front");
	g(hub, "commit", "-qm", "subs");
	bond(["team", "fix/x"]); // abre el agente del submódulo en su worktree
});

afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe.skipIf(process.platform === "win32")("H4: reintento de prompt estancado en un hub", () => {
	test("un stall y reintento: el prompt llega a la segunda", () => {
		const r = bond(["team", "prompt", "fix/x", "añade el campo email", "--repo", "front"], { FAKE_STALL_TIMES: "1" });
		expect(r.status).toBe(0);
		expect(r.stderr).not.toContain("no llegó");
		// Uno estancado + uno entregado.
		expect(promptCount()).toBe(2);
	});

	test("stalls repetidos sin señales en el panel: falla con mensaje claro, no solo avisa", () => {
		const r = bond(["team", "prompt", "fix/x", "añade el campo email", "--repo", "front"], { FAKE_STALL_TIMES: "2" });
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("no llegó");
		expect(r.stderr).toContain("revisa");
	});

	test("stall pero el panel ya muestra la tarea: se da por entregado y no reenvía", () => {
		const r = bond(["team", "prompt", "fix/x", "añade el campo email", "--repo", "front"], { FAKE_STALL_TIMES: "1", FAKE_PANE_SHOWS_TASK: "1" });
		expect(r.status).toBe(0);
		expect(r.stderr).not.toContain("no llegó");
		// Solo el primer envío: no se reintentó porque el panel ya la mostraba.
		expect(promptCount()).toBe(1);
	});
});
