import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, stringify } from "smol-toml";
import * as p from "@clack/prompts";
import { defaultCommand, hasExistingInstallEvidence, type Config } from "../cli/config.mts";

const ROOT = join(import.meta.dir, "..");
const MAIN = join(ROOT, "cli", "main.mts");

let home: string;
let binDir: string;
const origBondHome = process.env.BOND_HOME;
const origXdg = process.env.XDG_CONFIG_HOME;

beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "bond-app-test-home-"));
	binDir = mkdtempSync(join(tmpdir(), "bond-app-test-bin-"));
	process.env.BOND_HOME = home;
	process.env.XDG_CONFIG_HOME = join(home, ".config");
});

afterEach(() => {
	if (origBondHome !== undefined) process.env.BOND_HOME = origBondHome;
	else delete process.env.BOND_HOME;
	if (origXdg !== undefined) process.env.XDG_CONFIG_HOME = origXdg;
	else delete process.env.XDG_CONFIG_HOME;
	rmSync(home, { recursive: true, force: true });
	rmSync(binDir, { recursive: true, force: true });
});

const env = (extra: Record<string, string> = {}) => ({
	...process.env,
	BOND_HOME: home,
	HOME: home,
	USERPROFILE: home,
	XDG_CONFIG_HOME: join(home, ".config"),
	NO_COLOR: "1",
	...extra,
});

