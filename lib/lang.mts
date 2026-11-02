/**
 * Idioma de lo que bond imprime por consola: BOND_LANG > [ui] lang de ~/.bond/config.toml >
 * locale del entorno. Sin dependencias (en el binario las extensiones no tienen node_modules):
 * config.toml se lee a mano, solo su sección [ui], igual que los iconos del pie.
 *
 * Lo que reciben los agentes (las reglas de cli/instructions.mts) no pasa por aquí: sigue en
 * español y el idioma en que cada agente responde lo decide el AGENTS.md del usuario.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type Lang = "es" | "en";
export const LANGS: Lang[] = ["es", "en"];

const asLang = (v: string | undefined): Lang | undefined => {
	const s = v?.trim().toLowerCase();
	return LANGS.find((x) => x === s);
};

/** "ES ", "en" -> Lang; undefined si no es un idioma que bond soporte. */
export const parseLang = asLang;

/** `lang` de la sección [ui] de un config.toml (lo escribe bond setup); undefined si no está o no es válido. */
export function langFromConfig(toml: string): Lang | undefined {
	let inUi = false;
	for (const line of toml.split(/\r?\n/)) {
		const section = /^\s*\[([^\]]*)\]/.exec(line);
		if (section) inUi = section[1].trim() === "ui";
		else if (inUi) {
			const m = /^\s*lang\s*=\s*["']([^"']*)["']/.exec(line);
			if (m) return asLang(m[1]);
		}
	}
	return undefined;
}

/** Orden de gettext: LC_ALL manda, luego LANGUAGE (lista de preferencias), LC_MESSAGES y LANG. */
const LOCALE_VARS = ["LC_ALL", "LANGUAGE", "LC_MESSAGES", "LANG"] as const;

/**
 * Idioma del locale del entorno: `es` si la etiqueta empieza por es, `en` en caso contrario.
 * `C` y `POSIX` no dicen nada, y tampoco una variable vacía: undefined si nada aporta un idioma.
 */
export function detectLang(env: Record<string, string | undefined> = process.env): Lang | undefined {
	for (const name of LOCALE_VARS) {
		const value = env[name]?.trim();
		if (!value || value === "C" || value === "POSIX") continue;
		// "es_ES.UTF-8", "es:en", "es-419", "EN_US" -> "es" | "en"
		const tag = value.toLowerCase().split(/[:;._-\s]/)[0];
		if (tag.startsWith("es")) return "es";
		return "en";
	}
	return undefined;
}

/**
 * Idioma de la CLI: BOND_LANG (es o en) manda; si no, [ui] lang de ~/.bond/config.toml (lo
 * pregunta bond setup); si no, el locale del entorno; si nada dice idioma, español.
 */
export function resolveLang(env: Record<string, string | undefined> = process.env, readConfig = defaultConfigText): Lang {
	return asLang(env.BOND_LANG) ?? langFromConfig(readConfig(env)) ?? detectLang(env) ?? "es";
}

function defaultConfigText(env: Record<string, string | undefined>): string {
	try {
		return readFileSync(join(env.BOND_HOME || join(homedir(), ".bond"), "config.toml"), "utf8");
	} catch {
		return "";
	}
}
