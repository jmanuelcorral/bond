// Pruebas de la librería de propuesta de handoff (#88): detección del agente del panel,
// orden D1 (ok → low → unknown → exhausted), resumen escrito como fichero (D3), propuesta
// útil con todos los candidatos en `unknown` y el contrato central del epic: NINGÚN camino
// de código lanza el agente destino (stubs en el PATH que dejarían una marca si alguien los
// invocara). Sin Herdr real y sin red: el fetch de claude es inyectable y siempre falla.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildHandoff, currentPaneAgent, handoffCandidates, renderHandoff } from "../cli/handoff.mts";
import { appendEvent } from "../cli/budget.mts";
import type { HerdrAgent } from "../cli/herdr.mts";
import { setLang } from "../cli/messages.mts";

const NOW = new Date("2026-11-10T06:44:21.000Z");
const TS = NOW.toISOString();
/** Cualquier intento de salida a la red revienta aquí: claude degrada a `unknown` (fail-open). */
const noNet: typeof fetch = (() => Promise.reject(new Error("sin red en los tests"))) as unknown as typeof fetch;

let base: string;
beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "bond-handoff-"));
	process.env.BOND_EVENTS_DIR = join(base, "events");
	setLang("es");
});
afterEach(() => {
	rmSync(base, { recursive: true, force: true });
	delete process.env.BOND_EVENTS_DIR;
});

/** Sesión de pi con cwd en el home falso, como la encuentra findSessionFile. */
function piSession(home: string, cwd: string): void {
	const dir = join(home, ".pi", "agent", "sessions", "proj");
	mkdirSync(dir, { recursive: true });
	const msg = (role: "user" | "assistant", text: string) => JSON.stringify({ type: "message", message: { role, content: [{ type: "text", text }] } });
	writeFileSync(
		join(dir, "s1.jsonl"),
		[JSON.stringify({ type: "session", cwd }), msg("user", "primera pregunta"), msg("assistant", "primera respuesta"), msg("user", "segunda pregunta"), msg("assistant", "respuesta final pi")].join("\n") + "\n",
	);
}

describe("currentPaneAgent: el agente del panel actual", () => {
	const panes: HerdrAgent[] = [{ pane_id: "p1", agent: "pi" }, { pane_id: "p2", agent: "claude" }, { pane_id: "p3" }];
	test("panel conocido → su agente; desconocido o sin paneId → undefined", () => {
		expect(currentPaneAgent(panes, "p2")).toBe("claude");
		expect(currentPaneAgent(panes, "p9")).toBeUndefined();
		expect(currentPaneAgent(panes, "")).toBeUndefined();
	});
});

describe("handoffCandidates: orden D1 y comandos", () => {
	test("ok antes que unknown y exhausted; el origen fuera; estable dentro del estado", async () => {
		appendEvent({ ts: TS, agent: "pi", event: "session_start" }); // ok (eventos sin señal de límites)
		mkdirSync(join(base, "tx"), { recursive: true });
		const tx = join(base, "tx", "rollout.jsonl");
		writeFileSync(tx, JSON.stringify({ type: "event_msg", payload: { type: "token_count", rate_limits: { primary: {}, rate_limit_reached_type: "requests" }, info: {} } }) + "\n");
		appendEvent({ ts: TS, agent: "codex", event: "stop", transcript_path: tx }); // exhausted
		const cs = await handoffCandidates(["codex", "copilot", "gemini", "agy", "pi"], "agy", NOW, { fetchImpl: noNet });
		expect(cs.map((c) => c.agent)).toEqual(["pi", "copilot", "gemini", "codex"]); // ok, unknown, unknown (orden de entrada), exhausted
		expect(cs.map((c) => c.status.state)).toEqual(["ok", "unknown", "unknown", "exhausted"]);
	});
	test("opencode fuera de alcance (decisión de #86/#87) y duplicados dedup", async () => {
		const cs = await handoffCandidates(["pi", "opencode", "pi"], "pi", NOW, { fetchImpl: noNet });
		expect(cs.map((c) => c.agent)).toEqual([]);
		expect((await handoffCandidates(["opencode", "claude", "pi"], "pi", NOW, { fetchImpl: noNet })).map((c) => c.agent)).toEqual(["claude"]);
	});
	test("claude sin red degrada a unknown y la propuesta sigue (fail-open)", async () => {
		const cs = await handoffCandidates(["claude", "pi"], "pi", NOW, { fetchImpl: noNet });
		expect(cs).toHaveLength(1);
		expect(cs[0].agent).toBe("claude");
		expect(cs[0].status.state).toBe("unknown");
	});
	test("comandos: ejecutable + args por defecto; agy con --dangerously-skip-permissions; resumen por ruta (D3)", async () => {
		const cs = await handoffCandidates(["agy", "claude", "pi"], "pi", NOW, { summaryFile: "/x/resumen.md", fetchImpl: noNet });
		const agy = cs.find((c) => c.agent === "agy")!;
		const claude = cs.find((c) => c.agent === "claude")!;
		expect(agy.command.startsWith('agy --dangerously-skip-permissions "')).toBe(true);
		expect(claude.command.startsWith('claude "')).toBe(true);
		expect(agy.command).toContain("/x/resumen.md");
	});
});

