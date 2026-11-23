import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MINIONS } from "../cli/team.mts";

// Decisión 2026-11-23 (hub): bond-delegate nombra al delegado con el primer minion libre, como
// bond team, y lleva el rol aparte. La lista de la skill tiene que ser la de bond team.
describe("bond-delegate nombra a los delegados como minions", () => {
	for (const variant of ["skills", "skills-hc"]) {
		const skill = readFileSync(join(import.meta.dirname, "..", "global", variant, "bond-delegate", "SKILL.md"), "utf8");

		test(`${variant}: la lista de minions es la de bond team, en el mismo orden`, () => {
			const m = /el primer minion libre[^\n]*\n\s*([a-z, ]+)\./.exec(skill);
			expect(m).not.toBeNull();
			expect(m![1].split(",").map((s) => s.trim())).toEqual(MINIONS);
		});

		test(`${variant}: el rol ya no va en el nombre`, () => {
			expect(skill).not.toContain("<rol>-<n>");
			expect(skill).toContain("minion-<n>");
		});
	}

	test("hc: el rol va en la etiqueta role; clásico: en el título del panel", () => {
		const hc = readFileSync(join(import.meta.dirname, "..", "global", "skills-hc", "bond-delegate", "SKILL.md"), "utf8");
		const classic = readFileSync(join(import.meta.dirname, "..", "global", "skills", "bond-delegate", "SKILL.md"), "utf8");
		expect(hc).toContain("--label role=<rol>");
		expect(classic).toContain('herdr pane rename <panel> "<nombre> · <rol>"');
	});
});
