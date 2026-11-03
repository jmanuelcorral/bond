// Instrucciones globales que bond lleva a cada agente: sus reglas (Herdr, delegación,
// privacidad) y las preferencias personales de ~/.bond/AGENTS.md. Van en un bloque entre marcas
// del fichero de instrucciones global de cada agente; lo de fuera del bloque no se toca.
// (Más adelante, `bond eject` las dejará como texto independiente.)

import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { agentInfo } from "./catalog-agents.mts";
import { withBlock } from "./repo.mts";
import { t } from "./messages.mts";
import { BOND_HOME } from "./runtime.mts";
import { act } from "./util.mts";

export const PERSONAL_FILE = join(BOND_HOME, "AGENTS.md");

/**
 * Reglas de bond, iguales para todos los agentes. Función, no constante: el idioma puede cambiar
 * en mitad del proceso (el asistente de `bond setup` llama a `setLang` tras preguntar) y una
 * constante de módulo se quedaría con el idioma anterior a la pregunta.
 */
const bondRules = () => t("gen.rules");

/** Semilla de ~/.bond/AGENTS.md cuando no existe. */
const personalTemplate = () => t("gen.personal_template");

/**
 * Primera vez: las instrucciones que tenías (el AGENTS.md personal de una instalación anterior,
 * sin las secciones de Herdr y de contexto, que ya cubren las reglas de bond y las tools de cada
 * agente); si no hay, una plantilla.
 */
function seedPersonal(legacy?: string): string {
	if (!legacy?.trim()) return personalTemplate();
	const keep = legacy.split(/^(?=## )/m).filter((s) => !/^## (Entorno Herdr|Contexto)\b/.test(s));
	return `${keep.join("").trimEnd()}\n`;
}

export function ensurePersonal(legacy?: string): void {
	if (existsSync(PERSONAL_FILE)) return;
	act(t("util.write", { file: PERSONAL_FILE }), () => {
		mkdirSync(BOND_HOME, { recursive: true });
		writeFileSync(PERSONAL_FILE, seedPersonal(legacy));
	});
}

function blockBody(): string {
	const personal = existsSync(PERSONAL_FILE) ? readFileSync(PERSONAL_FILE, "utf8").trim() : "";
	return `${personal ? `${personal}\n\n` : ""}${bondRules()}`;
}

const blockNote = () => t("gen.block_note");

/** El fichero tiene el bloque de bond y está al día con ~/.bond/AGENTS.md y las reglas. */
export function blockCurrent(file: string): boolean {
	if (!existsSync(file)) return false;
	const current = readFileSync(file, "utf8");
	return withBlock(current, blockBody(), "md", blockNote()) === current;
}

/**
 * Estado de un fichero de instrucciones. Son códigos, no texto: lo que se imprime se traduce en
 * el llamador (cli/setup.mts), que es consola de bond. Aquí no hay idioma porque lo que se
 * escribe en el fichero son las reglas, que no se traducen.
 */
export type PropagateResult = "updated" | "current" | "skipped";

/** Escribe el bloque de bond en el fichero de instrucciones global de cada agente. */
export function propagate(agents: string[]): Array<{ agent: string; file: string; result: PropagateResult; why?: "symlink" }> {
	const body = blockBody();
	const out = [];
	for (const id of agents) {
		const info = agentInfo(id);
		if (!info?.instructions) continue;
		const file = info.instructions();
		let isLink = false;
		try {
			isLink = lstatSync(file).isSymbolicLink();
		} catch {
			// No existe: se crea.
		}
		if (isLink) {
			out.push({ agent: id, file, result: "skipped" as const, why: "symlink" as const });
			continue;
		}
		const current = existsSync(file) ? readFileSync(file, "utf8") : "";
		const next = withBlock(current, body, "md", blockNote());
		if (next === current) {
			out.push({ agent: id, file, result: "current" as const });
			continue;
		}
		act(t("util.bond_block", { file }), () => {
			mkdirSync(dirname(file), { recursive: true });
			writeFileSync(file, next);
		});
		out.push({ agent: id, file, result: "updated" as const });
	}
	return out;
}