describe("buildHandoff: propuesta completa", () => {
	test("con sesión: resumen escrito en <utc>-<agente>.md y comandos que lo referencian", async () => {
		piSession(base, join(base, "repo"));
		appendEvent({ ts: TS, agent: "pi", event: "session_start" });
		const p = await buildHandoff({ from: "pi", home: base, cwd: join(base, "repo"), now: NOW, all: ["pi", "claude"], tail: 2, fetchImpl: noNet });
		expect(p.generatedAt).toBe(TS);
		expect(p.fromStatus).toMatchObject({ agent: "pi", state: "ok" });
		expect(p.summaryFile).toBe(join(base, "handoff", "2026-11-10T06-44-21-000Z-pi.md"));
		expect(existsSync(p.summaryFile!)).toBe(true);
		const md = readFileSync(p.summaryFile!, "utf8");
		expect(md).toContain("respuesta final pi");
		expect(md).not.toContain("primera pregunta"); // --tail aplicado
		expect(p.summaryMd).toBe(md);
		expect(p.candidates.map((c) => c.agent)).toEqual(["claude"]);
		expect(p.candidates[0].command).toContain(p.summaryFile!);
	});
	test("sin sesión legible: la propuesta sigue siendo útil sin resumen", async () => {
		mkdirSync(join(base, "vacio"), { recursive: true });
		const p = await buildHandoff({ from: "pi", home: base, cwd: join(base, "vacio"), now: NOW, all: ["pi", "codex"], fetchImpl: noNet });
		expect(p.summaryFile).toBeUndefined();
		expect(p.candidates.map((c) => c.agent)).toEqual(["codex"]);
		expect(renderHandoff(p)).toContain("sin resumen");
	});
	test("con `all` sin config: todos menos el origen; sin candidatos, render lo dice", async () => {
		const p = await buildHandoff({ from: "pi", home: base, cwd: base, now: NOW, all: ["pi"], fetchImpl: noNet });
		expect(p.candidates).toEqual([]);
		expect(renderHandoff(p)).toContain("no hay candidatos");
	});
});

describe("renderHandoff: la propuesta legible", () => {
	test("tabla, resumen y comandos; nota todos-unknown cuando procede", async () => {
		piSession(base, join(base, "repo"));
		const p = await buildHandoff({ from: "pi", home: base, cwd: join(base, "repo"), now: NOW, all: ["pi", "codex"], fetchImpl: noNet });
		const md = renderHandoff(p);
		expect(md).toContain("Propuesta de traspaso desde pi");
		expect(md).toContain("| agente | estado | ventanas | fuente |");
		expect(md).toContain("| codex | unknown |");
		expect(md).toContain("todos los candidatos están en `unknown`");
		expect(md).toContain("respuesta final pi");
		expect(md).toContain(p.summaryFile!);
		expect(md).toContain("`codex \"");
	});
});

describe("nunca ejecuta el traspaso (contrato del epic #84)", () => {
	test("buildHandoff con stubs en el PATH que dejarían marca: ninguna se escribe", async () => {
		piSession(base, join(base, "repo"));
		const stubs = join(base, "bin");
		mkdirSync(stubs, { recursive: true });
		for (const a of ["pi", "claude", "codex", "agy", "copilot", "gemini", "opencode"]) {
			const stub = join(stubs, a);
			writeFileSync(stub, `#!/bin/sh\ntouch "${base}/spawned-${a}"\n`);
			if (process.platform !== "win32") chmodSync(stub, 0o755);
		}
		const savedPath = process.env.PATH;
		try {
			process.env.PATH = `${stubs}${process.platform === "win32" ? ";" : ":"}${savedPath ?? ""}`;
			const p = await buildHandoff({ from: "pi", home: base, cwd: join(base, "repo"), now: NOW, all: ["pi", "claude", "codex", "agy", "copilot"], fetchImpl: noNet });
			expect(p.candidates.length).toBeGreaterThan(0);
			renderHandoff(p);
			for (const a of ["pi", "claude", "codex", "agy", "copilot", "gemini", "opencode"]) {
				expect(existsSync(join(base, `spawned-${a}`))).toBe(false);
			}
		} finally {
			process.env.PATH = savedPath;
		}
	});
});

