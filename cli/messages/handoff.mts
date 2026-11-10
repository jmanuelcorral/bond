/**
 * Textos de la consola de bond del área handoff (propuesta de traspaso por presupuesto, #88).
 *
 * Las claves se tipan contra `es`: si añades una clave aquí y no su traducción en `en`,
 * `npm run typecheck` falla.
 */

export const es = {
	"handoff.title": "Propuesta de traspaso desde {from} ({state})",
	"handoff.generated": "Generado",
	"handoff.no_herdr": "no estoy en un panel de Herdr: dime el agente origen con --from",
	"handoff.no_candidates": "no hay candidatos a los que traspasar: todos los agentes de la config son el origen o están fuera de alcance",
	"handoff.all_unknown": "todos los candidatos están en `unknown` (sin señal de presupuesto): elige tú; el resumen y los comandos siguen sirviendo",
	"handoff.table_header": "| agente | estado | ventanas | fuente |",
	"handoff.table_rule": "| --- | --- | --- | --- |",
	"handoff.summary_section": "Resumen de la sesión",
	"handoff.summary_file": "Resumen escrito en {file}",
	"handoff.summary_none": "sin resumen: no encontré una sesión legible del agente origen",
	"handoff.commands_section": "Comandos para continuar (bond no ejecuta nada: tú lanzas el que elijas)",
	"handoff.command_row": "- {agent}: `{command}`",
	"handoff.prompt": "Retoma el trabajo de la sesión anterior: el resumen completo está en {file}. Empieza leyéndolo.",
	"handoff.prompt_nofile": "La sesión anterior se quedó sin presupuesto. Pregúntame qué estábamos haciendo y seguimos desde ahí.",
};

export const en: Record<keyof typeof es, string> = {
	"handoff.title": "Handoff proposal from {from} ({state})",
	"handoff.generated": "Generated",
	"handoff.no_herdr": "not inside a Herdr pane: tell me the source agent with --from",
	"handoff.no_candidates": "no candidates to hand off to: every agent in the config is the source or out of scope",
	"handoff.all_unknown": "every candidate is `unknown` (no budget signal): you pick; the summary and the commands are still useful",
	"handoff.table_header": "| agent | state | windows | source |",
	"handoff.table_rule": "| --- | --- | --- | --- |",
	"handoff.summary_section": "Session summary",
	"handoff.summary_file": "Summary written to {file}",
	"handoff.summary_none": "no summary: found no readable session for the source agent",
	"handoff.commands_section": "Commands to continue (bond runs nothing: you launch whichever you pick)",
	"handoff.command_row": "- {agent}: `{command}`",
	"handoff.prompt": "Pick up the previous session's work: the full summary is at {file}. Start by reading it.",
	"handoff.prompt_nofile": "The previous session ran out of budget. Ask me what we were doing and continue from there.",
};
