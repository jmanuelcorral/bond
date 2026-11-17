import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { catchDie } from "../cli/util.mts";
import { hc, hcAgentStatus } from "../cli/hc.mts";
import { t } from "../cli/messages.mts";
import {
	parseTeam,
	resolveEngine,
	extractEngine,
	runHcPlan,
	team,
	DEFAULT_ENGINE,
	type Engine,
	teamRows,
	sessionRows,
	classify,
} from "../cli/team.mts";

const dirs = (...existing: string[]) => (p: string) => existing.includes(p);

describe("team --engine hc / BOND_TEAM_ENGINE", () => {
	test("resolveEngine: por defecto herdr", () => {
		expect(resolveEngine(undefined, {})).toBe("herdr");
		expect(DEFAULT_ENGINE).toBe("herdr");
	});

	test("resolveEngine: flag --engine manda sobre variable de entorno", () => {
		expect(resolveEngine("hc", {})).toBe("hc");
		expect(resolveEngine("herdr", { BOND_TEAM_ENGINE: "hc" })).toBe("herdr");
		expect(resolveEngine("hc", { BOND_TEAM_ENGINE: "herdr" })).toBe("hc");
	});

	test("resolveEngine: variable BOND_TEAM_ENGINE", () => {
		expect(resolveEngine(undefined, { BOND_TEAM_ENGINE: "hc" })).toBe("hc");
		expect(resolveEngine(undefined, { BOND_TEAM_ENGINE: "herdr" })).toBe("herdr");
	});

	test("resolveEngine: motor desconocido lanza error", () => {
		expect(catchDie(() => resolveEngine("tmux", {})).error).toBeDefined();
		expect(catchDie(() => resolveEngine(undefined, { BOND_TEAM_ENGINE: "invalid" })).error).toBeDefined();
	});

	test("parseTeam: parsea --engine hc y herdr", () => {
		const oHc = parseTeam(["feat/a", "--engine", "hc"], dirs());
		expect(oHc.engine).toBe("hc");

		const oHerdr = parseTeam(["feat/a", "--engine", "herdr"], dirs());
		expect(oHerdr.engine).toBe("herdr");

		const oDef = parseTeam(["feat/a"], dirs(), {});
		expect(oDef.engine).toBe("herdr");
	});

	test("parseTeam: parsea --label y BOND_TEAM_LABELS", () => {
		const o = parseTeam(["feat/a", "--label", "herdr.space=s-run-123", "--label", "herdr.tab=t1"], dirs());
		expect(o.labels).toEqual({
			"herdr.space": "s-run-123",
			"herdr.tab": "t1",
		});

		const oEnv = parseTeam(["feat/a"], dirs(), {
			BOND_TEAM_LABELS: "herdr.space=s-env,herdr.tab=t2",
		});
		expect(oEnv.labels).toEqual({
			"herdr.space": "s-env",
			"herdr.tab": "t2",
		});
	});
});

describe("hcAgentStatus", () => {
	test("status como string plano", () => {
		expect(hcAgentStatus("idle")).toBe("idle");
		expect(hcAgentStatus("working")).toBe("working");
		expect(hcAgentStatus("blocked")).toBe("blocked");
		expect(hcAgentStatus("")).toBeUndefined();
	});

	test("status como objeto de herdr-core { state }", () => {
		expect(hcAgentStatus({ state: "idle", turn: 1 })).toBe("idle");
		expect(hcAgentStatus({ state: "working" })).toBe("working");
		expect(hcAgentStatus({ state: "blocked", reason: "permission" })).toBe("blocked");
		expect(hcAgentStatus({})).toBeUndefined();
		expect(hcAgentStatus(null)).toBeUndefined();
		expect(hcAgentStatus(undefined)).toBeUndefined();
	});
});

