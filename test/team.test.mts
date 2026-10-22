import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { branchInfo, classify, findWatchPane, gitWorktrees, idleTables, MINIONS, minionName, paintState, parseTeam, pendingWork, renderWatch, type Row, type State, STATE_CODE, selfCommand, type Split, tabLayout, tabRoom, tabWorktreePath, teamTabLabel, textWidth, WATCH_GROUPS, watchCommand, watchIdle } from "../cli/team.mts";

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

	test("--no-trust: sin heredar la confianza (por defecto, sí)", () => {
		expect(parseTeam(["feat/a"], dirs()).inheritTrust).toBe(true);
		expect(parseTeam(["feat/a", "--no-trust"], dirs()).inheritTrust).toBe(false);
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
			{ tab: 0, from: "anchor", direction: "down", ratio: 0.5 },
			{ tab: 0, from: 0, direction: "right", ratio: 0.5 },
		]);
	});

	const where = (l: Split[]) => l.map((s) => ("direction" in s ? [s.tab, s.from, s.direction, s.ratio] : [s.tab, s.from]));

	test("cuatro, con sitio para cuatro: todos en fila en tu pestaña, con el mismo ancho", () => {
		expect(where(tabLayout(4, 4))).toEqual([
			[0, "anchor", "down", 0.5],
			[0, 0, "right", 0.25],
			[0, 1, "right", 0.3333],
			[0, 2, "right", 0.5],
		]);
	});

	test("en tu pestaña (sin tope): cuatro en fila y el quinto debajo del primero", () => {
		const l = tabLayout(5);
		expect(l.every((s) => s.tab === 0)).toBe(true);
		expect(where(l.slice(1, 4))).toEqual([
			[0, 0, "right", 0.25],
			[0, 1, "right", 0.3333],
			[0, 2, "right", 0.5],
		]);
		expect(l[4]).toEqual({ tab: 0, from: 0, direction: "down", ratio: 0.5 });
	});

	test("cinco con sitio para cuatro: el quinto, solo en una pestaña nueva", () => {
		const l = tabLayout(5, 4);
		expect(where(l.slice(0, 4))).toEqual(where(tabLayout(4, 4)));
		expect(l[4]).toEqual({ tab: 1, from: "tab" });
	});

	test("nueve con sitio para cuatro: 4 en tu pestaña, 4 en la primera nueva y 1 en la segunda", () => {
		const l = tabLayout(9, 4);
		expect(l.map((s) => s.tab)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2]);
		expect(where(l.slice(4))).toEqual([
			[1, "tab"],
			[1, 4, "right", 0.25],
			[1, 5, "right", 0.3333],
			[1, 6, "right", 0.5],
			[2, "tab"],
		]);
	});

	test("con la pestaña llena, todos a pestañas nuevas; con sitio para dos, la fila de dos a mitades", () => {
		expect(where(tabLayout(2, 0))).toEqual([
			[1, "tab"],
			[1, 0, "right", 0.5],
		]);
		expect(where(tabLayout(3, 2))).toEqual([
			[0, "anchor", "down", 0.5],
			[0, 0, "right", 0.5],
			[1, "tab"],
		]);
	});

	test("tope de 6 paneles: el tuyo, la tabla y 4 minions", () => {
		expect(tabRoom(1, false)).toBe(4);
		expect(tabRoom(2, true)).toBe(4);
		expect(tabRoom(4, true)).toBe(2);
		expect(tabRoom(7, true)).toBe(0);
	});

	test("pestañas nuevas: equipo · <repo>, numeradas desde la segunda", () => {
		expect(teamTabLabel("fluzo", 1)).toBe("equipo · fluzo");
		expect(teamTabLabel("fluzo", 2)).toBe("equipo · fluzo · 2");
	});

	test("--tabs, --same-tab y --workspaces fijan el reparto; --yes no pregunta", () => {
		expect(parseTeam(["feat/a"], dirs()).layout).toBeUndefined();
		expect(parseTeam(["feat/a", "--workspaces"], dirs()).layout).toBe("workspaces");
		expect(parseTeam(["feat/a", "--tabs"], dirs()).layout).toBe("tabs");
		expect(parseTeam(["feat/a", "--same-tab"], dirs()).layout).toBe("same-tab");
		expect(parseTeam(["feat/a", "--tabs", "--tabs"], dirs()).layout).toBe("tabs");
		expect(parseTeam(["feat/a"], dirs()).yes).toBe(false);
		expect(parseTeam(["feat/a", "--yes"], dirs()).yes).toBe(true);
		expect(parseTeam(["-y", "feat/a"], dirs()).yes).toBe(true);
	});
});

