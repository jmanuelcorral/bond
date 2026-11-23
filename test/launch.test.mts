import { describe, expect, test } from "bun:test";
import { firstFreeName } from "../cli/herdr.mts";
import { launchInPlace, parseLaunch, workspaceLabel } from "../cli/launch.mts";

describe("firstFreeName", () => {
	test("gru si está libre; si no, gru-2, gru-3...", () => {
		expect(firstFreeName("gru", new Set())).toBe("gru");
		expect(firstFreeName("gru", new Set(["gru"]))).toBe("gru-2");
		expect(firstFreeName("gru", new Set(["gru", "gru-2"]))).toBe("gru-3");
	});

	test("recorta y empieza por letra, como pide Herdr", () => {
		expect(firstFreeName("pi-un-repo-con-un-nombre-muy-largo-de-verdad", new Set())).toBe("pi-un-repo-con-un-nombre-muy");
		expect(firstFreeName("9lives", new Set())).toBe("a-9lives");
	});
});

describe("parseLaunch", () => {
	test("sin --shell, solo el agente", () => {
		expect(parseLaunch([], false).shell).toBe(false);
	});

	test("--shell añade la shell, con su dirección y proporción", () => {
		const o = parseLaunch(["--shell", "-d", "down", "-r", "0.7"], false);
		expect(o.shell).toBe(true);
		expect(o.direction).toBe("down");
		expect(o.ratio).toBe("0.7");
	});
});

describe("workspaceLabel", () => {
	test("bond:<repo>, con la rama del worktree o la etiqueta pedida", () => {
		expect(workspaceLabel("/src/bond")).toBe("bond:bond");
		expect(workspaceLabel("/src/bond", "feat/x")).toBe("bond:bond/feat/x");
		expect(workspaceLabel("/src/bond", "feat/x", "mio")).toBe("mio");
	});
});

describe("launchInPlace (D-BB)", () => {
	test("con BOND_APP=1 el agente se abre en la terminal actual, sin Herdr", () => {
		expect(launchInPlace(parseLaunch(["--agent", "pi", "--", "--model", "x/y", "hola"], false), { BOND_APP: "1" })).toBe(true);
	});

	test("sin BOND_APP, o con otro valor, se sigue por Herdr clásico", () => {
		const o = parseLaunch(["--agent", "pi"], false);
		expect(launchInPlace(o, {})).toBe(false);
		expect(launchInPlace(o, { BOND_APP: "0" })).toBe(false);
		expect(launchInPlace(o, { BOND_APP: "true" })).toBe(false);
	});

	test("--no-agent y --worktree siguen necesitando Herdr", () => {
		expect(launchInPlace(parseLaunch(["--no-agent"], false), { BOND_APP: "1" })).toBe(false);
		expect(launchInPlace(parseLaunch(["--worktree", "feat/x"], false), { BOND_APP: "1" })).toBe(false);
	});
});
