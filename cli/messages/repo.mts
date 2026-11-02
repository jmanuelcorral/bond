/**
 * Textos de la consola de bond del área comandos repo, launch, sessions, run, herdr, endpoints y trust.
 *
 * Las claves se tipan contra `es`: si añades una clave aquí y no su traducción en `en`,
 * `npm run typecheck` falla. Este fichero lo mantiene una sola rama del equipo del i18n:
 * no lo edites desde dos ramas a la vez.
 */

export const es = {
	// ---- herdr (cli/herdr.mts) ----
	"herdr.not_installed": "Herdr no está instalado: https://herdr.dev/docs/install/ (o bond setup)",
	"herdr.server_failed": "el servidor de Herdr no arrancó (prueba `herdr` a mano)",

	// ---- run (cli/run.mts) ----
	"run.help": `Uso: bond run copilot [--model <proveedor>/<modelo>] [argumentos de copilot...]

Lanza Copilot CLI contra un modelo del registro global (modo BYOK de Copilot), poniendo
COPILOT_PROVIDER_BASE_URL, COPILOT_MODEL, límites de tokens y la API (completions o
responses). Sin --model, usa el primer modelo activo. No hace falta cuenta de GitHub.

Ejemplos:
  bond run copilot
  bond run copilot --model halo/flash-halogen -p "explica este repo"`,
	"run.only_copilot": "bond run solo admite copilot por ahora (pidió: {agent})",
	"run.not_in_path": "copilot no está en el PATH",
	"run.model_needs_arg": "--model necesita proveedor/modelo",
	"run.no_model_named": "no hay modelo {model} usable por Copilot (bond models list)",
	"run.no_models": "no hay modelos usables por Copilot (bond models list)",

	// ---- sessions (cli/sessions.mts) ----
	"sessions.help": `Uso: bond sessions [texto] [opciones]

Lista las sesiones de pi, de la más reciente a la más antigua, con el comando para
retomarlas. Las que están abiertas en un agente de Herdr muestran agente, estado y panel.

  texto            Filtra por nombre de sesión, directorio o id
  --here           Solo las sesiones del directorio actual
  --live           Solo las abiertas ahora en Herdr
  -n, --limit <N>  Cuántas mostrar (defecto: 20; 0 = todas)
  --json           Salida JSON para scripts
  -h, --help       Esta ayuda

Retomar: cd <directorio> && pi --session <id>. pi busca el id primero en las sesiones
del directorio actual; por eso el comando hace cd antes.`,
	"sessions.today": "hoy {time}",
	"sessions.limit_needs_int": "{opt} necesita un entero >= 0",
	"sessions.unknown_opt": "opción desconocida: {opt} (--help para ver las opciones)",
	"sessions.no_match": "Ninguna sesión coincide con el filtro.",
	"sessions.none_in_dir": "No hay sesiones en {dir}.",
	"sessions.not_exists": " (no existe)",
	"sessions.unnamed": "(sin nombre)",
	"sessions.header_modified": "MODIFICADA",
	"sessions.header_dir": "DIRECTORIO",
	"sessions.header_name": "NOMBRE",
	"sessions.header_msgs": "MSGS",
	"sessions.header_cost": "COSTE",
	"sessions.header_herdr": "EN HERDR",
	"sessions.header_resume": "RETOMAR",
	"sessions.more": "… {count} más (-n 0 para verlas todas)",

	// ---- launch (cli/launch.mts) ----
	"launch.help": `Uso: bond [opciones] [-- argumentos del agente]
       bond dev [directorio] [opciones] [-- argumentos del agente]

Dentro de un repo, abre su puesto de trabajo en Herdr: el agente por defecto del repo
(.bond/bond.toml), llamado gru (gru-2... si ya hay otro), solo en su panel; con --shell, una
shell al lado. Si el workspace ya existe, lo enfoca; si ya estás en él, abre el agente en
este mismo panel y, al salir de él, vuelves a la shell.
Fuera de Herdr arranca su servidor y engancha la interfaz. Si el repo no tiene bond, ofrece
bond init; si su config está desfasada, la regenera antes.

  -a, --agent <agente>          Otro agente en vez del de por defecto (pi, claude, codex...)
  -w, --worktree <rama>         En un worktree de git para <rama> (herdr worktree)
  -b, --base <ref>              Con --worktree: ref de la que sale una rama nueva
  --shell                       Una shell en otro panel, junto al agente
  -d, --direction <right|down>  Con --shell: dónde va la shell (defecto: right)
  -r, --ratio <0.1-0.9>         Con --shell: fracción del panel del agente (defecto: 0.6)
  -l, --label <texto>           Etiqueta del workspace (defecto: bond:<repo>[/<rama>])
  --no-agent                    Una shell en vez del agente
  --no-attach                   No enganchar la interfaz de Herdr al terminar
  --no-focus                    Abrirlo en segundo plano (sin cambiar de workspace ni enganchar)
  --trust-repository            Se pasa a herdr worktree (solo en repos revisados)`,
	"launch.worktree_needs_git": "--worktree necesita un repo git: {path}",
	"launch.no_herdr_ids": "no pude leer los ids de la respuesta de Herdr",
	"launch.opt_needs_value": "{opt} necesita un valor",
	"launch.unknown_opt": "opción desconocida: {opt} (bond --help)",
	"launch.unexpected_arg": "argumento inesperado: {arg} (bond --help)",
	"launch.direction_invalid": "--direction debe ser right o down",
	"launch.base_needs_worktree": "--base solo tiene sentido con --worktree",
	"launch.no_agents_installed": "no hay ningún agente instalado (bond setup te dice cómo instalar uno)",
	"launch.agent_not_supported": "Herdr no admite el agente '{agent}'. Válidos: {kinds}",
	"launch.agent_not_installed": "'{agent}' no está instalado",
	"launch.repo_no_bond": "{repo} no tiene bond. ¿Inicializarlo ahora (bond init)?",
	"launch.config_outdated": "config del repo desfasada ({count} cambio(s)): bond sync",
	"launch.already_open": "  ya estaba abierto ({ws}){focused}",
	"launch.focused": "; enfocado",
	"launch.agent_blocked": "  · espera una respuesta tuya (p. ej. confiar en la carpeta)",
	"launch.agent_row": "  agente    {name} ({agent}) en {pane}{blocked}",
	"launch.worktree_done": "  al terminar con el worktree: herdr worktree remove --workspace {ws}",
	"launch.ready": "  listo",
	"launch.ready_background": "  listo (en segundo plano)",
	"launch.herdr_attach": "  herdr para engancharte",
	"launch.run_failed": "no pude lanzar {agent}: {err}",
	"launch.unnamed": "(sin nombre)",
	"launch.no_agents_repo": "Sin agentes de este repo.",
	"launch.no_agents_live": "Sin agentes vivos. Abre uno con: bond",
	"launch.head_agent": "AGENTE",
	"launch.head_kind": "KIND",
	"launch.head_state": "ESTADO",
	"launch.head_cwd": "CWD",
	"launch.head_panel": "PANEL",

	// ---- repo (cli/repo.mts) ----
	"repo.init_help": `Uso: bond init [opciones]

Prepara el repo actual para tus agentes. Pregunta con cuáles integrarlo (de los instalados,
partiendo de los elegidos en bond setup), cuál abre \`bond\` por defecto y qué herramientas del
catálogo usar: el de bond y los de tu equipo declarados con [[catalog]] en bond.toml. Crea
.bond/bond.toml, un AGENTS.md (si falta) y la config de cada agente; con pi, además las Bond
Extensions. En un repo ya inicializado, permite cambiar la selección. Propone además la
memoria de decisiones (sección \`[decisions]\` de bond.toml, carpeta \`docs/decisions\` con
la skill \`decision-record\`): quita la sección para no usarla.

  --agents <a,b>      Agentes, sin preguntar ({agents})
  --default <a>       Agente por defecto
  --mcp <a,b>         Servidores MCP del catálogo (defecto: todos)
  --skills <a,b>      Skills del catálogo (defecto: las marcadas por defecto, sin las opcionales)
  --commands <a,b>    Comandos del catálogo (defecto: todos)
  --yes               Sin preguntas: lo elegido en bond setup y el catálogo por defecto
  --list              Enseña el catálogo (y los del equipo de bond.toml) y sale
  --dry-run           Enseña lo que haría sin escribir`,
	"repo.sync_help": `Uso: bond sync [opciones]

Genera la configuración de cada agente del repo a partir de .bond/bond.toml.

  --dry-run   Enseña qué cambiaría sin escribir
  --check     No escribe; sale con 1 si algo está desfasado (para CI)
  --force     Sobrescribe ficheros de bond editados a mano (guarda copia .bak)`,
	"repo.kind_mcp": "servidores MCP",
	"repo.kind_skills": "skills",
	"repo.kind_commands": "comandos",
	"repo.ambiguous_tool": 'bond.toml: "{ref}" está en los catálogos {catalogs}; elige uno: {options}',
	"repo.and": " y ",
	"repo.or": " o ",
	"repo.unknown_tools": "bond.toml: {kind} desconocidos: {unknown} (bond init --list)",
	"repo.duplicate_tool": 'bond.toml: {kind}: "{name}" pedido de {catalogs}; en el repo solo cabe uno',
	"repo.catalog_must_be_array": "bond.toml: catalog tiene que ser una lista de tablas ([[catalog]])",
	"repo.catalog_path_and_git": "{where}: path o git, no los dos",
	"repo.catalog_missing_path_git": "{where}: falta path (una carpeta, relativa al repo) o git (la URL del repo)",
	"repo.catalog_git_needs_name": "{where}: un catálogo por git necesita name (minúsculas, dígitos, - o _)",
	"repo.catalog_not_locked": "{where}: {name} no está fijado en .bond/lock.json: bond catalog update {name}",
	"repo.catalog_lock_mismatch": "{where}: .bond/lock.json fija {name} para otra URL o ref: bond catalog update {name}",
	"repo.catalog_url_duplicate": "{where}: {url} ya está como el catálogo {name}",
	"repo.catalog_path_not_found": "{where}: no existe la carpeta {path}",
	"repo.catalog_invalid_name": "{where}: name {name} no vale (minúsculas, dígitos, - o _)",
	"repo.catalog_name_taken": '{where}: ya hay un catálogo "{name}"{isBond}; ponle otro name',
	"repo.catalog_is_bond": " (es el de bond)",
	"repo.catalog_error_line": "catálogo {name} ({where}): {error}",
	"repo.catalog_has_error_one": "el catálogo {name} tiene 1 error: arréglalo y compruébalo con {cmd}",
	"repo.catalog_has_error_many": "el catálogo {name} tiene {count} errores: arréglalo y compruébalo con {cmd}",
	"repo.catalog_outside_repo": "el catálogo {name} ({path}) está fuera del repo: al resto del equipo no le sirve si no tiene esa misma carpeta",
	"repo.bond_toml_invalid": ".bond/bond.toml no es TOML válido: {error}",
	"repo.replaced_by": " (la sustituye {catalogs})",
	"repo.optional": " (opcional)",
	"repo.list_catalogs": "Catálogos: {catalogs}",
	"repo.list_mcp": "Servidores MCP:",
	"repo.list_skills": "Skills:",
	"repo.list_commands": "Comandos:",
	"repo.list_agents": "Agentes: {agents}",
	"repo.no_bond_toml": "no hay {file}: ejecuta bond init",
	"repo.mcp_alias": 'bond.toml: el servidor MCP "{old}" ahora se llama "{new}"; cámbialo en .bond/bond.toml',
	"repo.unknown_agents": "bond.toml: agentes desconocidos: {agents} (bond init --list)",
	"repo.mcp_server_needs_target": "bond.toml: mcp_servers.{name} necesita command o url",
	"repo.decisions_must_be_table": 'bond.toml: decisions tiene que ser una tabla: [decisions] con dir = "docs/decisions"',
	"repo.decisions_dir_invalid": "bond.toml: decisions.dir {dir} tiene que ser una carpeta dentro del repo: relativa, sin .. y sin ruta absoluta",
	"repo.hub_block_skip": "{error}: el bloque del hub en AGENTS.md no se actualiza",
	"repo.why_invalid_json": "no es JSON válido; no lo toco",
	"repo.why_root": "raíz",
	"repo.why_no_bond_keys": "sin claves de bond",
	"repo.why_edited_backup": "editado a mano; se guarda copia .bak",
	"repo.why_edited_force": "editado a mano desde el último sync (--force para sobrescribir)",
	"repo.why_exists_not_bond_force": "ya existe y no es de bond (--force para sobrescribir)",
	"repo.why_exists_not_bond_link": "ya existe y no es el enlace de bond",
	"repo.why_bond_block": "bloque de bond",
	"repo.why_no_longer_generated": "ya no lo genera bond, pero se editó a mano: no lo borro",
	"repo.up_to_date": "al día",
	"repo.decisions_readme_note": "  formato de decisiones: a partir de aquí es tuyo (el listado lo da bond decisions)",
	"repo.conflicts": "{count} conflicto(s): revisa los marcados con ! (o bond sync --force)",
	"repo.sync_unknown_opt": "opción desconocida: {opt} (bond sync --help)",
	"repo.ask_cancelled": "cancelado: no se ha cambiado nada",
	"repo.ask_agents": "¿Con qué agentes integrar este repo?",
	"repo.ask_default_agent": "¿Agente por defecto? (el que abre `bond` en este repo)",
	"repo.ask_catalog_title": "Catálogo",
	"repo.group_mcp": "Servidores MCP",
	"repo.group_skills": "Skills",
	"repo.group_commands": "Comandos",
	"repo.ask_tools": "¿Qué herramientas del catálogo? (espacio para marcar o desmarcar)",
	"repo.opt_needs_value": "{name} necesita un valor",
	"repo.init_unknown_opt": "opción desconocida: {opt} (bond init --help)",
	"repo.not_a_git_repo": "{root} no es un repo git: los ficheros generados conviene versionarlos",
	"repo.no_agents_installed": "no hay ningún agente instalado (bond setup te dice cómo instalar uno; o usa --agents)",
	"repo.agent_not_installed": "{agent} no está instalado aquí: se genera su config igualmente",
	"repo.already_initialized": "{file} ya existe: edítalo y ejecuta bond sync (o bond init para cambiarlo con preguntas)",
	"repo.init_already_exists_info": "Este repo ya tiene .bond/bond.toml: cambia lo que quieras (se conservan tus comentarios y servidores MCP propios)",
	"repo.at_least_one_agent": "hace falta al menos un agente",
	"repo.init_in": "bond init en {root}",
	"repo.init_summary": "  agentes: {agents} (por defecto: {default}) · mcp: {mcp} · skills: {skills} · comandos: {commands}",
	"repo.dry_run_write": "  [dry-run] escribiría .bond/bond.toml{agentsMd}",
	"repo.dry_run_and_agents_md": " y AGENTS.md",
	"repo.agents_md_template": "plantilla: complétala",
	"repo.trust_pi": "pi pregunta si confías en el proyecto (sin eso no carga .pi/ ni las Bond Extensions)",
	"repo.trust_claude": "Claude Code pide aprobar los servidores de .mcp.json",
	"repo.trust_copilot": "Copilot pide confiar en la carpeta (sin eso no carga .mcp.json)",
	"repo.trust_codex": "Codex solo carga .codex/config.toml en proyectos de confianza",
	"repo.trust_opencode": "opencode reconoce el proyecto cuando el repo tiene al menos un commit",
	"repo.trust_gemini": "Gemini pide confiar en la carpeta (security.folderTrust)",
	"repo.step_agents_md": "Completa AGENTS.md (instrucciones del proyecto para todos los agentes).",
	"repo.step_commit": "Commitea la configuración: git add .bond AGENTS.md {files}",
	"repo.step_trust": "La primera vez, cada agente pide confiar en el repo; bond no lo concede por ti:\n{asks}",
	"repo.step_open": "Abre el puesto de trabajo: bond",
	"repo.next_steps": "\nSiguiente:\n{steps}",
} as const;

