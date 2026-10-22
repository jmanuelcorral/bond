import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { branchInfo, classify, findWatchPane, gitWorktrees, lastLine, MINIONS, minionName, paintState, parseTeam, renderWatch, type State, STATE_CODE, selfCommand, tabLayout, tabWorktreePath, type WatchRow, watchCommand } from "../cli/team.mts";

const dirs = (...existing: string[]) => (p: string) => existing.includes(p);

describe("parseTeam", () => {
	test("sin repo: todo son ramas, con su agente si lo llevan", () => {
		const o = parseTeam(["feat/a", "feat/b:claude"], dirs());
		expect(o.dir).toBeUndefined();
		expect(o.specs).toEqual([{ branch: "feat/a", agent: undefined }, { branch: "feat/b", agent: "claude" }]);
	});

	test("el primero es el repo si es una carpeta que existe", () => {
		const o = parseTeam([".", "feat/a"], dirs("."));
		expect(o.dir).toBe(".");
		expect(o.specs.map((s) => s.branch)).toEqual(["feat/a"]);
	});

	test("una rama que se llama como una carpeta solo es repo en primera posición", () => {
		expect(parseTeam(["feat/a", "src"], dirs("src")).specs.map((s) => s.branch)).toEqual(["feat/a", "src"]);
	});

	test("opciones y argumentos para los agentes", () => {
		const o = parseTeam(["-a", "codex", "feat/a", "--base", "main", "--trust-repository", "--", "--model", "x"], dirs());
		expect(o).toMatchObject({ agent: "codex", base: "main", trust: true, agentArgs: ["--model", "x"] });
		expect(o.specs).toEqual([{ branch: "feat/a", agent: undefined }]);
	});
});

// --- estado de las ramas (solo git) ---------------------------------------------------------

