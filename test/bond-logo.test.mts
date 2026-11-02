import { describe, expect, test } from "bun:test";
import { animateLogo, frameAt, INDIGO, LARGE_WIDTH, logoFrames, MEDIUM_WIDTH, ramp, renderLogo, renderSmall, TEAL } from "../lib/bond-logo.mts";

const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
const width = (s: string) => [...plain(s)].length;

describe("renderLogo", () => {
	test("ninguna línea se sale del ancho, de 1 a 140 columnas", () => {
		for (let w = 1; w <= 140; w++) {
			for (const line of renderLogo({ width: w, version: "pi v0.70.0" })) {
				expect(width(line)).toBeLessThanOrEqual(w);
			}
		}
	});

	test("elige la forma según el ancho", () => {
		expect(LARGE_WIDTH).toBe(57);
		expect(MEDIUM_WIDTH).toBe(31);
		expect(renderLogo({ width: LARGE_WIDTH })).toHaveLength(7);
		expect(renderLogo({ width: LARGE_WIDTH - 1 })).toHaveLength(4);
		expect(renderLogo({ width: MEDIUM_WIDTH })).toHaveLength(4);
		expect(renderLogo({ width: MEDIUM_WIDTH - 1 })).toHaveLength(1);
	});

	test("lleva la versión, la palabra y el lema", () => {
		const large = renderLogo({ width: 80, version: "v1.10.0" }).map(plain);
		expect(large[0].endsWith("v1.10.0")).toBe(true);
		expect(large[2]).toContain("█▀▀▀▀▄ ▄▀▀▀▀▄ █▀▀▀▀▄ ▄▀▀▀▀█");
		expect(large[5]).toContain("licence to code");
		const medium = renderLogo({ width: 45, version: "v1.10.0" }).map(plain);
		expect(medium[0].endsWith("v1.10.0")).toBe(true);
		expect(medium[0]).toStartWith(" ▀█▄ ▀█▄");
		expect(medium[2]).toBe("   ▄█▀ ▄█▀  █▀▀▄ ▄▀▀▄ █▀▀▄ ▄▀▀█");
		expect(plain(renderLogo({ width: 30, version: "v1.10.0" })[0])).toStartWith("»» bond v1.10.0 ");
	});

	test("recorta una versión o un lema demasiado largos", () => {
		const lines = renderLogo({ width: 60, version: "x".repeat(40), tagline: "y".repeat(80) }).map(plain);
		expect(lines[0]).toContain("…");
		expect(lines[5]).toContain("…");
	});

	test("el isotipo va del índigo al teal del logo", () => {
		const [r, g, b] = INDIGO;
		const [tr, tg, tb] = TEAL;
		const first = renderLogo({ width: 80 })[0];
		expect(first).toContain(`38;2;${r};${g};${b}m`);
		expect(first).toContain(`38;2;${tr};${tg};${tb}m`);
		expect(ramp(-1)).toEqual(INDIGO);
		expect(ramp(2)).toEqual(TEAL);
	});
});

describe("animación", () => {
	const opts = { width: 80, version: "pi v0.70.0" };

	test("entra el logo grande, se recogen las ramas y queda la forma media", () => {
		const frames = logoFrames(opts);
		expect(frames.length).toBeGreaterThan(40);
		expect(frames[0].lines).toHaveLength(7);
		expect(plain(frames[0].lines.join(""))).not.toContain("bond"); // la palabra aún no se ve
		const full = frames.find((f) => f.ms >= 900);
		expect(full?.lines).toEqual(renderLogo(opts)); // la pausa es el logo grande quieto
		expect(frames[frames.length - 1].lines).toEqual(renderLogo({ ...opts, width: 40 }));
		const total = frames.reduce((t, f) => t + f.ms, 0);
		expect(total).toBeGreaterThan(1500);
		expect(total).toBeLessThan(3500);
		for (const f of frames) for (const l of f.lines) expect(width(l)).toBeLessThanOrEqual(opts.width);
	});

	test("sin sitio para la forma grande, un solo fotograma quieto", () => {
		const frames = logoFrames({ ...opts, width: 45 });
		expect(frames).toHaveLength(1);
		expect(frames[0].lines).toEqual(renderLogo({ ...opts, width: 45 }));
	});

	test("frameAt elige el fotograma por el tiempo transcurrido", () => {
		const frames = logoFrames(opts);
		expect(frameAt(frames, 0)).toEqual({ lines: frames[0].lines, done: false });
		expect(frameAt(frames, 60_000)).toEqual({ lines: frames[frames.length - 1].lines, done: true });
	});

	test("fuera de una terminal, el logo quieto y sin códigos de control", async () => {
		let out = "";
		await animateLogo(opts, { isTTY: false, write: (s: string) => (out += s) });
		expect(out).toBe(`${renderLogo(opts).join("\n")}\n`);
	});

	test("en una terminal, anima, oculta el cursor y lo devuelve", async () => {
		let out = "";
		await animateLogo(opts, { isTTY: true, write: (s: string) => (out += s) }, "  ");
		expect(out).toStartWith("\x1b[?25l");
		expect(out).toEndWith("\x1b[?25h");
		expect(out).toContain(`\x1b[2K  ${renderLogo({ ...opts, width: 40 })[3]}`);
	});
});

describe("renderSmall", () => {
	test("llena el ancho con la traza y su punto", () => {
		const line = renderSmall(60, "equipo en bond");
		expect(plain(line)).toStartWith("»» bond equipo en bond ─");
		expect(plain(line)).toEndWith("▪");
		expect(width(line)).toBe(60);
	});

	test("sin sitio para la traza, solo la marca y el texto, recortado al ancho", () => {
		expect(plain(renderSmall(16, "setup"))).toBe("»» bond setup");
		expect(plain(renderSmall(12, "equipo en bond"))).toBe("»» bond equ…");
		expect(plain(renderSmall(5, "setup"))).toBe("bond");
		for (let w = 1; w <= 80; w++) expect(width(renderSmall(w, "equipo en bond"))).toBeLessThanOrEqual(w);
	});
});
