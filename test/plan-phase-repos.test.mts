// El campo `Repos` de una fase (#44) es un contrato entre tres skills: plan-create lo escribe y
// lo valida contra la sesión del hub, plan-team lo lee para pasar `--repos` y pregunta si falta,
// y fuera de un hub se ignora con aviso. Se comprueba aquí, sobre el catálogo, y que bond sync lo
// propaga: si alguien lo borra o le cambia la forma, esto corta.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
const { syncRepo } = await import("../cli/repo.mts");

const ROOT = join(import.meta.dir, "..");
const origCwd = process.cwd();
let repo: string;

beforeEach(() => {
	repo = realpathSync(mkdtempSync(join(tmpdir(), "bond-plan-repos-")));
	spawnSync("git", ["init", "-q", "-b", "main"], { cwd: repo });
	process.chdir(repo);
});

afterEach(() => {
	process.chdir(origCwd);
	rmSync(repo, { recursive: true, force: true });
});

const catalog = (rel: string) => readFileSync(join(ROOT, "catalog/skills", rel), "utf8");
const template = () => catalog("plan-create/references/plan-template.md");

describe("el campo Repos del bloque de fase", () => {
	test("está en la plantilla, entre Affected contracts y Acceptance criteria", () => {
		const lines = template().split("\n");
		const i = lines.findIndex((l) => l.startsWith("- Repos:"));
		expect(i).toBeGreaterThan(-1);
		expect(lines[i - 1]).toMatch(/^- Affected contracts:/);
		expect(lines[i + 1]).toMatch(/^- Acceptance criteria:/);
	});

	test("dice que es solo para un hub, en formato de la sesión, y que se valida al escribir", () => {
		const field = template().split("\n").find((l) => l.startsWith("- Repos:")) ?? "";
		expect(field).toContain("hub plans only");
		expect(field).toContain("hub.toml");
		expect(field).toContain("bond hub --json");
		expect(field).toMatch(/[Oo]mit the field/);
	});

	test("la nota bajo el bloque deja claro que omitirlo no significa todos los repos", () => {
		const note = template().split("\n").find((l) => l.startsWith("In a hub (a `hub.toml` at the root"));
		expect(note).toBeDefined();
		expect(note).toContain("does not mean \"all repos\"");
		expect(note).toContain("has to ask");
	});
});

describe("las skills que lo consumen", () => {
	test("plan-create lo escribe y lo valida contra la sesión antes de guardar", () => {
		const s = catalog("plan-create/SKILL.md");
		expect(s).toContain("`Repos` field in every phase");
		expect(s).toContain("bond hub --json");
		expect(s).toContain("Outside a hub leave the field out");
	});

	test("plan-team lee el campo de la fase, pregunta si falta y no abre todos por cómodo", () => {
		const s = catalog("plan-team/SKILL.md");
		expect(s).toContain("read each selected phase's `Repos` field");
		expect(s).toContain("--repos <the phase's Repos field>");
		expect(s).toContain("ask the user which repos of the session the phase opens");
		expect(s).toContain("never open all of them because it is convenient");
	});

	test("plan-team avisa e ignora el campo fuera de un hub", () => {
		const s = catalog("plan-team/SKILL.md");
		expect(s).toContain("Outside a hub (no `hub.toml` at the root) the plan's `Repos` field does not apply");
		expect(s).toContain("say so and ignore it");
	});

	test("plan-execute nombra los repos de la fase en su informe dentro de un hub", () => {
		const s = catalog("plan-execute/SKILL.md");
		expect(s).toContain("the phase's `Repos` field names the session repos the phase touches");
	});
});

describe("bond sync propaga el campo", () => {
	test("lo lleva a .agents/skills/ y una segunda pasada no cambia nada", () => {
		mkdirSync(join(repo, ".bond"), { recursive: true });
		writeFileSync(join(repo, ".bond", "bond.toml"), 'agents = ["pi"]\nmcp = []\nskills = ["plan-create", "plan-team", "plan-execute"]\ncommands = []\n');
		syncRepo({ quiet: true });
		expect(readFileSync(join(repo, ".agents/skills/plan-create/references/plan-template.md"), "utf8")).toContain("- Repos:");
		expect(readFileSync(join(repo, ".agents/skills/plan-team/SKILL.md"), "utf8")).toContain("--repos <the phase's Repos field>");
		expect(syncRepo({ check: true, quiet: true })).toEqual([]);
	});
});
