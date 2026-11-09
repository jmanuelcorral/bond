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
};
