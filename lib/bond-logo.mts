/**
 * Logo de bond para la terminal: el isotipo de la web (dos chevrones que se cruzan y se abren en
 * tres trazas con su punto) en medios bloques, con el degradado del logo original de índigo a
 * teal, y el wordmark "bond" en minúsculas, en gris claro como en la web.
 *
 * Sin dependencias: lo usan la cabecera de pi (extensions/bond-header.ts) y la CLI (bond logo,
 * la ayuda y la línea de marca de bond, bond team, setup e init).
 * Es .mts para que Node lo cargue como módulo ES sin marcar todo el paquete como "type": "module".
 */

type RGB = [number, number, number];

const hex = (h: string): RGB => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as RGB;

/**
 * Degradado del isotipo por columnas, medido en docs/public/isotype-dark.png: índigo en los
 * chevrones, azul y cian en el cruce y teal en las trazas.
 */
const STOPS: [number, RGB][] = [
	[0, hex("#555ae7")],
	[0.22, hex("#5460e7")],
	[0.38, hex("#4396e0")],
	[0.46, hex("#35b4e0")],
	[0.54, hex("#2bcbdb")],
	[0.62, hex("#22dcd6")],
	[0.7, hex("#18e5d1")],
	[1, hex("#18e5d1")],
];
export const INDIGO = STOPS[0][1];
export const TEAL = STOPS[STOPS.length - 1][1];
/** Gris del wordmark de docs/public/logo-dark.png. */
const WORD: RGB = hex("#e8e9ec");
const DIM: RGB = hex("#64748b");
/** Teal apagado al final de la traza de la línea de marca. */
const TRACE_FAR: RGB = hex("#0f4d4a");

function mix(a: RGB, b: RGB, t: number): RGB {
	return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * t)) as RGB;
}

/** Color del degradado del logo en t (0 a 1). */
export function ramp(t: number): RGB {
	const x = Math.min(1, Math.max(0, t));
	for (let i = 1; i < STOPS.length; i++) {
		const [t0, c0] = STOPS[i - 1];
		const [t1, c1] = STOPS[i];
		if (x <= t1) return mix(c0, c1, (x - t0) / (t1 - t0));
	}
	return TEAL;
}

