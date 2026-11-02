import { describe, expect, test } from "bun:test";
import type { Config } from "../cli/config.mts";
import { fontDirs, nerdFontFamilies, nerdFontFamily } from "../cli/fonts.mts";

describe("Nerd Fonts", () => {
	test("reconoce familias y ficheros de Nerd Font", () => {
		expect(nerdFontFamily("JetBrainsMono Nerd Font")).toBe("JetBrainsMono Nerd Font");
		expect(nerdFontFamily("JetBrainsMonoNerdFontMono-Bold")).toBe("JetBrainsMono Nerd Font");
		expect(nerdFontFamily("JetBrainsMono NFP ExtraBold")).toBe("JetBrainsMono Nerd Font");
		expect(nerdFontFamily("MesloLGS NF Regular")).toBe("MesloLGS Nerd Font");
		expect(nerdFontFamily("Hack Regular Nerd Font Complete")).toBe("Hack Nerd Font");
		expect(nerdFontFamily("FiraCode Nerd Font Propo")).toBe("FiraCode Nerd Font");
	});

	test("no confunde otras fuentes", () => {
		for (const name of ["DejaVu Sans Mono", "Inconsolata", "NFL Sans", "Confortaa", "JetBrains Mono"]) expect(nerdFontFamily(name)).toBeUndefined();
	});

	test("una familia por fuente, sin repetir y ordenadas", () => {
		const names = ["JetBrainsMono NF", "JetBrainsMono NFM", "JetBrainsMono NFP", "JetBrainsMono Nerd Font", "Hack Nerd Font Mono", "DejaVu Sans"];
		expect(nerdFontFamilies(names)).toEqual(["Hack Nerd Font", "JetBrainsMono Nerd Font"]);
		expect(nerdFontFamilies([])).toEqual([]);
	});

	test("carpetas de fuentes de cada sistema", () => {
		expect(fontDirs("darwin", {}, "/Users/ana")).toContain("/Users/ana/Library/Fonts");
		const win = fontDirs("win32", { LOCALAPPDATA: "C:\\Users\\ana\\AppData\\Local", WINDIR: "C:\\Windows" }, "C:\\Users\\ana");
		expect(win).toEqual(["C:\\Users\\ana\\AppData\\Local\\Microsoft\\Windows\\Fonts", "C:\\Windows\\Fonts"]);
		expect(fontDirs("linux", {}, "/home/ana")).toContain("/home/ana/.local/share/fonts");
	});
});

describe("bond setup: iconos del pie de pi", async () => {
	const { iconsStep } = await import("../cli/wizard.mts");
	const cfg = (extra: Partial<Config> = {}): Config => ({ agents: ["pi"], providers: [], ...extra });

	test("con una Nerd Font instalada, Nerd Font (sin terminal no se pregunta)", async () => {
		const c = cfg();
		await iconsStep(c, false, () => ["JetBrainsMono Nerd Font"]);
		expect(c.ui).toEqual({ icons: "nerd" });
	});

	test("sin Nerd Font, emojis, aunque antes hubiera elegido Nerd Font", async () => {
		const c = cfg({ ui: { icons: "nerd" } });
		await iconsStep(c, false, () => []);
		expect(c.ui).toEqual({ icons: "emoji" });
	});

	test("si ya dijo que no a la Nerd Font, se respeta", async () => {
		const c = cfg({ ui: { icons: "emoji" } });
		await iconsStep(c, false, () => ["Hack Nerd Font"]);
		expect(c.ui).toEqual({ icons: "emoji" });
	});

	test("Unicode puesto a mano se respeta, y sin pi no se toca nada", async () => {
		const c = cfg({ ui: { icons: "unicode" } });
		await iconsStep(c, false, () => ["Hack Nerd Font"]);
		expect(c.ui).toEqual({ icons: "unicode" });
		const noPi = cfg({ agents: ["codex"] });
		await iconsStep(noPi, false, () => ["Hack Nerd Font"]);
		expect(noPi.ui).toBeUndefined();
	});
});