Object.assign(process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" });

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
	repo = realpathSync(mkdtempSync(join(tmpdir(), "bond-team-")));
	g("init", "-q", "-b", "main");
	commit("README", "hola\n");
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("branchInfo", () => {
	test("rama con commits sin integrar", () => {
		g("switch", "-qc", "feat/a");
		commit("a.txt", "a\n");
		g("switch", "-q", "main");
		expect(branchInfo(repo, "main", "feat/a")).toEqual({ ahead: 1, files: ["a.txt"], dirty: 0, integrated: false });
	});

	test("integrada por fast-forward", () => {
		g("switch", "-qc", "feat/a");
		commit("a.txt", "a\n");
		g("switch", "-q", "main");
		g("merge", "-q", "--ff-only", "feat/a");
		expect(branchInfo(repo, "main", "feat/a")).toMatchObject({ ahead: 0, integrated: true });
	});

	test("integrada por rebase (commits equivalentes en la base)", () => {
		g("switch", "-qc", "feat/a");
		commit("a.txt", "a\n");
		g("switch", "-q", "main");
		commit("b.txt", "b\n");
		g("cherry-pick", "feat/a");
		expect(branchInfo(repo, "main", "feat/a")).toMatchObject({ ahead: 1, integrated: true });
	});

	test("integrada por squash (lo que tocó está igual en la base)", () => {
		g("switch", "-qc", "feat/a");
		commit("a.txt", "a\n");
		commit("a.txt", "a2\n", "otra");
		g("switch", "-q", "main");
		g("merge", "-q", "--squash", "feat/a");
		g("commit", "-qm", "squash");
		expect(branchInfo(repo, "main", "feat/a")).toMatchObject({ ahead: 2, integrated: true });
	});

	test("cuenta los cambios sin commitear de su worktree", () => {
		const wt = join(repo, "..", `${repo.split(/[\\/]/).pop()}-wt`);
		g("worktree", "add", "-q", "-b", "feat/a", wt);
		writeFileSync(join(wt, "x.txt"), "x\n");
		try {
			expect(branchInfo(repo, "main", "feat/a", wt)).toMatchObject({ ahead: 0, dirty: 1 });
			const list = gitWorktrees(repo);
			expect(list.map((w) => [w.branch, w.main])).toEqual([["main", true], ["feat/a", false]]);
			expect(list[1].path).toBe(realpathSync.native(wt));
		} finally {
			rmSync(wt, { recursive: true, force: true });
		}
	});
});

describe("classify", () => {
	const base = { dirty: 0, ahead: 0, integrated: true };
	test("el agente manda; luego lo que hay sin commitear; luego los commits", () => {
		expect(classify({ ...base, agentStatus: "working", dirty: 3 })).toBe("trabajando");
		expect(classify({ ...base, agentStatus: "blocked" })).toBe("bloqueado");
		expect(classify({ ...base, agentStatus: "idle", dirty: 1 })).toBe("sin commitear");
		expect(classify({ ...base, ahead: 2, integrated: false })).toBe("lista");
		expect(classify({ ...base, ahead: 2 })).toBe("integrada");
		expect(classify(base)).toBe("sin commits");
	});
});

describe("equipo en la pestaña", () => {
	test("minions: el primero libre; si están todos, minion-2...", () => {
		expect(minionName(new Set())).toBe("kevin");
		expect(minionName(new Set(["kevin", "gru"]))).toBe("stuart");
		expect(minionName(new Set(MINIONS))).toBe("minion");
		expect(minionName(new Set([...MINIONS, "minion"]))).toBe("minion-2");
	});

	test("worktree en la carpeta de Herdr, con la rama sin barras", () => {
		expect(tabWorktreePath("/h", "fluzo", "plan/ui05-p1")).toBe(join("/h", ".herdr", "worktrees", "fluzo", "plan-ui05-p1"));
	});

	test("dos agentes: el primero debajo y el segundo a su derecha, mitad y mitad", () => {
		expect(tabLayout(2)).toEqual([
			{ from: "anchor", direction: "down", ratio: 0.5 },
			{ from: 0, direction: "right", ratio: 0.5 },
		]);
	});

	test("cuatro en fila con el mismo ancho; el quinto, debajo del primero", () => {
		const l = tabLayout(5);
		expect(l.slice(1, 4).map((s) => [s.from, s.direction, s.ratio])).toEqual([
			[0, "right", 0.25],
			[1, "right", 0.3333],
			[2, "right", 0.5],
		]);
		expect(l[4]).toEqual({ from: 0, direction: "down", ratio: 0.5 });
	});

	test("--workspaces vuelve al modo de un workspace por rama", () => {
		expect(parseTeam(["feat/a", "--workspaces"], dirs()).workspaces).toBe(true);
		expect(parseTeam(["feat/a"], dirs()).workspaces).toBe(false);
	});
});

describe("tabla en vivo", () => {
	const row = (branch: string, state: State, extra: Partial<WatchRow> = {}): WatchRow => ({ branch, state, path: `/w/${branch}`, ahead: 0, files: [], dirty: 0, integrated: false, managed: true, ...extra });
	const rows = [
		row("feat/a", "trabajando", { agent: { name: "kevin", kind: "pi", status: "working", pane: "w1:p2" }, ahead: 2, files: ["a", "b", "c"], last: "Editando cli/team.mts" }),
		row("feat/b", "bloqueado", { agent: { name: "stuart", kind: "pi", status: "idle", question: "confiar en la carpeta del proyecto", pane: "w1:p3" }, last: "Trust project folder?" }),
		row("feat/c", "lista", { ahead: 1, files: ["x"] }),
	];
	const opts = { width: 100, color: false, repo: "fluzo", base: "main", time: "10:00:00" };

	test("una fila por rama: minion, rama, estado, commits, ficheros y última línea", () => {
		const out = renderWatch(rows, opts);
		expect(out[0]).toBe(`${"bond team · fluzo · base main".padEnd(92)}10:00:00`);
		expect(out[2]).toBe("MINION  RAMA    ESTADO      COMMITS  FICHEROS  ÚLTIMA LÍNEA");
		expect(out[3]).toBe("kevin   feat/a  trabajando  +2       3         Editando cli/team.mts");
		// Con una pregunta en pantalla, la pregunta en vez de la última línea.
		expect(out[4]).toBe("stuart  feat/b  bloqueado   -        -         pregunta: confiar en la carpeta del proyecto");
		expect(out[5]).toBe("-       feat/c  lista       +1       1");
		expect(out.at(-1)).toContain("q o Ctrl+C");
		expect(out.every((l) => l.length <= 100)).toBe(true);
	});

	test("estrecha: la última línea va debajo de la fila y nada pasa del ancho", () => {
		const out = renderWatch(rows, { ...opts, width: 50 });
		expect(out[2]).toBe("MINION  RAMA    ESTADO      COMMITS  FICHEROS");
		expect(out[3]).toBe("kevin   feat/a  trabajando  +2       3");
		expect(out[4]).toBe("  Editando cli/team.mts");
		expect(out[6]).toBe("  pregunta: confiar en la carpeta del proyecto");
		expect(out.every((l) => l.length <= 50)).toBe(true);
		expect(renderWatch(rows, { ...opts, width: 20 }).every((l) => l.length <= 20)).toBe(true);
	});

	test("muy estrecha: cabeceras cortas y la rama recortada para que quepan las columnas", () => {
		const out = renderWatch(rows, { ...opts, width: 35 });
		expect(out[2]).toBe("MINION  RAMA  ESTADO      COM  FICH");
		expect(out[3]).toBe("kevin   fea…  trabajando  +2   3");
	});

	test("el estado lleva el color de su estado y nada más", () => {
		const out = renderWatch(rows, { ...opts, color: true });
		expect(out[3]).toContain(`\x1b[33mtrabajando\x1b[0m`);
		expect(out[4]).toContain(`\x1b[31mbloqueado\x1b[0m`);
		expect(out[5]).toContain(`\x1b[32mlista\x1b[0m`);
		expect(out[3].replace(/\x1b\[[0-9;]*m/g, "")).toBe(renderWatch(rows, opts)[3]);
	});

	test("colores por estado: rojo si te espera, verde si toca revisar, tenue si no hay nada", () => {
		expect(STATE_CODE).toEqual({ trabajando: "33", bloqueado: "31", "sin commitear": "33", lista: "32", integrada: "2", "sin commits": "2" });
		expect(paintState("lista", "x", true)).toBe("\x1b[32mx\x1b[0m");
		expect(paintState("lista", "x", false)).toBe("x");
	});

	test("sin worktrees", () => {
		expect(renderWatch([], opts)[2]).toBe("Sin worktrees en este repo.");
	});

	test("última línea con texto del panel, sin bordes ni líneas vacías", () => {
		expect(lastLine("hola\n● Leyendo cli/team.mts\n╰──────╯\n│ > │\n\n")).toBe("● Leyendo cli/team.mts");
		expect(lastLine("│ Pensando… │\n")).toBe("Pensando…");
		expect(lastLine("\n───\n")).toBeUndefined();
		expect(lastLine("  0.0%/131k (auto)          pi\n")).toBe("0.0%/131k (auto) pi");
	});

	test("el panel de la tabla se reutiliza: el de la misma pestaña y el mismo repo", () => {
		const panes = [
			{ pane_id: "w1:p1", tab_id: "w1:t1" },
			{ pane_id: "w1:p4", tab_id: "w1:t2", label: "tabla · fluzo" },
			{ pane_id: "w1:p5", tab_id: "w1:t1", label: "tabla · otro" },
			{ pane_id: "w1:p6", tab_id: "w1:t1", label: "tabla · fluzo" },
		];
		expect(findWatchPane(panes, "w1:t1", "fluzo")).toBe("w1:p6");
		expect(findWatchPane(panes, "w1:t3", "fluzo")).toBeUndefined();
	});

	test("la orden del panel vuelve a lanzar este bond", () => {
		expect(selfCommand("/usr/bin/node", "/r/bin/bond")).toEqual(["/usr/bin/node", "/r/bin/bond"]);
		expect(selfCommand("/usr/local/bin/bond", "/$bunfs/root/bond")).toEqual(["/usr/local/bin/bond"]);
		expect(watchCommand("/home/j/mi repo", "main", ["/usr/local/bin/bond"])).toBe("/usr/local/bin/bond team status '/home/j/mi repo' --watch --base main");
		expect(watchCommand("/r", undefined, ["bond"])).toBe("bond team status /r --watch");
	});
});
