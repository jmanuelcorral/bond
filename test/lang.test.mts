// Resolución del idioma de la consola: BOND_LANG > [ui] lang de config.toml > locale del
// entorno > español. Funciones puras: se les pasa el entorno y el texto del TOML.

import { describe, expect, test } from "bun:test";
import { detectLang, langFromConfig, parseLang, resolveLang } from "../lib/lang.mts";

const noConfig = () => "";

describe("langFromConfig", () => {
	test("lee lang de la sección [ui]", () => {
		expect(langFromConfig(`[ui]\nlang = "en"\n`)).toBe("en");
		expect(langFromConfig(`agents = ["pi"]\n\n[ui]\nicons = "nerd"\nlang = "es"\n`)).toBe("es");
	});
	test("undefined si no hay sección [ui], no hay lang o el valor no es un idioma", () => {
		expect(langFromConfig(`agents = ["pi"]\n`)).toBeUndefined();
		expect(langFromConfig(`[ui]\nicons = "nerd"\n`)).toBeUndefined();
		expect(langFromConfig(`[ui]\nlang = "fr"\n`)).toBeUndefined();
	});
	test("solo lang dentro de [ui]: el lang de otra sección no vale", () => {
		expect(langFromConfig(`[other]\nlang = "en"\n[ui]\nicons = "emoji"\n`)).toBeUndefined();
	});
});

describe("detectLang", () => {
	test("es si la etiqueta del locale empieza por es", () => {
		expect(detectLang({ LANG: "es_ES.UTF-8" })).toBe("es");
		expect(detectLang({ LANG: "es-419" })).toBe("es");
		expect(detectLang({ LANG: "ES" })).toBe("es");
	});
	test("cualquier otro idioma detectado es inglés", () => {
		expect(detectLang({ LANG: "en_US.UTF-8" })).toBe("en");
		expect(detectLang({ LANG: "de_DE.UTF-8" })).toBe("en");
		expect(detectLang({ LANG: "pt_BR.UTF-8" })).toBe("en");
	});
	test("LC_ALL manda y LANGUAGE se mira antes que LC_MESSAGES y LANG", () => {
		expect(detectLang({ LC_ALL: "es_ES", LANG: "en_US" })).toBe("es");
		expect(detectLang({ LC_ALL: "en_US", LANG: "es_ES" })).toBe("en");
		expect(detectLang({ LANGUAGE: "es:en", LC_MESSAGES: "en_US" })).toBe("es");
		expect(detectLang({ LC_MESSAGES: "fr_FR", LANG: "es_ES" })).toBe("en");
	});
	test("C y POSIX no dicen idioma", () => {
		expect(detectLang({ LC_ALL: "C", LANG: "es_ES.UTF-8" })).toBe("es");
		expect(detectLang({ LANG: "C" })).toBeUndefined();
		expect(detectLang({})).toBeUndefined();
	});
});

describe("resolveLang", () => {
	test("BOND_LANG manda sobre config y entorno", () => {
		expect(resolveLang({ BOND_LANG: "en", LANG: "es_ES" }, () => `[ui]\nlang = "es"\n`)).toBe("en");
		expect(resolveLang({ BOND_LANG: "es" }, () => `[ui]\nlang = "en"\n`)).toBe("es");
	});
	test("un BOND_LANG inválido se ignora y se sigue resolviendo", () => {
		expect(resolveLang({ BOND_LANG: "fr", LANG: "es_ES" }, noConfig)).toBe("es");
		expect(resolveLang({ BOND_LANG: "" }, noConfig)).toBe("es");
	});
	test("[ui] lang va por delante del locale del entorno", () => {
		expect(resolveLang({ LANG: "en_US" }, () => `[ui]\nlang = "es"\n`)).toBe("es");
		expect(resolveLang({ LANG: "es_ES" }, () => `[ui]\nlang = "en"\n`)).toBe("en");
	});
	test("sin config ni nada que diga idioma, español", () => {
		expect(resolveLang({}, noConfig)).toBe("es");
		expect(resolveLang({ LANG: "C" }, noConfig)).toBe("es");
	});
});

describe("parseLang", () => {
	test("acepta mayúsculas y espacios, rechaza lo demás", () => {
		expect(parseLang(" ES ")).toBe("es");
		expect(parseLang("en")).toBe("en");
		expect(parseLang("fr")).toBeUndefined();
		expect(parseLang(undefined)).toBeUndefined();
	});
});
