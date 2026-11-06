// Pruebas del núcleo de presupuesto (epic #84, #86): normalización de eventos de hooks,
// lectura del transcript de Codex (decisión 2026-11-06), fusión de hooks.json sin tocar lo
// ajeno (la entrada de herdr) y fail-open del hook.

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { hookEvent, parseCodexTranscript, stateFromCodex, appendEvent, readEvents, mergeAgentHooks, ensureBudgetHooks, eventsDir, LOW_PCT } from "../cli/budget.mts";

const REPO = join(import.meta.dir, "..");

let base: string;
beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "bond-budget-"));
	process.env.BOND_EVENTS_DIR = join(base, "events");
});
afterEach(() => {
	rmSync(base, { recursive: true, force: true });
	delete process.env.BOND_EVENTS_DIR;
});

describe("hookEvent: normalización del JSON de cada agente", () => {
	test("Stop de Codex: evento, sesión y transcript", () => {
		const raw = JSON.stringify({
			session_id: "01a1affc",
			turn_id: "01a1affc-3b8a",
			transcript_path: "/home/x/.codex/sessions/2026/11/06/rollout-x.jsonl",
			cwd: "/tmp",
			hook_event_name: "Stop",
			model: "gpt-6-luna",
		});
		const ev = hookEvent("codex", raw, "2026-11-06T09:31:45.000Z");
		expect(ev).toMatchObject({ ts: "2026-11-06T09:31:45.000Z", agent: "codex", event: "stop", session_id: "01a1affc", transcript_path: "/home/x/.codex/sessions/2026/11/06/rollout-x.jsonl", cwd: "/tmp" });
	});

	test("PreCompact de Claude → pre_compact", () => {
		const ev = hookEvent("claude", JSON.stringify({ hook_event_name: "PreCompact", session_id: "s1" }), "2026-11-06T10:00:00.000Z");
		expect(ev.event).toBe("pre_compact");
		expect(ev.session_id).toBe("s1");
	});

	test("session.idle de opencode → idle", () => {
		expect(hookEvent("opencode", JSON.stringify({ event: "session.idle" }), "t").event).toBe("idle");
	});

	test("session_compact de pi → compact", () => {
		expect(hookEvent("pi", JSON.stringify({ event: "session_compact" }), "t").event).toBe("compact");
	});

	test("stdin que no es JSON → raw (señal de vida, no error)", () => {
		expect(hookEvent("codex", "no soy json", "t").event).toBe("raw");
		expect(hookEvent("codex", "", "t").event).toBe("raw");
	});
});

describe("parseCodexTranscript: último token_count del rollout", () => {
	const tokenCount = (used: number, extra = "") =>
		JSON.stringify({
			timestamp: "2026-11-06T08:31:47.241Z",
			ordinal: 16,
			type: "event_msg",
			payload: {
				type: "token_count",
				info: { total_token_usage: { total_tokens: 13_911 }, model_context_window: 258_400 },
				rate_limits: { limit_id: "codex", primary: { used_percent: used, window_minutes: 43_200, resets_at: 1_796_402_806 }, secondary: null, rate_limit_reached_type: null, credits: { has_credits: false } },
			},
		}) + extra;

	test("extrae used_percent, ventana, reset y context window", () => {
		const b = parseCodexTranscript(`{"type":"session_meta"}\n${tokenCount(19)}\n`);
		expect(b).toEqual({ usedPct: 19, windowMinutes: 43_200, resetAt: 1_796_402_806, reachedType: null, contextWindow: 258_400 });
	});

	test("se queda con el último token_count", () => {
		const b = parseCodexTranscript(`${tokenCount(10)}\n${tokenCount(42)}\n`);
		expect(b?.usedPct).toBe(42);
	});

	test("línea corrupta no corta el scan", () => {
		const b = parseCodexTranscript(`${tokenCount(10)}\n{roto\n${tokenCount(30)}\n`);
		expect(b?.usedPct).toBe(30);
	});

	test("sin token_count → undefined", () => {
		expect(parseCodexTranscript('{"type":"event_msg","payload":{"type":"task_complete"}}\n')).toBeUndefined();
	});

	test("token_count sin rate_limits → undefined de números pero no peto", () => {
		const line = JSON.stringify({ type: "event_msg", payload: { type: "token_count", info: { model_context_window: 100 } } });
		const b = parseCodexTranscript(line + "\n");
		expect(b?.usedPct).toBeUndefined();
		expect(b?.contextWindow).toBe(100);
	});
});

describe("stateFromCodex", () => {
	test("rate_limit_reached_type → exhausted", () => {
		expect(stateFromCodex({ reachedType: "team_plan_limit" })).toBe("exhausted");
	});
	test(">=100% → exhausted; >= umbral → low; resto ok; sin datos unknown", () => {
		expect(stateFromCodex({ usedPct: 100 })).toBe("exhausted");
		expect(stateFromCodex({ usedPct: LOW_PCT })).toBe("low");
		expect(stateFromCodex({ usedPct: LOW_PCT - 1 })).toBe("ok");
		expect(stateFromCodex({})).toBe("unknown");
	});
});

