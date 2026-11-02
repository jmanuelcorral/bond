// Los catálogos de textos de la consola: las claves tipadas obligan a que el inglés las tenga
// todas (si faltara una, npm run typecheck no pasa); aquí se comprueba lo que los tipos no
// cubren: que el inglés no deja español sin traducir y que la interpolación funciona.

import { describe, expect, test } from "bun:test";
import { MESSAGE_KEYS, t } from "../cli/messages.mts";

/** Marcas de castellano: puntuación invertida, acentos y la eñe. */
const SPANISH = /[¿¡áéíóúüñ]/;

/** Claves bilingües a propósito: se muestran en los dos idiomas para quien no entienda el suyo. */
const BILINGUAL = new Set(["wizard.lang_question", "wizard.lang_es"]);

describe("catálogos de textos de la consola", () => {
	test("hay claves en los dos idiomas", () => {
		expect(MESSAGE_KEYS.length).toBeGreaterThan(50);
	});
	test("toda clave tiene su texto en inglés", () => {
		const missing = MESSAGE_KEYS.filter((k) => !t(k, {}, "en").trim());
		expect(missing).toEqual([]);
	});
	test("el inglés no deja castellano sin traducir (salvo las etiquetas bilingües)", () => {
		const offenders = MESSAGE_KEYS.filter((k) => !BILINGUAL.has(k) && SPANISH.test(t(k, {}, "en")));
		expect(offenders).toEqual([]);
	});
	test("sustituye {param} y deja tal cual el parámetro que no llega", () => {
		expect(t("setup.unknown_opt", { opt: "--lang fr" }, "en")).toBe("unknown option: --lang fr (bond setup --help)");
		expect(t("setup.unknown_opt", { opt: "--lang fr" }, "es")).toBe("opción desconocida: --lang fr (bond setup --help)");
		expect(t("setup.unknown_opt", {})).toContain("{opt}");
	});
	test("los dos idiomas dicen lo mismo en las cadenas comunes", () => {
		expect(t("setup.icon.nerd", {}, "es")).toBe(t("setup.icon.nerd", {}, "en"));
		expect(t("setup.applying", {}, "es")).toBe("Aplicando");
		expect(t("setup.applying", {}, "en")).toBe("Applying");
	});
	test("el resumen de setup se arma con sus parámetros en ambos idiomas", () => {
		for (const at of ["es", "en"] as const) {
			const out = t(
				"setup.summary",
				{ logo: "L", agents: "pi, claude", default: "pi", endpoints: "ollama", config: "/c", suggestions: "on", icons: "", personal: "/p" },
				at,
			);
			expect(out).toContain("pi, claude");
			expect(out).not.toContain("{");
		}
	});
});