const fg = ([r, g, b]: RGB, s: string) => `\x1b[38;2;${r};${g};${b}m${s}\x1b[39m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;

/** Degradado del logo por columnas sobre una fila de `width` columnas; los espacios no llevan color. */
function gradientRow(row: string, width = [...row].length): string {
	const n = Math.max(1, width - 1);
	return [...row].map((ch, x) => (ch === " " ? ch : fg(ramp(x / n), ch))).join("");
}

/** Bitmap ('#' encendido) a filas de medios bloques: cada fila de texto son dos píxeles. */
function halfBlocks(bits: string[]): string[] {
	const rows: string[] = [];
	for (let y = 0; y < bits.length; y += 2) {
		const top = bits[y];
		const bottom = bits[y + 1] ?? "";
		let s = "";
		for (let x = 0; x < Math.max(top.length, bottom.length); x++) {
			const t = top[x] === "#";
			const b = bottom[x] === "#";
			s += t && b ? "█" : t ? "▀" : b ? "▄" : " ";
		}
		rows.push(s);
	}
	const width = Math.max(...rows.map((r) => r.length));
	return rows.map((r) => r.padEnd(width));
}

// Isotipo grande: 14 píxeles de alto = 7 filas × 27 columnas.
const ISO_LARGE = halfBlocks([
	"    ###               #### ",
	"###  ###             ######",
	" ###  ###   ######## ######",
	"  ###  ### ###        #### ",
	"   ###  #####              ",
	"    ###  ####         #### ",
	"     ### ################# ",
	"     ### ################# ",
	"    ###  ####         #### ",
	"   ###  #####              ",
	"  ###  ### ###        #### ",
	" ###  ###   ######## ######",
	"###  ###             ######",
	"    ###               #### ",
]);

// Forma media: solo los dos chevrones, 8 píxeles = 4 filas × 10 columnas. Es también como
// termina la animación.
const CHEVRONS = halfBlocks([
	" ##  ##   ",
	"  ##  ##  ",
	"   ##  ## ",
	"    ##  ##",
	"    ##  ##",
	"   ##  ## ",
	"  ##  ##  ",
	" ##  ##   ",
]);
/** Los chevrones solo llevan la parte del degradado que va del índigo al cian. */
const CHEVRONS_SPAN = 0.6;

// Wordmark: "bond" en minúsculas redondeadas, de 4 filas (junto al isotipo grande) y de 3 (medio).
const WORD_LARGE = [
	"█                         █",
	"█▀▀▀▀▄ ▄▀▀▀▀▄ █▀▀▀▀▄ ▄▀▀▀▀█",
	"█    █ █    █ █    █ █    █",
	"▀▄▄▄▄▀ ▀▄▄▄▄▀ ▀    ▀ ▀▄▄▄▄▀",
];
const WORD_MEDIUM = [
	"█                 █",
	"█▀▀▄ ▄▀▀▄ █▀▀▄ ▄▀▀█",
	"█▄▄▀ ▀▄▄▀ █  █ ▀▄▄█",
];

const len = (s: string) => [...s].length;

function truncate(s: string, n: number): string {
	const chars = [...s];
	if (chars.length <= n) return s;
	return n <= 0 ? "" : `${chars.slice(0, n - 1).join("")}…`;
}

/** Anchos mínimos de cada forma. */
export const LARGE_WIDTH = len(ISO_LARGE[0]) + 3 + len(WORD_LARGE[0]); // 57
export const MEDIUM_WIDTH = len(CHEVRONS[0]) + 2 + len(WORD_MEDIUM[0]); // 31

export interface LogoOptions {
	/** Columnas disponibles. */
	width: number;
	/** Texto arriba a la derecha, p. ej. "v1.10.0" o "pi v0.70.0". */
	version?: string;
	/** Lema bajo la palabra en la forma grande. */
	tagline?: string;
}

const DEFAULT_TAGLINE = "licence to code";
/** Fondo de la terminal de la web, del que «se encienden» la palabra y los textos. */
const SURFACE: RGB = hex("#0b0f17");
const WHITE: RGB = [255, 255, 255];

interface LargeState {
	/** Columnas del isotipo que se ven (el resto, en blanco). */
	upto: number;
	/** Columnas que ocupa el isotipo antes de la palabra (al recoger las ramas, la palabra las sigue). */
	cols: number;
	/** Columna del frente brillante de la entrada; -1, sin frente. */
	head: number;
	/** Encendido de la palabra y los textos, de 0 a 1. */
	glow: number;
}

/** El logo grande en un estado de la animación; el estado por defecto es el logo quieto. */
function large({ width, version = "", tagline = DEFAULT_TAGLINE }: LogoOptions, st: LargeState): string[] {
	const wordWidth = len(WORD_LARGE[0]);
	const v = truncate(version, wordWidth);
	const t = truncate(tagline, width - LARGE_WIDTH + wordWidth);
	const on = (c: RGB) => (st.glow >= 1 ? c : mix(SURFACE, c, st.glow));
	return ISO_LARGE.map((row, y) => {
		const iso = [...row]
			.slice(0, st.cols)
			.map((ch, x) => {
				if (ch === " " || x >= st.upto) return " ";
				const c = ramp(x / (len(row) - 1));
				return fg(st.head < 0 ? c : mix(c, WHITE, Math.max(0, 1 - Math.abs(x - st.head) / 3) * 0.75), ch);
			})
			.join("");
		let right = "";
		if (st.glow > 0) {
			if (y === 0 && v) right = " ".repeat(wordWidth - len(v)) + fg(on(DIM), v);
			else if (y >= 1 && y <= 4) right = fg(on(WORD), WORD_LARGE[y - 1]);
			else if (y === 5 && t) right = fg(on(DIM), t);
		}
		return (iso + (right ? `   ${right}` : "")).trimEnd();
	});
}

/** Forma media: los chevrones y la palabra de 3 filas, con la versión encima. */
function medium({ version = "" }: LogoOptions): string[] {
	const wordWidth = len(WORD_MEDIUM[0]);
	const v = truncate(version, wordWidth);
	const n = len(CHEVRONS[0]) - 1;
	return CHEVRONS.map((row, y) => {
		const iso = [...row].map((ch, x) => (ch === " " ? ch : fg(ramp((x / n) * CHEVRONS_SPAN), ch))).join("");
		const right = y >= 1 ? fg(WORD, WORD_MEDIUM[y - 1]) : v ? " ".repeat(wordWidth - len(v)) + fg(DIM, v) : "";
		return (iso + (right ? `  ${right}` : "")).trimEnd();
	});
}

/**
 * Insignia de dos filas para el pie de estado: los chevrones ">>" con su degradado y, si
 * `word`, la palabra "bond" en la fila de arriba. Las dos filas miden lo mismo.
 */
export function renderBadge(word = true): [string, string] {
	const paint = (row: string) => {
		const n = len(row) - 1;
		return [...row].map((ch, x) => (ch === " " ? ch : fg(ramp((x / n) * CHEVRONS_SPAN), ch))).join("");
	};
	if (!word) return [paint("▀▄ ▀▄"), paint("▄▀ ▄▀")];
	return [`${paint("▀█▄ ▀█▄")} ${bold(fg(WORD, "bond"))}`, `${paint("▄█▀ ▄█▀")}     `];
}

/** Ancho visible de la insignia. */
export const badgeWidth = (word = true) => (word ? 12 : 5);

/** Color de los iconos del pie: el cian del cruce del logo. */
export const ICON_COLOR = ramp(0.46);
export const paintIcon = (s: string) => fg(ICON_COLOR, s);

/**
 * Elige la forma según el ancho:
 * - grande (57+): isotipo de 7 filas, palabra de 4 y el lema debajo;
 * - media (31-56): los chevrones ">>" y la palabra de 3 filas;
 * - mínima: la línea de marca.
 */
export function renderLogo(opts: LogoOptions): string[] {
	const cols = len(ISO_LARGE[0]);
	if (opts.width >= LARGE_WIDTH) return large(opts, { upto: cols, cols, head: -1, glow: 1 });
	if (opts.width >= MEDIUM_WIDTH) return medium(opts);
	return [renderSmall(opts.width, opts.version)];
}

export interface Frame {
	lines: string[];
	/** Milisegundos que se ve antes del siguiente. */
	ms: number;
}

/** Hasta qué columna se recogen las ramas: el cruce de los chevrones. */
const CROSS = 12;

/**
 * Fotogramas de la animación del logo (unos 2,4 s): el isotipo grande entra de izquierda a
 * derecha con un frente brillante, se enciende la palabra, pausa, las ramas se recogen hasta el
 * cruce y queda la forma media, con solo los chevrones. Sin sitio para la forma grande, un único
 * fotograma con el logo quieto.
 */
export function logoFrames(opts: LogoOptions): Frame[] {
	if (opts.width < LARGE_WIDTH) return [{ lines: renderLogo(opts), ms: 0 }];
	const cols = len(ISO_LARGE[0]);
	const frames: Frame[] = [];
	for (let c = 1; c <= cols + 3; c++) frames.push({ lines: large(opts, { upto: Math.min(c, cols), cols, head: c - 1, glow: 0 }), ms: 22 });
	for (let i = 1; i <= 6; i++) frames.push({ lines: large(opts, { upto: cols, cols, head: -1, glow: i / 6 }), ms: 40 });
	frames[frames.length - 1].ms = 900;
	for (let c = cols - 1; c >= CROSS; c--) frames.push({ lines: large(opts, { upto: c, cols: c, head: -1, glow: 1 }), ms: 28 });
	frames[frames.length - 1].ms = 120;
	frames.push({ lines: medium(opts), ms: 0 });
	return frames;
}

/** Fotograma que toca a los `elapsed` ms de empezar, y si la animación ha terminado. */
export function frameAt(frames: Frame[], elapsed: number): { lines: string[]; done: boolean } {
	let t = 0;
	for (const f of frames) {
		t += f.ms;
		if (elapsed < t) return { lines: f.lines, done: false };
	}
	return { lines: frames[frames.length - 1].lines, done: true };
}

interface Out {
	isTTY?: boolean;
	columns?: number;
	write(s: string): unknown;
}

/**
 * Pinta el logo animado en la terminal y deja la forma media. Si la salida no es una terminal,
 * o no cabe la forma grande, lo pinta quieto. `indent` va delante de cada línea.
 */
export async function animateLogo(opts: LogoOptions, out: Out = process.stdout, indent = ""): Promise<void> {
	const frames = out.isTTY ? logoFrames(opts) : [];
	if (frames.length <= 1) {
		out.write(`${renderLogo(opts).map((l) => indent + l).join("\n")}\n`);
		return;
	}
	const show = () => out.write("\x1b[?25h");
	out.write("\x1b[?25l");
	process.once("exit", show);
	let prev = 0;
	for (const f of frames) {
		// Vuelve al principio del fotograma anterior, lo reescribe y borra lo que sobre debajo.
		const up = prev ? `\x1b[${prev}A\r` : "";
		out.write(`${up}${f.lines.map((l) => `\x1b[2K${indent}${l}`).join("\n")}\n${prev > f.lines.length ? "\x1b[J" : ""}`);
		prev = f.lines.length;
		if (f.ms) await new Promise((r) => setTimeout(r, f.ms));
	}
	show();
	process.removeListener("exit", show);
}

/**
 * Línea de marca para la salida de los scripts: "»» bond texto ───▪", con la traza apagándose
 * hacia la derecha hasta llenar `width`.
 */
export function renderSmall(width = 40, suffix = ""): string {
	if (width < 7) return width >= 4 ? bold(fg(WORD, "bond")) : "";
	let plainSuffix = suffix.replace(/\x1b\[[0-9;]*m/g, "");
	if (8 + len(plainSuffix) > width) suffix = plainSuffix = truncate(plainSuffix, width - 8);
	const head = `${gradientRow("»»", 2)} ${bold(fg(WORD, "bond"))}${suffix ? ` ${suffix}` : ""}`;
	const used = 7 + (suffix ? 1 + len(plainSuffix) : 0);
	const rest = width - used - 1; // espacio + traza + punto
	if (rest < 3) return head;
	const line = [...Array(rest - 1)].map((_, x) => fg(mix(TEAL, TRACE_FAR, x / (rest - 1)), "─")).join("");
	return `${head} ${line}${fg(TEAL, "▪")}`;
}
