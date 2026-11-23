import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";
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
import { globalSkills, globalSkillsDir } from "../cli/setup.mts";
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

	describe("D-CC / C3: variantes hc de skills de delegación según BOND_APP en setup", () => {
		let testHome: string;

		beforeEach(() => {
			testHome = realpathSync(mkdtempSync(join(tmpdir(), "bond-setup-home-")));
		});

		afterEach(() => {
			rmSync(testHome, { recursive: true, force: true });
		});

		const runGlobalSkills = (customHome: string, envVars: Record<string, string> = {}) => {
			const script = `
				const { globalSkills } = await import(${JSON.stringify(pathToFileURL(join(import.meta.dirname, "..", "cli", "setup.mts")).href)});
				globalSkills(false);
			`;
			const cleanEnv = { ...process.env };
			delete cleanEnv.BOND_APP;
			const r = spawnSync(process.execPath, ["-e", script], {
				env: {
					...cleanEnv,
					...envVars,
					HOME: customHome,
					USERPROFILE: customHome,
					BOND_HOME: join(customHome, ".bond"),
					NO_COLOR: "1",
				},
				encoding: "utf8",
			});
			if (r.status !== 0) throw new Error(`setup falló: ${r.stderr || r.stdout}`);
			return r;
		};

		test("globalSkillsDir selecciona variante según BOND_APP", () => {
			expect(globalSkillsDir({})).toMatch(/[/\\]global[/\\]skills$/);
			expect(globalSkillsDir({ BOND_APP: "1" })).toMatch(/[/\\]global[/\\]skills-hc$/);
			expect(globalSkillsDir({ BOND_APP: "0" })).toMatch(/[/\\]global[/\\]skills$/);
		});

		test("sin BOND_APP: se instala la variante clásica byte a byte idéntica a global/skills (test de oro C3)", () => {
			runGlobalSkills(testHome, {});

			const delegateInstalled = join(testHome, ".agents", "skills", "bond-delegate", "SKILL.md");
			const teamInstalled = join(testHome, ".agents", "skills", "bond-team", "SKILL.md");

			expect(existsSync(delegateInstalled)).toBe(true);
			expect(existsSync(teamInstalled)).toBe(true);

			const delegateRef = readFileSync(join(import.meta.dirname, "..", "global", "skills", "bond-delegate", "SKILL.md"), "utf8");
			const teamRef = readFileSync(join(import.meta.dirname, "..", "global", "skills", "bond-team", "SKILL.md"), "utf8");

			expect(readFileSync(delegateInstalled, "utf8")).toBe(delegateRef);
			expect(readFileSync(teamInstalled, "utf8")).toBe(teamRef);

			// La clásica menciona herdr y no hc
			expect(readFileSync(delegateInstalled, "utf8")).toContain("# Delegar en otro agente (Herdr)");
			expect(readFileSync(delegateInstalled, "utf8")).not.toContain("# Delegar en otro agente (hc)");
			expect(readFileSync(teamInstalled, "utf8")).toContain("# Equipo de agentes en worktrees (Herdr)");
			expect(readFileSync(teamInstalled, "utf8")).not.toContain("# Equipo de agentes en worktrees (hc)");
		});

		test("con BOND_APP=1: se instala la variante hc que menciona hc y no herdr", () => {
			runGlobalSkills(testHome, { BOND_APP: "1" });

			const delegateInstalled = join(testHome, ".agents", "skills", "bond-delegate", "SKILL.md");
			const teamInstalled = join(testHome, ".agents", "skills", "bond-team", "SKILL.md");

			expect(existsSync(delegateInstalled)).toBe(true);
			expect(existsSync(teamInstalled)).toBe(true);

			const delegateHcRef = readFileSync(join(import.meta.dirname, "..", "global", "skills-hc", "bond-delegate", "SKILL.md"), "utf8");
			const teamHcRef = readFileSync(join(import.meta.dirname, "..", "global", "skills-hc", "bond-team", "SKILL.md"), "utf8");

			expect(readFileSync(delegateInstalled, "utf8")).toBe(delegateHcRef);
			expect(readFileSync(teamInstalled, "utf8")).toBe(teamHcRef);

			// La variante hc menciona hc y sus comandos y no herdr
			const delegateContent = readFileSync(delegateInstalled, "utf8");
			expect(delegateContent).toContain("# Delegar en otro agente (hc)");
			expect(delegateContent).toContain("hc run --bg");
			expect(delegateContent).toContain("hc send");
			expect(delegateContent).toContain("hc read");
			expect(delegateContent).toContain("hc kill");
			expect(delegateContent).not.toContain("herdr agent start");
			expect(delegateContent).not.toContain("herdr agent prompt");

			const teamContent = readFileSync(teamInstalled, "utf8");
			expect(teamContent).toContain("# Equipo de agentes en worktrees (hc)");
			expect(teamContent).toContain("hc wait");
			expect(teamContent).toContain("hc read");
			expect(teamContent).not.toContain("herdr agent wait");
		});

		test("vigilancia de diferencias mínimas: solo difiere la sección de transporte", () => {
			const delegateClassic = readFileSync(join(import.meta.dirname, "..", "global", "skills", "bond-delegate", "SKILL.md"), "utf8");
			const delegateHc = readFileSync(join(import.meta.dirname, "..", "global", "skills-hc", "bond-delegate", "SKILL.md"), "utf8");

			const extractSection = (content: string, header: string, nextHeader: string) => {
				const start = content.indexOf(header);
				const end = content.indexOf(nextHeader, start);
				return (end !== -1 ? content.slice(start, end) : content.slice(start)).trim();
			};

			// Sección "## Entrada" debe ser exactamente idéntica
			const entradaClassic = extractSection(delegateClassic, "## Entrada", "## Procedimiento");
			const entradaHc = extractSection(delegateHc, "## Entrada", "## Procedimiento");
			expect(entradaHc).toBe(entradaClassic);

			// Memoria de decisiones y runs deben mencionarse en ambas variantes
			expect(delegateHc).toContain("docs/decisions/runs/");
			expect(delegateHc).toContain("bond decisions add");
			expect(delegateHc).toContain("decision-record");

			const teamClassic = readFileSync(join(import.meta.dirname, "..", "global", "skills", "bond-team", "SKILL.md"), "utf8");
			const teamHc = readFileSync(join(import.meta.dirname, "..", "global", "skills-hc", "bond-team", "SKILL.md"), "utf8");

			// Sección "## Entrada" y "## En un hub" en bond-team
			const teamEntradaClassic = extractSection(teamClassic, "## Entrada", "## Procedimiento");
			const teamEntradaHc = extractSection(teamHc, "## Entrada", "## Procedimiento");
			expect(teamEntradaHc).toBe(teamEntradaClassic);

			const hubClassic = teamClassic.slice(teamClassic.indexOf("## En un hub"));
			const hubHc = teamHc.slice(teamHc.indexOf("## En un hub"));
			// En hub solo cambia herdr agent wait por hc wait
			expect(hubHc.replace(/hc wait/g, "herdr agent wait")).toBe(hubClassic);
		});
	});
});
