// `bond app`: comprueba que `bond-app` está en el PATH, ejecuta `bond-app install`,
// abre herdr-app con el layout `bond` (`bond-app open`) y deja el orquestador en primer
// plano en la terminal (`bond-app start`).

import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import { t } from "./messages.mts";
import { die, which } from "./util.mts";

export const appHelp = (): string => t("app.help");
export const APP_HELP = Object.assign(() => appHelp(), {
	toString: () => appHelp(),
	[Symbol.toPrimitive]: () => appHelp(),
	[Symbol.for("nodejs.util.inspect.custom")]: () => appHelp(),
});

export async function app(args: string[]): Promise<void> {
	let port: string | undefined;
	let host: string | undefined;
	let dataDir: string | undefined;
	let home: string | undefined;
	let tokenFile: string | undefined;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-h" || arg === "--help") {
			console.log(appHelp());
			return;
		}
		if (arg === "app") {
			continue;
		}
		if (arg === "--port") {
			const v = args[++i];
			if (!v || v.startsWith("--")) die(t("app.option_needs_value", { option: arg }));
			port = v;
		} else if (arg === "--host") {
			const v = args[++i];
			if (!v || v.startsWith("--")) die(t("app.option_needs_value", { option: arg }));
			host = v;
		} else if (arg === "--data-dir") {
			const v = args[++i];
			if (!v || v.startsWith("--")) die(t("app.option_needs_value", { option: arg }));
			dataDir = v;
		} else if (arg === "--home") {
			const v = args[++i];
			if (!v || v.startsWith("--")) die(t("app.option_needs_value", { option: arg }));
			home = v;
		} else if (arg === "--token-file") {
			const v = args[++i];
			if (!v || v.startsWith("--")) die(t("app.option_needs_value", { option: arg }));
			tokenFile = v;
		} else {
			die(t("app.unknown_option", { option: arg }));
		}
	}

	const bin = which("bond-app");
	if (!bin) {
		die(t("app.missing"));
	}

	// 1. Instala o actualiza layout, mods y temas en herdr-app
	const installArgs = ["install"];
	if (port || host) {
		const h = host || "127.0.0.1";
		const p = port || "3000";
		installArgs.push("--api", `http://${h}:${p}/api/v1`);
	}
	if (home) installArgs.push("--home", home);
	if (tokenFile) installArgs.push("--token-file", tokenFile);
	else if (dataDir) installArgs.push("--token-file", join(dataDir, "token"));

	const installRes = spawnSync(bin, installArgs, {
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	if (installRes.status !== 0) {
		process.exit(installRes.status ?? 1);
	}

	// 2. Abre herdr-app y cambia al layout bond
	const openArgs = ["open"];
	if (home) openArgs.push("--home", home);

	const openRes = spawnSync(bin, openArgs, {
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	if (openRes.status !== 0) {
		process.exit(openRes.status ?? 1);
	}

	// 3. Arranca el orquestador en primer plano; ctrl+c para limpiamente
	const startArgs = ["start"];
	if (port) startArgs.push("--port", port);
	if (host) startArgs.push("--host", host);
	if (dataDir) startArgs.push("--data-dir", dataDir);

	const startProc = spawn(bin, startArgs, {
		stdio: "inherit",
		shell: process.platform === "win32",
	});

	startProc.on("error", (err) => {
		die(t("app.spawn_error", { error: err.message }));
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