export const en: Record<keyof typeof es, string> = {
	// ---- herdr (cli/herdr.mts) ----
	"herdr.not_installed": "Herdr is not installed: https://herdr.dev/docs/install/ (or bond setup)",
	"herdr.server_failed": "the Herdr server did not start (try `herdr` manually)",

	// ---- run (cli/run.mts) ----
	"run.help": `Usage: bond run copilot [--model <provider>/<model>] [copilot arguments...]

Launches Copilot CLI against a model from the global registry (Copilot BYOK mode), setting
COPILOT_PROVIDER_BASE_URL, COPILOT_MODEL, token limits and the API (completions or
responses). Without --model, it uses the first active model. No GitHub account needed.

Examples:
  bond run copilot
  bond run copilot --model halo/flash-halogen -p "explain this repo"`,
	"run.only_copilot": "bond run only supports copilot for now (requested: {agent})",
	"run.not_in_path": "copilot is not in PATH",
	"run.model_needs_arg": "--model requires provider/model",
	"run.no_model_named": "no {model} model usable by Copilot (bond models list)",
	"run.no_models": "no models usable by Copilot (bond models list)",

	// ---- sessions (cli/sessions.mts) ----
	"sessions.help": `Usage: bond sessions [query] [options]

Lists pi sessions, from newest to oldest, with the command to resume them.
Those open in a Herdr agent show agent, status and pane.

  query            Filter by session name, directory or id
  --here           Only sessions in the current directory
  --live           Only those currently open in Herdr
  -n, --limit <N>  How many to show (default: 20; 0 = all)
  --json           JSON output for scripts
  -h, --help       This help

Resume: cd <directory> && pi --session <id>. pi searches for the id first in
sessions of the current directory; that is why the command cds first.`,
	"sessions.today": "today {time}",
	"sessions.limit_needs_int": "{opt} requires an integer >= 0",
	"sessions.unknown_opt": "unknown option: {opt} (--help to see options)",
	"sessions.no_match": "No sessions match the filter.",
	"sessions.none_in_dir": "No sessions in {dir}.",
	"sessions.not_exists": " (does not exist)",
	"sessions.unnamed": "(unnamed)",
	"sessions.header_modified": "MODIFIED",
	"sessions.header_dir": "DIRECTORY",
	"sessions.header_name": "NAME",
	"sessions.header_msgs": "MSGS",
	"sessions.header_cost": "COST",
	"sessions.header_herdr": "IN HERDR",
	"sessions.header_resume": "RESUME",
	"sessions.more": "… {count} more (-n 0 to see all)",

	// ---- launch (cli/launch.mts) ----
	"launch.help": `Usage: bond [options] [-- agent arguments]
       bond dev [directory] [options] [-- agent arguments]

Inside a repo, opens its Herdr workstation: the repo's default agent
(.bond/bond.toml), named gru (gru-2... if another exists), alone in its pane;
with --shell, a shell beside it. If the workspace already exists, focuses it;
if you are already in it, opens the agent in this same pane, returning to the
shell on exit.
Outside Herdr, starts its server and attaches the interface. If the repo does
not have bond, offers bond init; if its config is outdated, regenerates it first.

  -a, --agent <agent>           Another agent instead of default (pi, claude, codex...)
  -w, --worktree <branch>       In a git worktree for <branch> (herdr worktree)
  -b, --base <ref>              With --worktree: ref to branch off from
  --shell                       A shell in another pane, beside the agent
  -d, --direction <right|down>  With --shell: where the shell goes (default: right)
  -r, --ratio <0.1-0.9>         With --shell: agent pane fraction (default: 0.6)
  -l, --label <text>            Workspace label (default: bond:<repo>[/<branch>])
  --no-agent                    A shell instead of the agent
  --no-attach                   Do not attach Herdr interface on exit
  --no-focus                    Open in background (without switching workspace or attaching)
  --trust-repository            Passed to herdr worktree (only for reviewed repos)`,
	"launch.worktree_needs_git": "--worktree requires a git repo: {path}",
	"launch.no_herdr_ids": "could not read ids from Herdr response",
	"launch.opt_needs_value": "{opt} requires a value",
	"launch.unknown_opt": "unknown option: {opt} (bond --help)",
	"launch.unexpected_arg": "unexpected argument: {arg} (bond --help)",
	"launch.direction_invalid": "--direction must be right or down",
	"launch.base_needs_worktree": "--base only makes sense with --worktree",
	"launch.no_agents_installed": "no agents installed (bond setup explains how to install one)",
	"launch.agent_not_supported": "Herdr does not support the agent '{agent}'. Valid: {kinds}",
	"launch.agent_not_installed": "'{agent}' is not installed",
	"launch.repo_no_bond": "{repo} does not have bond. Initialize it now (bond init)?",
	"launch.config_outdated": "outdated repo config ({count} change(s)): bond sync",
	"launch.already_open": "  already open ({ws}){focused}",
	"launch.focused": "; focused",
	"launch.agent_blocked": "  · waiting for your response (e.g. trust folder)",
	"launch.agent_row": "  agent     {name} ({agent}) on {pane}{blocked}",
	"launch.worktree_done": "  when done with worktree: herdr worktree remove --workspace {ws}",
	"launch.ready": "  ready",
	"launch.ready_background": "  ready (in background)",
	"launch.herdr_attach": "  herdr to attach",
	"launch.run_failed": "could not launch {agent}: {err}",
	"launch.unnamed": "(unnamed)",
	"launch.no_agents_repo": "No agents for this repo.",
	"launch.no_agents_live": "No live agents. Open one with: bond",
	"launch.head_agent": "AGENT",
	"launch.head_kind": "KIND",
	"launch.head_state": "STATUS",
	"launch.head_cwd": "CWD",
	"launch.head_panel": "PANE",

	// ---- repo (cli/repo.mts) ----
	"repo.init_help": `Usage: bond init [options]

Prepares the current repo for your agents. Asks which agents to integrate with
(from installed ones, starting from those chosen in bond setup), which agent
\`bond\` opens by default, and which catalog tools to use: bond's and your
team's declared with [[catalog]] in bond.toml. Creates .bond/bond.toml, an
AGENTS.md (if missing) and config for each agent; for pi, additionally the Bond
Extensions. In an already initialized repo, allows changing the selection. Also
proposes decision memory (\`[decisions]\` section in bond.toml, \`docs/decisions\`
folder with the \`decision-record\` skill): remove the section to disable it.

  --agents <a,b>      Agents, without prompts ({agents})
  --default <a>       Default agent
  --mcp <a,b>         Catalog MCP servers (default: all)
  --skills <a,b>      Catalog skills (default: default-flagged ones, excluding optional)
  --commands <a,b>    Catalog commands (default: all)
  --yes               Without prompts: choices from bond setup and default catalog
  --list              Show catalog (and team ones from bond.toml) and exit
  --dry-run           Show what would be done without writing`,
	"repo.sync_help": `Usage: bond sync [options]

Generates config for each agent in the repo from .bond/bond.toml.

  --dry-run   Show what would change without writing
  --check     Do not write; exit 1 if anything is outdated (for CI)
  --force     Overwrite bond files edited by hand (saves .bak copy)`,
	"repo.kind_mcp": "MCP servers",
	"repo.kind_skills": "skills",
	"repo.kind_commands": "commands",
	"repo.ambiguous_tool": 'bond.toml: "{ref}" is in catalogs {catalogs}; choose one: {options}',
	"repo.and": " and ",
	"repo.or": " or ",
	"repo.unknown_tools": "bond.toml: unknown {kind}: {unknown} (bond init --list)",
	"repo.duplicate_tool": 'bond.toml: {kind}: "{name}" requested from {catalogs}; only one fits in the repo',
	"repo.catalog_must_be_array": "bond.toml: catalog must be a list of tables ([[catalog]])",
	"repo.catalog_path_and_git": "{where}: path or git, not both",
	"repo.catalog_missing_path_git": "{where}: missing path (a folder, relative to repo) or git (repo URL)",
	"repo.catalog_git_needs_name": "{where}: a git catalog requires name (lowercase, digits, - or _)",
	"repo.catalog_not_locked": "{where}: {name} is not locked in .bond/lock.json: bond catalog update {name}",
	"repo.catalog_lock_mismatch": "{where}: .bond/lock.json locks {name} for another URL or ref: bond catalog update {name}",
	"repo.catalog_url_duplicate": "{where}: {url} is already added as catalog {name}",
	"repo.catalog_path_not_found": "{where}: folder {path} does not exist",
	"repo.catalog_invalid_name": "{where}: name {name} is invalid (lowercase, digits, - or _)",
	"repo.catalog_name_taken": '{where}: catalog "{name}" already exists{isBond}; choose another name',
	"repo.catalog_is_bond": " (it is bond's)",
	"repo.catalog_error_line": "catalog {name} ({where}): {error}",
	"repo.catalog_has_error_one": "catalog {name} has 1 error: fix it and check with {cmd}",
	"repo.catalog_has_error_many": "catalog {name} has {count} errors: fix it and check with {cmd}",
	"repo.catalog_outside_repo": "catalog {name} ({path}) is outside the repo: it won't work for the rest of the team unless they have that same folder",
	"repo.bond_toml_invalid": ".bond/bond.toml is not valid TOML: {error}",
	"repo.replaced_by": " (replaced by {catalogs})",
	"repo.optional": " (optional)",
	"repo.list_catalogs": "Catalogs: {catalogs}",
	"repo.list_mcp": "MCP servers:",
	"repo.list_skills": "Skills:",
	"repo.list_commands": "Commands:",
	"repo.list_agents": "Agents: {agents}",
	"repo.no_bond_toml": "no {file}: run bond init",
	"repo.mcp_alias": 'bond.toml: MCP server "{old}" is now named "{new}"; update it in .bond/bond.toml',
	"repo.unknown_agents": "bond.toml: unknown agents: {agents} (bond init --list)",
	"repo.mcp_server_needs_target": "bond.toml: mcp_servers.{name} requires command or url",
	"repo.decisions_must_be_table": 'bond.toml: decisions must be a table: [decisions] with dir = "docs/decisions"',
	"repo.decisions_dir_invalid": "bond.toml: decisions.dir {dir} must be a folder inside the repo: relative, without .. and not absolute",
	"repo.hub_block_skip": "{error}: hub block in AGENTS.md is not updated",
	"repo.why_invalid_json": "not valid JSON; leaving untouched",
	"repo.why_root": "root",
	"repo.why_no_bond_keys": "no bond keys",
	"repo.why_edited_backup": "edited by hand; saving .bak copy",
	"repo.why_edited_force": "edited by hand since last sync (--force to overwrite)",
	"repo.why_exists_not_bond_force": "already exists and is not from bond (--force to overwrite)",
	"repo.why_exists_not_bond_link": "already exists and is not the bond symlink",
	"repo.why_bond_block": "bond block",
	"repo.why_no_longer_generated": "no longer generated by bond, but was edited by hand: not deleting",
	"repo.up_to_date": "up to date",
	"repo.decisions_readme_note": "  decision format: from now on it's yours (list with bond decisions)",
	"repo.conflicts": "{count} conflict(s): check those marked with ! (or bond sync --force)",
	"repo.sync_unknown_opt": "unknown option: {opt} (bond sync --help)",
	"repo.ask_cancelled": "cancelled: nothing changed",
	"repo.ask_agents": "Which agents to integrate this repo with?",
	"repo.ask_default_agent": "Default agent? (the one that opens `bond` in this repo)",
	"repo.ask_catalog_title": "Catalog",
	"repo.group_mcp": "MCP Servers",
	"repo.group_skills": "Skills",
	"repo.group_commands": "Commands",
	"repo.ask_tools": "Which catalog tools? (space to check or uncheck)",
	"repo.opt_needs_value": "{name} requires a value",
	"repo.init_unknown_opt": "unknown option: {opt} (bond init --help)",
	"repo.not_a_git_repo": "{root} is not a git repo: generated files should be tracked with git",
	"repo.no_agents_installed": "no agents installed (bond setup explains how to install one; or use --agents)",
	"repo.agent_not_installed": "{agent} is not installed here: generating its config anyway",
	"repo.already_initialized": "{file} already exists: edit it and run bond sync (or bond init to change with prompts)",
	"repo.init_already_exists_info": "This repo already has .bond/bond.toml: change whatever you want (your comments and custom MCP servers are preserved)",
	"repo.at_least_one_agent": "at least one agent is required",
	"repo.init_in": "bond init in {root}",
	"repo.init_summary": "  agents: {agents} (default: {default}) · mcp: {mcp} · skills: {skills} · commands: {commands}",
	"repo.dry_run_write": "  [dry-run] would write .bond/bond.toml{agentsMd}",
	"repo.dry_run_and_agents_md": " and AGENTS.md",
	"repo.agents_md_template": "template: fill it in",
	"repo.trust_pi": "pi asks if you trust the project (without this it won't load .pi/ or Bond Extensions)",
	"repo.trust_claude": "Claude Code asks to approve servers in .mcp.json",
	"repo.trust_copilot": "Copilot asks to trust the folder (without this it won't load .mcp.json)",
	"repo.trust_codex": "Codex only loads .codex/config.toml in trusted projects",
	"repo.trust_opencode": "opencode recognizes the project when the repo has at least one commit",
	"repo.trust_gemini": "Gemini asks to trust the folder (security.folderTrust)",
	"repo.step_agents_md": "Complete AGENTS.md (project instructions for all agents).",
	"repo.step_commit": "Commit the configuration: git add .bond AGENTS.md {files}",
	"repo.step_trust": "The first time, each agent asks to trust the repo; bond does not grant it for you:\n{asks}",
	"repo.step_open": "Open the workstation: bond",
	"repo.next_steps": "\nNext:\n{steps}",
};
