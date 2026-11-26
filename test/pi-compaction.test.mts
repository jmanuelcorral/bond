// bond#92: compactación de pi por modelo. Con poco contexto, bond escribe
// compaction.modelOverrides en el settings.json de pi para que compacte antes; solo sus
// entradas (apuntadas en state.json), sin pisar las de la persona ni el resto del fichero.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { piCompactionFor } from "../cli/agents.mts";

const CLI = join(import.meta.dir, "..", "cli");
const url = (f: string) => JSON.stringify(pathToFileURL(join(CLI, f)).href);

let home: string;
let piDir: string;

beforeEach(() => {
	home = realpathSync(mkdtempSync(join(tmpdir(), "bond-pi-compaction-")));
	piDir = join(home, ".pi", "agent");
	mkdirSync(piDir, { recursive: true });
	mkdirSync(join(home, ".bond"), { recursive: true });
	writeFileSync(
		join(home, ".bond", "config.toml"),
		[
			'agents = ["pi"]',
			"[providers.llamaswap]",
			'base_url = "http://127.0.0.1:8080/v1"',
			'apis = ["chat"]',
			"[[providers.llamaswap.models]]",
			'id = "flash-halogen"',
			"context = 131072",
			"[[providers.llamaswap.models]]",
			'id = "tiny"',
			"context = 32768",
			"[[providers.llamaswap.models]]",
			'id = "big"',
			"context = 1000000",
			"[[providers.llamaswap.models]]",
			'id = "unknown"',
		].join("\n"),
	);
});

afterEach(() => {
	rmSync(home, { recursive: true, force: true });
});

/** syncAgents de bond con pi "instalado", en un HOME de prueba. */
function sync(check = false): { status: number | null; stdout: string; stderr: string } {
	return spawnSync(
		process.execPath,
		[
			"-e",
			`
const { syncAgents } = await import(${url("models.mts")});
const { TARGETS, COMPANIONS } = await import(${url("agents.mts")});
for (const t of [...TARGETS, ...Object.values(COMPANIONS).flat()]) t.installed = () => true;
console.log(JSON.stringify(syncAgents({ agents: ["pi"], check: ${check}, quiet: true })));
`,
		],
		{
			env: { ...process.env, HOME: home, USERPROFILE: home, BOND_HOME: join(home, ".bond"), PI_CODING_AGENT_DIR: piDir, NO_COLOR: "1" },
			encoding: "utf8",
			timeout: 30_000,
		},
	);
}

const settings = () => JSON.parse(readFileSync(join(piDir, "settings.json"), "utf8"));
const stale = (r: { stdout: string }) => JSON.parse(r.stdout.trim().split("\n").pop() ?? "[]");

describe("piCompactionFor", () => {
	test("131K: compacta con 32K libres y guarda 15K recientes", () => {
		expect(piCompactionFor(131072)).toEqual({ reserveTokens: 32768, keepRecentTokens: 15728 });
	});
	test("32K: nunca antes que el defecto de pi (16384), sin pasar de la mitad", () => {
		expect(piCompactionFor(32768)).toEqual({ reserveTokens: 16384, keepRecentTokens: 3932 });
		expect(piCompactionFor(16000)?.reserveTokens).toBe(8000);
	});
	test("contexto grande o desconocido: sin ajuste", () => {
		expect(piCompactionFor(1_000_000)).toBeNull();
		expect(piCompactionFor(undefined)).toBeNull();
		expect(piCompactionFor(0)).toBeNull();
	});
});

describe("bond models sync: compaction.modelOverrides de pi (bond#92)", () => {
	test("escribe el ajuste de los modelos pequeños y conserva el resto de settings.json", () => {
		writeFileSync(join(piDir, "settings.json"), `${JSON.stringify({ lastChangelogVersion: "1.5.1", compaction: { enabled: true } }, null, 2)}\n`);
		const r = sync();
		expect(r.status).toBe(0);
		const s = settings();
		expect(s.lastChangelogVersion).toBe("1.5.1");
		expect(s.compaction.enabled).toBe(true);
		expect(s.compaction.modelOverrides).toEqual({
			"llamaswap/flash-halogen": { reserveTokens: 32768, keepRecentTokens: 15728 },
			"llamaswap/tiny": { reserveTokens: 16384, keepRecentTokens: 3932 },
		});
		// Al día: --check no lo da por desfasado.
		expect(stale(sync(true))).toEqual([]);
	});

	test("respeta el ajuste que la persona puso a mano", () => {
		const mine = { reserveTokens: 50000, keepRecentTokens: 10000 };
		writeFileSync(join(piDir, "settings.json"), JSON.stringify({ compaction: { modelOverrides: { "llamaswap/flash-halogen": mine } } }));
		expect(sync().status).toBe(0);
		const o = settings().compaction.modelOverrides;
		expect(o["llamaswap/flash-halogen"]).toEqual(mine);
		expect(o["llamaswap/tiny"]).toEqual({ reserveTokens: 16384, keepRecentTokens: 3932 });
		// Una segunda pasada no lo pisa (no es de bond).
		expect(sync().status).toBe(0);
		expect(settings().compaction.modelOverrides["llamaswap/flash-halogen"]).toEqual(mine);
	});

	test("--check (y bond doctor) da pi por desfasado si falta el ajuste", () => {
		writeFileSync(join(piDir, "settings.json"), "{}\n");
		expect(stale(sync(true))).toContain("pi");
	});

	test("quita sus entradas cuando el modelo ya no lo necesita", () => {
		expect(sync().status).toBe(0);
		const cfg = readFileSync(join(home, ".bond", "config.toml"), "utf8").replace("context = 32768", "context = 400000");
		writeFileSync(join(home, ".bond", "config.toml"), cfg);
		expect(sync().status).toBe(0);
		expect(Object.keys(settings().compaction.modelOverrides)).toEqual(["llamaswap/flash-halogen"]);
	});

	test("un settings.json enlazado (instalación antigua) no se toca", () => {
		const target = join(home, "repo-settings.json");
		writeFileSync(target, "{}\n");
		symlinkSync(target, join(piDir, "settings.json"));
		expect(sync().status).toBe(0);
		expect(readFileSync(target, "utf8")).toBe("{}\n");
	});

	test("sin modelos pequeños, settings.json queda igual byte a byte", () => {
		writeFileSync(join(home, ".bond", "config.toml"), 'agents = ["pi"]\n[providers.p]\nbase_url = "http://x/v1"\napis = ["chat"]\n[[providers.p.models]]\nid = "big"\ncontext = 1000000\n');
		const raw = '{"lastChangelogVersion":"1.5.1"}';
		writeFileSync(join(piDir, "settings.json"), raw);
		expect(sync().status).toBe(0);
		expect(readFileSync(join(piDir, "settings.json"), "utf8")).toBe(raw);
	});
});
