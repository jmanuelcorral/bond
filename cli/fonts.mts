// Detección de Nerd Fonts instaladas, para que `bond setup` pregunte si usar sus iconos en el pie
// de pi. Que una esté instalada no quiere decir que la terminal la use: por eso se pregunta.

import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";
import { which } from "./util.mts";

const FONT_EXT = new Set([".ttf", ".otf", ".ttc", ".otc"]);

/** Nombre de familia de una Nerd Font, o undefined si no lo es. */
export function nerdFontFamily(name: string): string | undefined {
	const n = name.trim();
	if (!/nerd ?font|(^|[\s_-])NF[MP]?($|[\s_-])/i.test(n)) return undefined;
	// "JetBrainsMonoNerdFontMono-Bold", "JetBrainsMono NFP ExtraBold" o "Hack Regular Nerd Font
	// Complete" → "JetBrainsMono Nerd Font", "Hack Nerd Font": una familia por fuente.
	const family = n
		.replace(/([a-z0-9])NerdFont/gi, "$1 Nerd Font")
		.replace(/[-_]/g, " ")
		.replace(/\b(Regular|Bold|Italic|Light|Medium|Thin|ExtraLight|ExtraBold|SemiBold|SemiLight|Black|Heavy|Retina|Book|Oblique|BoldItalic|LightItalic|MediumItalic|Complete|Windows Compatible)\b/gi, "")
		.replace(/\bNF[MP]?\b/, "Nerd Font")
		.replace(/(Nerd Font)\s*(Mono|Propo)\b/i, "$1")
		.replace(/\s+/g, " ")
		.trim();
	return family || n;
}

/** Familias de Nerd Font, sin repetir, a partir de nombres de familia o de fichero. */
export function nerdFontFamilies(names: string[]): string[] {
	const out = new Set<string>();
	for (const name of names) {
		const f = nerdFontFamily(name);
		if (f) out.add(f);
	}
	return [...out].sort();
}

/** Carpetas de fuentes de cada sistema (para cuando no hay fc-list). */
export function fontDirs(platform = process.platform, env = process.env, home = homedir()): string[] {
	if (platform === "darwin") return [join(home, "Library", "Fonts"), "/Library/Fonts", "/System/Library/Fonts"];
	if (platform === "win32") {
		const dirs = [join(env.WINDIR ?? "C:\\Windows", "Fonts")];
		if (env.LOCALAPPDATA) dirs.unshift(join(env.LOCALAPPDATA, "Microsoft", "Windows", "Fonts"));
		return dirs;
	}
	return [join(home, ".local", "share", "fonts"), join(home, ".fonts"), "/usr/local/share/fonts", "/usr/share/fonts"];
}

/** Nombres de fichero de fuentes bajo `dir`, hasta `depth` niveles (las carpetas de Linux anidan). */
function fontFiles(dir: string, depth = 3): string[] {
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return [];
	}
	const out: string[] = [];
	for (const e of entries) {
		const path = join(dir, e);
		if (FONT_EXT.has(extname(e).toLowerCase())) out.push(basename(e, extname(e)));
		else if (depth > 0) {
			try {
				if (statSync(path).isDirectory()) out.push(...fontFiles(path, depth - 1));
			} catch {
				// enlace roto o sin permisos: se salta
			}
		}
	}
	return out;
}

/**
 * Nerd Fonts instaladas: con fc-list si lo hay (Linux, y macOS con fontconfig), y si no, por los
 * nombres de fichero de las carpetas de fuentes.
 */
export function detectNerdFonts(): string[] {
	if (which("fc-list")) {
		try {
			const out = execFileSync("fc-list", [":", "family"], { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] });
			// Cada línea, las familias de una fuente separadas por comas.
			return nerdFontFamilies(out.split("\n").flatMap((l) => l.split(",")));
		} catch {
			// fc-list falla: se miran las carpetas
		}
	}
	return nerdFontFamilies(fontDirs().flatMap((d) => fontFiles(d)));
}
