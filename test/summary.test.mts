// Pruebas del resumen de sesión determinista (#87): parsers por formato (fixtures recortados
// de sesiones reales), recorte por N y por tamaño, detección de la sesión más reciente en un
// home falso, estado de repo con git y render pegable. Sin red y sin LLM por construcción.

import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findSessionFile, renderSessionSummary, summarizeSession } from "../cli/summary.mts";
import { setLang } from "../cli/messages.mts";

const FIX = join(import.meta.dir, "fixtures", "summary");
const NOW = new Date("2026-11-09T12:00:00.000Z");
const base = { repoContext: false as const, now: NOW };

describe("summarizeSession: parsers por formato", () => {
	test("pi: mensajes user/assistant, fuera razonamiento, tool results y línea corrupta", () => {
		const s = summarizeSession("pi", { ...base, sessionFile: join(FIX, "pi.jsonl") });
		expect(s.exchanges.map((x) => x.role)).toEqual(["user", "assistant", "user", "assistant"]);
		expect(s.exchanges[3].text).toBe("respuesta final pi");
		expect(s.model).toBe("test-model");
		expect(s.generatedAt).toBe(NOW.toISOString());
		expect(s.sessionFile).toBe(join(FIX, "pi.jsonl"));
	});
	test("claude: content string o bloques, fuera sidechain y tool results", () => {
		const s = summarizeSession("claude", { ...base, sessionFile: join(FIX, "claude.jsonl") });
		expect(s.exchanges.map((x) => x.role)).toEqual(["user", "assistant", "assistant"]);
		expect(s.exchanges.map((x) => x.text)).toEqual(["hola claude", "primera respuesta claude", "respuesta final claude"]);
		expect(s.model).toBe("claude-test");
	});
	test("codex: fuera developer y bloques de contexto; modelo del turn_context", () => {
		const s = summarizeSession("codex", { ...base, sessionFile: join(FIX, "codex.jsonl") });
		expect(s.exchanges.map((x) => x.role)).toEqual(["user", "assistant"]);
		expect(s.exchanges[0].text).toBe("hola codex");
		expect(s.exchanges[1].text).toBe("respuesta final codex");
		expect(s.model).toBe("gpt-6-test");
	});
	test("agy: USER_EXPLICIT y PLANNER_RESPONSE, fuera SYSTEM y GENERIC; desenuelve <USER_REQUEST>", () => {
		const s = summarizeSession("agy", { ...base, sessionFile: join(FIX, "agy.jsonl") });
		expect(s.exchanges.map((x) => x.role)).toEqual(["user", "assistant", "assistant"]);
		expect(s.exchanges[0].text).toBe("revisar el repo");
		expect(s.exchanges[2].text).toBe("respuesta final agy");
		expect(s.model).toBeUndefined();
	});
	test("determinista: mismo input y reloj fijo → mismo resumen", () => {
		const f = { ...base, sessionFile: join(FIX, "pi.jsonl") };
		expect(JSON.stringify(summarizeSession("pi", f))).toBe(JSON.stringify(summarizeSession("pi", f)));
	});
	test("recorte: solo los últimos N intercambios, en orden cronológico", () => {
		const s = summarizeSession("pi", { ...base, sessionFile: join(FIX, "pi.jsonl"), n: 2 });
		expect(s.exchanges.map((x) => x.text)).toEqual(["segunda pregunta", "respuesta final pi"]);
	});
	test("recorte: intercambios largos se cortan con «…»", () => {
		const dir = mkdtempSync(join(tmpdir(), "bond-summary-clip-"));
		try {
			const f = join(dir, "larga.jsonl");
			writeFileSync(f, JSON.stringify({ type: "message", message: { role: "assistant", content: [{ type: "text", text: "x".repeat(500) }] } }) + "\n");
			const s = summarizeSession("pi", { ...base, sessionFile: f, maxChars: 60 });
			expect(s.exchanges[0].text.length).toBe(60);
			expect(s.exchanges[0].text.endsWith("…")).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("summarizeSession: errores claros", () => {
	test("agente no soportado (opencode fuera del alcance, decisión 2026-11-09)", () => {
		expect(() => summarizeSession("opencode")).toThrow();
		expect(() => summarizeSession("gemini")).toThrow();
	});
	test("sin sesión y fichero ilegible o sin intercambios", () => {
		expect(() => summarizeSession("pi", { ...base, sessionFile: join(FIX, "no-existe.jsonl") })).toThrow();
		expect(() => summarizeSession("pi", { ...base, cwd: join(tmpdir(), "bond-sin-sesion-" + Date.now()) })).toThrow();
		expect(() => summarizeSession("pi", { ...base, sessionFile: join(FIX, "noise.jsonl") })).toThrow();
	});
});

describe("findSessionFile: sesión más reciente en el home", () => {
	test("cada agente encuentra su transcript por cwd y mtime", () => {
		const h = mkdtempSync(join(tmpdir(), "bond-summary-home-"));
		try {
			const read = (f: string) => readFileSync(join(FIX, f), "utf8");
			const cwd = "/repo-test";
			mkdirSync(join(h, ".pi/agent/sessions/proj"), { recursive: true });
			writeFileSync(join(h, ".pi/agent/sessions/proj/vieja.jsonl"), read("pi.jsonl"));
			utimesSync(join(h, ".pi/agent/sessions/proj/vieja.jsonl"), new Date(0), new Date(0));
			writeFileSync(join(h, ".pi/agent/sessions/proj/nueva.jsonl"), read("pi.jsonl"));
			mkdirSync(join(h, ".claude/projects/p1"), { recursive: true });
			writeFileSync(join(h, ".claude/projects/p1/s1.jsonl"), read("claude.jsonl"));
			mkdirSync(join(h, ".codex/sessions/2026/11/09"), { recursive: true });
			writeFileSync(join(h, ".codex/sessions/2026/11/09/rollout-x.jsonl"), read("codex.jsonl"));
			mkdirSync(join(h, ".gemini/antigravity-cli/brain/id1/.system_generated/logs"), { recursive: true });
			writeFileSync(join(h, ".gemini/antigravity-cli/brain/id1/.system_generated/logs/transcript.jsonl"), read("agy.jsonl"));

			const saved = process.env.PI_CODING_AGENT_SESSION_DIR;
			delete process.env.PI_CODING_AGENT_SESSION_DIR;
			try {
				expect(findSessionFile("pi", { home: h, cwd })).toBe(join(h, ".pi/agent/sessions/proj/nueva.jsonl"));
				expect(findSessionFile("claude", { home: h, cwd })).toContain(join(".claude/projects/p1", "s1.jsonl"));
				expect(findSessionFile("codex", { home: h, cwd })).toContain("rollout-x.jsonl");
				expect(findSessionFile("agy", { home: h, cwd })).toContain("transcript.jsonl");
				// cwd ajeno: pi no cae una sesión de otro proyecto
				expect(findSessionFile("pi", { home: h, cwd: "/otro-repo" })).toBeUndefined();
			} finally {
				if (saved !== undefined) process.env.PI_CODING_AGENT_SESSION_DIR = saved;
			}
		} finally {
			rmSync(h, { recursive: true, force: true });
		}
	});
});

describe("estado del repo y render", () => {
	test("git status y git diff --stat de un repo con cambios", () => {
		const dir = mkdtempSync(join(tmpdir(), "bond-summary-repo-"));
		try {
			const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: ["ignore", "pipe", "ignore"] });
			git("init", "-q");
			git("config", "user.email", "t@t");
			git("config", "user.name", "t");
			writeFileSync(join(dir, "a.txt"), "uno\n");
			git("add", "a.txt");
			git("commit", "-qm", "init");
			writeFileSync(join(dir, "a.txt"), "dos\n");
			const s = summarizeSession("pi", { sessionFile: join(FIX, "pi.jsonl"), now: NOW, cwd: dir });
			expect(s.repo?.status).toContain("M a.txt");
			expect(s.repo?.diffStat).toContain("a.txt");
			// fuera de un repo: sin sección, sin petar
			const fuera = summarizeSession("pi", { sessionFile: join(FIX, "pi.jsonl"), now: NOW, cwd: tmpdir() });
			expect(fuera.repo).toBeUndefined();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
	test("render: markdown pegable con cabecera trazable", () => {
		setLang("es");
		const md = renderSessionSummary(summarizeSession("pi", { ...base, sessionFile: join(FIX, "pi.jsonl") }));
		expect(md).toContain("# Resumen de sesión — pi");
		expect(md).toContain("test-model");
		expect(md).toContain(NOW.toISOString());
		expect(md).toContain("**Usuario:**");
		expect(md).toContain("respuesta final pi");
		expect(md).not.toContain("## Estado del repo");
	});
});
