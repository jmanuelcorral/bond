/**
 * Cabecera de bond al arrancar pi: el isotipo de la web con su degradado de índigo a teal y la
 * palabra "bond" (lib/bond-logo.mts). Entra animado y se queda en la forma media (">>" y la
 * palabra); en paneles estrechos sale quieto, en la forma que quepa.
 *
 * /header alterna entre esta cabecera y la de pi (con sus atajos de teclado).
 */

import { type ExtensionAPI, type ExtensionContext, type Theme, VERSION } from "@earendil-works/pi-coding-agent";
import { type TUI, truncateToWidth } from "@earendil-works/pi-tui";
import { type Frame, frameAt, LARGE_WIDTH, logoFrames } from "../lib/bond-logo.mts";

export default function (pi: ExtensionAPI) {
	let enabled = true;

	const version = `pi v${VERSION}`;
	// Lo que dura la animación (con la forma grande; en paneles estrechos no hay animación).
	const duration = logoFrames({ width: LARGE_WIDTH }).reduce((t, f) => t + f.ms, 0);

	function header(tui: TUI, theme: Theme) {
		const start = Date.now();
		let frames: { width: number; list: Frame[] } | undefined;
		// Mientras dura la animación, pide redibujar; al acabar, un último dibujo con la forma final.
		let timer: ReturnType<typeof setInterval> | undefined = setInterval(() => {
			if (Date.now() - start > duration) stop();
			tui.requestRender();
		}, 20);
		const stop = () => {
			if (timer) clearInterval(timer);
			timer = undefined;
		};
		return {
			render(width: number): string[] {
				if (frames?.width !== width) frames = { width, list: logoFrames({ width: width - 1, version }) };
				const { lines } = frameAt(frames.list, Date.now() - start);
				const hints = theme.fg("dim", "/delegate /team /review /handoff /commit /header");
				return ["", ...lines.map((l) => ` ${l}`), truncateToWidth(` ${hints}`, width), ""];
			},
			invalidate() {},
			dispose: stop,
		};
	}

	function install(ctx: ExtensionContext) {
		if (ctx.mode !== "tui") return;
		ctx.ui.setHeader(header);
	}

	pi.on("session_start", async (_event, ctx) => {
		if (enabled) install(ctx);
	});

	pi.registerCommand("header", {
		description: "Alterna entre la cabecera de BOND y la de pi",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			if (ctx.mode !== "tui") return;
			if (enabled) install(ctx);
			else ctx.ui.setHeader(undefined);
			ctx.ui.notify(enabled ? "Cabecera de BOND" : "Cabecera de pi", "info");
		},
	});
}
