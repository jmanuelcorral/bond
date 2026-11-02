/**
 * Textos de la consola de bond del área comandos hub, hub init, hub check y hub pull.
 *
 * Las claves se tipan contra `es`: si añades una clave aquí y no su traducción en `en`,
 * `npm run typecheck` falla. Este fichero lo mantiene una sola rama del equipo del i18n:
 * no lo edites desde dos ramas a la vez.
 */

export const es = {
	// ---- Ayudas ----
	"hub.help": `Uso: bond hub [subcomando] [opciones]

Un hub es un repo git compartido que agrupa varios repos (p. ej. frontend y backend)
declarados en hub.toml, cada uno como submódulo o como enlace (symlink) a un clon local.
La sesión la forman el hub y sus repos, cada uno con su rama base y su modo de enlace.
Lo propio de cada máquina va en .bond/hub.local.toml.

Comandos:
  init [dir]      Crea un hub o lo prepara en un repo que ya existe, e importa repos
  add <url|ruta>  Añade un repo al hub (como submódulo o como enlace local);
                  --description describe el repo en hub.toml
  sync            Deja el disco como dice hub.toml y actualiza el registro global
  pull            Pone al día la base del hub y de sus repos en fast-forward (--dry-run, --json)
  check           Revisa cada repo de la sesión: qué falta y cómo arreglarlo (--fix, --json)

Sin subcomando: enseña la sesión del hub (repos, ruta, base, enlace, rama actual y,
si se declaró en hub.toml, la descripción de cada repo). En el AGENTS.md del hub,
bond sync mantiene un bloque generado con esa tabla, las reglas del hub y dónde
viven docs/plans/ y docs/decisions/ (D18).`,

	"hub.init.help": `Uso: bond hub init [dir] [repos...] [opciones]

Crea un hub o lo prepara en un repo git existente e importa repositorios:
por URL (submódulo) o desde un clon local (symlink). En un repo con submódulos,
los importa a hub.toml con su rama base.

Los repos nuevos entran en repos/<nombre> (D16); al importar submódulos
que ya existían se conserva su ruta. Cada repo puede llevar una descripción
opcional (el asistente la pregunta; en bond hub add, --description): alimenta
el bloque que bond genera en el AGENTS.md del hub (D18).

Opciones:
  --yes, -y       No pregunta: usa valores detectados y añade los repos indicados
  --dry-run       Muestra qué haría sin escribir en disco ni ejecutar comandos
  --dir <ruta>    Directorio del hub (por defecto, el directorio actual)
  --name <nombre> Nombre del hub (por defecto, el nombre de la carpeta)
  --base <rama>   Rama base del hub (por defecto, la rama actual o main)
  --repo <origen> Repositorio a importar (URL o ruta local; puede repetirse)

Antes de nada hace bond init en el propio hub si no lo tiene (con terminal, con sus
preguntas; con --yes, lo de bond setup), con las skills por defecto y plan-team.

Un hub recién creado (sin ningún commit) queda con su config de agente generada y un
commit inicial de los ficheros del hub, para que 'bond hub check' encuentre la base.
En un hub preexistente con commits no se commitea: los cambios se dejan para ti.

Los repos de la sesión sin bond reciben un bond init con la config del hub (sus
agentes y las skills por defecto del catálogo); los que ya lo tienen conservan la
suya. Su config se commitea en la rama actual del repo si estaba limpio; en un
submódulo ese commit es local: haz git push en él antes de subir el hub.`,

	"hub.add.help": `Uso: bond hub add <url|ruta> [opciones]

Añade un repositorio al hub: como submódulo si es una URL o como enlace (symlink)
si es una ruta a un clon local.

Opciones:
  --name <nombre>  Identificador del repo en hub.toml (por defecto, derivado del origen)
  --path <ruta>    Ruta dentro del hub (por defecto, repos/<nombre>; D16)
  --base <rama>    Rama base del repo (por defecto, la rama actual o main)
  --link <modo>    Modo de enlace: "submodule" o "symlink"
  --agent <agente> Agente por defecto para este repo en el hub
  --description <texto>  Qué es el repo (opcional); alimenta el bloque que bond genera en el AGENTS.md del hub (D18)
  --yes, -y        No pregunta
  --dry-run        Muestra qué haría sin escribir en disco`,

	"hub.sync.help": `Uso: bond hub sync [opciones]

Deja el disco como dice hub.toml: monta submódulos, crea enlaces (symlinks o
junctions en Windows), pregunta la ruta local que falte u ofrece clonar, y
actualiza el registro global ~/.bond/hubs.toml. Al hub y a los repos de la
sesión que no tienen bond les hace bond init (como bond hub init).

Opciones:
  --yes, -y   Falla si falta alguna ruta local en vez de preguntar
  --dry-run   Muestra qué haría sin modificar nada`,

	"hub.check.help": `Uso: bond hub check [opciones]

Revisa cada repo de la sesión del hub (el hub primero) y sale con 1 si algo no está
listo para trabajar con agentes. Cada problema nombra el repo, la comprobación y el
arreglo: existe y es un repo git, el enlace es el que dice hub.toml, la base existe,
bond init hecho y config al día, agentes instalados, admite worktrees, sin cambios
sin commitear y sin ramas verticales a medias.

Algunas comprobaciones son avisos (D17): se muestran con «!» pero no
cuentan como problemas ni cambian el código de salida (p. ej. los repos
fuera de repos/, la ruta por defecto desde D16, o una base atrasada
respecto a su remoto, D19).

  --fix     Arregla solo lo seguro: crea o repara el enlace al clon local (symlink,
            junction en Windows) y registra el repo en ~/.bond/hubs.toml (D14), e
            inicializa los submódulos sin iniciar. Nunca descarta cambios ni cambia
            de rama un repo. Con terminal y sin --yes pregunta antes de cada arreglo.
  --yes, -y Aplica los arreglos seguros sin preguntar (necesario sin terminal si se
            quiere arreglar; con --fix y terminal, evita la confirmación).
  --json    Salida en JSON: level (ok, warn o fail) por comprobación, repo e informe
            (los mensajes del arreglo van a stderr).
  --dry-run Describe los arreglos sin aplicarlos.`,

	"hub.pull.help": `Uso: bond hub pull [opciones]

Pone al día la rama base del hub y de cada repo de la sesión con git fetch y
avance en fast-forward (D19). Solo actúa si el repo está en su rama base y sin
cambios sin commitear, o avanzando directamente la ref si la base no tiene
checkout en ningún worktree (p. ej. en un submódulo con HEAD separado). Si la
base tiene cambios en su checkout, está en uso en otro worktree, ha divergido o
no tiene remoto/upstream, lo salta y explica el motivo.
Nunca hace merge, rebase ni push.

Opciones:
  --dry-run   Describe los avances sin hacer fetch ni mover las ramas.
  --json      Salida en JSON con el resultado por repo.`,

	// ---- hub.mts ----
	"hub.toml_invalid": "{file} no es TOML válido: {error}",
	"hub.toml_not_table": "{file} tiene que ser una tabla: define name, base y [repos]",
	"hub.toml_missing_name": "{file}: falta name (el nombre del hub, p. ej. name = \"mi-hub\")",
	"hub.toml_missing_base": "{file}: falta base (la rama base del hub, p. ej. base = \"main\")",
	"hub.toml_repos_not_table": "{file}: repos tiene que ser una tabla de repositorios: [repos.<nombre>]",
	"hub.toml_repo_not_table": "{file}: repos.{key} tiene que ser una tabla: [repos.{key}]",
	"hub.toml_repo_needs_path": "{file}: repos.{key} necesita path (la ruta dentro del hub, con /)",
	"hub.toml_repo_path_relative": "{file}: repos.{key}.path tiene que ser una ruta relativa dentro del hub, con / y sin ..",
	"hub.toml_repo_path_duplicate": "{file}: la ruta \"{path}\" está repetida en repos",
	"hub.toml_repo_needs_base": "{file}: repos.{key} necesita base (la rama base del repo)",
	"hub.toml_repo_invalid_link": "{file}: repos.{key}.link tiene que ser \"submodule\" o \"symlink\"",
	"hub.toml_repo_url_string": "{file}: repos.{key}.url tiene que ser una cadena",
	"hub.toml_repo_agent_string": "{file}: repos.{key}.agent tiene que ser una cadena",
	"hub.toml_repo_desc_string": "{file}: repos.{key}.description tiene que ser una cadena",
	"hub.local_toml_not_table": "{file} tiene que ser una tabla: [repos.<nombre>]",
	"hub.local_toml_repos_not_table": "{file}: repos tiene que ser una tabla: [repos.<nombre>]",
	"hub.local_toml_repo_not_table": "{file}: repos.{key} tiene que ser una tabla",
	"hub.local_toml_repo_source_path": "{file}: repos.{key}.source tiene que ser una ruta",
	"hub.registry_repos_not_table": "{path}: repos tiene que ser una tabla: [repos]",
	"hub.act_write_registry": "escribir registro en {path}",
	"hub.warn_invalid_hub": "{error}: sigo sin el modo hub",
	"hub.submodules_failed": "git submodule status falló en {root}: {error}",
	"hub.session_col_repo": "REPO",
	"hub.session_col_path": "RUTA",
	"hub.session_col_base": "BASE",
	"hub.session_col_link": "ENLACE",
	"hub.session_col_branch": "RAMA",
	"hub.session_col_desc": "DESCRIPCIÓN",
	"hub.session_not_present": "(no está)",
	"hub.session_detached_head": "(HEAD separado)",
	"hub.unknown_opt": "opción desconocida: {opt} (bond hub --help)",
	"hub.not_a_hub": "no es un hub: falta hub.toml (bond hub --help)",
	"hub.hub_toml_unreadable": "existe {file} pero no se puede leer: {error}",
	"hub.dir_not_a_hub": "el directorio {name} no es un hub: su hub.toml no define una sesión de hub",

	// ---- hub-init.mts ----
	"hub.act_update_gitignore": "actualizar .gitignore",
	"hub.already_linked": "ya enlazado: {path}",
	"hub.dest_is_real_repo": "{path} ya existe como repositorio real; no se sustituye",
	"hub.dest_exists_backup": "{path} ya existe; lo guardo como {bak}",
	"hub.linked": "enlazado: {dest} -> {src}",
	"hub.junction_created": "junction creada: {dest} -> {src}",
	"hub.link_failed": "no se pudo crear symlink ni junction en {path}: {error}",
	"hub.clone_err_specify": "indica la carpeta del clon local",
	"hub.clone_err_not_found": "no existe: {dir}",
	"hub.clone_err_not_git": "no es un repo git: {dir}",
	"hub.ask_clone_hint": "(↑/↓ elige, Tab completa, / entra en la carpeta)",
	"hub.submodule_up_to_date": "submódulo al día: {path}",
	"hub.submodule_update_failed": "git submodule update falló para {path}: {error}",
	"hub.submodule_initialized": "submódulo inicializado: {path}",
	"hub.submodule_missing_url": "repos.{key}: falta url para clonar el submódulo",
	"hub.submodule_add_failed": "git submodule add falló para {url}: {error}",
	"hub.submodule_added": "submódulo añadido: {path} ({url})",
	"hub.missing_local_path": "falta la ruta local para {path} ({key}): indícala en .bond/hub.local.toml ([repos.{key}].source = \"...\") o ejecuta bond hub sync de forma interactiva",
	"hub.prompt_repo_is_symlink": "El repo \"{key}\" ({path}) está configurado como enlace (symlink) pero falta su ruta local.",
	"hub.prompt_how_configure": "¿Cómo quieres configurar {key}?",
	"hub.opt_existing_clone": "Indicar la ruta a un clon local existente",
	"hub.opt_clone_from": "Clonar desde {url}",
	"hub.prompt_where_clone": "¿Dónde clonar el repositorio?",
	"hub.git_clone_failed": "git clone falló: {error}",
	"hub.prompt_path_to_clone": "Ruta al clon local de {key}:",
	"hub.local_path_not_found": "la ruta local de {key} no existe: {source} (corrígela en .bond/hub.local.toml)",
	"hub.act_link": "enlazar {dest} -> {source}",
	"hub.act_save_hub_local": "guardar .bond/hub.local.toml",
	"hub.agents_desc": "agentes {agents}",
	"hub.agents_from_setup": "los agentes de bond setup",
	"hub.prompt_init_repo": "{key} no tiene bond: ¿bond init con la config del hub ({desc})?",
	"hub.warn_repo_without_bond": "{key}: sin bond init, su agente no tendrá las skills ni las instrucciones de bond (bond hub check lo marca)",
	"hub.dry_run_init_repo": "bond init en {path} ({desc}) y commit de su config si el repo está limpio",
	"hub.log_init_repo": "bond init en {path}",
	"hub.warn_repo_dirty_config_uncommitted": "{key}: tenía cambios sin commitear, así que su config de bond queda sin commitear; commitéala tú (los worktrees de bond team salen de lo commiteado)",
	"hub.prompt_commit_config": "¿Commitear la config de bond en {key} ({branch})?",
	"hub.warn_repo_config_uncommitted": "{key}: config de bond sin commitear; los worktrees de bond team no la verán hasta que la commitees",
	"hub.warn_commit_config_failed": "{key}: commit de la config de bond: {error}",
	"hub.log_config_committed": "{key}: config de bond commiteada en {branch}",
	"hub.warn_submodule_commit_local": "{key}: el commit es local; haz git push en {path} antes de subir el hub, o sus clones no encontrarán ese commit",
	"hub.dry_run_init_hub": "bond init en el hub (skills por defecto y plan-team)",
	"hub.log_init_hub": "bond init en el hub",
	"hub.opt_needs_value": "{opt} necesita un valor",
	"hub.init_unknown_opt": "opción desconocida: {opt} (bond hub init --help)",
	"hub.git_init_failed": "git init falló: {error}",
	"hub.act_create_bond_dir": "crear .bond",
	"hub.act_create_agents_md": "crear AGENTS.md",
	"hub.prompt_hub_name": "Nombre del hub",
	"hub.prompt_hub_base": "Rama base del hub",
	"hub.prompt_import_submodules": "¿Qué submódulos quieres importar a hub.toml?",
	"hub.hint_base": "base {base}",
	"hub.prompt_add_repo_question": "¿Añadir un repositorio al hub?",
	"hub.opt_by_url": "Por URL (submódulo)",
	"hub.opt_from_local": "Desde un clon local (symlink)",
	"hub.opt_done": "Listo (no añadir más)",
	"hub.prompt_repo_url": "URL del repositorio (git@... o https://...):",
	"hub.prompt_name_in_toml": "Nombre en hub.toml:",
	"hub.prompt_path_in_hub": "Ruta dentro del hub:",
	"hub.prompt_repo_base": "Rama base:",
	"hub.prompt_default_agent": "Agente por defecto (opcional):",
	"hub.prompt_repo_desc": "Descripción del repo (opcional):",
	"hub.placeholder_frontend": "p. ej. el frontend del producto",
	"hub.placeholder_backend": "p. ej. el backend de la API",
	"hub.prompt_local_clone_path": "Ruta al clon local:",
	"hub.act_save_hub_toml": "guardar hub.toml",
	"hub.act_initial_sync_and_commit": "bond sync en el hub y commit inicial de sus ficheros (hub.toml, .gitmodules, .gitignore, AGENTS.md, .bond/ y la config de agente)",
	"hub.warn_initial_commit_failed": "commit inicial del hub: {error}",
	"hub.hub_ready": "hub {name} listo en {root}",
	"hub.add_link_invalid": "--link tiene que ser \"submodule\" o \"symlink\"",
	"hub.add_unknown_opt": "opción desconocida: {opt} (bond hub add --help)",
	"hub.add_unexpected_arg": "argumento inesperado: {arg} (bond hub add --help)",
	"hub.add_needs_target": "bond hub add necesita una URL o ruta local (bond hub add --help)",
	"hub.add_path_must_be_relative": "la ruta \"{path}\" tiene que ser relativa dentro del hub, con / y sin ..",
	"hub.add_repo_exists_diff_config": "repos.{name} ya existe en hub.toml con otra configuración (usa otro --name o edita hub.toml)",
	"hub.add_repo_already_exists": "repos.{name} ya existe en hub.toml",
	"hub.add_desc_updated": "actualizada la descripción de repos.{name}",
	"hub.add_path_already_used": "la ruta \"{path}\" ya está usada por repos.{key}",
	"hub.add_added_repo": "añadido {name} a {root}",
	"hub.sync_unknown_opt": "opción desconocida: {opt} (bond hub sync --help)",

	// ---- hub-check.mts ----
	"hub.check_base_behind": "base atrasada",
	"hub.check_base_behind_detail": "{count} commit(s) por detrás de {upstream}",
	"hub.check_route": "ruta",
	"hub.check_route_detail": "fuera de repos/ (la ruta por defecto es repos/<nombre>)",
	"hub.check_route_fix": "si quieres la convención, mueve el repo a repos/<nombre> y actualiza su path en hub.toml",
	"hub.check_exists": "existe",
	"hub.check_submodule_uninit": "submódulo sin inicializar",
	"hub.check_submodule_fix": "bond hub check --fix (git -C {root} submodule update --init {path})",
	"hub.check_fix_submodule_warn": "{name}: git submodule update --init: {error}",
	"hub.check_fix_submodule_log": "{name}: submódulo inicializado",
	"hub.check_missing_link_no_source": "falta el enlace y no hay clon local declarado",
	"hub.check_missing_link_no_source_fix": "añade source a [repos.<x>] en .bond/hub.local.toml",
	"hub.check_missing_link_source_not_found": "falta el enlace y el clon local {source} no existe",
	"hub.check_missing_link_source_not_found_fix": "restaura el clon o cambia source en .bond/hub.local.toml",
	"hub.check_broken_link_detail": "el enlace está roto (apuntaba a {target})",
	"hub.check_path_not_git": "hay algo en su ruta que no es un repo git",
	"hub.check_path_not_git_fix": "revisa {path}: ni repo ni enlace ({dir})",
	"hub.check_missing_link_to_source": "falta el enlace a {source}",
	"hub.check_link": "enlace",
	"hub.check_link_is_normal_dir": "es un directorio normal; en hub.toml link = \"symlink\"",
	"hub.check_link_is_normal_dir_fix": "enlaza la ruta al clon local o cambia link en hub.toml",
	"hub.check_link_points_elsewhere": "apunta a {actual}, no al clon de .bond/hub.local.toml ({expected})",
	"hub.check_link_points_elsewhere_fix": "recrea el enlace o corrige source en .bond/hub.local.toml",
	"hub.check_link_symlink_ok": "symlink -> {target}",
	"hub.check_link_submodule_ok": "submódulo",
	"hub.check_link_submodule_not_reg": "no está registrado como submódulo del hub",
	"hub.check_link_submodule_not_reg_fix": "bond hub add <url> o cambia link en hub.toml",
	"hub.check_base": "base",
	"hub.check_base_not_found": "la base \"{base}\" no existe en {name}",
	"hub.check_base_not_found_fix": "cambia base en hub.toml o haz git fetch en el repo",
	"hub.check_bond_init": "bond init",
	"hub.check_bond_init_missing": "el repo no tiene .bond/bond.toml",
	"hub.check_bond_init_missing_fix": "bond hub sync (hace el bond init que falta)",
	"hub.check_config": "config",
	"hub.check_config_fix": "bond sync (en {dir})",
	"hub.check_config_pending": "{count} cambio(s) de config de agente pendientes",
	"hub.check_config_up_to_date": "al día",
	"hub.check_agents": "agentes",
	"hub.check_agents_review_fix": "revisa .bond/bond.toml",
	"hub.check_agents_missing": "no están instalados: {list}",
	"hub.check_agents_missing_fix": "bond setup, o instala el agente y repite bond hub check",
	"hub.check_agents_none": "sin agentes",
	"hub.check_worktrees": "worktrees",
	"hub.check_worktrees_bare": "el repo es bare: bond team no puede crear worktrees en él",
	"hub.check_worktrees_failed": "git worktree list falla en {name}",
	"hub.check_worktrees_bare_fix": "importa un clon normal (git clone) y enlázalo",
	"hub.check_changes": "cambios",
	"hub.check_changes_dirty": "{count} cambio(s) sin commitear",
	"hub.check_changes_dirty_fix": "commitea o guarda los cambios: el worktree de bond team sale de lo commiteado",
	"hub.check_changes_clean": "limpio",
	"hub.check_vertical_branch": "rama vertical",
	"hub.check_vertical_missing_in_hub": "{branch} tiene worktree en {repos} pero no existe en el hub",
	"hub.check_vertical_missing_in_hub_fix": "bond team clean {branch}, o crea la rama en el hub antes de abrir worktrees",
	"hub.check_vertical_multiple": "varias ramas verticales abiertas ({branches}): en un hub solo cabe una por sesión",
	"hub.check_vertical_multiple_fix": "bond team clean {branch} (las ramas se quedan)",
	"hub.check_vertical_one": "{branch} en la sesión",
	"hub.check_vertical_none": "ninguna abierta",
	"hub.check_warn_hint": " · {count} aviso(s) que no impiden trabajar",
	"hub.check_ok": "el hub está listo para trabajar con agentes",
	"hub.check_failures": "{count} problema(s)",
	"hub.check_fixable_hint": " → bond hub check --fix arregla lo seguro",
	"hub.check_unknown_opt": "opción desconocida: {opt} (bond hub check --help)",
	"hub.check_prompt_fix": "¿Arreglar {check} en {repo}: {detail}?",
	"hub.cancelled": "Cancelado",
	"hub.check_act_fix": "arreglar {check} en {repo}: {detail}",
	"hub.check_warn_fix_failed": "{repo}: no se pudo arreglar {check}: {error}",

	// ---- hub-pull.mts ----
	"hub.pull_not_on_disk": "no está en disco",
	"hub.pull_base_not_found": "la base \"{base}\" no existe",
	"hub.pull_no_remote": "sin remoto configurado",
	"hub.pull_no_upstream": "la base \"{base}\" no tiene upstream configurado",
	"hub.pull_checked_out_elsewhere": "la base \"{base}\" tiene checkout en otro worktree ({path})",
	"hub.pull_dirty_changes": "{count} cambio(s) sin commitear",
	"hub.pull_fetch_failed": "git fetch falló: {error}",
	"hub.pull_compare_failed": "no se pudo comparar {base} con {upstream}",
	"hub.pull_up_to_date": "al día",
	"hub.pull_diverged": "la base ha divergido de {upstream} ({ahead} por delante, {behind} por detrás)",
	"hub.pull_would_advance": "avanzaría {count} commit(s) a {upstream} (fast-forward)",
	"hub.pull_ff_failed": "fast-forward falló: {error}",
	"hub.pull_advanced": "avanzado {count} commit(s) a {upstream} (fast-forward)",
	"hub.pull_skipped_label": "saltado: {detail}",
	"hub.pull_failed_fallback": "falló",
	"hub.pull_summary_updated": "{count} actualizado(s)",
	"hub.pull_summary_up_to_date": "{count} al día",
	"hub.pull_summary_skipped": "{count} saltado(s)",
	"hub.pull_summary_failed": "{count} con fallo",
	"hub.pull_bases_checked": "bases revisadas",
	"hub.pull_unknown_opt": "opción desconocida: {opt} (bond hub pull --help)",
} as const;

