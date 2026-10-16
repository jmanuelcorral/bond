// Instrucciones globales que bond lleva a cada agente: sus reglas (Herdr, delegación,
// privacidad) y las preferencias personales de ~/.bond/AGENTS.md. Van en un bloque entre marcas
// del fichero de instrucciones global de cada agente; lo de fuera del bloque no se toca.
// (Más adelante, `bond eject` las dejará como texto independiente.)

import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { agentInfo } from "./catalog-agents.mts";
import { withBlock } from "./repo.mts";
import { BOND_HOME, FROM_SOURCE } from "./runtime.mts";
import { act, REPO_DIR } from "./util.mts";

export const PERSONAL_FILE = join(BOND_HOME, "AGENTS.md");

/** Reglas de bond, iguales para todos los agentes. */
const BOND_RULES = `## Bond: Herdr y otros agentes

- Puedes estar dentro de un panel de Herdr (\`HERDR_ENV=1\`). Usa Herdr (paneles, otros agentes,
  workspaces, worktrees) solo cuando el usuario lo pida o lo pida un comando como /delegate o
  /team; no por iniciativa propia porque algo tarde o se pueda paralelizar. El skill \`herdr\`
  explica cómo; la sintaxis la manda \`herdr <grupo>\`.
- Para delegar en otro agente o repartir trabajo en worktrees, usa los skills
  \`bond-delegate\` y \`bond-team\`.
- No cierres workspaces, paneles, agentes ni sesiones que no hayas creado tú. No ejecutes
  \`herdr\` sin subcomando.
- No mandes código ni datos privados a búsquedas web: busca el mensaje de error, no el fichero.`;

const PERSONAL_TEMPLATE = `# Mis instrucciones para todos los agentes

<!-- bond las lleva al fichero de instrucciones global de cada agente (bond setup).
     Idioma, estilo, cómo trabajas, reglas de git... -->
`;

/** Primera vez: si hay un AGENTS.md personal en el repo de bond, sus secciones propias; si no, plantilla. */
function seedPersonal(): string {
	const legacy = join(REPO_DIR, "pi", "agent", "AGENTS.md");
	if (!FROM_SOURCE || !existsSync(legacy)) return PERSONAL_TEMPLATE;
	// Las secciones de Herdr y de contexto ya las cubren las reglas de bond y las tools de cada agente.
	const sections = readFileSync(legacy, "utf8").split(/^(?=## )/m);
	const keep = sections.filter((s) => !/^## (Entorno Herdr|Contexto)\b/.test(s));
	return `${keep.join("").trimEnd()}\n`;
}

export function ensurePersonal(): void {
	if (existsSync(PERSONAL_FILE)) return;
	act(`escribir ${PERSONAL_FILE}`, () => {
		mkdirSync(BOND_HOME, { recursive: true });
		writeFileSync(PERSONAL_FILE, seedPersonal());
	});
}

function blockBody(): string {
	const personal = existsSync(PERSONAL_FILE) ? readFileSync(PERSONAL_FILE, "utf8").trim() : "";
	return `${personal ? `${personal}\n\n` : ""}${BOND_RULES}`;
}

/** Escribe el bloque de bond en el fichero de instrucciones global de cada agente. */
export function propagate(agents: string[]): Array<{ agent: string; file: string; result: "actualizado" | "al día" | "omitido"; why?: string }> {
	const body = blockBody();
	const out = [];
	for (const id of agents) {
		const info = agentInfo(id);
		if (!info) continue;
		const file = info.instructions();
		let isLink = false;
		try {
			isLink = lstatSync(file).isSymbolicLink();
		} catch {
			// No existe: se crea.
		}
		if (isLink) {
			out.push({ agent: id, file, result: "omitido" as const, why: "es un enlace (config personal enlazada; se migra en bond 1.0)" });
			continue;
		}
		const current = existsSync(file) ? readFileSync(file, "utf8") : "";
		const next = withBlock(current, body, "md", "generado por bond setup; no editar: cambia ~/.bond/AGENTS.md");
		if (next === current) {
			out.push({ agent: id, file, result: "al día" as const });
			continue;
		}
		act(`bloque de bond en ${file}`, () => {
			mkdirSync(dirname(file), { recursive: true });
			writeFileSync(file, next);
		});
		out.push({ agent: id, file, result: "actualizado" as const });
	}
	return out;
}
