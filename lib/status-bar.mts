/**
 * Piezas del pie de estado de bond (extensions/status-line.ts) que no dependen de pi: los iconos
 * y el reparto de los datos en el ancho del panel. Sin dependencias (en el binario, las
 * extensiones no tienen node_modules): por eso config.toml se lee aquí a mano, solo [ui] icons.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Iconos de cada dato del pie. */
export interface Icons {
	agent: string;
	folder: string;
	branch: string;
	worktree: string;
	model: string;
	context: string;
	cost: string;
	time: string;
	api: string;
	diff: string;
	ok: string;
	fail: string;
	wait: string;
	status: string;
}

/** Nerd Font (v3): se ven bien con una de esas fuentes en la terminal. */
export const NERD_ICONS: Icons = {
	agent: "\u{f06a9}", // md-robot
	folder: "\u{f07b}", // fa-folder
	branch: "\u{e725}", // dev-git_branch
	worktree: "\u{f0645}", // md-file_tree
	model: "\u{f09d1}", // md-brain
	context: "\u{f035b}", // md-memory
	cost: "\u{f155}", // fa-dollar
	time: "\u{f017}", // fa-clock_o
	api: "\u{f0e7}", // fa-bolt
	diff: "\u{f440}", // oct-diff
	ok: "\u{f00c}", // fa-check
	fail: "\u{f00d}", // fa-close
	wait: "\u{f051f}", // md-timer_sand
	status: "\u{f12e}", // fa-puzzle_piece
};

/** Símbolos Unicode de una columna que traen todas las fuentes: para terminales sin emojis (BOND_ICONS=unicode). */
export const UNICODE_ICONS: Icons = {
	agent: "◉",
	folder: "▤",
	branch: "⎇",
	worktree: "⑂",
	model: "◆",
	context: "◧",
	cost: "$",
	time: "◷",
	api: "↯",
	diff: "±",
	ok: "✓",
	fail: "✗",
	wait: "⧗",
	status: "▪",
};

/**
 * Emojis de un solo carácter y presentación emoji (sin selector de variante, que cada terminal
 * mide distinto): ocupan siempre dos columnas. Para terminales sin Nerd Font.
 */
export const EMOJI_ICONS: Icons = {
	agent: "🤖",
	folder: "📁",
	branch: "🌿",
	worktree: "🌳",
	model: "🧠",
	context: "📊",
	cost: "💰",
	time: "🕐",
	api: "⚡",
	diff: "📝",
	ok: "✅",
	fail: "❌",
	wait: "⏳",
	status: "🧩",
};

export type IconStyle = "nerd" | "emoji" | "unicode";
export const ICON_STYLES: IconStyle[] = ["nerd", "emoji", "unicode"];
const SETS: Record<IconStyle, Icons> = { nerd: NERD_ICONS, emoji: EMOJI_ICONS, unicode: UNICODE_ICONS };

const asStyle = (v: string | undefined): IconStyle | undefined => {
	const s = v?.trim().toLowerCase();
	return ICON_STYLES.find((x) => x === s);
};

/** `icons` de la sección [ui] de un config.toml (lo escribe bond setup); undefined si no está. */
export function iconStyleFromConfig(toml: string): IconStyle | undefined {
	let inUi = false;
	for (const line of toml.split(/\r?\n/)) {
		const section = /^\s*\[([^\]]*)\]/.exec(line);
		if (section) inUi = section[1].trim() === "ui";
		else if (inUi) {
			const m = /^\s*icons\s*=\s*["']([^"']*)["']/.exec(line);
			if (m) return asStyle(m[1]);
		}
	}
	return undefined;
}

/**
 * Iconos del pie: BOND_ICONS (nerd, emoji o unicode) manda; si no, [ui] icons de
 * ~/.bond/config.toml (lo pregunta bond setup si hay una Nerd Font); si no, emojis.
 */
export function iconStyle(env: Record<string, string | undefined> = process.env, readConfig = defaultConfigText): IconStyle {
	return asStyle(env.BOND_ICONS) ?? iconStyleFromConfig(readConfig(env)) ?? "emoji";
}

function defaultConfigText(env: Record<string, string | undefined>): string {
	try {
		return readFileSync(join(env.BOND_HOME || join(homedir(), ".bond"), "config.toml"), "utf8");
	} catch {
		return "";
	}
}

export const iconSet = (env?: Record<string, string | undefined>, readConfig?: typeof defaultConfigText): Icons => SETS[iconStyle(env, readConfig)];

export interface Segment {
	/** Texto ya coloreado. */
	text: string;
	/** Ancho visible del texto. */
	width: number;
	/** Cuanto más alto, antes se quita si no cabe; 0 no se quita nunca. */
	drop: number;
}

/**
 * Une los segmentos con `gap` quitando, mientras no quepan en `width`, los de `drop` más alto.
 * Lo que siga sin caber lo recorta quien pinte la línea.
 */
export function fitSegments(segments: Segment[], width: number, gap = "  "): string {
	const kept = segments.filter((s) => s.text);
	const total = () => kept.reduce((n, s) => n + s.width, 0) + Math.max(0, kept.length - 1) * gap.length;
	while (total() > width) {
		const worst = kept.reduce((w, s, i) => (s.drop > (kept[w]?.drop ?? 0) ? i : w), -1);
		if (worst < 0) break;
		kept.splice(worst, 1);
	}
	return kept.map((s) => s.text).join(gap);
}
