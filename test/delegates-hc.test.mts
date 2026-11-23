import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import {
	delegateKill,
	delegatePrompt,
	delegateRead,
	delegateStart,
	delegateTransport,
	delegateWait,
	isBondApp,
	preparePane,
	visibleScreen,
} from "../cli/herdr.mts";
import { hcPrompt, hcWait } from "../cli/hc.mts";
import { resolveEngine, DEFAULT_ENGINE } from "../cli/team.mts";

describe("D-BB / C1 / C2: transporte hc en bond tras BOND_APP", () => {
	let binDir: string;
	let logDir: string;
	let herdrLog: string;
	let hcLog: string;
	const origPath = process.env.PATH;
	const origBondApp = process.env.BOND_APP;

	beforeEach(() => {
		binDir = realpathSync(mkdtempSync(join(tmpdir(), "bond-bin-")));
		logDir = realpathSync(mkdtempSync(join(tmpdir(), "bond-logs-")));
		herdrLog = join(logDir, "herdr.log");
		hcLog = join(logDir, "hc.log");

		// Doble falso: fake herdr
		const herdrFile = join(binDir, process.platform === "win32" ? "herdr.cmd" : "herdr");
		const herdrContent = process.platform === "win32"
			? `@echo off\necho %* >> "${herdrLog}"\necho {"result":{}}`
			: `#!/bin/sh\necho "$@" >> "${herdrLog}"\necho '{"result":{}}'`;
		writeFileSync(herdrFile, herdrContent, { mode: 0o755 });

		// Doble falso: fake hc
		const hcFile = join(binDir, process.platform === "win32" ? "hc.cmd" : "hc");
		const hcContent = process.platform === "win32"
			? `@echo off\necho %* >> "${hcLog}"\nif "%1"=="read" (echo screen-content) else (echo {"address":"t-mock-1","status":"done"})`
			: `#!/bin/sh\necho "$@" >> "${hcLog}"\nif [ "$1" = "read" ]; then echo 'screen-content'; else echo '{"address":"t-mock-1","status":"done"}'; fi`;
		writeFileSync(hcFile, hcContent, { mode: 0o755 });

		process.env.PATH = `${binDir}${delimiter}${origPath}`;
		delete process.env.BOND_APP;
	});

	afterEach(() => {
		process.env.PATH = origPath;
		if (origBondApp !== undefined) process.env.BOND_APP = origBondApp;
		else delete process.env.BOND_APP;
		rmSync(binDir, { recursive: true, force: true });
		rmSync(logDir, { recursive: true, force: true });
	});

	const readHerdrCalls = (): string[] => {
		try {
			return require("node:fs").readFileSync(herdrLog, "utf8").trim().split("\n").filter(Boolean);
		} catch {
			return [];
		}
	};

	const readHcCalls = (): string[] => {
		try {
			return require("node:fs").readFileSync(hcLog, "utf8").trim().split("\n").filter(Boolean);
		} catch {
			return [];
		}
	};

	describe("selección de transporte (isBondApp, delegateTransport, resolveEngine)", () => {
		test("isBondApp evalúa estrictamente BOND_APP=1", () => {
			expect(isBondApp({ BOND_APP: "1" })).toBe(true);
			expect(isBondApp({})).toBe(false);
			expect(isBondApp({ BOND_APP: "0" })).toBe(false);
			expect(isBondApp({ BOND_APP: "false" })).toBe(false);
			expect(isBondApp({ BOND_APP: "" })).toBe(false);
		});

		test("delegateTransport devuelve hc solo con BOND_APP=1", () => {
			expect(delegateTransport({ BOND_APP: "1" })).toBe("hc");
			expect(delegateTransport({})).toBe("herdr");
			expect(delegateTransport({ BOND_APP: "0" })).toBe("herdr");
		});

		test("resolveEngine por defecto: hc con BOND_APP=1, herdr sin variable", () => {
			expect(resolveEngine(undefined, { BOND_APP: "1" })).toBe("hc");
			expect(resolveEngine(undefined, {})).toBe(DEFAULT_ENGINE);
			expect(resolveEngine(undefined, { BOND_APP: "0" })).toBe("herdr");
		});

		test("resolveEngine: flag explícito o BOND_TEAM_ENGINE manda sobre BOND_APP", () => {
			expect(resolveEngine("herdr", { BOND_APP: "1" })).toBe("herdr");
			expect(resolveEngine("hc", {})).toBe("hc");
			expect(resolveEngine(undefined, { BOND_APP: "1", BOND_TEAM_ENGINE: "herdr" })).toBe("herdr");
		});
	});

	describe("C1: sin BOND_APP el flujo herdr clásico queda idéntico (test de oro)", () => {
		test("delegateStart llama a herdr agent start sin tocar hc", () => {
			const res = delegateStart({ name: "rev-1", agent: "pi", pane: "p-42" }, {});
			expect(res.name).toBe("rev-1");

			const herdrCalls = readHerdrCalls();
			const hcCalls = readHcCalls();

			expect(hcCalls).toEqual([]);
			expect(herdrCalls.length).toBe(1);
			expect(herdrCalls[0]).toContain("agent start rev-1 --kind pi --pane p-42 --timeout 90000");
		});

		test("delegatePrompt llama a herdr agent prompt sin tocar hc", () => {
			delegatePrompt("rev-1", "haz tests", { wait: true, timeout: 5000 }, {});

			expect(readHcCalls()).toEqual([]);
			const herdrCalls = readHerdrCalls();
			expect(herdrCalls.length).toBe(1);
			expect(herdrCalls[0]).toContain("agent prompt rev-1 haz tests --wait --timeout 5000");
		});

		test("delegateRead llama a herdr agent read sin tocar hc", () => {
			delegateRead("rev-1", { lines: 60, source: "visible" }, {});

			expect(readHcCalls()).toEqual([]);
			const herdrCalls = readHerdrCalls();
			expect(herdrCalls.length).toBe(1);
			expect(herdrCalls[0]).toContain("agent read rev-1 --source visible --lines 60");
		});

		test("delegateWait llama a herdr agent wait sin tocar hc", () => {
			delegateWait("rev-1", { timeout: 3000 }, {});

			expect(readHcCalls()).toEqual([]);
			const herdrCalls = readHerdrCalls();
			expect(herdrCalls.length).toBe(1);
			expect(herdrCalls[0]).toContain("agent wait rev-1 --timeout 3000");
		});

		test("delegateKill llama a herdr agent kill sin tocar hc", () => {
			delegateKill("rev-1", {});

			expect(readHcCalls()).toEqual([]);
			const herdrCalls = readHerdrCalls();
			expect(herdrCalls.length).toBe(1);
			expect(herdrCalls[0]).toContain("agent kill rev-1");
		});

		test("visibleScreen llama a herdr agent read --source visible", () => {
			delete process.env.BOND_APP;
			visibleScreen("rev-1");

			expect(readHcCalls()).toEqual([]);
			const herdrCalls = readHerdrCalls();
			expect(herdrCalls.length).toBe(1);
			expect(herdrCalls[0]).toContain("agent read rev-1 --source visible --lines 60");
		});
	});

	describe("C2: con BOND_APP=1 delegación vía hc (run --bg, read, prompt/send, wait, kill)", () => {
		test("delegateStart invoca hc run --bg --keep --no-parent sin tocar herdr", () => {
			const res = delegateStart({ name: "rev-hc", agent: "pi", cwd: "/tmp/work" }, { BOND_APP: "1" });
			expect(res.name).toBe("rev-hc");
			expect(res.address).toBe("t-mock-1");

			expect(readHerdrCalls()).toEqual([]);
			const hcCalls = readHcCalls();
			expect(hcCalls.length).toBe(1);
			expect(hcCalls[0]).toMatch(/run --bg --keep --no-parent --name rev-hc --cwd \/tmp\/work -- (?:.*\/)?pi/);
		});

		test("delegatePrompt invoca hc send con --wait y --timeout sin tocar herdr", () => {
			delegatePrompt("rev-hc", "revisa el PR", { wait: true, timeout: 10_000 }, { BOND_APP: "1" });

			expect(readHerdrCalls()).toEqual([]);
			const hcCalls = readHcCalls();
			expect(hcCalls.length).toBe(1);
			expect(hcCalls[0]).toContain("send --json --wait --timeout 10 -- rev-hc revisa el PR");
		});

		test("delegateRead invoca hc read --lines sin tocar herdr", () => {
			const out = delegateRead("rev-hc", { lines: 120 }, { BOND_APP: "1" });
			expect(out.trim()).toBe("screen-content");

			expect(readHerdrCalls()).toEqual([]);
			const hcCalls = readHcCalls();
			expect(hcCalls.length).toBe(1);
			expect(hcCalls[0]).toContain("read --lines 120 rev-hc");
		});

		test("delegateWait invoca hc wait --json con --timeout sin tocar herdr", () => {
			delegateWait("rev-hc", { timeout: 8000 }, { BOND_APP: "1" });

			expect(readHerdrCalls()).toEqual([]);
			const hcCalls = readHcCalls();
			expect(hcCalls.length).toBe(1);
			expect(hcCalls[0]).toContain("wait --json --timeout 8 rev-hc");
		});

		test("delegateKill invoca hc kill y hc rm sin tocar herdr", () => {
			delegateKill("rev-hc", { BOND_APP: "1" });

			expect(readHerdrCalls()).toEqual([]);
			const hcCalls = readHcCalls();
			expect(hcCalls.length).toBe(2);
			expect(hcCalls[0]).toContain("kill rev-hc --json");
			expect(hcCalls[1]).toContain("rm rev-hc --json");
		});

		test("visibleScreen con BOND_APP=1 invoca hc read --lines 60", () => {
			process.env.BOND_APP = "1";
			const out = visibleScreen("rev-hc");
			expect(out.trim()).toBe("screen-content");

			expect(readHerdrCalls()).toEqual([]);
			const hcCalls = readHcCalls();
			expect(hcCalls.length).toBe(1);
			expect(hcCalls[0]).toContain("read --lines 60 rev-hc");
		});

		test("preparePane con BOND_APP=1 es no-op y no toca herdr", () => {
			process.env.BOND_APP = "1";
			preparePane("p-test", "agy");

			expect(readHerdrCalls()).toEqual([]);
			expect(readHcCalls()).toEqual([]);
		});

		test("hcPrompt alias de hcSend y hcWait primitivas de hc.mts", () => {
			expect(hcPrompt).toBeDefined();
			expect(hcWait).toBeDefined();
		});
	});

	describe("resolución de PATH de agy en motor hc", () => {
		test("delegateStart con agy incluye --dangerously-skip-permissions", () => {
			delegateStart({ name: "agy-1", agent: "agy", cwd: "/tmp/work" }, { BOND_APP: "1" });
			const hcCalls = readHcCalls();
			expect(hcCalls[0]).toContain("--dangerously-skip-permissions");
		});
	});
});
