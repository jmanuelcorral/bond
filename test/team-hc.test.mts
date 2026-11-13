import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { catchDie } from "../cli/util.mts";
import { hcAgentStatus } from "../cli/hc.mts";
import {
	parseTeam,
	resolveEngine,
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
});
