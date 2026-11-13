// `bond app`: comprueba que `bond-app` está en el PATH, ejecuta `bond-app install`,
// abre herdr-app con el layout `bond` (`bond-app open`) y deja el orquestador en primer
// plano en la terminal (`bond-app start`).

import { spawn, spawnSync } from "node:child_process";
import { t } from "./messages.mts";
import { die, which } from "./util.mts";

export const appHelp = (): string => t("app.help");
export const APP_HELP = Object.assign(() => appHelp(), {
	toString: () => appHelp(),
	[Symbol.toPrimitive]: () => appHelp(),
	[Symbol.for("nodejs.util.inspect.custom")]: () => appHelp(),
});

export async function app(args: string[]): Promise<void> {
	if (args.includes("-h") || args.includes("--help")) {
		console.log(appHelp());
		return;
	}

	const bin = which("bond-app");
	if (!bin) {
		die(t("app.missing"));
	}

	// 1. Instala o actualiza layout, mods y temas en herdr-app
	const installRes = spawnSync(bin, ["install"], {
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	if (installRes.status !== 0) {
		process.exit(installRes.status ?? 1);
	}

	// 2. Abre herdr-app y cambia al layout bond
	const openRes = spawnSync(bin, ["open"], {
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	if (openRes.status !== 0) {
		process.exit(openRes.status ?? 1);
	}

	// 3. Arranca el orquestador en primer plano; ctrl+c para limpiamente
	const extraArgs = args.filter((a) => a !== "app");
	const startProc = spawn(bin, ["start", ...extraArgs], {
		stdio: "inherit",
		shell: process.platform === "win32",
	});

	await new Promise<void>((resolve) => {
		const cleanup = (sig: NodeJS.Signals) => {
			startProc.kill(sig);
		};
		process.on("SIGINT", () => cleanup("SIGINT"));
		process.on("SIGTERM", () => cleanup("SIGTERM"));

		startProc.on("exit", (code, signal) => {
			if (signal === "SIGINT" || signal === "SIGTERM") {
				process.exit(0);
			}
			process.exit(code ?? 0);
		});
	});
}
