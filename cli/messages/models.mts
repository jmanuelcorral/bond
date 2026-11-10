/**
 * Textos de la consola de bond del área comandos models y keys.
 *
 * Las claves se tipan contra `es`: si añades una clave aquí y no su traducción en `en`,
 * `npm run typecheck` falla. Este fichero lo mantiene una sola rama del equipo del i18n:
 * no lo edites desde dos ramas a la vez.
 */

export const es = {
	"models.help": `Uso: bond models <subcomando> [opciones]

Registro global de modelos en {file}: se declaran una vez y bond genera la
configuración de cada agente que pueda usarlos.

  init              Crea config.toml (importa los proveedores del models.json de pi, si hay)
  list              Proveedores, modelos y qué agentes pueden usarlos
  probe [id...]     Pregunta a cada pasarela qué APIs sirve (chat, responses, messages)
  sync [opciones]   Escribe la configuración de modelos de cada agente
      --agent <a>   Solo ese agente (repetible): pi, opencode, crush; codex solo limpia su bloque huérfano
      --dry-run     Enseña los cambios sin escribir
      --check       No escribe; sale con 1 si algún agente está desfasado
  path              Ruta de config.toml

Agentes: pi, opencode y Crush usan la API de chat; Copilot se lanza con \`bond run copilot\`.
Codex usa su cuenta oficial (bond no lo aprovisiona). Claude Code no puede usar
pasarelas compatibles con OpenAI.`,
	"models.unknown_sub": "subcomando desconocido: models {sub} (bond models --help)",
	"models.init_exists": "ya existe {file} (--force para recrearlo; se guarda copia)",
	"models.init_created_imported": "creado {file} (importado de {source})",
	"models.init_created_empty": "creado {file} (vacío, con un ejemplo)",
	"models.list_none": "Sin proveedores. Edita {file} (bond models init crea uno de ejemplo).",
	"models.list_disabled": " (desactivado)",
	"models.list_apis_declared": " (declaradas)",
	"models.list_apis_probe": " (probe {date})",
	"models.list_apis_assumed": " (supuesto: bond models probe)",
	"models.list_not_served": "  no lo sirve la pasarela",
	"models.list_disabled_tag": "(desactivado)",
	"models.list_agents": "  agentes: {agents}",
	"models.probe_no_match": "ningún proveedor coincide: {ids}",
	"models.probe_var_undefined": "{id}: la variable {var} no está definida",
	"models.probe_models_failed": "{id}: GET /models falló ({err})",
	"models.probe_no_active_models": "{id}: sin modelos activos que probar",
	"models.probe_models_serves": "sirve {count}",
	"models.probe_models_unavailable": "lista no disponible",
	"models.probe_models_missing": "; no sirve {missing}",
	"models.probe_models_summary": "modelos: {status}{missing}",
	"models.probe_empty_reasoning": "responde vacía por presupuesto de razonamiento: si es un modelo razonador, decláralo con reasoning = true",
	"models.probe_apis_note": "\nNota: los proveedores con 'apis' en config.toml usan lo declarado, no lo detectado.",
	"models.sync_unsupported_agent": "agente sin generador de modelos: {agent} (pi, opencode, crush; codex solo se le limpia el bloque huérfano)",
	"models.sync_api_unsupported": "{id}: la pasarela no sirve la API {api}",
	"models.sync_up_to_date": "al día",
	"models.sync_outdated": "desfasado",
	"models.sync_comments_warn": "{file} tiene comentarios; al reescribirlo se pierden (queda copia .bak)",
	"models.sync_would_change": "cambiaría",
	"models.sync_updated": "actualizado",
	"models.sync_verify": "    {models}  → comprobar: {verify}",
	"models.sync_not_installed": "no instalados (se omiten): {agents}  · forzar: --agent <a>",
	"models.sync_agent_needs_val": "--agent necesita un valor",
	"models.sync_unknown_opt": "opción desconocida: {opt} (bond models --help)",
	"models.note_opencode": "formato de opencode v2: providers.<id>.settings.baseURL",
	"models.note_crush": "crushrc es un script de bash; si defines a mano un proveedor con el mismo id, bond no lo duplica",
	"models.note_codex": "codex: usa su cuenta oficial; bond no lo aprovisiona",
	"models.sync_codex_no_orphan": "cuenta oficial: no hay bloque huérfano que limpiar",
	"models.sync_cleaned_codex": "bloque huérfano eliminado (backup creado)",
	"models.sync_would_clean_codex": "eliminaría bloque huérfano",
	"models.sync_orphan_block": "bloque huérfano de bond presente (ejecuta bond models sync)",
	"models.crush_skipped_manual": "ya definido a mano en crushrc (fuera del bloque de bond)",
} as const;

