/**
 * Logo de BOND: palabra de 3 filas con medios bloques, degradado de magenta a azul oscuro y
 * campo de diagonales a los lados. Estilo inspirado en el logo de Crush (charmbracelet); las
 * letras y el código son propios.
 *
 * Sin dependencias: lo usan la cabecera de pi (extensions/bond-header.ts) y bin/bond-logo.
 * Es .mts para que Node lo cargue como módulo ES sin marcar todo el paquete como "type": "module".
 */

type RGB = [number, number, number];

export const MAGENTA: RGB = [255, 62, 201];
export const DARK_BLUE: RGB = [31, 47, 168];
const FIELD: RGB = [78, 62, 122];
const DIM: RGB = [128, 128, 150];

// Letras sobre una rejilla de 6 "píxeles" de alto: cada fila de texto son dos píxeles
// (▀ arriba, ▄ abajo, █ los dos). `stretchCol` es la columna que se repite al estirarla.
interface Letter {
	rows: [string, string, string];
	stretchCol?: number;
}

const LETTERS: Record<string, Letter> = {
	B: { rows: ["█▀▀▄", "█▀▀▄", "█▄▄▀"], stretchCol: 1 },
	O: { rows: ["▄▀▀▀▄", "█   █", "▀▄▄▄▀"], stretchCol: 2 },
	N: { rows: ["█▄  █", "█ ▀▄█", "█   █"] }, // la diagonal no admite estirarse
	D: { rows: ["█▀▀▀▄", "█   █", "█▄▄▄▀"], stretchCol: 2 },
};

const DIAG = "╱";

export interface Stretch {
	/** Posición de la letra en la palabra. */
	index: number;
	/** Columnas que se añaden. */
	extra: number;
}

/** Estiramiento al azar de una letra que lo admita, como hace Crush: se elige una vez por sesión. */
export function randomStretch(word = "BOND"): Stretch {
	const candidates = [...word].map((ch, i) => (LETTERS[ch]?.stretchCol !== undefined ? i : -1)).filter((i) => i >= 0);
	const index = candidates[Math.floor(Math.random() * candidates.length)] ?? -1;
	return { index, extra: 2 + Math.floor(Math.random() * 4) };
}

function stretchRows(letter: Letter, extra: number): string[] {
	if (letter.stretchCol === undefined || extra <= 0) return [...letter.rows];
	const c = letter.stretchCol;
	return letter.rows.map((r) => {
		const chars = [...r];
		return chars.slice(0, c + 1).join("") + chars[c].repeat(extra) + chars.slice(c + 1).join("");
	});
}

/** Las 3 filas de la palabra, sin color. */
export function wordRows(word = "BOND", stretch?: Stretch): string[] {
	const rows = ["", "", ""];
	[...word].forEach((ch, i) => {
		const letter = LETTERS[ch];
		if (!letter) return;
		const lr = stretchRows(letter, stretch && stretch.index === i ? stretch.extra : 0);
		for (let y = 0; y < 3; y++) rows[y] += (i > 0 ? " " : "") + lr[y];
	});
	return rows;
}

const fg = ([r, g, b]: RGB, s: string) => `\x1b[38;2;${r};${g};${b}m${s}\x1b[39m`;

function mix(a: RGB, b: RGB, t: number): RGB {
	return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * t)) as RGB;
}

/** Degradado por columna; los espacios no llevan color. */
export function gradient(text: string, from: RGB = MAGENTA, to: RGB = DARK_BLUE, bold = false): string {
	const chars = [...text];
	const n = Math.max(1, chars.length - 1);
	const out = chars.map((ch, i) => (ch === " " ? ch : fg(mix(from, to, i / n), ch))).join("");
	return bold ? `\x1b[1m${out}\x1b[22m` : out;
}

export interface LogoOptions {
	/** Columnas disponibles. */
	width: number;
	/** Texto a la derecha de la fila de datos, p. ej. "pi v1.2.0". */
	version?: string;
	stretch?: Stretch;
}

/**
 * Elige la forma según el ancho:
 * - ancha: campo de diagonales a izquierda y derecha (en escalera), como la cabecera de Crush;
 * - compacta: diagonales arriba y abajo, para paneles medianos;
 * - mínima: una línea, para paneles muy estrechos.
 */
export function renderLogo({ width, version = "", stretch }: LogoOptions): string[] {
	const rows = wordRows("BOND", stretch);
	const wordWidth = [...rows[0]].length;
	const tag = "007";
	const meta = tag + " ".repeat(Math.max(1, wordWidth - tag.length - version.length)) + version;
	const metaColored = fg(MAGENTA, tag) + " ".repeat(Math.max(1, wordWidth - tag.length - version.length)) + fg(DIM, version);
	const word = rows.map((r) => gradient(r));

	const leftField = 6;
	const minRight = 8;
	if (width >= leftField + 1 + wordWidth + 1 + minRight) {
		// Como en Crush, la derecha rellena el ancho; con tope para no llenar paneles muy anchos.
		const right = Math.min(32, width - leftField - wordWidth - 2);
		const lines = [metaColored, ...word];
		const plain = [meta, ...rows];
		return lines.map((l, i) => {
			const body = l + " ".repeat(Math.max(0, wordWidth - [...plain[i]].length));
			return `${fg(FIELD, DIAG.repeat(leftField))} ${body} ${fg(FIELD, DIAG.repeat(Math.max(0, right - i)))}`;
		});
	}
	if (width >= wordWidth) {
		const field = fg(FIELD, DIAG.repeat(wordWidth));
		return [field, metaColored, ...word, field];
	}
	const small = `${fg(MAGENTA, tag)} ${gradient("BOND", MAGENTA, DARK_BLUE, true)}`;
	const rest = width - 9;
	return [rest > 0 ? `${small} ${fg(FIELD, DIAG.repeat(rest))}` : small];
}

/** Una línea de marca: "007 BOND ╱╱╱…", para la salida de los scripts. */
export function renderSmall(width = 40, suffix = ""): string {
	const head = `${fg(MAGENTA, "007")} ${gradient("BOND", MAGENTA, DARK_BLUE, true)}${suffix ? ` ${suffix}` : ""}`;
	const used = 9 + (suffix ? 1 + [...suffix.replace(/\x1b\[[0-9;]*m/g, "")].length : 0);
	const rest = width - used - 1;
	return rest > 0 ? `${head} ${fg(FIELD, DIAG.repeat(rest))}` : head;
}
