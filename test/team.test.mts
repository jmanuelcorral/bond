import { describe, expect, test } from "bun:test";
import { parseTeam } from "../cli/launch.mts";

const dirs = (...existing: string[]) => (p: string) => existing.includes(p);

describe("parseTeam", () => {
	test("sin repo: todo son ramas, con su agente si lo llevan", () => {
		const o = parseTeam(["feat/a", "feat/b:claude"], dirs());
		expect(o.dir).toBeUndefined();
		expect(o.specs).toEqual([{ branch: "feat/a", agent: undefined }, { branch: "feat/b", agent: "claude" }]);
	});

	test("el primero es el repo si es una carpeta que existe", () => {
		const o = parseTeam([".", "feat/a"], dirs("."));
		expect(o.dir).toBe(".");
		expect(o.specs.map((s) => s.branch)).toEqual(["feat/a"]);
	});

	test("una rama que se llama como una carpeta solo es repo en primera posición", () => {
		expect(parseTeam(["feat/a", "src"], dirs("src")).specs.map((s) => s.branch)).toEqual(["feat/a", "src"]);
	});

	test("opciones y argumentos para los agentes", () => {
		const o = parseTeam(["-a", "codex", "feat/a", "--base", "main", "--trust-repository", "--", "--model", "x"], dirs());
		expect(o).toMatchObject({ agent: "codex", base: "main", trust: true, agentArgs: ["--model", "x"] });
		expect(o.specs).toEqual([{ branch: "feat/a", agent: undefined }]);
	});
});