export const en: Record<keyof typeof es, string> = {
	"models.help": `Usage: bond models <subcommand> [options]

Global model registry in {file}: declare once, and bond generates the
configuration for each agent that can use them.

  init              Create config.toml (import providers from pi's models.json if present)
  list              Providers, models, and which agents can use them
  probe [id...]     Ask each gateway which APIs it serves (chat, responses, messages)
  sync [options]    Write the model configuration for each agent
      --agent <a>   Only that agent (repeatable): pi, opencode, crush; codex only cleans its orphaned block
      --dry-run     Show changes without writing
      --check       Do not write; exit 1 if any agent is out of date
  path              Path of config.toml

Agents: pi, opencode, and Crush use the chat API; Copilot is launched with \`bond run copilot\`.
Codex uses its official account (bond does not provision it). Claude Code cannot use
OpenAI-compatible gateways.`,
	"models.unknown_sub": "unknown subcommand: models {sub} (bond models --help)",
	"models.init_exists": "{file} already exists (--force to recreate; a backup is saved)",
	"models.init_created_imported": "created {file} (imported from {source})",
	"models.init_created_empty": "created {file} (empty, with an example)",
	"models.list_none": "No providers. Edit {file} (bond models init creates an example).",
	"models.list_disabled": " (disabled)",
	"models.list_apis_declared": " (declared)",
	"models.list_apis_probe": " (probe {date})",
	"models.list_apis_assumed": " (assumed: bond models probe)",
	"models.list_not_served": "  gateway does not serve it",
	"models.list_disabled_tag": "(disabled)",
	"models.list_agents": "  agents: {agents}",
	"models.probe_no_match": "no provider matches: {ids}",
	"models.probe_var_undefined": "{id}: variable {var} is not set",
	"models.probe_models_failed": "{id}: GET /models failed ({err})",
	"models.probe_no_active_models": "{id}: no active models to probe",
	"models.probe_models_serves": "serves {count}",
	"models.probe_models_unavailable": "list unavailable",
	"models.probe_models_missing": "; does not serve {missing}",
	"models.probe_models_summary": "models: {status}{missing}",
	"models.probe_empty_reasoning": "empty reply due to reasoning budget: if this is a reasoning model, declare it with reasoning = true",
	"models.probe_apis_note": "\nNote: providers with 'apis' in config.toml use what is declared, not what was detected.",
	"models.sync_unsupported_agent": "agent without model generator: {agent} (pi, opencode, crush; for codex only the orphaned block is cleaned)",
	"models.sync_api_unsupported": "{id}: gateway does not serve the {api} API",
	"models.sync_up_to_date": "up to date",
	"models.sync_outdated": "out of date",
	"models.sync_comments_warn": "{file} has comments; rewriting it loses them (.bak copy kept)",
	"models.sync_would_change": "would change",
	"models.sync_updated": "updated",
	"models.sync_verify": "    {models}  → check: {verify}",
	"models.sync_not_installed": "not installed (skipped): {agents}  · force: --agent <a>",
	"models.sync_agent_needs_val": "--agent requires a value",
	"models.sync_unknown_opt": "unknown option: {opt} (bond models --help)",
	"models.note_opencode": "opencode v2 format: providers.<id>.settings.baseURL",
	"models.note_crush": "crushrc is a bash script; if you define a provider with the same id manually, bond will not duplicate it",
	"models.note_codex": "codex: uses its official account; bond does not provision it",
	"models.sync_codex_no_orphan": "official account: no orphaned block to clean",
	"models.sync_cleaned_codex": "orphaned block removed (backup created)",
	"models.sync_would_clean_codex": "would remove orphaned block",
	"models.sync_orphan_block": "orphaned bond block present (run bond models sync)",
	"models.crush_skipped_manual": "already defined manually in crushrc (outside the bond block)",
};
