// Pruebas de `bond models` (#73 y #80):
// - #73: bond models sync respeta cfg.agents y no escribe en agentes no seleccionados.
// - #80: Codex usa su cuenta oficial (sin aprovisionar), migración idempotente de bloque huérfano con backup.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const CLI = join(import.meta.dir, "..", "cli");
const BIN_BOND = join(import.meta.dir, "..", "bin", "bond");

let home: string;
let codexDir: string;

beforeEach(() => {
	home = realpathSync(mkdtempSync(join(tmpdir(), "bond-models-test-")));
	codexDir = join(home, ".codex");
	mkdirSync(codexDir, { recursive: true });
	mkdirSync(join(home, ".bond"), { recursive: true });
	writeFileSync(join(home, ".bond", "config.toml"), 'agents = ["pi"]\nproviders = []\n');
});

afterEach(() => {
	rmSync(home, { recursive: true, force: true });
});

const url = (f: string) => JSON.stringify(pathToFileURL(join(CLI, f)).href);

function runNode(script: string, extraEnv: Record<string, string> = {}): { status: number | null; stdout: string; stderr: string } {
	return spawnSync(process.execPath, ["-e", script], {
		env: {
			...process.env,
			HOME: home,
			USERPROFILE: home,
			BOND_HOME: join(home, ".bond"),
			XDG_CONFIG_HOME: join(home, ".config"),
			CODEX_HOME: codexDir,
			NO_COLOR: "1",
			...extraEnv,
		},
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: 30_000,
	});
}

function runBond(args: string[], extraEnv: Record<string, string> = {}): { status: number | null; stdout: string; stderr: string } {
	return spawnSync(process.execPath, [BIN_BOND, ...args], {
		env: {
			...process.env,
			HOME: home,
			USERPROFILE: home,
			BOND_HOME: join(home, ".bond"),
			XDG_CONFIG_HOME: join(home, ".config"),
			CODEX_HOME: codexDir,
			NO_COLOR: "1",
			...extraEnv,
		},
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: 30_000,
	});
}

describe("Issue #73: bond models sync respeta cfg.agents", () => {
	test("syncAgents sin opts.agents solo toma los agentes presentes en cfg.agents", () => {
		const r = runNode(`
const { syncAgents } = await import(${url("models.mts")});
const { TARGETS } = await import(${url("agents.mts")});
const { writeFileSync, mkdirSync } = await import("node:fs");
const { join } = await import("node:path");

// Mock de configuración con solo pi
mkdirSync(join(process.env.BOND_HOME), { recursive: true });
writeFileSync(join(process.env.BOND_HOME, "config.toml"), [
  'agents = ["pi"]',
  '[[providers]]',
  'id = "prov-1"',
  'base_url = "http://127.0.0.1:8080/v1"',
  'apis = ["chat"]',
  '[[providers.models]]',
  'id = "m1"',
].join("\\n"));

// Sobreescribimos installed para simular que todos los targets están instalados
for (const t of TARGETS) {
  t.installed = () => true;
}

const stale = syncAgents({ check: true, quiet: true });
// Solo pi debe ser evaluado y salir como desfasado (porque no existe su models.json aún)
console.log(JSON.stringify(stale));
`);
		expect(r.status).toBe(0);
		const stale = JSON.parse(r.stdout.trim().split("\n").pop() ?? "[]");
		expect(stale).toEqual(["pi"]);
	});

	test("--agent <a> fuerza la sincronización de un agente aunque no esté en cfg.agents", () => {
		const r = runNode(`
const { syncAgents } = await import(${url("models.mts")});
const { TARGETS } = await import(${url("agents.mts")});
const { writeFileSync, mkdirSync } = await import("node:fs");
const { join } = await import("node:path");

mkdirSync(join(process.env.BOND_HOME), { recursive: true });
writeFileSync(join(process.env.BOND_HOME, "config.toml"), [
  'agents = ["pi"]',
  '[[providers]]',
  'id = "prov-1"',
  'base_url = "http://127.0.0.1:8080/v1"',
  'apis = ["chat"]',
  '[[providers.models]]',
  'id = "m1"',
].join("\\n"));

for (const t of TARGETS) {
  t.installed = () => true;
}

const stale = syncAgents({ agents: ["opencode"], check: true, quiet: true });
console.log(JSON.stringify(stale));
`);
		expect(r.status).toBe(0);
		const stale = JSON.parse(r.stdout.trim().split("\n").pop() ?? "[]");
		expect(stale).toEqual(["opencode"]);
	});

	test("agente no soportado en --agent falla con error", () => {
		const r = runNode(`
const { syncAgents } = await import(${url("models.mts")});
syncAgents({ agents: ["codex"] });
`);
		expect(r.status).not.toBe(0);
		expect(r.stderr).toContain("codex");
	});
});

