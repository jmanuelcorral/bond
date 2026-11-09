/**
 * Textos de la consola de bond del área summary (resumen de sesión determinista, #87).
 *
 * Las claves se tipan contra `es`: si añades una clave aquí y no su traducción en `en`,
 * `npm run typecheck` falla.
 */

export const es = {
	"summary.unknown_agent": "agente desconocido para el resumen: {agent} (soportados: pi, claude, codex, agy)",
	"summary.no_session": "no encuentro una sesión de {agent} para {cwd}",
	"summary.unreadable": "no se puede leer la sesión {file}",
	"summary.no_exchanges": "la sesión {file} no tiene intercambios user/assistant reconocibles",
	"summary.title": "Resumen de sesión",
	"summary.session": "Sesión",
	"summary.model": "Modelo",
	"summary.generated": "Generado",
	"summary.repo": "Estado del repo",
	"summary.status": "git status",
	"summary.diff": "git diff --stat",
	"summary.clean": "limpio",
	"summary.exchanges": "Intercambios",
	"summary.role_user": "Usuario",
	"summary.role_assistant": "Asistente",
	"summary.command_help": `Uso: bond summary [agente] [opciones]

Resume la última sesión de un agente (pi, claude, codex o agy) de forma determinista:
los últimos intercambios user/assistant, el estado del repo y metadatos trazables,
en Markdown listo para pegar como contexto en otro agente. Lee los ficheros de
sesión de cada agente directamente: sin red y sin LLM.

Sin agente, coge el primero que tenga sesión en el directorio actual.

  -n, --tail N   últimos N intercambios (por defecto: 10)

Es la materia prima de la que se servirá \`bond handoff\` (#88).`,
	"summary.bad_tail": "--tail no válido: {value}",
	"summary.bad_arg": "argumento no reconocido: {arg}",
};

export const en: Record<keyof typeof es, string> = {
	"summary.unknown_agent": "unknown agent for the summary: {agent} (supported: pi, claude, codex, agy)",
	"summary.no_session": "no session of {agent} found for {cwd}",
	"summary.unreadable": "can't read session {file}",
	"summary.no_exchanges": "session {file} has no recognizable user/assistant exchanges",
	"summary.title": "Session summary",
	"summary.session": "Session",
	"summary.model": "Model",
	"summary.generated": "Generated",
	"summary.repo": "Repo status",
	"summary.status": "git status",
	"summary.diff": "git diff --stat",
	"summary.clean": "clean",
	"summary.exchanges": "Exchanges",
	"summary.role_user": "User",
	"summary.role_assistant": "Assistant",
	"summary.command_help": `Usage: bond summary [agent] [options]

Deterministically summarizes an agent's latest session (pi, claude, codex or agy):
the last user/assistant exchanges, repo status and traceable metadata, as Markdown
ready to paste as context into another agent. It reads each agent's session files
directly: no network, no LLM.

With no agent, picks the first one with a session in the current directory.

  -n, --tail N   keep the last N exchanges (default: 10)

This is the raw material \`bond handoff\` (#88) will use.`,
	"summary.bad_tail": "invalid --tail: {value}",
	"summary.bad_arg": "unrecognized argument: {arg}",
};