export const en: Record<keyof typeof es, string> = {
	// ---- Ayudas ----
	"hub.help": `Usage: bond hub [subcommand] [options]

A hub is a shared git repo grouping multiple repos (e.g. frontend and backend)
declared in hub.toml, each as a submodule or as a link (symlink) to a local clone.
The session is formed by the hub and its repos, each with its base branch and link mode.
Machine-specific config lives in .bond/hub.local.toml.

Commands:
  init [dir]      Create a hub or prepare an existing repo, and import repos
  add <url|path>  Add a repo to the hub (as a submodule or local link);
                  --description describes the repo in hub.toml
  sync            Set disk state as defined in hub.toml and update global registry
  pull            Update the base of the hub and its repos with fast-forward (--dry-run, --json)
  check           Check each session repo: what is missing and how to fix it (--fix, --json)

Without subcommand: shows hub session (repos, path, base, link, current branch and,
if declared in hub.toml, the description of each repo). In the hub's AGENTS.md,
bond sync maintains a generated block with that table, hub rules, and where
docs/plans/ and docs/decisions/ live (D18).`,

	"hub.init.help": `Usage: bond hub init [dir] [repos...] [options]

Create a hub or prepare an existing git repo and import repositories:
by URL (submodule) or from a local clone (symlink). In a repo with submodules,
imports them into hub.toml with their base branch.

New repos go into repos/<name> (D16); existing submodules keep their path.
Each repo can have an optional description (the wizard asks for it; in bond
hub add, --description): feeds the block that bond generates in the hub's
AGENTS.md (D18).

Options:
  --yes, -y       Do not ask: use detected values and add specified repos
  --dry-run       Show what would be done without writing to disk or running commands
  --dir <path>    Hub directory (defaults to current directory)
  --name <name>   Hub name (defaults to folder name)
  --base <branch> Hub base branch (defaults to current branch or main)
  --repo <source> Repository to import (URL or local path; can be repeated)

First runs bond init in the hub itself if missing (with terminal, with prompts;
with --yes, the bond setup defaults), with default skills and plan-team.

A newly created hub (with no commits) gets its agent config generated and an
initial commit of hub files, so 'bond hub check' finds the base branch.
In a pre-existing hub with commits, nothing is committed: changes are left for you.

Session repos without bond get a bond init with the hub's config (its
agents and default catalog skills); those that already have it keep their
own. Their config is committed on the current branch if clean; in a
submodule that commit is local: run git push on it before pushing the hub.`,

	"hub.add.help": `Usage: bond hub add <url|path> [options]

Add a repository to the hub: as a submodule if a URL or as a link (symlink)
if a path to a local clone.

Options:
  --name <name>         Repo identifier in hub.toml (defaults to name from source)
  --path <path>         Path inside the hub (defaults to repos/<name>; D16)
  --base <branch>       Base branch of the repo (defaults to current branch or main)
  --link <mode>         Link mode: "submodule" or "symlink"
  --agent <agent>       Default agent for this repo in the hub
  --description <text>  What the repo is (optional); feeds the block that bond generates in the hub's AGENTS.md (D18)
  --yes, -y             Do not ask
  --dry-run             Show what would be done without writing to disk`,

	"hub.sync.help": `Usage: bond hub sync [options]

Sets disk state as defined in hub.toml: mounts submodules, creates links (symlinks or
junctions on Windows), asks for missing local paths or offers to clone, and
updates global registry ~/.bond/hubs.toml. Runs bond init on the hub and
session repos lacking bond (like bond hub init).

Options:
  --yes, -y   Fail if any local path is missing instead of asking
  --dry-run   Show what would be done without modifying anything`,

	"hub.check.help": `Usage: bond hub check [options]

Checks each repo in the hub session (hub first) and exits with 1 if anything is not
ready to work with agents. Each issue names the repo, check and fix:
exists and is a git repo, link matches hub.toml, base branch exists,
bond init done and config up to date, agents installed, supports worktrees, no uncommitted
changes, and no partial vertical branches.

Some checks are warnings (D17): shown with "!" but do not count
as problems nor change the exit code (e.g. repos outside repos/,
the default route since D16, or a base branch behind its remote, D19).

  --fix     Fix only safe items: create or repair link to local clone (symlink,
            junction on Windows) and register repo in ~/.bond/hubs.toml (D14), and
            initialize uninitialized submodules. Never discards changes or switches
            branches. With terminal and without --yes asks before each fix.
  --yes, -y Apply safe fixes without asking (required without terminal if fixing;
            with --fix and terminal, avoids confirmation).
  --json    JSON output: level (ok, warn, or fail) per check, repo, and report
            (fix messages go to stderr).
  --dry-run Describe fixes without applying them.`,

	"hub.pull.help": `Usage: bond hub pull [options]

Updates the base branch of the hub and each session repo with git fetch and
fast-forward (D19). Only acts if the repo is on its base branch and without
uncommitted changes, or directly advancing the ref if the base is not checked out
in any worktree (e.g. in a submodule with detached HEAD). If the base has changes
in its checkout, is in use in another worktree, has diverged, or has no remote/upstream,
skips it and explains why.
Never merges, rebases, or pushes.

Options:
  --dry-run   Describe advances without fetching or moving branches.
  --json      JSON output with result per repo.`,

	// ---- hub.mts ----
	"hub.toml_invalid": "{file} is not valid TOML: {error}",
	"hub.toml_not_table": "{file} must be a table: define name, base and [repos]",
	"hub.toml_missing_name": "{file}: missing name (hub name, e.g. name = \"my-hub\")",
	"hub.toml_missing_base": "{file}: missing base (hub base branch, e.g. base = \"main\")",
	"hub.toml_repos_not_table": "{file}: repos must be a repository table: [repos.<name>]",
	"hub.toml_repo_not_table": "{file}: repos.{key} must be a table: [repos.{key}]",
	"hub.toml_repo_needs_path": "{file}: repos.{key} needs path (the path within the hub, using /)",
	"hub.toml_repo_path_relative": "{file}: repos.{key}.path must be a relative path inside the hub, with / and without ..",
	"hub.toml_repo_path_duplicate": "{file}: path \"{path}\" is duplicated in repos",
	"hub.toml_repo_needs_base": "{file}: repos.{key} needs base (the repo base branch)",
	"hub.toml_repo_invalid_link": "{file}: repos.{key}.link must be \"submodule\" or \"symlink\"",
	"hub.toml_repo_url_string": "{file}: repos.{key}.url must be a string",
	"hub.toml_repo_agent_string": "{file}: repos.{key}.agent must be a string",
	"hub.toml_repo_desc_string": "{file}: repos.{key}.description must be a string",
	"hub.local_toml_not_table": "{file} must be a table: [repos.<name>]",
	"hub.local_toml_repos_not_table": "{file}: repos must be a table: [repos.<name>]",
	"hub.local_toml_repo_not_table": "{file}: repos.{key} must be a table",
	"hub.local_toml_repo_source_path": "{file}: repos.{key}.source must be a path",
	"hub.registry_repos_not_table": "{path}: repos must be a table: [repos]",
	"hub.act_write_registry": "write registry to {path}",
	"hub.warn_invalid_hub": "{error}: continuing without hub mode",
	"hub.submodules_failed": "git submodule status failed in {root}: {error}",
	"hub.session_col_repo": "REPO",
	"hub.session_col_path": "PATH",
	"hub.session_col_base": "BASE",
	"hub.session_col_link": "LINK",
	"hub.session_col_branch": "BRANCH",
	"hub.session_col_desc": "DESCRIPTION",
	"hub.session_not_present": "(missing)",
	"hub.session_detached_head": "(detached HEAD)",
	"hub.unknown_opt": "unknown option: {opt} (bond hub --help)",
	"hub.not_a_hub": "not a hub: missing hub.toml (bond hub --help)",
	"hub.hub_toml_unreadable": "hub file {file} exists but cannot be read: {error}",
	"hub.dir_not_a_hub": "directory {name} is not a hub: its hub.toml defines no hub session",

	// ---- hub-init.mts ----
	"hub.act_update_gitignore": "update .gitignore",
	"hub.already_linked": "already linked: {path}",
	"hub.dest_is_real_repo": "{path} already exists as a real repository; not replacing",
	"hub.dest_exists_backup": "{path} already exists; saving as {bak}",
	"hub.linked": "linked: {dest} -> {src}",
	"hub.junction_created": "junction created: {dest} -> {src}",
	"hub.link_failed": "could not create symlink or junction at {path}: {error}",
	"hub.clone_err_specify": "specify the local clone folder",
	"hub.clone_err_not_found": "does not exist: {dir}",
	"hub.clone_err_not_git": "not a git repo: {dir}",
	"hub.ask_clone_hint": "(↑/↓ select, Tab complete, / enter folder)",
	"hub.submodule_up_to_date": "submodule up to date: {path}",
	"hub.submodule_update_failed": "git submodule update failed for {path}: {error}",
	"hub.submodule_initialized": "submodule initialized: {path}",
	"hub.submodule_missing_url": "repos.{key}: missing url to clone submodule",
	"hub.submodule_add_failed": "git submodule add failed for {url}: {error}",
	"hub.submodule_added": "submodule added: {path} ({url})",
	"hub.missing_local_path": "missing local path for {path} ({key}): specify it in .bond/hub.local.toml ([repos.{key}].source = \"...\") or run bond hub sync interactively",
	"hub.prompt_repo_is_symlink": "Repo \"{key}\" ({path}) is configured as a link (symlink) but missing its local path.",
	"hub.prompt_how_configure": "How do you want to configure {key}?",
	"hub.opt_existing_clone": "Specify path to an existing local clone",
	"hub.opt_clone_from": "Clone from {url}",
	"hub.prompt_where_clone": "Where to clone the repository?",
	"hub.git_clone_failed": "git clone failed: {error}",
	"hub.prompt_path_to_clone": "Path to local clone of {key}:",
	"hub.local_path_not_found": "local path for {key} does not exist: {source} (fix it in .bond/hub.local.toml)",
	"hub.act_link": "link {dest} -> {source}",
	"hub.act_save_hub_local": "save .bond/hub.local.toml",
	"hub.agents_desc": "agents {agents}",
	"hub.agents_from_setup": "agents from bond setup",
	"hub.prompt_init_repo": "{key} does not have bond: bond init with hub config ({desc})?",
	"hub.warn_repo_without_bond": "{key}: without bond init, its agent will not have bond skills or instructions (bond hub check flags this)",
	"hub.dry_run_init_repo": "bond init in {path} ({desc}) and commit of its config if repo is clean",
	"hub.log_init_repo": "bond init in {path}",
	"hub.warn_repo_dirty_config_uncommitted": "{key}: had uncommitted changes, so its bond config remains uncommitted; commit it manually (bond team worktrees branch off committed state)",
	"hub.prompt_commit_config": "Commit bond config in {key} ({branch})?",
	"hub.warn_repo_config_uncommitted": "{key}: uncommitted bond config; bond team worktrees will not see it until you commit it",
	"hub.warn_commit_config_failed": "{key}: bond config commit: {error}",
	"hub.log_config_committed": "{key}: bond config committed on {branch}",
	"hub.warn_submodule_commit_local": "{key}: the commit is local; run git push in {path} before pushing the hub, or its clones will not find that commit",
	"hub.dry_run_init_hub": "bond init in the hub (default skills and plan-team)",
	"hub.log_init_hub": "bond init in the hub",
	"hub.opt_needs_value": "{opt} needs a value",
	"hub.init_unknown_opt": "unknown option: {opt} (bond hub init --help)",
	"hub.git_init_failed": "git init failed: {error}",
	"hub.act_create_bond_dir": "create .bond",
	"hub.act_create_agents_md": "create AGENTS.md",
	"hub.prompt_hub_name": "Hub name",
	"hub.prompt_hub_base": "Hub base branch",
	"hub.prompt_import_submodules": "Which submodules do you want to import into hub.toml?",
	"hub.hint_base": "base {base}",
	"hub.prompt_add_repo_question": "Add a repository to the hub?",
	"hub.opt_by_url": "By URL (submodule)",
	"hub.opt_from_local": "From a local clone (symlink)",
	"hub.opt_done": "Done (do not add more)",
	"hub.prompt_repo_url": "Repository URL (git@... or https://...):",
	"hub.prompt_name_in_toml": "Name in hub.toml:",
	"hub.prompt_path_in_hub": "Path inside the hub:",
	"hub.prompt_repo_base": "Base branch:",
	"hub.prompt_default_agent": "Default agent (optional):",
	"hub.prompt_repo_desc": "Repo description (optional):",
	"hub.placeholder_frontend": "e.g. the product frontend",
	"hub.placeholder_backend": "e.g. the API backend",
	"hub.prompt_local_clone_path": "Path to local clone:",
	"hub.act_save_hub_toml": "save hub.toml",
	"hub.act_initial_sync_and_commit": "bond sync in the hub and initial commit of its files (hub.toml, .gitmodules, .gitignore, AGENTS.md, .bond/ and agent config)",
	"hub.warn_initial_commit_failed": "initial hub commit: {error}",
	"hub.hub_ready": "hub {name} ready at {root}",
	"hub.add_link_invalid": "--link must be \"submodule\" or \"symlink\"",
	"hub.add_unknown_opt": "unknown option: {opt} (bond hub add --help)",
	"hub.add_unexpected_arg": "unexpected argument: {arg} (bond hub add --help)",
	"hub.add_needs_target": "bond hub add needs a URL or local path (bond hub add --help)",
	"hub.add_path_must_be_relative": "path \"{path}\" must be relative inside the hub, with / and without ..",
	"hub.add_repo_exists_diff_config": "repos.{name} already exists in hub.toml with another configuration (use another --name or edit hub.toml)",
	"hub.add_repo_already_exists": "repos.{name} already exists in hub.toml",
	"hub.add_desc_updated": "updated description of repos.{name}",
	"hub.add_path_already_used": "path \"{path}\" is already used by repos.{key}",
	"hub.add_added_repo": "added {name} to {root}",
	"hub.sync_unknown_opt": "unknown option: {opt} (bond hub sync --help)",

	// ---- hub-check.mts ----
	"hub.check_base_behind": "base behind",
	"hub.check_base_behind_detail": "{count} commit(s) behind {upstream}",
	"hub.check_route": "route",
	"hub.check_route_detail": "outside repos/ (default route is repos/<name>)",
	"hub.check_route_fix": "to follow convention, move repo to repos/<name> and update its path in hub.toml",
	"hub.check_exists": "exists",
	"hub.check_submodule_uninit": "submodule not initialized",
	"hub.check_submodule_fix": "bond hub check --fix (git -C {root} submodule update --init {path})",
	"hub.check_fix_submodule_warn": "{name}: git submodule update --init: {error}",
	"hub.check_fix_submodule_log": "{name}: submodule initialized",
	"hub.check_missing_link_no_source": "missing link and no local clone declared",
	"hub.check_missing_link_no_source_fix": "add source to [repos.<x>] in .bond/hub.local.toml",
	"hub.check_missing_link_source_not_found": "missing link and local clone {source} does not exist",
	"hub.check_missing_link_source_not_found_fix": "restore clone or change source in .bond/hub.local.toml",
	"hub.check_broken_link_detail": "link is broken (pointed to {target})",
	"hub.check_path_not_git": "something in path is not a git repo",
	"hub.check_path_not_git_fix": "check {path}: neither repo nor link ({dir})",
	"hub.check_missing_link_to_source": "missing link to {source}",
	"hub.check_link": "link",
	"hub.check_link_is_normal_dir": "normal directory; in hub.toml link = \"symlink\"",
	"hub.check_link_is_normal_dir_fix": "link path to local clone or change link in hub.toml",
	"hub.check_link_points_elsewhere": "points to {actual}, not to clone from .bond/hub.local.toml ({expected})",
	"hub.check_link_points_elsewhere_fix": "recreate link or fix source in .bond/hub.local.toml",
	"hub.check_link_symlink_ok": "symlink -> {target}",
	"hub.check_link_submodule_ok": "submodule",
	"hub.check_link_submodule_not_reg": "not registered as hub submodule",
	"hub.check_link_submodule_not_reg_fix": "bond hub add <url> or change link in hub.toml",
	"hub.check_base": "base",
	"hub.check_base_not_found": "base \"{base}\" does not exist in {name}",
	"hub.check_base_not_found_fix": "change base in hub.toml or run git fetch in repo",
	"hub.check_bond_init": "bond init",
	"hub.check_bond_init_missing": "repo lacks .bond/bond.toml",
	"hub.check_bond_init_missing_fix": "bond hub sync (runs missing bond init)",
	"hub.check_config": "config",
	"hub.check_config_fix": "bond sync (in {dir})",
	"hub.check_config_pending": "{count} agent config change(s) pending",
	"hub.check_config_up_to_date": "up to date",
	"hub.check_agents": "agents",
	"hub.check_agents_review_fix": "check .bond/bond.toml",
	"hub.check_agents_missing": "not installed: {list}",
	"hub.check_agents_missing_fix": "bond setup, or install the agent and run bond hub check again",
	"hub.check_agents_none": "no agents",
	"hub.check_worktrees": "worktrees",
	"hub.check_worktrees_bare": "bare repository: bond team cannot create worktrees in it",
	"hub.check_worktrees_failed": "git worktree list fails in {name}",
	"hub.check_worktrees_bare_fix": "import a normal clone (git clone) and link it",
	"hub.check_changes": "changes",
	"hub.check_changes_dirty": "{count} uncommitted change(s)",
	"hub.check_changes_dirty_fix": "commit or stash changes: bond team worktree branches off committed state",
	"hub.check_changes_clean": "clean",
	"hub.check_vertical_branch": "vertical branch",
	"hub.check_vertical_missing_in_hub": "{branch} has worktree in {repos} but does not exist in hub",
	"hub.check_vertical_missing_in_hub_fix": "bond team clean {branch}, or create the branch in the hub before opening worktrees",
	"hub.check_vertical_multiple": "multiple vertical branches open ({branches}): in a hub only one fits per session",
	"hub.check_vertical_multiple_fix": "bond team clean {branch} (branches are kept)",
	"hub.check_vertical_one": "{branch} in session",
	"hub.check_vertical_none": "none open",
	"hub.check_warn_hint": " · {count} warning(s) that do not prevent working",
	"hub.check_ok": "the hub is ready to work with agents",
	"hub.check_failures": "{count} problem(s)",
	"hub.check_fixable_hint": " → bond hub check --fix fixes safe issues",
	"hub.check_unknown_opt": "unknown option: {opt} (bond hub check --help)",
	"hub.check_prompt_fix": "Fix {check} in {repo}: {detail}?",
	"hub.cancelled": "Cancelled",
	"hub.check_act_fix": "fix {check} in {repo}: {detail}",
	"hub.check_warn_fix_failed": "{repo}: could not fix {check}: {error}",

	// ---- hub-pull.mts ----
	"hub.pull_not_on_disk": "not on disk",
	"hub.pull_base_not_found": "base \"{base}\" does not exist",
	"hub.pull_no_remote": "no remote configured",
	"hub.pull_no_upstream": "base \"{base}\" has no upstream configured",
	"hub.pull_checked_out_elsewhere": "base \"{base}\" is checked out in another worktree ({path})",
	"hub.pull_dirty_changes": "{count} uncommitted change(s)",
	"hub.pull_fetch_failed": "git fetch failed: {error}",
	"hub.pull_compare_failed": "could not compare {base} with {upstream}",
	"hub.pull_up_to_date": "up to date",
	"hub.pull_diverged": "base has diverged from {upstream} ({ahead} ahead, {behind} behind)",
	"hub.pull_would_advance": "would advance {count} commit(s) to {upstream} (fast-forward)",
	"hub.pull_ff_failed": "fast-forward failed: {error}",
	"hub.pull_advanced": "advanced {count} commit(s) to {upstream} (fast-forward)",
	"hub.pull_skipped_label": "skipped: {detail}",
	"hub.pull_failed_fallback": "failed",
	"hub.pull_summary_updated": "{count} updated",
	"hub.pull_summary_up_to_date": "{count} up to date",
	"hub.pull_summary_skipped": "{count} skipped",
	"hub.pull_summary_failed": "{count} failed",
	"hub.pull_bases_checked": "bases checked",
	"hub.pull_unknown_opt": "unknown option: {opt} (bond hub pull --help)",
};