function bond(args: string[], extra: Record<string, string> = {}, cwd?: string) {
	const r = spawnSync(process.execPath, [MAIN, ...args], {
		env: env(extra),
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: 60_000,
	});
	return { status: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

describe("default_command setting in config.toml (D21)", () => {
	test("instalación nueva sin config.toml ni indicios: defaultCommand devuelve 'app'", () => {
		expect(hasExistingInstallEvidence()).toBe(false);
		expect(defaultCommand()).toBe("app");
	});

	test("instalación existente sin default_command: defaultCommand devuelve 'dev' (conserva comportamiento)", () => {
		const cfgFile = join(home, "config.toml");
		writeFileSync(cfgFile, stringify({ agents: ["pi"], providers: {} }));
		expect(hasExistingInstallEvidence()).toBe(true);
		expect(defaultCommand()).toBe("dev");
	});

	test("default_command = 'app' en config.toml devuelve 'app'", () => {
		const cfgFile = join(home, "config.toml");
		writeFileSync(cfgFile, stringify({ agents: ["pi"], default_command: "app", providers: {} }));
		expect(defaultCommand()).toBe("app");
	});

	test("default_command = 'dev' en config.toml devuelve 'dev'", () => {
		const cfgFile = join(home, "config.toml");
		writeFileSync(cfgFile, stringify({ agents: ["pi"], default_command: "dev", providers: {} }));
		expect(defaultCommand()).toBe("dev");
	});
});

describe("evidencia de instalación previa sin config.toml (M2)", () => {
	test("state.json sin config.toml cuenta como instalación existente: defaultCommand devuelve 'dev'", () => {
		writeFileSync(join(home, "state.json"), JSON.stringify({ version: "1.14.0" }));
		expect(hasExistingInstallEvidence()).toBe(true);
		expect(defaultCommand()).toBe("dev");
	});

	test("AGENTS.md sin config.toml cuenta como instalación existente: defaultCommand devuelve 'dev'", () => {
		writeFileSync(join(home, "AGENTS.md"), "# Mis instrucciones\n");
		expect(hasExistingInstallEvidence()).toBe(true);
		expect(defaultCommand()).toBe("dev");
	});

	test("keys/ con ficheros sin config.toml cuenta como instalación existente: defaultCommand devuelve 'dev'", () => {
		const keysDir = join(home, "keys");
		mkdirSync(keysDir, { recursive: true });
		writeFileSync(join(keysDir, "openai"), "sk-test-key");
		expect(hasExistingInstallEvidence()).toBe(true);
		expect(defaultCommand()).toBe("dev");
	});

	test("events/ con ficheros sin config.toml cuenta como instalación existente: defaultCommand devuelve 'dev'", () => {
		const eventsDir = join(home, "events");
		mkdirSync(eventsDir, { recursive: true });
		writeFileSync(join(eventsDir, "2026-11-13.jsonl"), "{}\n");
		expect(hasExistingInstallEvidence()).toBe(true);
		expect(defaultCommand()).toBe("dev");
	});

	test("instalación existente solo con state.json: --yes no fuerza 'app'", () => {
		writeFileSync(join(home, "state.json"), JSON.stringify({ version: "1.14.0" }));
		const r = bond(["setup", "--yes"]);
		expect(r.status).toBe(0);

		const cfgFile = join(home, "config.toml");
		const raw = parse(readFileSync(cfgFile, "utf8")) as Record<string, unknown>;
		expect(raw.default_command).toBeUndefined();
		expect(defaultCommand()).toBe("dev");
	});
});

describe("bond app", () => {
	test("ayuda con --help y -h", () => {
		const r1 = bond(["app", "--help"], { BOND_LANG: "es" });
		expect(r1.status).toBe(0);
		expect(r1.out).toContain("Uso: bond app");
		expect(r1.out).toContain("Arranca bond-app");

		const r2 = bond(["app", "-h"], { BOND_LANG: "en" });
		expect(r2.status).toBe(0);
		expect(r2.out).toContain("Usage: bond app");
		expect(r2.out).toContain("Starts bond-app");
	});

	test("sin bond-app en el PATH falla con código 1 y explica instalación local (M3, criterio 4)", () => {
		const r = bond(["app"], { PATH: "/nonexistent-path-for-bond-test", BOND_LANG: "es" });
		expect(r.status).toBe(1);
		expect(r.out).toContain("bond-app no está instalado");
		expect(r.out).toContain("clon o paquete local");
		expect(r.out).not.toContain("npm install -g bond-app\n");
	});

	test("rechaza opciones desconocidas con código 1 (L2)", () => {
		const r = bond(["app", "--unknown-flag"], { BOND_LANG: "es" });
		expect(r.status).toBe(1);
		expect(r.out).toContain("Opción desconocida para bond app: --unknown-flag");
	});

	test("exige valor para opciones con argumento (L2)", () => {
		const r = bond(["app", "--port"], { BOND_LANG: "es" });
		expect(r.status).toBe(1);
		expect(r.out).toContain("La opción --port requiere un valor");
	});

	test("con bond-app en PATH: ejecuta install, open y start en orden", () => {
		const logFile = join(home, "mock-bond-app.log");
		const mockBin = join(binDir, "bond-app");
		const script = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(logFile)}, args.join(' ') + '\\n');
if (args[0] === 'start') {
  process.exit(0);
}
process.exit(0);
`;
		writeFileSync(mockBin, script);
		chmodSync(mockBin, 0o755);

		const r = bond(["app"], { PATH: `${binDir}:${process.env.PATH}` });
		expect(r.status).toBe(0);

		expect(existsSync(logFile)).toBe(true);
		const calls = readFileSync(logFile, "utf8").trim().split("\n");
		expect(calls).toEqual(["install", "open", "start"]);
	});

	test("propaga consistencia de --port/--api, --host, --home y --data-dir (L2)", () => {
		const logFile = join(home, "mock-bond-app.log");
		const mockBin = join(binDir, "bond-app");
		const script = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(logFile)}, args.join(' ') + '\\n');
process.exit(0);
`;
		writeFileSync(mockBin, script);
		chmodSync(mockBin, 0o755);

		const dataDir = join(home, "custom-data");
		const homeDir = join(home, "custom-herdr-home");
		const r = bond(
			["app", "--port", "8080", "--host", "127.0.0.1", "--data-dir", dataDir, "--home", homeDir],
			{ PATH: `${binDir}:${process.env.PATH}` }
		);
		expect(r.status).toBe(0);

		const lines = readFileSync(logFile, "utf8").trim().split("\n");
		expect(lines).toHaveLength(3);
		// install recibe --api consistente con port/host, --home y --token-file derivado de data-dir
		expect(lines[0]).toBe(`install --api http://127.0.0.1:8080/api/v1 --home ${homeDir} --token-file ${join(dataDir, "token")}`);
		// open recibe --home
		expect(lines[1]).toBe(`open --home ${homeDir}`);
		// start recibe port, host y data-dir
		expect(lines[2]).toBe(`start --port 8080 --host 127.0.0.1 --data-dir ${dataDir}`);
	});

	test("si bond-app install falla, bond app sale con el código de error", () => {
		const mockBin = join(binDir, "bond-app");
		const script = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'install') {
  console.error("install error simulated");
  process.exit(42);
}
process.exit(0);
`;
		writeFileSync(mockBin, script);
		chmodSync(mockBin, 0o755);

		const r = bond(["app"], { PATH: `${binDir}:${process.env.PATH}` });
		expect(r.status).toBe(42);
	});

	test("si bond-app open falla, bond app sale con el código de error", () => {
		const mockBin = join(binDir, "bond-app");
		const script = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'open') {
  console.error("open error simulated");
  process.exit(23);
}
process.exit(0);
`;
		writeFileSync(mockBin, script);
		chmodSync(mockBin, 0o755);

		const r = bond(["app"], { PATH: `${binDir}:${process.env.PATH}` });
		expect(r.status).toBe(23);
	});
});