describe("bond handoff (CLI)", () => {
	const REPO = join(import.meta.dir, "..");
	const run = (cwd: string, home: string, args: string[]) =>
		spawnSync(process.execPath, [join(REPO, "cli/main.mts"), "handoff", ...args], {
			cwd,
			encoding: "utf8",
			timeout: 30_000,
			env: {
				...process.env,
				// HOME y USERPROFILE: os.homedir() mira uno u otro según el SO; BOND_HOME, por si el entorno lo fija.
				HOME: home,
				USERPROFILE: home,
				BOND_HOME: join(home, ".bond"),
				// Fuera de Herdr aunque los tests corran dentro de un panel, y sin red: sin clave de Claude.
				HERDR_ENV: "",
				HERDR_PANE_ID: "",
				ANTHROPIC_API_KEY: "",
				PI_CODING_AGENT_SESSION_DIR: "",
			},
		});
	// El fixture de pi declara "cwd":"/repo-test": se reescribe al directorio real (realpathSync por macOS).
	const mkHome = (cwd: string) => {
		const home = realpathSync(mkdtempSync(join(tmpdir(), "bond-handoff-cli-")));
		mkdirSync(join(home, ".pi/agent/sessions/proj"), { recursive: true });
		const text = readFileSync(join(import.meta.dir, "fixtures", "summary", "pi.jsonl"), "utf8").replaceAll('"/repo-test"', JSON.stringify(cwd));
		writeFileSync(join(home, ".pi/agent/sessions/proj/s.jsonl"), text);
		return home;
	};

	test("--from pi: propuesta completa, resumen escrito y comandos; no lanza agentes", () => {
		const cwd = realpathSync(mkdtempSync(join(tmpdir(), "bond-handoff-cwd-")));
		const home = mkHome(cwd);
		// Prueba de spawn: stubs en el PATH que dejarían una marca si bond invocara a alguien.
		const bin = join(home, "bin");
		mkdirSync(bin, { recursive: true });
		for (const n of ["pi", "claude", "codex", "agy", "copilot", "gemini", "opencode"]) {
			writeFileSync(join(bin, n), `#!/bin/sh\ntouch "${home}/spawned-${n}"\n`);
			chmodSync(join(bin, n), 0o511);
		}
		const savedPath = process.env.PATH;
		process.env.PATH = bin + ":" + process.env.PATH;
		try {
			const r = run(cwd, home, ["--from", "pi"]);
			expect(r.status).toBe(0);
			expect(r.stdout).toContain("Propuesta de traspaso desde pi");
			// Todos unknown sin eventos: la propuesta sigue siendo útil (criterio de #88).
			expect(r.stdout).toContain("están en `unknown`");
			// El resumen viaja escrito a fichero (D3) y también inline.
			expect(r.stdout).toContain(join(".bond", "handoff"));
			expect(r.stdout).toContain("respuesta final pi");
			expect(r.stdout).toContain('codex "Retoma el trabajo');
			for (const n of ["pi", "claude", "codex", "agy", "copilot", "gemini", "opencode"]) {
				expect(existsSync(join(home, `spawned-${n}`)), `${n} no debió lanzarse`).toBe(false);
			}
			// El resumen quedó realmente en el fichero anunciado.
			expect(existsSync(join(home, ".bond", "handoff"))).toBe(true);
		} finally {
			process.env.PATH = savedPath;
			rmSync(home, { recursive: true, force: true });
			rmSync(cwd, { recursive: true, force: true });
		}
	});
	test("--tail N pasa al resumen", () => {
		const cwd = realpathSync(mkdtempSync(join(tmpdir(), "bond-handoff-cwd-")));
		const home = mkHome(cwd);
		try {
			const r = run(cwd, home, ["--from", "pi", "--tail", "1"]);
			expect(r.status).toBe(0);
			expect(r.stdout).toContain("respuesta final pi");
			expect(r.stdout).not.toContain("hola pi");
		} finally {
			rmSync(home, { recursive: true, force: true });
			rmSync(cwd, { recursive: true, force: true });
		}
	});
	test("fuera de Herdr sin --from: error claro", () => {
		const cwd = realpathSync(mkdtempSync(join(tmpdir(), "bond-handoff-cwd-")));
		const home = mkHome(cwd);
		try {
			const r = run(cwd, home, []);
			expect(r.status).not.toBe(0);
			expect(r.stderr).toContain("--from");
		} finally {
			rmSync(home, { recursive: true, force: true });
			rmSync(cwd, { recursive: true, force: true });
		}
	});
	test("opciones malas: --tail no numérico y argumento desconocido", () => {
		const cwd = realpathSync(mkdtempSync(join(tmpdir(), "bond-handoff-cwd-")));
		const home = mkHome(cwd);
		try {
			expect(run(cwd, home, ["--from", "pi", "--tail", "x"]).status).not.toBe(0);
			expect(run(cwd, home, ["--nope"]).status).not.toBe(0);
		} finally {
			rmSync(home, { recursive: true, force: true });
			rmSync(cwd, { recursive: true, force: true });
		}
	});
	test("--help", () => {
		const cwd = realpathSync(mkdtempSync(join(tmpdir(), "bond-handoff-cwd-")));
		const home = mkHome(cwd);
		try {
			const r = run(cwd, home, ["--help"]);
			expect(r.status).toBe(0);
			expect(r.stdout).toContain("Uso: bond handoff");
		} finally {
			rmSync(home, { recursive: true, force: true });
			rmSync(cwd, { recursive: true, force: true });
		}
	});
});
