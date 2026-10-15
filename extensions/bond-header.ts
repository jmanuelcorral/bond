/**
 * Cabecera de BOND al arrancar pi: logo de 4 filas con degradado de magenta a azul oscuro y
 * campo de diagonales (lib/bond-logo.mts). Se adapta al ancho: ancho, compacto o una línea.
 *
 * /header alterna entre esta cabecera y la de pi (con sus atajos de teclado).
 */

import { type ExtensionAPI, type ExtensionContext, type Theme, VERSION } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { randomStretch, renderLogo } from "../lib/bond-logo.mts";

export default function (pi: ExtensionAPI) {
	let enabled = true;
	// Como en Crush: se estira una letra al azar, una vez por proceso, para que no baile al redimensionar.
	const stretch = randomStretch();

	function render(theme: Theme, width: number): string[] {
		const logo = renderLogo({ width: width - 1, version: `pi v${VERSION}`, stretch });
		const hints = theme.fg("dim", "licence to code · /delegate /team /review /handoff /commit /header");
		return ["", ...logo.map((l) => ` ${l}`), truncateToWidth(` ${hints}`, width), ""];
	}

	function install(ctx: ExtensionContext) {
		if (ctx.mode !== "tui") return;
		ctx.ui.setHeader((_tui, theme) => ({
			render: (width: number) => render(theme, width),
			invalidate() {},
		}));
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