describe("bond sin subcomando según default_command", () => {
	test("con default_command = 'app', bond a secas ejecuta bond app (criterio 1)", () => {
		const cfgFile = join(home, "config.toml");
		writeFileSync(cfgFile, stringify({ agents: ["pi"], default_command: "app", providers: {} }));

		const logFile = join(home, "mock-bond-app.log");
		const mockBin = join(binDir, "bond-app");
		const script = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(logFile)}, args.join(' ') + '\\n');
process.exit(0);
`;
		writeFileSync(mockBin, script);
		chmodSync(mockBin, 0o755);

		const r = bond([], { PATH: `${binDir}:${process.env.PATH}` });
		expect(r.status).toBe(0);
		expect(existsSync(logFile)).toBe(true);
		const calls = readFileSync(logFile, "utf8").trim().split("\n");
		expect(calls).toEqual(["install", "open", "start"]);
	});

	test("con default_command = 'dev', bond a secas hace lo de hoy (criterio 2)", () => {
		const cfgFile = join(home, "config.toml");
		writeFileSync(cfgFile, stringify({ agents: ["pi"], default_command: "dev", providers: {} }));

		// Fuera de un repo, bond sin subcomando enseña la ayuda
		const r = bond([], {}, home);
		expect(r.status).toBe(0);
		expect(r.out).toContain("Uso: bond [comando]");
	});

	test("bond dev no cambia incluso con default_command = 'app'", () => {
		const cfgFile = join(home, "config.toml");
		writeFileSync(cfgFile, stringify({ agents: ["pi"], default_command: "app", providers: {} }));

		// bond dev --help da la ayuda de launch (puesto de trabajo)
		const r = bond(["dev", "--help"]);
		expect(r.status).toBe(0);
		expect(r.out).toContain("puesto de trabajo");
	});
});

describe("bond setup y regla --yes (criterio 3)", () => {
	test("defaultCommandStep con isNew=true en no interactivo fija 'app'", async () => {
		const { defaultCommandStep } = await import("../cli/wizard.mts");
		const cfg: Config = { agents: ["pi"], providers: [] };
		await defaultCommandStep(cfg, false, true);
		expect(cfg.default_command).toBe("app");
	});

	test("defaultCommandStep con isNew=false en no interactivo respeta undefined", async () => {
		const { defaultCommandStep } = await import("../cli/wizard.mts");
		const cfg: Config = { agents: ["pi"], providers: [] };
		await defaultCommandStep(cfg, false, false);
		expect(cfg.default_command).toBeUndefined();
	});

	test("instalación nueva con --yes guarda default_command = 'app'", () => {
		// En home no hay config.toml previo ni indicios
		const r = bond(["setup", "--yes"]);
		expect(r.status).toBe(0);

		const raw = parse(readFileSync(join(home, "config.toml"), "utf8")) as Record<string, unknown>;
		expect(raw.default_command).toBe("app");
	});

	test("instalación existente sin default_command: --yes no lo cambia (no fuerza 'app')", () => {
		const cfgFile = join(home, "config.toml");
		writeFileSync(cfgFile, stringify({ agents: ["pi"], providers: {} }));

		const r = bond(["setup", "--yes"]);
		expect(r.status).toBe(0);

		// Lee el fichero raw para comprobar que no se ha añadido default_command = "app"
		const text = readFileSync(cfgFile, "utf8");
		expect(text).not.toContain('default_command = "app"');
		expect(defaultCommand()).toBe("dev");
	});

	test("instalación existente con default_command = 'dev': --yes lo conserva", () => {
		const cfgFile = join(home, "config.toml");
		writeFileSync(cfgFile, stringify({ agents: ["pi"], default_command: "dev", providers: {} }));

		const r = bond(["setup", "--yes"]);
		expect(r.status).toBe(0);

		const raw = parse(readFileSync(cfgFile, "utf8")) as Record<string, unknown>;
		expect(raw.default_command).toBe("dev");
	});
});

describe("L3 y M3: asistente interactivo para default_command", () => {
	test("L3: si el usuario elige 'app' pero bond-app no está en PATH y se omite la instalación, mantiene 'dev'", async () => {
		const { defaultCommandStep } = await import("../cli/wizard.mts");
		const cfg: Config = { agents: ["pi"], providers: [] };

		const mockPrompts = {
			...p,
			select: async () => "app",
			text: async () => "",
		};

		await defaultCommandStep(cfg, true, true, mockPrompts as any);
		// Al no estar bond-app en PATH, debe mantenerse/revertirse a "dev"
		expect(cfg.default_command).toBe("dev");
	});

	test("M3: si se introduce una ruta local válida y se confirma, instala desde esa ruta local", async () => {
		const { defaultCommandStep } = await import("../cli/wizard.mts");
		const cfg: Config = { agents: ["pi"], providers: [] };

		// Creamos paquete local simulado
		const localPkgDir = mkdtempSync(join(tmpdir(), "mock-pkg-"));
		const npmLog = join(home, "mock-npm.log");
		const mockNpm = join(binDir, "npm");
		const mockBondApp = join(binDir, "bond-app");

		// mock npm registra sus argumentos y crea el ejecutable bond-app en binDir simulando la instalación global
		const mockNpmScript = `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(${JSON.stringify(npmLog)}, process.argv.slice(2).join(' ') + '\\n');
fs.writeFileSync(${JSON.stringify(mockBondApp)}, '#!/bin/sh\\nexit 0\\n');
fs.chmodSync(${JSON.stringify(mockBondApp)}, 0o755);
process.exit(0);
`;
		writeFileSync(mockNpm, mockNpmScript);
		chmodSync(mockNpm, 0o755);

		const origPath = process.env.PATH;
		process.env.PATH = `${binDir}:${origPath}`;

		const mockPrompts = {
			...p,
			select: async () => "app",
			text: async () => localPkgDir,
			confirm: async () => true,
		};

		try {
			await defaultCommandStep(cfg, true, true, mockPrompts as any);
			expect(existsSync(npmLog)).toBe(true);
			const npmArgs = readFileSync(npmLog, "utf8").trim();
			// Se ejecuta npm install -g <ruta-local>, NUNCA npm install -g bond-app sin ruta
			expect(npmArgs).toBe(`install -g ${localPkgDir}`);
			expect(npmArgs).not.toBe("install -g bond-app");
			expect(cfg.default_command).toBe("app");
		} finally {
			process.env.PATH = origPath;
			rmSync(localPkgDir, { recursive: true, force: true });
		}
	});
});
