// El idioma de `bond setup` de cara al usuario: la ayuda en el idioma resuelto, el flag --lang
// (también para la ayuda) y lo que langStep deja en la config. Cada caso corre en su proceso
// con un BOND_HOME temporal, como el resto de la suite.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = join(import.meta.dir, "..");
const MAIN = join(ROOT, "cli", "main.mts");
const CLI = join(ROOT, "cli");
const url = (f: string) => JSON.stringify(pathToFileURL(join(CLI, f)).href);

let home: string;
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "bond-lang-"));
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

const env = (extra: Record<string, string> = {}) => ({
	...process.env,
	BOND_HOME: home,
	HOME: home,
	USERPROFILE: home,
	XDG_CONFIG_HOME: join(home, ".config"),
	NO_COLOR: "1",
	...extra,
});

function bond(args: string[], extra: Record<string, string> = {}) {
	const r = spawnSync(process.execPath, [MAIN, ...args], { env: env(extra), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 });
	return { status: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

/** Un proceso con los módulos de cli/ dentro, con el idioma que se le ponga por entorno. */
function node(script: string, extra: Record<string, string> = {}) {
	const r = spawnSync(process.execPath, ["-e", script], { env: env(extra), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 });
	return { status: r.status ?? -1, out: `${r.stdout}${r.stderr}`, last: r.stdout.trim().split("\n").pop() ?? "" };
}

describe("bond setup --help según el idioma", () => {
	test("BOND_LANG=en da la ayuda en inglés", () => {
		const r = bond(["setup", "--help"], { BOND_LANG: "en" });
		expect(r.out).toContain("Usage: bond setup");
		expect(r.out).toContain("No questions");
		expect(r.out).not.toContain("Uso: bond setup");
		expect(r.out).not.toContain("Sin preguntas");
	});
	test("BOND_LANG=es da la ayuda en español", () => {
		const r = bond(["setup", "--help"], { BOND_LANG: "es" });
		expect(r.out).toContain("Uso: bond setup");
		expect(r.out).toContain("Sin preguntas");
		expect(r.out).not.toContain("Usage: bond setup");
	});
	test("--lang afecta también a la ayuda", () => {
		expect(bond(["setup", "--lang", "en", "--help"], { BOND_LANG: "es" }).out).toContain("Usage: bond setup");
		expect(bond(["setup", "--lang=en", "--help"], { BOND_LANG: "es" }).out).toContain("Usage: bond setup");
		expect(bond(["setup", "--lang", "es", "--help"], { BOND_LANG: "en" }).out).toContain("Uso: bond setup");
	});
	test("--lang sin valor o con un idioma que no existe es una opción desconocida", () => {
		const noValue = bond(["setup", "--lang"], { BOND_LANG: "en" });
		expect(noValue.status).not.toBe(0);
		expect(noValue.out).toContain("unknown option: --lang");
		const bad = bond(["setup", "--lang", "fr"], { BOND_LANG: "en" });
		expect(bad.status).not.toBe(0);
		expect(bad.out).toContain("unknown option: --lang fr");
	});
});

describe("langStep", () => {
	test("--lang guarda el idioma en la config y lo aplica al momento", () => {
		const r = node(`
const { langStep } = await import(${url("wizard.mts")});
const { saveConfig, loadConfig } = await import(${url("config.mts")});
const { lang } = await import(${url("messages.mts")});
const cfg = { agents: ["pi"], providers: [] };
await langStep(cfg, false, "en");
const antes = lang();
saveConfig(cfg);
console.log(JSON.stringify({ antes, ui: cfg.ui, leido: loadConfig().ui }));
`);
		expect(r.status).toBe(0);
		const got = JSON.parse(r.last);
		expect(got.antes).toBe("en");
		expect(got.ui).toEqual({ lang: "en" });
		expect(got.leido).toEqual({ lang: "en" });
		expect(readFileSync(join(home, "config.toml"), "utf8")).toContain('lang = "en"');
	});
	test("con BOND_LANG no se pregunta y no se escribe en la config: manda la variable", () => {
		const r = node(
			`
const { langStep } = await import(${url("wizard.mts")});
const { lang } = await import(${url("messages.mts")});
const cfg = { agents: ["pi"], providers: [] };
await langStep(cfg, false);
console.log(JSON.stringify({ lang: lang(), ui: cfg.ui }));
`,
			{ BOND_LANG: "en" },
		);
		expect(r.status).toBe(0);
		const got = JSON.parse(r.last);
		expect(got.lang).toBe("en");
		expect(got.ui).toBeUndefined();
	});
	test("sin flag, el asistente arranca en el idioma de la config ya guardada", () => {
		node(`
const { langStep } = await import(${url("wizard.mts")});
const { saveConfig } = await import(${url("config.mts")});
const cfg = { agents: ["pi"], providers: [] };
await langStep(cfg, false, "en");
saveConfig(cfg);
`);
		// Sin BOND_LANG: la config de este HOME temporal es lo que resuelve el idioma.
		const r = node(
			`
const { loadConfigOrEmpty } = await import(${url("config.mts")});
const { langStep } = await import(${url("wizard.mts")});
const { lang } = await import(${url("messages.mts")});
const cfg = loadConfigOrEmpty();
await langStep(cfg, false);
console.log(JSON.stringify({ lang: lang(), ui: cfg.ui }));
`,
			{ BOND_LANG: "" },
		);
		expect(r.status).toBe(0);
		const got = JSON.parse(r.last);
		expect(got.lang).toBe("en");
		expect(got.ui).toEqual({ lang: "en" });
	});
});
