import { describe, expect, test } from "bun:test";
import { badgeWidth, renderBadge } from "../lib/bond-logo.mts";
import { stringify } from "smol-toml";
import { EMOJI_ICONS, fitSegments, iconSet, iconStyle, iconStyleFromConfig, NERD_ICONS, type Segment, UNICODE_ICONS } from "../lib/status-bar.mts";

const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
const seg = (text: string, drop: number): Segment => ({ text, width: [...text].length, drop });

describe("iconos", () => {
	const noConfig = () => "";

	test("sin nada configurado, emojis", () => {
		expect(iconSet({}, noConfig)).toBe(EMOJI_ICONS);
	});

	test("[ui] icons de config.toml, tal como lo escribe bond setup", () => {
		const toml = stringify({ agents: ["pi"], providers: { halo: { base_url: "http://x" } }, ui: { icons: "nerd" } });
		expect(iconStyleFromConfig(toml)).toBe("nerd");
		expect(iconSet({}, () => toml)).toBe(NERD_ICONS);
		expect(iconStyleFromConfig('[ui]\nicons = "unicode"\n')).toBe("unicode");
	});

	test("icons fuera de [ui], o con un valor desconocido, no cuenta", () => {
		expect(iconStyleFromConfig('icons = "nerd"\n[suggestions]\nicons = "nerd"\n')).toBeUndefined();
		expect(iconStyleFromConfig('[ui]\nicons = "grande"\n')).toBeUndefined();
		expect(iconStyleFromConfig("")).toBeUndefined();
	});

	test("BOND_ICONS manda sobre config.toml", () => {
		const nerd = () => '[ui]\nicons = "nerd"\n';
		expect(iconStyle({ BOND_ICONS: " Emoji " }, nerd)).toBe("emoji");
		expect(iconStyle({ BOND_ICONS: "unicode" }, nerd)).toBe("unicode");
		expect(iconStyle({ BOND_ICONS: "otra" }, nerd)).toBe("nerd");
		expect(iconSet({ BOND_HOME: "/no/existe" })).toBe(EMOJI_ICONS);
	});

	test("los tres juegos tienen los mismos iconos", () => {
		for (const set of [UNICODE_ICONS, EMOJI_ICONS]) expect(Object.keys(set).sort()).toEqual(Object.keys(NERD_ICONS).sort());
	});

	test("Nerd Font y Unicode, de una columna; emojis, un solo carácter de presentación emoji (dos columnas)", () => {
		for (const set of [NERD_ICONS, UNICODE_ICONS]) for (const icon of Object.values(set)) expect([...icon]).toHaveLength(1);
		for (const icon of Object.values(EMOJI_ICONS)) {
			expect([...icon]).toHaveLength(1); // sin selector de variante (U+FE0F), que cada terminal mide distinto
			expect(icon).toMatch(/^\p{Emoji_Presentation}$/u);
		}
	});
});

describe("fitSegments", () => {
	const parts = [seg("modelo", 0), seg("rama", 1), seg("agente", 2), seg("carpeta", 3)];

	test("con sitio, todos en orden", () => {
		expect(fitSegments(parts, 80)).toBe("modelo  rama  agente  carpeta");
	});

	test("sin sitio, se quitan primero los de drop más alto", () => {
		expect(fitSegments(parts, 22)).toBe("modelo  rama  agente");
		expect(fitSegments(parts, 12)).toBe("modelo  rama");
	});

	test("los de drop 0 no se quitan nunca, aunque no quepan", () => {
		expect(fitSegments(parts, 3)).toBe("modelo");
	});

	test("ignora los segmentos vacíos", () => {
		expect(fitSegments([seg("", 0), seg("a", 1), seg("", 2), seg("b", 1)], 80)).toBe("a  b");
	});
});

describe("insignia", () => {
	test("dos filas del mismo ancho, con la palabra o solo los chevrones", () => {
		const wide = renderBadge(true).map(plain);
		expect(wide).toEqual(["▀█▄ ▀█▄ bond", "▄█▀ ▄█▀     "]);
		expect(badgeWidth(true)).toBe(12);
		const narrow = renderBadge(false).map(plain);
		expect(narrow).toEqual(["▀▄ ▀▄", "▄▀ ▄▀"]);
		expect(badgeWidth(false)).toBe(5);
	});
});
