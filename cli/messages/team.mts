/**
 * Textos de la consola de bond del área comando team.
 *
 * Las claves se tipan contra `es`: si añades una clave aquí y no su traducción en `en`,
 * `npm run typecheck` falla. Este fichero lo mantiene una sola rama del equipo del i18n:
 * no lo edites desde dos ramas a la vez.
 */

export const es = {
	"team.help": `Uso: bond team [repo] <rama[:agente]>... [opciones] [-- argumentos de los agentes]
       bond team status [repo] [--base <ref>] [--json | --watch [--keep-open]]
       bond team prompt <rama> <tarea> [--repo <repo>] [--wait] [--timeout <ms>] [--no-record]
       bond team collect <rama> [--repo <repo>] [--lines <n>] [--agent <nombre>] [--request <encargo>]
       bond team clean [repo] [rama...] [--repo <repo>] [--base <ref>] [--force] [--delete-branch] [--keep-table] [--dry-run]

Abre un worktree y un agente por rama. Sin [repo], el repo del directorio actual. El agente de
cada rama: el de rama:agente, si no --agent, si no el agente por defecto del repo
(.bond/bond.toml), si no el de bond setup. Los worktrees salen de lo commiteado.

Dentro de Herdr, cada agente va en un panel de tu pestaña, debajo del tuyo (en fila, con el
mismo ancho), con nombre de minion (kevin, stuart, bob...). Tu pestaña admite 6 paneles: el
tuyo, la tabla y 4 minions; los que no caben van a pestañas nuevas "equipo · <repo>", 4 por
pestaña. Si no caben, bond team pregunta antes de crear nada: 1) pestañas nuevas (por
defecto), 2) todo en tu pestaña (filas de 4, aunque se apriete) o 3) un workspace por rama.
--tabs, --same-tab y --workspaces eligen sin preguntar; sin terminal o con --yes, la 1. Fuera
de Herdr, un workspace por rama. Dentro, además, un panel estrecho a la derecha del tuyo con la
tabla en vivo de todas las ramas (bond team status --watch), o el que ya haya.

En paneles, si el orquestador (pi, Claude Code o agy en el panel desde el que lanzas el equipo)
confía en el checkout principal, todos los agentes del equipo confían en su worktree; si no, cada
uno hereda la confianza que él mismo tenga en el checkout. bond la escribe en trust.json de pi,
~/.claude.json o trustedWorkspaces de agy, y el agente arranca sin preguntar; sin ninguna, o con
otros agentes, pregunta como siempre.

agy arranca con --dangerously-skip-permissions (sin él pide permiso por cada comando); tus
argumentos tras -- lo sustituyen. Si no está en el PATH pero sí en ~/.local/bin, bond añade esa
carpeta al PATH de la shell del panel antes de lanzarlo.

  -a, --agent <agente>   Agente para las ramas sin :agente
  -b, --base <ref>       Ref de la que salen las ramas nuevas
  --tabs                 Si no caben en tu pestaña, el resto en pestañas nuevas (por defecto)
  --same-tab             Todos en tu pestaña, en filas de 4, aunque no quepan
  --workspaces           Un workspace por rama (herdr worktree) en vez de paneles
  -y, --yes              Sin preguntar: si no caben, pestañas nuevas
  --no-trust             En paneles: no heredar la confianza del checkout principal
  --trust-repository     Con --workspaces: se pasa a herdr worktree (solo en repos revisados)
  --repos <a,b>          En un hub: solo esos repos de la sesión (ruta o nombre)

En un hub (un repo con hub.toml), bond team <rama> abre
una rama vertical: la crea en el hub, sin worktree ni agente, y abre un worktree y un agente
en cada repo de la sesión (o en los de --repos), cada uno desde su base de hub.toml y con
el agente por defecto de su bond.toml (o el de rama:agente o --agent). En paneles, los
worktrees van en ~/.herdr/worktrees/<hub>/<submódulo>/<rama>. Una sola rama vertical por
sesión: con una abierta, bond team se niega a abrir otra hasta bond team clean. Desde el hub,
prompt manda la tarea a todos los agentes de la rama, con una nota que les dice quiénes son
los otros y en qué repo está cada uno (--repo, solo a uno); collect y clean buscan la rama en
todos los repos (--repo si hace falta elegir); los runs van a la memoria del hub (si no la
tiene, a la del repo). Dentro de un repo de la sesión, bond team trabaja solo en ese repo.

status   Cada worktree del repo: estado, agente, commits por delante de la base y ficheros.
         Estados: trabajando, bloqueado, sin commitear, lista (commits por revisar),
         integrada (ya está en la base: por merge, fast-forward, rebase o squash), sin commits.
         La base, por defecto, es la rama del checkout principal.
         --watch: tabla en vivo (cada 2 s) agrupada por estado, en este orden: ⛔ necesita tu
         respuesta (con la pregunta debajo), 🔄 trabajando, ✏️ sin commitear, 📦 por revisar
         y ✅ integradas / sin empezar; los grupos vacíos no salen. El icono del estado va en
         el título del grupo; cada fila: minion, rama, commits y ficheros. Sale con q o Ctrl+C. En el
         panel de la tabla, si ninguna rama tiene trabajo pendiente (trabajando, bloqueado,
         sin commitear, lista, o un agente abierto sin commits aún), avisa y se cierra sola;
         no si es el panel enfocado ni con --keep-open. En un hub (declarado en hub.toml),
         status y --watch enseñan los worktrees de toda la sesión en un panel tabla · <hub> con
         columna REPO.
prompt   Manda una tarea al agente de esa rama (herdr agent prompt); --wait espera a que acabe.
         Con la memoria de decisiones activa ([decisions] en bond.toml), guarda el encargo
         exacto en <dir>/runs/ (--no-record para no guardarlo); si la escritura falla,
         avisa y manda el prompt igual. Con memoria, el encargo lleva además una nota: lo
         que el agente registre en <dir>/ se commitea en su rama (viaja con el código).
collect  Recoge el informe del agente: toma solo su última respuesta del fichero de sesión
         que Herdr da en agent_session (en pi, un .jsonl; en agy, con su integración de
         Herdr, el transcript.jsonl de la conversación) y, si no puede leerlo, del panel
         recortado (sin banner de arranque ni avisos). Lo guarda en el run de esa rama de la
         memoria de decisiones, con el estado, los commits de la rama y las decisiones
         registradas por ese agente. Repetirlo reemplaza el informe y recalcula listas: no
         duplica nada. Sin run creado por prompt, lo crea con --request como encargo (para
         delegaciones sin equipo, como bond-delegate); --agent recoge por nombre de agente.
         Se niega mientras el agente trabaja o espera una respuesta.
clean    Quita worktrees (carpeta, workspace y agente); las ramas se quedan. Sin ramas, solo
         los integrados que abrió Herdr. Nunca uno con el agente trabajando o con cambios sin
         commitear, salvo con --force. --delete-branch borra además las ramas integradas.
         Si al acabar no queda ningún agente del equipo, cierra también el panel de la tabla
         en vivo; --keep-table lo deja abierto.`,
	"team.err_flag_conflict": "{flag} no va con --{layout} (bond team --help)",
	"team.err_needs_value": "{flag} necesita un valor (bond team --help)",
	"team.err_unknown_opt": "opción desconocida: {opt} (bond team --help)",
	"team.err_malformed_spec": "rama mal escrita: {spec} (rama o rama:agente)",
	"team.err_duplicate_branch": "rama repetida: {branch}",
	"team.err_missing_branches": "faltan las ramas: bond team [repo] <rama[:agente]>... (bond team --help)",
	"team.err_not_git_repo": "no es un repo git: {path}",
	"team.err_repos_only_hub": "--repos solo va en un hub (bond hub --help)",
	"team.err_invalid_branch_name": "nombre de rama no válido para git: {branches}",
	"team.warn_foreign_agent": "{agents} no está entre los agentes del repo: sin su config (MCP, skills...). Añádelo con bond init",
	"team.warn_uncommitted_changes": "hay cambios sin commitear: los worktrees salen de lo commiteado y no los verán",
	"team.logo_team_in": "equipo en {repo}",
	"team.footer_hints": "\n  Repartir trabajo: bond team prompt <rama> \"la tarea\"\n  Cómo va: bond team status · Al acabar: bond team clean",
	"team.ws_already_open": "ya abierto ({ws})",
	"team.agent_in_pane": "{name} ({agent}) en {pane}",
	"team.awaits_reply": " · espera una respuesta tuya",
	"team.trust_inherited": " · confianza heredada",
	"team.tab_label": "equipo · {repo}",
	"team.tab_label_n": "equipo · {repo} · {n}",
	"team.layout_tabs_split": "Pestañas nuevas (por defecto): {room} en la tuya y el resto en \"{tab}\", 4 por pestaña",
	"team.layout_tabs_all": "Pestañas nuevas (por defecto): todos en \"{tab}\", 4 por pestaña",
	"team.layout_same_tab": "Todo en mi pestaña: en filas de 4, aunque se apriete",
	"team.layout_workspaces": "Workspaces aparte: un workspace por rama (--workspaces)",
	"team.layout_cancelled": "\n  Cancelado: no he creado nada.",
	"team.ask_layout_title_one": "\n{n} agentes y en tu pestaña cabe 1 ({cap} paneles como mucho: el tuyo, la tabla y 4 minions). ¿Dónde van?",
	"team.ask_layout_title_many": "\n{n} agentes y en tu pestaña caben {room} ({cap} paneles como mucho: el tuyo, la tabla y 4 minions). ¿Dónde van?",
	"team.ask_layout_prompt": "Elige [1]: ",
	"team.ask_layout_hint": "  {choices} o Intro",
	"team.already_has_agent": "ya tiene agente ({path})",
	"team.err_herdr_pane_read": "no pude leer el panel nuevo de la respuesta de Herdr",
	"team.warn_trust_inherit_failed": "{label}: no pude heredar la confianza ({error}); {agent} preguntará",
	"team.err_main_not_on_branch": "el checkout principal no está en una rama: indica la base con --base <ref>",
	"team.err_base_not_found": "la base no existe: {base}",
	"team.warn_base_not_found_in": "la base no existe en {path}: {base}",
	"team.state_working": "trabajando",
	"team.state_blocked": "bloqueado",
	"team.state_uncommitted": "sin commitear",
	"team.state_ready": "lista",
	"team.state_integrated": "integrada",
	"team.state_no_commits": "sin commits",
	"team.status_no_worktrees": "Sin worktrees en este repo. Crea un equipo con: bond team <rama>...",
	"team.status_th_repo": "REPO",
	"team.status_th_branch": "RAMA",
	"team.status_th_state": "ESTADO",
	"team.status_th_agent": "AGENTE",
	"team.status_th_commits": "COMMITS",
	"team.status_th_files": "FICHEROS",
	"team.status_th_where": "DÓNDE",
	"team.status_dirty_extra": " (+{dirty} sin commitear)",
	"team.status_panel": "panel {pane}",
	"team.status_closed": "cerrado",
	"team.status_answer_hint": "\n  Contesta tú en su panel: bond no responde por ti.",
	"team.status_pi_trust_hint": "  En pi, \"Trust parent folder\" una vez basta para todos los worktrees de este repo.",
	"team.err_status_usage": "uso: bond team status [repo] [--base <ref>] [--json | --watch [--keep-open]]",
	"team.err_hub_base_override": "en un hub cada repo usa su base de hub.toml; quita --base",
	"team.err_watch_json_conflict": "--watch y --json no van juntos",
	"team.err_keep_open_needs_watch": "--keep-open va con --watch",
	"team.watch_group_blocked": "Necesita tu respuesta",
	"team.watch_group_working": "Trabajando",
	"team.watch_group_uncommitted": "Sin commitear",
	"team.watch_group_ready": "Por revisar",
	"team.watch_group_integrated": "Integradas / sin empezar",
	"team.watch_no_worktrees": "Sin worktrees en este repo.",
	"team.watch_th_minion": "MINION",
	"team.watch_th_repo": "REPO",
	"team.watch_th_branch": "RAMA",
	"team.watch_th_commits": "COMMITS",
	"team.watch_th_files": "FICHEROS",
	"team.watch_th_com": "COM",
	"team.watch_th_fich": "FICH",
	"team.watch_question": "   └ pregunta: {question}",
	"team.watch_footer": "q o Ctrl+C para salir · se actualiza cada 2 s",
	"team.err_watch_needs_tty": "--watch necesita una terminal (sin ella: bond team status --json)",
	"team.watch_no_pending_work": "sin trabajo pendiente",
	"team.watch_closing_in": "sin trabajo pendiente\nel panel se cierra en {seconds} s",
	"team.watch_error": "error: {error}",
	"team.watch_pane_label": "tabla · {repo}",
	"team.live_table": "tabla en vivo",
	"team.table_already_open": "ya abierta en {pane}",
	"team.table_in_pane": "en {pane}",
	"team.warn_table_failed": "tabla en vivo: {error} (ábrela a mano: bond team status --watch)",
	"team.warn_table_failed_short": "tabla en vivo: {error}",
	"team.err_prompt_usage": "uso: bond team prompt <rama> \"la tarea\" [--repo <repo>] [--wait] [--timeout <ms>] [--no-record]",
	"team.err_repo_only_hub": "--repo solo va en un hub (bond hub --help)",
	"team.err_no_worktree_for_branch": "no hay worktree para {branch} (bond team status)",
	"team.err_no_agent_running": "{branch} no tiene un agente en marcha (bond team {branch} para abrirlo)",
	"team.err_agent_blocked_with_q": "{name} espera una respuesta tuya ({question}): contéstale en su panel (herdr workspace focus {workspace}) y repite",
	"team.err_agent_blocked": "{name} espera una respuesta tuya: contéstale en su panel (herdr workspace focus {workspace}) y repite",
	"team.warn_run_record_failed": "run: {error} (mando el prompt igual)",
	"team.run_label": "run: {rel}",
	"team.err_prompt_stalled_pane": "el prompt no llegó a {name}: Herdr no observó actividad y el panel no muestra la tarea tras reintentar una vez. Revisa el panel antes de volver a mandarlo.",
	"team.err_empty_task": "el encargo está vacío (bond team prompt <rama> \"la tarea\")",
	"team.blocker_working": "está trabajando",
	"team.blocker_blocked": "espera una respuesta tuya",
	"team.err_agent_is_working": "{agent} está trabajando: espera a que termine (herdr agent wait {agent}) y repite",
	"team.err_agent_is_blocked": "{agent} espera una respuesta tuya: espera a que termine (herdr agent wait {agent}) y repite",
	"team.err_collect_usage": "uso: bond team collect <rama> [--repo <repo>] [--lines <n>] [--agent <nombre>] [--request <encargo>]",
	"team.err_read_decisions_failed": "no pude leer [decisions] de {path}: {error}",
	"team.err_no_decision_memory": "este repo no usa la memoria de decisiones: añade la sección [decisions] a .bond/bond.toml (bond init la propone) y ejecuta bond sync",
	"team.err_no_agent_for_collect": "no hay agente en la rama {branch} y no diste --agent (bond team status)",
	"team.err_read_pane_failed": "no pude leer el panel de {agent}: {error}",
	"team.collect_source_session": "la sesión",
	"team.collect_source_pane": "el panel",
	"team.collect_reported": "reported · informe desde {source} · {commits} commit(s) de {branch} · {decisions} decisión(es) de {agent}",
	"team.err_clean_no_worktree": "sin worktree: {branches} (bond team status)",
	"team.clean_outside_herdr": "  {branch}: integrada, pero no la abrió Herdr ({path}); nómbrala para quitarla",
	"team.clean_nothing_to_remove": "Nada que quitar.",
	"team.clean_no_integrated_to_remove": "Ninguna rama integrada que quitar (bond team status).",
	"team.clean_repo_ws_open": "  El workspace del repo ({label}) sigue abierto; si ya no lo usas: herdr workspace close {id}",
	"team.warn_clean_working": "{label}: no lo quito, el agente está trabajando (--force para quitarlo igualmente)",
	"team.warn_clean_dirty": "{label}: no lo quito, {dirty} cambio(s) sin commitear (--force para quitarlo igualmente)",
	"team.warn_clean_inside": "{label}: no lo quito, estás dentro (--force para quitarlo igualmente)",
	"team.warn_clean_blocked": "{label}: no lo quito, el agente espera una respuesta (--force para quitarlo igualmente)",
	"team.clean_branch_kept": "rama conservada",
	"team.clean_branch_deleted": "rama borrada",
	"team.clean_branch_not_integrated": "rama conservada: no está integrada (--force para borrarla)",
	"team.clean_table_closed": "{pane} · no queda ningún agente del equipo (--keep-table para dejarla)",
	"team.warn_hub_fallback": "{error}: sigo sin el modo hub",
	"team.err_pick_not_in_session": "{flag} {name}: no es un repo de la sesión ({repos})",
	"team.err_pick_multiple_hits": "{flag} {name}: hay varios ({hits}); usa la ruta",
	"team.err_hub_single_branch": "en un hub, una sola rama vertical por sesión (D2): bond team <rama>[:agente] [--repos a,b], no {branches}",
	"team.err_hub_no_base": "en un hub, cada repo sale de su base de hub.toml: sin --base",
	"team.err_hub_no_repos": "{name} no tiene repos en su sesión: añade repos a hub.toml",
	"team.hub_open_vertical_item": "{branch} (worktree en {repo}: {path})",
	"team.err_hub_already_open": "{name} ya tiene abierta la rama vertical {open} y solo cabe una por sesión: ciérrala antes con bond team clean {branch} (las ramas se quedan)",
	"team.err_hub_base_missing": "la base no existe en {repos}: cámbiala en hub.toml (base o [repos.<x>].base)",
	"team.warn_hub_foreign_agent": "{path}: {agent} no está entre los agentes del repo: sin su config (MCP, skills...). Añádelo con bond init",
	"team.warn_hub_uncommitted": "{path}: hay cambios sin commitear: el worktree sale de lo commiteado y no los verá",
	"team.hub_branch_exists": "la rama ya está en el hub",
	"team.err_hub_git_branch": "{name}: git branch {branch} {base}: {error}",
	"team.hub_branch_created": "rama del hub desde {base}, sin worktree ni agente",
	"team.logo_branch_in_hub": "{branch} en {name}",
	"team.hub_footer_hints": "\n  Repartir trabajo: bond team prompt {branch} \"la tarea\" (a todos; --repo <repo> a uno)\n  Recoger: bond team collect {branch} --repo <repo> · Al acabar: bond team clean {branch}",
	"team.err_hub_no_worktree": "no hay worktree para {branch} en ningún repo de {name} (bond team status)",
	"team.err_hub_no_worktree_in_repo": "{branch} no tiene worktree en {path} (bond team status)",
	"team.warn_hub_no_agent": "{repo}: {branch} no tiene un agente en marcha (bond team {branch} para abrirlo)",
	"team.err_hub_no_live_agent": "{branch} no tiene ningún agente en marcha (bond team {branch} para abrirlo)",
	"team.err_hub_no_live_agent_in": "{branch} no tiene ningún agente en marcha en {path} (bond team {branch} para abrirlo)",
	"team.err_hub_blocked_reply": "{agents} espera una respuesta tuya: contéstale en su panel y repite (no he mandado nada)",
	"team.warn_hub_run_failed": "{repo}: run: {error} (mando el prompt igual)",
	"team.err_hub_prompt_stalls": "el prompt no llegó a {targets}: revisa sus paneles antes de volver a mandar",
	"team.err_hub_no_wt_asked_repo": "no hay worktree para {branch} con {agent} en {path} (bond team status)",
	"team.err_hub_no_wt_asked_all": "no hay worktree para {branch} con {agent} en ningún repo de {name} (bond team status)",
	"team.err_hub_no_wt_repo": "no hay worktree para {branch} en {path} (bond team status)",
	"team.err_hub_no_wt_all": "no hay worktree para {branch} en ningún repo de {name} (bond team status)",
	"team.err_hub_collect_multiple": "{branch} está en {count} repos ({repos}): recoge uno a uno con --repo <repo>",
	"team.err_hub_no_agent_for_collect": "no hay agente en la rama {branch} de {path} y no diste --agent (bond team status)",
	"team.err_hub_no_decision_memory": "ni {hub} ni {repo} usan la memoria de decisiones: añade la sección [decisions] a .bond/bond.toml del hub (bond init la propone) y ejecuta bond sync",
	"team.err_hub_clean_no_base": "en un hub, cada repo se compara con su base de hub.toml: sin --base",
	"team.err_hub_clean_no_worktree": "sin worktree en {target}: {branches} (bond team status)",
	"team.hub_clean_branches_kept": "  Las ramas se quedan, en {name} y en cada repo",
	"team.hub_clean_branch_kept_sub_wt": "rama conservada: le queda algún worktree en otro repo",
	"team.hub_clean_branch_not_integrated": "rama conservada: no está integrada en {base} (--force para borrarla)",
} as const;

