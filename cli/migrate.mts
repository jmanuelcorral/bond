// Migración de una instalación anterior (bond 0.7 / piSetup) a la 1.0: la config de pi estaba
// enlazada a ficheros del repo de bond (pi/agent/*) y el paquete de pi se cargaba globalmente.
// Ahora cada fichero es tuyo (una copia real) y las Bond Extensions se cargan por repo.
// Idempotente: sin nada que migrar no hace nada. `bond setup` la ejecuta siempre.

import { lstatSync, readFileSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { t } from "./messages.mts";
import { act, AGENT_DIR, log, STAMP, warn } from "./util.mts";

const isLink = (p: string) => {
	try {
		return lstatSync(p).isSymbolicLink();
	} catch {
		return false;
	}
};

/** ¿Es un enlace a la config personal que vivía en el repo (…/pi/agent/<fichero>)? */
const legacyLink = (p: string, file: string) => isLink(p) && readlinkSync(p).replace(/\\/g, "/").endsWith(`/pi/agent/${file}`);

/** Paquetes de pi que eran el repo de bond cargado globalmente. */
const LEGACY_PACKAGES = new Set(["./bond", "./pisetup", "~/.pi/agent/bond", "~/.pi/agent/pisetup"]);

export interface MigrationResult {
	actions: string[];
	/** Contenido del AGENTS.md personal de antes, para sembrar ~/.bond/AGENTS.md. */
	legacyInstructions?: string;
}

export function migrateLegacy(): MigrationResult {
	const actions: string[] = [];
	let legacyInstructions: string | undefined;

	for (const file of ["settings.json", "mcp.json", "AGENTS.md"]) {
		const p = join(AGENT_DIR, file);
		if (!legacyLink(p, file)) continue;
		let content: string | undefined;
		try {
			content = readFileSync(realpathSync(p), "utf8");
		} catch {
			warn(t("migrate.broken_link", { path: p }));
		}
		act(t("migrate.act_own_file", { path: p }), () => {
			if (content !== undefined) writeFileSync(`${p}.bak.${STAMP}`, content);
			rmSync(p);
			if (content === undefined) return;
			if (file === "settings.json") {
				const s = JSON.parse(content) as Record<string, unknown>;
				// El repo de bond como paquete global: ahora las Bond Extensions van por repo (bond init).
				if (Array.isArray(s.packages)) {
					s.packages = (s.packages as unknown[]).filter((x) => !(typeof x === "string" && LEGACY_PACKAGES.has(x)));
					if (!(s.packages as unknown[]).length) delete s.packages;
				}
				writeFileSync(p, `${JSON.stringify(s, null, 2)}\n`);
			} else if (file === "AGENTS.md") {
				// Tus instrucciones pasan a ~/.bond/AGENTS.md; aquí queda el bloque que escribe bond.
				legacyInstructions = content;
				writeFileSync(p, "");
			} else {
				writeFileSync(p, content);
			}
		});
		actions.push(t("migrate.action_own_file", { file, bak: `${file}.bak.${STAMP}` }));
	}

	for (const name of ["bond", "pisetup"]) {
		const p = join(AGENT_DIR, name);
		if (!isLink(p)) continue;
		act(`rm ${p}`, () => rmSync(p));
		actions.push(t("migrate.action_removed_pkg", { name }));
	}
	const prompts = join(AGENT_DIR, "prompts");
	if (isLink(prompts) && /\/(pi\/agent\/)?prompts$/.test(readlinkSync(prompts))) {
		act(`rm ${prompts}`, () => rmSync(prompts));
		actions.push(t("migrate.action_removed_prompts"));
	}
	for (const a of actions) log(t("migrate.log", { action: a }));
	return { actions, legacyInstructions };
}

