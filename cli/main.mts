// Punto de entrada de `bond`: interpreta el subcomando y delega.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomStretch, renderLogo } from "../lib/bond-logo.mts";
import { DOCTOR_HELP, doctor } from "./doctor.mts";
import { SETUP_HELP, setup } from "./setup.mts";
import { die, REPO_DIR, setDryRun } from "./util.mts";

// Ancho de la terminal; si la salida no es una terminal, $COLUMNS o 80.
const termWidth = () => process.stdout.columns || Number(process.env.COLUMNS) || 80;

const VERSION = JSON.parse(readFileSync(join(REPO_DIR, "package.json"), "utf8")).version as string;

// Subcomandos que de momento son los scripts de bin/ (se migrarán a TypeScript más adelante).
const SCRIPTS: Record<string, { script: string; summary: string }> = {
	dev: { script: "pidev", summary: "Workspace de Herdr con un agente y tu shell (--kind, --worktree)" },
	team: { script: "piteam", summary: "Un agente por rama, cada uno en su worktree" },
	status: { script: "pistatus", summary: "Agentes vivos en Herdr" },
	sessions: { script: "pisessions", summary: "Sesiones de pi y cómo retomarlas" },
};

function help(): void {
	const logo = renderLogo({ width: Math.min(termWidth(), 72), version: `v${VERSION}`, stretch: randomStretch() });
	console.log(`${logo.join("\n")}

Uso: bond <comando> [opciones]   (bond <comando> --help para el detalle)

Máquina
  setup        Deja la máquina lista: pi, configuración, Herdr, bond en el PATH
  doctor       Comprueba la instalación y lo que depende de fuera
  models       Registro global de modelos y su configuración en cada agente
  run          Lanza un agente con su entorno de modelos (hoy: copilot)

Herdr
${Object.entries(SCRIPTS)
	.map(([name, s]) => `  ${name.padEnd(12)} ${s.summary}`)
	.join("\n")}

Otros
  logo         El logo de BOND
  version      Versión de bond`);
}

async function main(argv: string[]): Promise<void> {
	const [cmd, ...rest] = argv;
	const wantsHelp = rest.includes("-h") || rest.includes("--help");
	setDryRun(rest.includes("--dry-run"));

	switch (cmd) {
		case undefined:
		case "help":
		case "-h":
		case "--help":
			return help();
		case "version":
		case "--version":
		case "-v":
			return console.log(VERSION);
		case "setup":
			return wantsHelp ? console.log(SETUP_HELP) : setup(rest);
		case "doctor":
			return wantsHelp ? console.log(DOCTOR_HELP) : doctor(rest);
		// models y run dependen de smol-toml: se cargan solo al usarlos, para que `bond setup`
		// funcione en un clon recién descargado, antes de instalar dependencias.
		case "models": {
			const m = await import("./models.mts");
			return wantsHelp ? console.log(m.MODELS_HELP) : m.models(rest);
		}
		case "run": {
			const r = await import("./run.mts");
			return wantsHelp && rest.length <= 1 ? console.log(r.RUN_HELP) : r.runAgent(rest);
		}
		case "logo": {
			return console.log(renderLogo({ width: termWidth(), version: `v${VERSION}`, stretch: randomStretch() }).join("\n"));
		}
	}

	const script = SCRIPTS[cmd];
	if (!script) die(`comando desconocido: ${cmd} (bond help)`, 2);
	const r = spawnSync(join(REPO_DIR, "bin", script.script), rest, { stdio: "inherit" });
	process.exitCode = r.status ?? 1;
}

await main(process.argv.slice(2));