describe("Issue #80: Codex con cuenta oficial y migración de bloque huérfano", () => {
	test("TARGETS no incluye codex", () => {
		const r = runNode(`
const { TARGETS } = await import(${url("agents.mts")});
console.log(JSON.stringify(TARGETS.map(t => t.agent)));
`);
		expect(r.status).toBe(0);
		const agents = JSON.parse(r.stdout.trim().split("\n").pop() ?? "[]");
		expect(agents).not.toContain("codex");
		expect(agents).toEqual(["pi", "opencode", "crush"]);
	});

	test("bond models sync no escribe nada en ~/.codex/config.toml", () => {
		const r = runNode(`
const { syncAgents } = await import(${url("models.mts")});
const { TARGETS } = await import(${url("agents.mts")});
const { writeFileSync, mkdirSync, existsSync } = await import("node:fs");
const { join } = await import("node:path");

mkdirSync(join(process.env.BOND_HOME), { recursive: true });
writeFileSync(join(process.env.BOND_HOME, "config.toml"), [
  'agents = ["codex", "pi"]',
  '[[providers]]',
  'id = "prov-1"',
  'base_url = "http://127.0.0.1:8080/v1"',
  'apis = ["chat", "responses"]',
  '[[providers.models]]',
  'id = "m1"',
].join("\\n"));

for (const t of TARGETS) {
  t.installed = () => true;
}

syncAgents({ quiet: true });
`);
		expect(r.status).toBe(0);
		const codexConfig = join(codexDir, "config.toml");
		expect(existsSync(codexConfig)).toBe(false);
	});

	test("migración: bloque huérfano en ~/.codex/config.toml se elimina con backup y preserva config manual", () => {
		const codexConfig = join(codexDir, "config.toml");
		const originalContent = [
			'model = "gpt-4o"',
			'temperature = 0.7',
			'',
			'# >>> bond >>> generado por `bond models sync`; no editar: cambia ~/.config/bond/config.toml',
			'[model_providers.old_prov]',
			'name = "old_prov"',
			'base_url = "http://127.0.0.1:8080/v1"',
			'# <<< bond <<<',
			'',
			'[user_section]',
			'custom = true',
		].join("\n");
		writeFileSync(codexConfig, originalContent);

		const r = runNode(`
const { syncAgents } = await import(${url("models.mts")});
syncAgents({ quiet: false });
`);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("codex");
		expect(r.stdout).toContain("bloque huérfano eliminado");

		// Comprobar que el contenido manual se preservó y el bloque de bond desapareció
		const updated = readFileSync(codexConfig, "utf8");
		expect(updated).toContain('model = "gpt-4o"');
		expect(updated).toContain("[user_section]");
		expect(updated).toContain("custom = true");
		expect(updated).not.toContain("# >>> bond >>>");
		expect(updated).not.toContain("model_providers.old_prov");
		expect(updated).not.toContain("# <<< bond <<<");

		// Comprobar que se creó backup .bak.* con el contenido original
		const baks = readdirSync(codexDir).filter((f) => f.startsWith("config.toml.bak."));
		expect(baks.length).toBe(1);
		expect(readFileSync(join(codexDir, baks[0]), "utf8")).toBe(originalContent);
	});

	test("migración idempotente: ejecutar dos veces no crea dos backups ni da error", () => {
		const codexConfig = join(codexDir, "config.toml");
		const originalContent = [
			'model = "gpt-4o"',
			'',
			'# >>> bond >>> generado por `bond models sync`; no editar: cambia ~/.config/bond/config.toml',
			'[model_providers.old_prov]',
			'# <<< bond <<<',
		].join("\n");
		writeFileSync(codexConfig, originalContent);

		// Primera pasada
		const r1 = runNode(`
const { syncAgents } = await import(${url("models.mts")});
syncAgents({ quiet: true });
`);
		expect(r1.status).toBe(0);
		const baks1 = readdirSync(codexDir).filter((f) => f.startsWith("config.toml.bak."));
		expect(baks1.length).toBe(1);

		// Segunda pasada
		const r2 = runNode(`
const { syncAgents } = await import(${url("models.mts")});
syncAgents({ quiet: true });
`);
		expect(r2.status).toBe(0);
		const baks2 = readdirSync(codexDir).filter((f) => f.startsWith("config.toml.bak."));
		expect(baks2.length).toBe(1); // No se creó un segundo backup
	});

	test("bond models list muestra nota explicativa de que Codex usa su cuenta oficial", () => {
		mkdirSync(join(home, ".bond"), { recursive: true });
		writeFileSync(
			join(home, ".bond", "config.toml"),
			[
				'agents = ["pi"]',
				"[[providers]]",
				'id = "prov-test"',
				'base_url = "http://127.0.0.1:8080/v1"',
				'apis = ["chat"]',
				"[[providers.models]]",
				'id = "test-model"',
			].join("\n"),
		);

		const r = runBond(["models", "list"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("codex: usa su cuenta oficial; bond no lo aprovisiona");
	});

	test("Codex sigue soportado en SUPPORTED_AGENTS y recibe instrucciones", () => {
		const r = runNode(`
const { SUPPORTED_AGENTS } = await import(${url("repo.mts")});
const { agentInfo } = await import(${url("catalog-agents.mts")});
console.log(JSON.stringify({
  supported: SUPPORTED_AGENTS.includes("codex"),
  hasInfo: !!agentInfo("codex")
}));
`);
		expect(r.status).toBe(0);
		const res = JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}");
		expect(res.supported).toBe(true);
		expect(res.hasInfo).toBe(true);
	});
});
