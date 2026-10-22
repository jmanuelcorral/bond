import { describe, expect, test } from "bun:test";
import { firstFreeName } from "../cli/herdr.mts";
import { parseLaunch } from "../cli/launch.mts";

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