describe("tabla en vivo", () => {
	const row = (branch: string, state: State, extra: Partial<Row> = {}): Row => ({ branch, state, path: `/w/${branch}`, ahead: 0, files: [], dirty: 0, integrated: false, managed: true, ...extra });
	const rows = [
		row("feat/a", "trabajando", { agent: { name: "kevin", kind: "pi", status: "working", pane: "w1:p2" }, ahead: 2, files: ["a", "b", "c"] }),
		row("feat/b", "bloqueado", { agent: { name: "stuart", kind: "pi", status: "idle", question: "confiar en la carpeta del proyecto", pane: "w1:p3" } }),
		row("feat/c", "lista", { ahead: 1, files: ["x"] }),
		row("feat/d", "integrada", { ahead: 1 }),
		row("feat/e", "sin commitear", { agent: { name: "bob", kind: "claude", status: "idle" }, dirty: 1, files: ["y"] }),
		row("feat/f", "sin commits"),
	];
	const opts = { width: 80, color: false, repo: "fluzo", base: "main", time: "10:00:00" };
	const plain = (l: string) => l.replace(/\x1b\[[0-9;]*m/g, "");

	test("ancho visual: emoji a 2 columnas, sin contar el color ni lo que se combina", () => {
		expect(textWidth("abc")).toBe(3);
		expect(textWidth("⛔🔄📦✅")).toBe(8);
		expect(textWidth("✏️")).toBe(2);
		expect(textWidth("\x1b[31m⛔\x1b[0m x")).toBe(4);
		expect(textWidth("é")).toBe(1);
		expect(textWidth("e\u0301")).toBe(1);
		expect(textWidth("…└")).toBe(2);
	});

	test("grupos por estado, en orden: lo que te espera primero, y sin la última línea del panel", () => {
		const out = renderWatch(rows, opts);
		expect(out).toEqual([
			`${"bond team · fluzo · base main".padEnd(72)}10:00:00`,
			"",
			"   MINION  RAMA    COMMITS  FICHEROS",
			"",
			"⛔ Necesita tu respuesta",
			"⛔ stuart  feat/b  -        -",
			"   └ pregunta: confiar en la carpeta del proyecto",
			"",
			"🔄 Trabajando",
			"🔄 kevin   feat/a  +2       3",
			"",
			"✏️ Sin commitear",
			"✏️ bob     feat/e  -        1",
			"",
			"📦 Por revisar",
			"📦 -       feat/c  +1       1",
			"",
			"✅ Integradas / sin empezar",
			"✅ -       feat/d  +1       -",
			"✅ -       feat/f  -        -",
			"",
			"q o Ctrl+C para salir · se actualiza cada 2 s",
		]);
		expect(out.join("\n")).not.toContain("ÚLTIMA");
	});

	test("los grupos vacíos no salen", () => {
		const out = renderWatch([row("feat/c", "lista", { ahead: 1 }), row("feat/a", "trabajando")], opts);
		expect(out.filter((l) => WATCH_GROUPS.some((g) => l === `${g.icon} ${g.title}`))).toEqual(["🔄 Trabajando", "📦 Por revisar"]);
		expect(WATCH_GROUPS.map((g) => g.states)).toEqual([["bloqueado"], ["trabajando"], ["sin commitear"], ["lista"], ["integrada", "sin commits"]]);
	});

	test("a 40, 60 y 80 columnas nada pasa del ancho y las columnas quedan alineadas con los emoji", () => {
		for (const width of [40, 60, 80]) {
			const out = renderWatch(rows, { ...opts, width, color: true }).map(plain);
			expect(out.every((l) => textWidth(l) <= width)).toBe(true);
			// Cada columna empieza en la misma posición visual en la cabecera y en todas las filas.
			const lines = [out[2], ...out.filter((l) => /^\S+ \S/.test(l) && /feat\//.test(l))];
			expect(lines).toHaveLength(7);
			const starts = (l: string) => [...l.matchAll(/(?<=^|\s)\S+/g)].map((m) => textWidth(l.slice(0, m.index)));
			for (const l of lines.slice(1)) expect(starts(l).slice(1)).toEqual(starts(out[2]));
		}
		expect(renderWatch(rows, { ...opts, width: 40 })[6]).toBe("   └ pregunta: confiar en la carpeta de…");
		expect(renderWatch(rows, { ...opts, width: 20 }).every((l) => textWidth(l) <= 20)).toBe(true);
	});

	test("muy estrecha: cabeceras cortas y la rama recortada para que quepan las columnas", () => {
		const out = renderWatch(rows, { ...opts, width: 26 });
		expect(out[2]).toBe("   MINION  RAMA  COM  FICH");
		expect(out[9]).toBe("🔄 kevin   fea…  +2   3");
	});

	test("título e icono en el color de su estado; sin color, los iconos siguen diciendo el estado", () => {
		const out = renderWatch(rows, { ...opts, color: true });
		expect(out[4]).toBe("\x1b[31m⛔ Necesita tu respuesta\x1b[0m");
		expect(out[5]).toBe("\x1b[31m⛔\x1b[0m stuart  feat/b  -        -");
		expect(out[9]).toStartWith("\x1b[33m🔄\x1b[0m");
		expect(out[15]).toStartWith("\x1b[32m📦\x1b[0m");
		expect(out.map(plain)).toEqual(renderWatch(rows, opts));
		const bare = renderWatch(rows, opts);
		expect(bare.join("\n")).not.toContain("\x1b[");
		expect(bare[5]).toStartWith("⛔ ");
		expect(bare[9]).toStartWith("🔄 ");
	});

	test("colores por estado: rojo si te espera, verde si toca revisar, tenue si no hay nada", () => {
		expect(STATE_CODE).toEqual({ trabajando: "33", bloqueado: "31", "sin commitear": "33", lista: "32", integrada: "2", "sin commits": "2" });
		expect(paintState("lista", "x", true)).toBe("\x1b[32mx\x1b[0m");
		expect(paintState("lista", "x", false)).toBe("x");
	});

	test("bloqueada sin pregunta en pantalla: sin línea de pregunta", () => {
		const out = renderWatch([row("feat/b", "bloqueado", { agent: { name: "stuart", kind: "pi", status: "blocked" } })], opts);
		expect(out.slice(4, 7)).toEqual(["⛔ Necesita tu respuesta", "⛔ stuart  feat/b  -        -", ""]);
	});

	test("sin worktrees", () => {
		expect(renderWatch([], opts)[2]).toBe("Sin worktrees en este repo.");
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

describe("cerrar al terminar", () => {
	const row = (branch: string, state: State, extra: Partial<Row> = {}): Row => ({ branch, state, path: `/w/${branch}`, ahead: 0, files: [], dirty: 0, integrated: false, managed: true, ...extra });
	const kevin = { name: "kevin", kind: "pi", status: "idle", pane: "w1:p2" };
	const table = { label: "tabla · fluzo", focused: false };

	test("trabajo pendiente: trabajando, bloqueado, sin commitear, lista, o un agente que aún no ha empezado", () => {
		for (const s of ["trabajando", "bloqueado", "sin commitear", "lista"] as State[]) expect(pendingWork([row("a", "integrada"), row("b", s)])).toBe(true);
		expect(pendingWork([row("a", "sin commits", { agent: kevin })])).toBe(true);
		expect(pendingWork([row("a", "integrada", { agent: kevin }), row("b", "sin commits")])).toBe(false);
		expect(pendingWork([])).toBe(false);
		// Tuvo commits y vuelve a sin commits: se integró por merge o fast-forward.
		expect(pendingWork([row("a", "sin commits", { agent: kevin })], new Set(["a"]))).toBe(false);
		expect(watchIdle([row("a", "sin commits", { agent: kevin })], table, "fluzo", false, new Set(["a"]))).toBe("close");
	});

	test("la tabla con todas las ramas integradas se cierra; con trabajo pendiente, no", () => {
		expect(watchIdle([row("a", "integrada"), row("b", "integrada")], table, "fluzo", false)).toBe("close");
		expect(watchIdle([row("a", "integrada"), row("b", "lista", { ahead: 1 })], table, "fluzo", false)).toBe("busy");
		expect(watchIdle([row("a", "trabajando", { agent: kevin })], table, "fluzo", false)).toBe("busy");
	});

	test("si solo queda el grupo ✅, no hay trabajo pendiente y la tabla se cierra", () => {
		const done = [row("a", "integrada", { ahead: 1 }), row("b", "sin commits", { agent: kevin })];
		const out = renderWatch(done, { width: 60, color: false, repo: "fluzo", base: "main", time: "10:00:00" });
		expect(out.filter((l) => WATCH_GROUPS.some((g) => l === `${g.icon} ${g.title}`))).toEqual(["✅ Integradas / sin empezar"]);
		expect(watchIdle(done, table, "fluzo", false, new Set(["b"]))).toBe("close");
	});

	test("enfocada, con --keep-open o fuera del panel de la tabla, solo avisa", () => {
		const done = [row("a", "integrada")];
		expect(watchIdle(done, { ...table, focused: true }, "fluzo", false)).toBe("idle");
		expect(watchIdle(done, table, "fluzo", true)).toBe("idle");
		expect(watchIdle(done, { label: "gru", focused: false }, "fluzo", false)).toBe("idle");
		expect(watchIdle(done, { label: "tabla · otro", focused: false }, "fluzo", false)).toBe("idle");
		expect(watchIdle(done, undefined, "fluzo", false)).toBe("idle");
	});

	test("el aviso va encima del pie de la tabla", () => {
		const out = renderWatch([row("a", "integrada")], { width: 80, color: false, repo: "fluzo", base: "main", time: "10:00:00", notice: "sin trabajo pendiente" });
		expect(out.slice(-3)).toEqual(["sin trabajo pendiente", "", expect.stringContaining("q o Ctrl+C")]);
		expect(renderWatch([], { width: 30, color: false, repo: "fluzo", base: "main", time: "10:00:00", notice: "sin trabajo pendiente\nel panel se cierra en 4 s" }).slice(-4, -2)).toEqual(["sin trabajo pendiente", "el panel se cierra en 4 s"]);
		expect(renderWatch([], { width: 80, color: false, repo: "fluzo", base: "main", time: "10:00:00" })).not.toContain("sin trabajo pendiente");
	});

	test("clean de la última rama: se cierra la tabla de ese repo, la del que llama no", () => {
		const panes = [
			{ pane_id: "w1:p1", tab_id: "w1:t1", label: "gru" },
			{ pane_id: "w1:p3", tab_id: "w1:t1", label: "tabla · fluzo" },
			{ pane_id: "w1:p4", tab_id: "w1:t1", label: "tabla · otro" },
			{ pane_id: "w2:p1", tab_id: "w2:t1", label: "tabla · fluzo" },
		];
		expect(idleTables([], panes, "fluzo", "w1:p1")).toEqual(["w1:p3", "w2:p1"]);
		expect(idleTables([row("a", "integrada")], panes, "fluzo", "w2:p1")).toEqual(["w1:p3"]);
		// Queda un minion abierto: la tabla sigue.
		expect(idleTables([row("b", "lista", { agent: kevin })], panes, "fluzo", "w1:p1")).toEqual([]);
	});
});