export const en: Record<keyof typeof es, string> = {
	"team.help": `Usage: bond team [repo] <branch[:agent]>... [options] [-- agent args]
       bond team status [repo] [--base <ref>] [--json | --watch [--keep-open]]
       bond team prompt <branch> <task> [--repo <repo>] [--wait] [--timeout <ms>] [--no-record]
       bond team collect <branch> [--repo <repo>] [--lines <n>] [--agent <name>] [--request <assignment>]
       bond team clean [repo] [branch...] [--repo <repo>] [--base <ref>] [--force] [--delete-branch] [--keep-table] [--dry-run]

Opens a worktree and an agent per branch. Without [repo], the repo in the current directory. Each
branch's agent: branch:agent, else --agent, else the repo's default agent
(.bond/bond.toml), else bond setup's. Worktrees stem from committed changes.

Inside Herdr, each agent runs in a pane on your tab, below yours (side by side, equal
width), with minion names (kevin, stuart, bob...). Your tab accommodates 6 panes: yours,
the table, and 4 minions; those that do not fit go into new "team · <repo>" tabs, 4 per
tab. If they do not fit, bond team asks before creating anything: 1) new tabs (default),
2) all on your tab (rows of 4, even if cramped), or 3) one workspace per branch.
--tabs, --same-tab, and --workspaces select without prompting; without a TTY or with --yes, option 1. Outside
Herdr, one workspace per branch. Inside, additionally, a narrow pane to the right of yours with the
live table of all branches (bond team status --watch), or whichever is already open.

In panes, if the orchestrator (pi, Claude Code, or agy in the pane from which you launch the team)
trusts the main checkout, all team agents trust their worktree; otherwise, each
inherits whatever trust it has in the checkout. bond writes it to pi's trust.json,
~/.claude.json, or agy's trustedWorkspaces, and the agent starts without prompting; with neither, or with
other agents, it prompts as usual.

agy starts with --dangerously-skip-permissions (without it, it asks for permission on every command); your
arguments after -- replace it. If not in PATH but in ~/.local/bin, bond adds that
folder to the pane's shell PATH before launching it.

  -a, --agent <agent>    Agent for branches without :agent
  -b, --base <ref>       Ref from which new branches start
  --tabs                 If they do not fit on your tab, the rest on new tabs (default)
  --same-tab             All on your tab, in rows of 4, even if they do not fit
  --workspaces           One workspace per branch (herdr worktree) instead of panes
  -y, --yes              Without prompting: if they do not fit, new tabs
  --no-trust             In panes: do not inherit trust from the main checkout
  --trust-repository     With --workspaces: passed to herdr worktree (only in reviewed repos)
  --repos <a,b>          In a hub: only those repos from the session (path or name)

In a hub (a repo with hub.toml), bond team <branch> opens
a vertical branch: creates it in the hub without worktree or agent, and opens a worktree and an agent
in each session repo (or those in --repos), each from its hub.toml base and with
the default agent from its bond.toml (or branch:agent or --agent). In panes,
worktrees go to ~/.herdr/worktrees/<hub>/<submodule>/<branch>. Only one vertical branch per
session: with one open, bond team refuses to open another until bond team clean. From the hub,
prompt sends the task to all agents on the branch, with a note telling them who
the others are and which repo each is in (--repo, only to one); collect and clean search for the branch in
all repos (--repo if selection is needed); runs go to the hub's decision memory (if none,
to the repo's). Inside a session repo, bond team works only in that repo.

status   Each worktree in the repo: state, agent, commits ahead of base, and files.
         States: working, blocked, uncommitted, ready (commits to review),
         integrated (already in base: by merge, fast-forward, rebase, or squash), no commits.
         The base, by default, is the main checkout's branch.
         --watch: live table (every 2 s) grouped by state, in this order: ⛔ needs your
         reply (with question below), 🔄 working, ✏️ uncommitted, 📦 to review,
         and ✅ integrated / not started; empty groups are omitted. The state icon appears in
         the group header; each row: minion, branch, commits, and files. Exits with q or Ctrl+C. On the
         table pane, if no branch has pending work (working, blocked,
         uncommitted, ready, or an open agent without commits yet), it warns and closes automatically;
         not if it is the focused pane or with --keep-open. In a hub (declared in hub.toml),
         status and --watch show all session worktrees in a table · <hub> pane with
         a REPO column.
prompt   Sends a task to the agent on that branch (herdr agent prompt); --wait waits for completion.
         With decision memory enabled ([decisions] in bond.toml), saves the exact task
         in <dir>/runs/ (--no-record to skip saving); if saving fails,
         it warns and sends the prompt anyway. With memory, the task also includes a note:
         whatever the agent records in <dir>/ is committed on its branch (travels with code).
collect  Collects the agent report: takes only its last response from the session file
         provided by Herdr in agent_session (in pi, a .jsonl; in agy, with its Herdr integration,
         the conversation transcript.jsonl) and, if unable to read it, from the trimmed
         pane (without startup banner or notices). Saves it to that branch's run in decision
         memory, with the state, branch commits, and decisions
         recorded by that agent. Repeating it replaces the report and recalculates lists: no
         duplicates. Without a run created by prompt, creates one with --request as task (for
         delegations without a team, like bond-delegate); --agent collects by agent name.
         Refuses while the agent is working or waiting for a reply.
clean    Removes worktrees (folder, workspace, and agent); branches remain. Without branches, only
         integrated ones opened by Herdr. Never one with the agent working or with uncommitted
         changes, unless --force. --delete-branch also deletes integrated branches.
         When finished, if no team agent remains, also closes the live table
         pane; --keep-table keeps it open.`,
	"team.err_flag_conflict": "{flag} does not go with --{layout} (bond team --help)",
	"team.err_needs_value": "{flag} requires a value (bond team --help)",
	"team.err_unknown_opt": "unknown option: {opt} (bond team --help)",
	"team.err_malformed_spec": "malformed branch: {spec} (branch or branch:agent)",
	"team.err_duplicate_branch": "duplicate branch: {branch}",
	"team.err_missing_branches": "missing branches: bond team [repo] <branch[:agent]>... (bond team --help)",
	"team.err_not_git_repo": "not a git repo: {path}",
	"team.err_repos_only_hub": "--repos only works in a hub (bond hub --help)",
	"team.err_invalid_branch_name": "invalid branch name for git: {branches}",
	"team.warn_foreign_agent": "{agents} is not among repo agents: missing config (MCP, skills...). Add it with bond init",
	"team.warn_uncommitted_changes": "uncommitted changes present: worktrees branch from committed state and will not see them",
	"team.logo_team_in": "team in {repo}",
	"team.footer_hints": "\n  Assign work: bond team prompt <branch> \"the task\"\n  Check progress: bond team status · When finished: bond team clean",
	"team.ws_already_open": "already open ({ws})",
	"team.agent_in_pane": "{name} ({agent}) in {pane}",
	"team.awaits_reply": " · waiting for your reply",
	"team.trust_inherited": " · inherited trust",
	"team.tab_label": "team · {repo}",
	"team.tab_label_n": "team · {repo} · {n}",
	"team.layout_tabs_split": "New tabs (default): {room} on yours and the rest in \"{tab}\", 4 per tab",
	"team.layout_tabs_all": "New tabs (default): all in \"{tab}\", 4 per tab",
	"team.layout_same_tab": "All on my tab: in rows of 4, even if cramped",
	"team.layout_workspaces": "Separate workspaces: one workspace per branch (--workspaces)",
	"team.layout_cancelled": "\n  Cancelled: created nothing.",
	"team.ask_layout_title_one": "\n{n} agents and your tab fits 1 ({cap} panes at most: yours, the table, and 4 minions). Where should they go?",
	"team.ask_layout_title_many": "\n{n} agents and your tab fits {room} ({cap} panes at most: yours, the table, and 4 minions). Where should they go?",
	"team.ask_layout_prompt": "Choose [1]: ",
	"team.ask_layout_hint": "  {choices} or Enter",
	"team.already_has_agent": "already has an agent ({path})",
	"team.err_herdr_pane_read": "could not read new pane from Herdr response",
	"team.warn_trust_inherit_failed": "{label}: could not inherit trust ({error}); {agent} will prompt",
	"team.err_main_not_on_branch": "the main checkout is not on a branch: specify the base with --base <ref>",
	"team.err_base_not_found": "base does not exist: {base}",
	"team.warn_base_not_found_in": "base does not exist in {path}: {base}",
	"team.state_working": "working",
	"team.state_blocked": "blocked",
	"team.state_uncommitted": "uncommitted",
	"team.state_ready": "ready",
	"team.state_integrated": "integrated",
	"team.state_no_commits": "no commits",
	"team.status_no_worktrees": "No worktrees in this repo. Create a team with: bond team <branch>...",
	"team.status_th_repo": "REPO",
	"team.status_th_branch": "BRANCH",
	"team.status_th_state": "STATE",
	"team.status_th_agent": "AGENT",
	"team.status_th_commits": "COMMITS",
	"team.status_th_files": "FILES",
	"team.status_th_where": "WHERE",
	"team.status_dirty_extra": " (+{dirty} uncommitted)",
	"team.status_panel": "pane {pane}",
	"team.status_closed": "closed",
	"team.status_answer_hint": "\n  Reply in their pane: bond will not answer for you.",
	"team.status_pi_trust_hint": "  In pi, \"Trust parent folder\" once is enough for all worktrees in this repo.",
	"team.err_status_usage": "usage: bond team status [repo] [--base <ref>] [--json | --watch [--keep-open]]",
	"team.err_hub_base_override": "in a hub each repo uses its hub.toml base; remove --base",
	"team.err_watch_json_conflict": "--watch and --json cannot be used together",
	"team.err_keep_open_needs_watch": "--keep-open requires --watch",
	"team.watch_group_blocked": "Needs your reply",
	"team.watch_group_working": "Working",
	"team.watch_group_uncommitted": "Uncommitted",
	"team.watch_group_ready": "To review",
	"team.watch_group_integrated": "Integrated / not started",
	"team.watch_no_worktrees": "No worktrees in this repo.",
	"team.watch_th_minion": "MINION",
	"team.watch_th_repo": "REPO",
	"team.watch_th_branch": "BRANCH",
	"team.watch_th_commits": "COMMITS",
	"team.watch_th_files": "FILES",
	"team.watch_th_com": "COM",
	"team.watch_th_fich": "FILES",
	"team.watch_question": "   └ question: {question}",
	"team.watch_footer": "q or Ctrl+C to exit · refreshes every 2 s",
	"team.err_watch_needs_tty": "--watch requires a terminal (without it: bond team status --json)",
	"team.watch_no_pending_work": "no pending work",
	"team.watch_closing_in": "no pending work\npane closing in {seconds} s",
	"team.watch_error": "error: {error}",
	"team.watch_pane_label": "table · {repo}",
	"team.live_table": "live table",
	"team.table_already_open": "already open in {pane}",
	"team.table_in_pane": "in {pane}",
	"team.warn_table_failed": "live table: {error} (open it manually: bond team status --watch)",
	"team.warn_table_failed_short": "live table: {error}",
	"team.err_prompt_usage": "usage: bond team prompt <branch> \"the task\" [--repo <repo>] [--wait] [--timeout <ms>] [--no-record]",
	"team.err_repo_only_hub": "--repo only works in a hub (bond hub --help)",
	"team.err_no_worktree_for_branch": "no worktree for {branch} (bond team status)",
	"team.err_no_agent_running": "{branch} has no running agent (bond team {branch} to start it)",
	"team.err_agent_blocked_with_q": "{name} is waiting for your reply ({question}): answer in their pane (herdr workspace focus {workspace}) and try again",
	"team.err_agent_blocked": "{name} is waiting for your reply: answer in their pane (herdr workspace focus {workspace}) and try again",
	"team.warn_run_record_failed": "run: {error} (sending prompt anyway)",
	"team.run_label": "run: {rel}",
	"team.err_prompt_stalled_pane": "prompt did not reach {name}: Herdr observed no activity and pane shows no task after one retry. Check pane before sending again.",
	"team.err_empty_task": "task is empty (bond team prompt <branch> \"the task\")",
	"team.blocker_working": "is working",
	"team.blocker_blocked": "is waiting for your reply",
	"team.err_agent_is_working": "{agent} is working: wait for it to finish (herdr agent wait {agent}) and try again",
	"team.err_agent_is_blocked": "{agent} is waiting for your reply: wait for it to finish (herdr agent wait {agent}) and try again",
	"team.err_collect_usage": "usage: bond team collect <branch> [--repo <repo>] [--lines <n>] [--agent <name>] [--request <assignment>]",
	"team.err_read_decisions_failed": "could not read [decisions] from {path}: {error}",
	"team.err_no_decision_memory": "this repo does not use decision memory: add the [decisions] section to .bond/bond.toml (bond init suggests it) and run bond sync",
	"team.err_no_agent_for_collect": "no agent on branch {branch} and --agent was not provided (bond team status)",
	"team.err_read_pane_failed": "could not read pane for {agent}: {error}",
	"team.collect_source_session": "session",
	"team.collect_source_pane": "pane",
	"team.collect_reported": "reported · report from {source} · {commits} commit(s) from {branch} · {decisions} decision(s) by {agent}",
	"team.err_clean_no_worktree": "no worktree: {branches} (bond team status)",
	"team.clean_outside_herdr": "  {branch}: integrated, but not opened by Herdr ({path}); specify it by name to remove",
	"team.clean_nothing_to_remove": "Nothing to remove.",
	"team.clean_no_integrated_to_remove": "No integrated branches to remove (bond team status).",
	"team.clean_repo_ws_open": "  The repo workspace ({label}) remains open; if no longer needed: herdr workspace close {id}",
	"team.warn_clean_working": "{label}: not removing, agent is working (--force to remove anyway)",
	"team.warn_clean_dirty": "{label}: not removing, {dirty} uncommitted change(s) (--force to remove anyway)",
	"team.warn_clean_inside": "{label}: not removing, you are inside (--force to remove anyway)",
	"team.warn_clean_blocked": "{label}: not removing, agent is waiting for a reply (--force to remove anyway)",
	"team.clean_branch_kept": "branch kept",
	"team.clean_branch_deleted": "branch deleted",
	"team.clean_branch_not_integrated": "branch kept: not integrated (--force to delete)",
	"team.clean_table_closed": "{pane} · no team agents remain (--keep-table to keep it)",
	"team.warn_hub_fallback": "{error}: continuing without hub mode",
	"team.err_pick_not_in_session": "{flag} {name}: not a session repo ({repos})",
	"team.err_pick_multiple_hits": "{flag} {name}: multiple matches ({hits}); use the path",
	"team.err_hub_single_branch": "in a hub, only one vertical branch per session (D2): bond team <branch>[:agent] [--repos a,b], not {branches}",
	"team.err_hub_no_base": "in a hub, each repo branches from its hub.toml base: omit --base",
	"team.err_hub_no_repos": "{name} has no repos in its session: add repos to hub.toml",
	"team.hub_open_vertical_item": "{branch} (worktree in {repo}: {path})",
	"team.err_hub_already_open": "{name} already has vertical branch {open} open and only one fits per session: close it first with bond team clean {branch} (branches remain)",
	"team.err_hub_base_missing": "base does not exist in {repos}: change it in hub.toml (base or [repos.<x>].base)",
	"team.warn_hub_foreign_agent": "{path}: {agent} is not among repo agents: missing config (MCP, skills...). Add it with bond init",
	"team.warn_hub_uncommitted": "{path}: uncommitted changes present: worktree branches from committed state and will not see them",
	"team.hub_branch_exists": "branch already exists in the hub",
	"team.err_hub_git_branch": "{name}: git branch {branch} {base}: {error}",
	"team.hub_branch_created": "hub branch from {base}, without worktree or agent",
	"team.logo_branch_in_hub": "{branch} in {name}",
	"team.hub_footer_hints": "\n  Assign work: bond team prompt {branch} \"the task\" (to all; --repo <repo> to one)\n  Collect: bond team collect {branch} --repo <repo> · When finished: bond team clean {branch}",
	"team.err_hub_no_worktree": "no worktree for {branch} in any repo of {name} (bond team status)",
	"team.err_hub_no_worktree_in_repo": "{branch} has no worktree in {path} (bond team status)",
	"team.warn_hub_no_agent": "{repo}: {branch} has no running agent (bond team {branch} to start it)",
	"team.err_hub_no_live_agent": "{branch} has no running agent (bond team {branch} to start it)",
	"team.err_hub_no_live_agent_in": "{branch} has no running agent in {path} (bond team {branch} to start it)",
	"team.err_hub_blocked_reply": "{agents} is waiting for your reply: answer in their pane and try again (nothing was sent)",
	"team.warn_hub_run_failed": "{repo}: run: {error} (sending prompt anyway)",
	"team.err_hub_prompt_stalls": "prompt did not reach {targets}: check their panes before sending again",
	"team.err_hub_no_wt_asked_repo": "no worktree for {branch} with {agent} in {path} (bond team status)",
	"team.err_hub_no_wt_asked_all": "no worktree for {branch} with {agent} in any repo of {name} (bond team status)",
	"team.err_hub_no_wt_repo": "no worktree for {branch} in {path} (bond team status)",
	"team.err_hub_no_wt_all": "no worktree for {branch} in any repo of {name} (bond team status)",
	"team.err_hub_collect_multiple": "{branch} is in {count} repos ({repos}): collect one by one with --repo <repo>",
	"team.err_hub_no_agent_for_collect": "no agent on branch {branch} in {path} and --agent was not provided (bond team status)",
	"team.err_hub_no_decision_memory": "neither {hub} nor {repo} use decision memory: add the [decisions] section to the hub's .bond/bond.toml (bond init suggests it) and run bond sync",
	"team.err_hub_clean_no_base": "in a hub, each repo is compared against its hub.toml base: omit --base",
	"team.err_hub_clean_no_worktree": "no worktree in {target}: {branches} (bond team status)",
	"team.hub_clean_branches_kept": "  Branches remain, in {name} and in each repo",
	"team.hub_clean_branch_kept_sub_wt": "branch kept: a worktree remains in another repo",
	"team.hub_clean_branch_not_integrated": "branch kept: not integrated into {base} (--force to delete)",
};
