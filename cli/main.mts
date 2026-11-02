// Punto de entrada de `bond`: interpreta el subcomando y delega.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { animateLogo } from "../lib/bond-logo.mts";
import { DOCTOR_HELP, doctor } from "./doctor.mts";
import { langFlag, setup, setupHelp } from "./setup.mts";
import { assetsDir, VERSION } from "./runtime.mts";
import { die, run, setDryRun } from "./util.mts";
import { setLang, t } from "./messages.mts";

// Ancho de la terminal; si la salida no es una terminal, $COLUMNS o 80.
const termWidth = () => process.stdout.columns || Number(process.env.COLUMNS) || 80;

export const mainHelp = (): string => t("main.help");

const printHelp = (h: unknown) => console.log(typeof h === "function" ? (h as () => string)() : h);

async function help(): Promise<void> {
	await animateLogo({ width: Math.min(termWidth(), 72), version: `v${VERSION}` });
	console.log(`\n${mainHelp()}`);
}

/**
 * Ficheros de bond en disco. Desde el binario se extraen la primera vez de cada versión, y lo
 * que aún usa los de otra versión (tras bond update, brew upgrade...) pasa a estos.
 * Con `offer` (al abrir el puesto de trabajo), ofrece la versión nueva si la hay.
 */
async function prepare(opts: { offer?: boolean } = {}): Promise<void> {
	await assetsDir();
	const { cleanupOld, offerUpdate, refreshRuntime } = await import("./update.mts");
	cleanupOld();
	await refreshRuntime();
	// Actualizado: los ficheros de esta versión ya no están, así que sigue el binario nuevo.
	if (opts.offer && (await offerUpdate()) === "updated") {
		process.exit(spawnSync(process.execPath, process.argv.slice(2), { stdio: "inherit" }).status ?? 1);
	}
}

async function main(argv: string[]): Promise<void> {
	const [cmd, ...rest] = argv;
	const wantsHelp = rest.includes("-h") || rest.includes("--help");
	setDryRun(rest.includes("--dry-run"));
	// bond dev y bond team (no sus subcomandos) abren el puesto de trabajo: ahí se ofrece actualizar.
	const workstation = !wantsHelp && (cmd === "dev" || (cmd === "team" && !["status", "prompt", "clean"].includes(rest[0] ?? "")));
	// Desde el binario, los ficheros de bond se extraen la primera vez (salvo para la ayuda).
	if (cmd && !["help", "-h", "--help", "version", "--version", "-v", "logo"].includes(cmd)) await prepare({ offer: workstation });

	// `bond` a secas dentro de un repo: abre su puesto de trabajo (fuera de un repo, la ayuda).
	if (cmd === undefined || (cmd.startsWith("-") && !["-h", "--help", "-v", "--version"].includes(cmd))) {
		const inRepo = run("git", ["rev-parse", "--show-toplevel"]).status === 0 || existsSync(".bond/bond.toml");
		if (!inRepo && cmd === undefined) return help();
		await prepare({ offer: !argv.includes("-h") && !argv.includes("--help") });
		const l = await import("./launch.mts");
		return argv.includes("-h") || argv.includes("--help") ? printHelp(l.LAUNCH_HELP) : l.launch(argv, { dev: false });
	}

	switch (cmd) {
		case "help":
		case "-h":
		case "--help":
			return help();
		case "version":
		case "--version":
		case "-v":
			return console.log(VERSION);
		case "setup": {
			// El idioma del flag se aplica antes de imprimir, para que --lang valga también para la ayuda.
			const l = langFlag(rest);
			if (l) setLang(l);
			return wantsHelp ? console.log(setupHelp()) : setup(rest);
		}
		case "doctor":
			return wantsHelp ? printHelp(DOCTOR_HELP) : doctor(rest);
		// models y run dependen de smol-toml: se cargan solo al usarlos, para que `bond setup`
		// funcione en un clon recién descargado, antes de instalar dependencias.
		case "models": {
			const m = await import("./models.mts");
			return wantsHelp ? printHelp(m.MODELS_HELP) : m.models(rest);
		}
		case "run": {
			const r = await import("./run.mts");
			return wantsHelp && rest.length <= 1 ? printHelp(r.RUN_HELP) : r.runAgent(rest);
		}
		case "init":
		case "sync": {
			const r = await import("./repo.mts");
			if (wantsHelp) return printHelp(cmd === "init" ? r.INIT_HELP : r.SYNC_HELP);
			return cmd === "init" ? r.init(rest) : r.sync(rest);
		}
		case "decisions": {
			const d = await import("./decisions.mts");
			return wantsHelp ? printHelp(d.DECISIONS_HELP) : d.decisions(rest);
		}
		case "hub": {
			const h = await import("./hub.mts");
			return h.hub(rest);
		}
		case "catalog": {
			const c = await import("./catalog.mts");
			return wantsHelp ? printHelp(c.CATALOG_HELP) : c.catalogCommand(rest);
		}
		case "dev":
		case "team":
		case "status": {
			const l = await import("./launch.mts");
			if (cmd === "team") {
				const t = await import("./team.mts");
				return wantsHelp ? printHelp(t.TEAM_HELP) : t.team(rest);
			}
			if (wantsHelp) return printHelp(cmd === "status" ? t("main.status_help") : l.LAUNCH_HELP);
			if (cmd === "dev") return l.launch(rest, { dev: true });
			return l.status(rest);
		}
		case "sessions":
			return (await import("./sessions.mts")).sessions(rest);
		case "migrate": {
			// Migra una instalación anterior sin pasar por el asistente (bond setup también lo hace).
			const { migrateLegacy } = await import("./migrate.mts");
			const { ensurePersonal, propagate } = await import("./instructions.mts");
			const r = migrateLegacy();
			if (r.legacyInstructions !== undefined) {
				ensurePersonal(r.legacyInstructions);
				propagate(["pi"]);
			}
			if (!r.actions.length) console.log(t("main.migrate_nothing"));
			return;
		}
		case "update": {
			const u = await import("./update.mts");
			return wantsHelp ? printHelp(u.UPDATE_HELP) : u.update(rest);
		}
		// Lo lanza bond update con el binario nuevo: extrae sus ficheros y limpia (lo hace prepare).
		case "_runtime":
			return;
		case "key":
			return (await import("./keys.mts")).keyCommand(rest);
		case "logo":
			return animateLogo({ width: termWidth(), version: `v${VERSION}` });
	}
	die(t("main.unknown_cmd", { cmd }), 2);
}

await main(process.argv.slice(2));