describe("teamRows con engine = hc (git worktrees)", () => {
	let repo: string;
	const g = (...args: string[]) => {
		const r = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
		if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
		return r.stdout.trim();
	};
	const commit = (file: string, content: string, msg = file) => {
		writeFileSync(join(repo, file), content);
		g("add", file);
		g("commit", "-qm", msg);
	};

	beforeEach(() => {
		repo = realpathSync(mkdtempSync(join(tmpdir(), "bond-team-hc-")));
		g("init", "-q", "-b", "main");
		commit("README", "hola\n");
	});
	afterEach(() => rmSync(repo, { recursive: true, force: true }));

	test("teamRows lista worktrees enlazados bajo motor hc", () => {
		const wtPath = join(repo, "wt-a");
		g("worktree", "add", "-b", "feat/a", wtPath, "main");
		const rows = teamRows(repo, "main", "hc");
		expect(rows.length).toBe(1);
		expect(rows[0].branch).toBe("feat/a");
		expect(rows[0].ahead).toBe(0);
		expect(rows[0].state).toBe("sin commits");
	});

	test("sessionRows en repo sin hub.toml delega a teamRows con engine hc", () => {
		const wtPath = join(repo, "wt-b");
		g("worktree", "add", "-b", "feat/b", wtPath, "main");
		const rows = sessionRows(repo, undefined, "hc");
		expect(rows.length).toBe(1);
		expect(rows[0].branch).toBe("feat/b");
	});

	test("parseTeam: --label sin formato clave=valor falla con die", () => {
		expect(catchDie(() => parseTeam(["feat/a", "--label", "badlabel"], dirs())).error).toBeDefined();
	});

	test("extractEngine: extrae --engine antes del parseo respetando --", () => {
		expect(extractEngine([])).toBe("herdr");
		expect(extractEngine(["feat/a", "--engine", "hc"])).toBe("hc");
		expect(extractEngine(["feat/a", "--engine", "herdr"])).toBe("herdr");
		expect(extractEngine([], { BOND_TEAM_ENGINE: "hc" })).toBe("hc");
		expect(extractEngine(["feat/a", "--engine", "herdr"], { BOND_TEAM_ENGINE: "hc" })).toBe("herdr");
		expect(extractEngine(["feat/a", "--", "--engine", "hc"])).toBe("herdr");
	});
});

describe("hc() parsing de stdout y stderr", () => {
	let binDir: string;
	const origPath = process.env.PATH;

	beforeEach(() => {
		binDir = realpathSync(mkdtempSync(join(tmpdir(), "bond-mock-hc-")));
	});

	afterEach(() => {
		process.env.PATH = origPath;
		rmSync(binDir, { recursive: true, force: true });
	});

	const setHc = (script: string) => {
		const hcFile = join(binDir, process.platform === "win32" ? "hc.cmd" : "hc");
		const content = process.platform === "win32" ? `@echo off\n${script}` : `#!/bin/sh\n${script}`;
		writeFileSync(hcFile, content, { mode: 0o755 });
		process.env.PATH = `${binDir}${delimiter}${origPath}`;
	};

	test("éxito con status 0: parsea stdout y no parsea stderr como JSON", () => {
		setHc("printf '%s\\n' '{\"address\":\"t-1\"}'\nprintf '%s\\n' 'invalid stderr' >&2\nexit 0");
		const res = hc<{ address: string }>(["dummy"]);
		expect(res.address).toBe("t-1");
	});

	test("éxito con status 0 y stdout vacío: devuelve {} y no parsea stderr", () => {
		setHc("printf '%s\\n' '{\"error\":{\"kind\":\"Fake\",\"message\":\"boom\"}}' >&2\nexit 0");
		const res = hc<Record<string, unknown>>(["dummy"]);
		expect(res).toEqual({});
	});

	test("fallo con status != 0: parsea stderr como error JSON con kind y message", () => {
		setHc("printf '%s\\n' '{\"error\":{\"kind\":\"NotFound\",\"message\":\"terminal not found\"}}' >&2\nexit 1");
		let thrown: (Error & { kind?: string; code?: number }) | undefined;
		try {
			hc(["dummy"]);
		} catch (e) {
			thrown = e as Error & { kind?: string; code?: number };
		}
		expect(thrown).toBeDefined();
		expect(thrown?.message).toBe("terminal not found");
		expect(thrown?.kind).toBe("NotFound");
		expect(thrown?.code).toBe(1);
	});
});