describe("event log", () => {
	test("round-trip append/read ordenado", () => {
		appendEvent({ ts: "2026-11-05T10:00:00.000Z", agent: "codex", event: "stop" });
		appendEvent({ ts: "2026-11-06T09:00:00.000Z", agent: "claude", event: "notification" });
		const evs = readEvents(new Date("2026-11-06T12:00:00Z"));
		expect(evs.map((e) => e.agent)).toEqual(["codex", "claude"]);
	});

	test("fichero fuera de la ventana de 7 días se purga", () => {
		mkdirSync(eventsDir(), { recursive: true });
		writeFileSync(join(eventsDir(), "2026-10-01.jsonl"), JSON.stringify({ ts: "2026-10-01T00:00:00Z", agent: "codex", event: "stop" }) + "\n");
		// mtime viejo para que caiga fuera de la ventana
		utimesSync(join(eventsDir(), "2026-10-01.jsonl"), new Date("2026-10-01T00:00:00Z"), new Date("2026-10-01T00:00:00Z"));
		expect(readEvents(new Date("2026-11-06T12:00:00Z"))).toEqual([]);
		expect(existsSync(join(eventsDir(), "2026-10-01.jsonl"))).toBe(false);
	});
});

describe("mergeAgentHooks: la nuestra se identifica por marker, lo ajeno intacto", () => {
	const HERDR = { hooks: { Stop: [{ hooks: [{ type: "command", command: "bash '/home/x/.codex/herdr-agent-state.sh' idle", timeout: 10 }] }] } };

	test("añade la nuestra dejando la de herdr", () => {
		const { doc, changed } = mergeAgentHooks(HERDR, ["Stop"], "bond budget-hook codex", "budget-hook codex");
		expect(changed).toBe(true);
		const stop = (doc as any).hooks.Stop;
		expect(stop.length).toBe(2);
		expect(JSON.stringify(stop[0])).toContain("herdr-agent-state.sh");
		expect(JSON.stringify(stop[1])).toContain("budget-hook codex");
	});

	test("idempotente: aplicar dos veces no cambia nada", () => {
		const once = mergeAgentHooks(HERDR, ["Stop"], "bond budget-hook codex", "budget-hook codex").doc;
		const twice = mergeAgentHooks(once, ["Stop"], "bond budget-hook codex", "budget-hook codex");
		expect(twice.changed).toBe(false);
	});

	test("no pisa el JSON ajeno ilegible: ensureBudgetHooks lo reporta sin apply", () => {
		const home = join(base, "home");
		mkdirSync(join(home, ".codex"), { recursive: true });
		writeFileSync(join(home, ".codex", "hooks.json"), "{esto no es json");
		const [inst] = ensureBudgetHooks(["codex"], { home });
		expect(inst.needed).toBe(true);
		expect(inst.apply).toBeUndefined();
	});

	test("ensureBudgetHooks crea el hooks.json de codex y es idempotente", () => {
		const home = join(base, "home2");
		const first = ensureBudgetHooks(["codex"], { home });
		expect(first.length).toBe(1);
		first[0].apply!();
		const doc = JSON.parse(readFileSync(join(home, ".codex", "hooks.json"), "utf8"));
		expect(JSON.stringify(doc)).toContain("budget-hook codex");
		expect(ensureBudgetHooks(["codex"], { home })).toEqual([]);
		// agentes sin destino (pi, agy en esta capa) no generan nada
		expect(ensureBudgetHooks(["pi", "agy", "copilot"], { home })).toEqual([]);
	});
});

describe("bond budget-hook: fail-open", () => {
	const runHook = (args: string[], input: string) =>
		spawnSync(process.execPath, [join(REPO, "cli/main.mts"), "budget-hook", ...args], { input, encoding: "utf8", timeout: 15_000 });

	test("stdin basura → exit 0 y evento raw registrado", () => {
		const r = runHook(["codex"], "no soy json");
		expect(r.status).toBe(0);
		const evs = readEvents();
		expect(evs.length).toBe(1);
		expect(evs[0]).toMatchObject({ agent: "codex", event: "raw" });
	});

	test("agente desconocido → exit 0 sin registrar", () => {
		const r = runHook(["agente-falso"], "{}");
		expect(r.status).toBe(0);
	});

	test("Stop real de codex → evento stop con transcript", () => {
		const r = runHook(["codex"], JSON.stringify({ hook_event_name: "Stop", transcript_path: "/x/y.jsonl", session_id: "s" }));
		expect(r.status).toBe(0);
		expect(readEvents()[0]).toMatchObject({ agent: "codex", event: "stop", transcript_path: "/x/y.jsonl" });
	});
});