describe("orden de requireHerdr antes del parseo", () => {
	let nodeDir: string;

	beforeEach(() => {
		nodeDir = realpathSync(mkdtempSync(join(tmpdir(), "bond-node-only-")));
		const nodeBin = spawnSync("which", ["node"], { encoding: "utf8" }).stdout.trim() || process.execPath;
		const link = join(nodeDir, process.platform === "win32" ? "node.exe" : "node");
		try {
			writeFileSync(link, `#!/bin/sh\nexec "${nodeBin}" "$@"\n`, { mode: 0o755 });
		} catch {}
	});

	afterEach(() => {
		rmSync(nodeDir, { recursive: true, force: true });
	});

	test("sin Herdr instalado: team() falla con error de herdr antes que el de ramas vacías", () => {
		const bondBin = join(import.meta.dirname, "..", "bin", "bond");
		const r = spawnSync(process.execPath, [bondBin, "team"], {
			env: { PATH: nodeDir, HOME: nodeDir, USERPROFILE: nodeDir, NO_COLOR: "1" },
			encoding: "utf8",
		});
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("Herdr no está instalado");
	});

	test("sin hc instalado: team(--engine hc) falla con error de hc antes que el de ramas vacías", () => {
		const bondBin = join(import.meta.dirname, "..", "bin", "bond");
		const r = spawnSync(process.execPath, [bondBin, "team", "--engine", "hc"], {
			env: { PATH: nodeDir, HOME: nodeDir, USERPROFILE: nodeDir, NO_COLOR: "1" },
			encoding: "utf8",
		});
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("hc (herdr-core) no está instalado");
	});
});

describe("herencia de confianza en runHcPlan (motor hc)", () => {
	let repoDir: string;
	let binDir: string;
	const origPath = process.env.PATH;
	const origHerdrEnv = process.env.HERDR_ENV;
	const origHerdrPane = process.env.HERDR_PANE_ID;

	beforeEach(() => {
		repoDir = realpathSync(mkdtempSync(join(tmpdir(), "bond-hc-trust-")));
		binDir = realpathSync(mkdtempSync(join(tmpdir(), "bond-hc-trust-bin-")));
		const hcFile = join(binDir, process.platform === "win32" ? "hc.cmd" : "hc");
		const content = process.platform === "win32"
			? `@echo off\nif "%1"=="ls" (echo {"terminals":[]}) else if "%1"=="run" (echo {"address":"addr-123"})`
			: `#!/bin/sh\nif [ "$1" = "ls" ]; then echo '{"terminals":[]}'; elif [ "$1" = "run" ]; then echo '{"address":"addr-123"}'; fi`;
		writeFileSync(hcFile, content, { mode: 0o755 });
		process.env.PATH = `${binDir}${delimiter}${origPath}`;
		delete process.env.HERDR_ENV;
		delete process.env.HERDR_PANE_ID;
	});

	afterEach(() => {
		process.env.PATH = origPath;
		if (origHerdrEnv !== undefined) process.env.HERDR_ENV = origHerdrEnv;
		else delete process.env.HERDR_ENV;
		if (origHerdrPane !== undefined) process.env.HERDR_PANE_ID = origHerdrPane;
		else delete process.env.HERDR_PANE_ID;
		rmSync(repoDir, { recursive: true, force: true });
		rmSync(binDir, { recursive: true, force: true });
	});

	test("fuera de herdr sin orquestador: vouched es false y no hereda confianza si el repo no está confiado", () => {
		const wtDir = join(repoDir, "wt-test");
		const logs: string[] = [];
		const origLog = console.log;
		console.log = (msg: string) => logs.push(msg);
		try {
			runHcPlan(repoDir, [{ branch: "feat/x", agent: "pi", path: wtDir }], {
				engine: "hc",
				inheritTrust: true,
				trust: false,
				yes: true,
				noTable: true,
				specs: [{ branch: "feat/x" }],
				agentArgs: [],
			});
		} finally {
			console.log = origLog;
		}
		const line = logs.find((l) => l.includes("addr-123")) ?? "";
		expect(line).not.toContain("confianza heredada");
	});
});
