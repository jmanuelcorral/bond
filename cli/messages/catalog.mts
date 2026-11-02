/**
 * Textos de la consola de bond del área comandos catalog y agents.
 *
 * Las claves se tipan contra `es`: si añades una clave aquí y no su traducción en `en`,
 * `npm run typecheck` falla. Este fichero lo mantiene una sola rama del equipo del i18n:
 * no lo edites desde dos ramas a la vez.
 */

export const es = {
	"catalog.help": `Uso: bond catalog <subcomando> [opciones]

Catálogos de skills, comandos y servidores MCP para compartir entre repos.

Crear un catálogo (en su propio repo):
  create [--name n]   Prepara el repo actual como catálogo: catalog.toml y las carpetas
                      skills/, commands/ y mcps/, cada una con un README.md que explica cómo
                      añadir lo suyo. Pregunta el nombre (por defecto, el de la carpeta). Si ya
                      hay catalog.toml, no lo toca: solo añade lo que falte.
  check [dir]         Comprueba un catálogo (por defecto, el del repo actual). Sale con 1 si
                      hay errores, para CI.

Usarlo en un repo con bond (.bond/bond.toml):
  add <url|carpeta>   Lo declara en bond.toml ([[catalog]]). Por git, fija el commit en
                      .bond/lock.json: --ref tag, rama o sha (por defecto, la rama por defecto).
                      --name n le da otro nombre (por defecto, el de su catalog.toml).
  list                El de bond y los del repo, con su ref y commit.
  update [nombre]     Vuelve a resolver la ref de los catálogos por git y mueve el lock;
                      --ref cambia la ref (con nombre).
  remove <nombre>     Lo quita de bond.toml, del lock y de lo que el repo tenía elegido de él.
  clean               Vacía la caché (~/.bond/catalogs), salvo los commits que fija este repo.

add y update enseñan antes los servidores MCP que llegan o cambian (ejecutan programas en tu
máquina) y lo que pasa a venir de otro catálogo, y piden confirmación (--yes la da).

  --dry-run           (create) Enseña lo que haría sin escribir`,

	// catalog-git.mts
	"catalog.git_needed": "hace falta git para los catálogos del equipo por URL (instálalo y vuelve a probar)",
	"catalog.git_cannot_read": "no se puede leer {url}: {error}",
	"catalog.git_ref_not_found": 'no hay ningún tag ni rama "{ref}" en {url}',
	"catalog.git_no_default_branch": "{url} no tiene rama por defecto: indica --ref",
	"catalog.git_cannot_download": "no se puede descargar {url}: {error}",
	"catalog.git_commit_missing": "el commit {sha} no está en {url} (¿se reescribió la historia? bond catalog update)",
	"catalog.git_cannot_extract": "no se puede extraer {sha} de {url}: {error}",
	"catalog.lock_cannot_read": ".bond/lock.json no se puede leer ({error}): recupéralo de git o ejecuta bond catalog update",

	// catalog.mts - frontmatter & validation
	"catalog.fm_missing": "sin frontmatter (--- ... ---)",
	"catalog.fm_not_kv": 'línea {n}: no es "clave: valor" ni comentario',
	"catalog.fm_unclosed_quote": "línea {n}: comilla sin cerrar en {key}",
	"catalog.fm_unquoted_colon": 'línea {n}: valor sin comillas en {key} contiene ": " (YAML lo rechaza); entrecomillalo ("...")',
	"catalog.check_missing_toml": "falta catalog.toml (bond catalog create lo prepara)",
	"catalog.check_invalid_toml": "catalog.toml no es TOML válido: {err}",
	"catalog.check_invalid_name": "catalog.toml: name {name} no vale (minúsculas, dígitos, - o _)",
	"catalog.check_missing_skill_md": "skills/{dir}: falta SKILL.md",
	"catalog.check_missing_fm": "skills/{dir}/SKILL.md: falta el frontmatter (--- name y description ---)",
	"catalog.check_skill_name_mismatch": 'skills/{dir}/SKILL.md: name {name}, tiene que ser "{dir}" (el nombre de la carpeta)',
	"catalog.check_name_empty": "vacío",
	"catalog.check_missing_skill_desc": "skills/{dir}/SKILL.md: falta description (el agente la usa para decidir cuándo cargarla)",
	"catalog.check_invalid_fm": "skills/{dir}/SKILL.md: frontmatter no es YAML válido: {err}",
	"catalog.check_invalid_skill_name": "skills/{dir}: nombre no válido (minúsculas, dígitos, - o _)",
	"catalog.check_skills_not_table": "catalog.toml: skills tiene que ser una tabla ([skills.<nombre>])",
	"catalog.check_skills_orphan": "catalog.toml: [skills.{name}] no corresponde a ninguna skill de skills/",
	"catalog.check_skills_summary_not_string": "catalog.toml: skills.{name}.summary tiene que ser texto",
	"catalog.check_skills_default_not_bool": "catalog.toml: skills.{name}.default tiene que ser true o false",
	"catalog.check_invalid_cmd_name": "commands/{name}.md: nombre no válido (minúsculas, dígitos, - o _)",
	"catalog.check_missing_cmd_desc": "commands/{name}.md: falta description en el frontmatter",
	"catalog.check_mcp_invalid_json": "{where}: JSON inválido ({err})",
	"catalog.check_mcp_not_object": "{where}: tiene que ser un objeto",
	"catalog.check_mcp_invalid_name": "{where}: nombre no válido (minúsculas, dígitos, - o _)",
	"catalog.check_mcp_needs_cmd_or_url": "{where}: necesita command (servidor local) o url (remoto)",
	"catalog.check_mcp_cmd_and_url": "{where}: command o url, no los dos",
	"catalog.check_mcp_args_not_list": "{where}: args tiene que ser una lista de textos",
	"catalog.check_mcp_field_not_object": "{where}: {field} tiene que ser un objeto de textos",
	"catalog.check_mcp_looks_secret": "{where}: {field}.{key} parece un secreto escrito tal cual; usa ${VARIABLE}",
	"catalog.check_mcp_missing_desc": "{where}: sin description (bond init la enseña al elegir)",
	"catalog.check_mcp_desc_not_string": "{where}: description tiene que ser texto",

	// catalog.mts - subcommands & counting
	"catalog.create_name_needs_val": "--name necesita un valor",
	"catalog.create_invalid_name": "nombre de catálogo no válido: {name} (minúsculas, dígitos, - o _)",
	"catalog.create_not_git": "{root} no es un repo git: para compartir el catálogo, versiónalo y publícalo en git",
	"catalog.create_toml_exists": "catalog.toml ya existe: --name no lo cambia",
	"catalog.create_prompt_name": "¿Nombre del catálogo? (el que verá el equipo al usarlo)",
	"catalog.create_prompt_validate": "minúsculas, dígitos, - o _",
	"catalog.cancelled": "cancelado",
	"catalog.create_start": "bond catalog create en {root}",
	"catalog.create_already_complete": "  el catálogo ya tiene todo lo necesario: nada que añadir",
	"catalog.create_dry_run": "  [dry-run] crearía {path}",
	"catalog.create_summary": `
Catálogo "{name}". Siguiente:
  1. Añade skills, comandos y servidores MCP (el README.md de cada carpeta explica cómo).
  2. Compruébalo: bond catalog check
  3. Commitea y publícalo en git: git add catalog.toml skills commands mcps`,
	"catalog.check_one_dir": "bond catalog check admite un solo directorio",
	"catalog.check_dir_not_found": "no existe el directorio {dir}",
	"catalog.error_prefix": "error:",
	"catalog.count_skill_one": "skill",
	"catalog.count_skill_many": "skills",
	"catalog.count_cmd_one": "comando",
	"catalog.count_cmd_many": "comandos",
	"catalog.count_mcp_one": "servidor MCP",
	"catalog.count_mcp_many": "servidores MCP",
	"catalog.count_error_one": "error",
	"catalog.count_error_many": "errores",
	"catalog.count_warning_one": "aviso",
	"catalog.count_warning_many": "avisos",
	"catalog.count_commit_del_one": "commit borrado",
	"catalog.count_commit_del_many": "commits borrados",
	"catalog.check_failed": "el catálogo {label} tiene {errors} ({counts})",
	"catalog.check_ok": "catálogo {label} correcto: {counts}{warnings}",
	"catalog.check_warnings_suffix": ", {count}",
	"catalog.no_bond_toml": "este repo no tiene .bond/bond.toml: ejecuta antes bond init",
	"catalog.invalid_bond_toml": ".bond/bond.toml no es TOML válido: {err}",
	"catalog.mcp_review_header": "Servidores MCP del catálogo {name} (se instalan solo si están en mcp = [...]):",
	"catalog.moved_item": "  {symbol} {name}: de {from} pasa a {to}",
	"catalog.moved_header": "Lo que usa este repo y pasa a venir de otro catálogo:",
	"catalog.confirm_changes_unattended": "hay cambios que revisar (arriba): repite con --yes para aceptarlos",
	"catalog.confirm_prompt": "¿Seguir?",
	"catalog.flag_needs_value": "{flag} necesita un valor",
	"catalog.unknown_opt": "opción desconocida: {opt} (bond catalog --help)",
	"catalog.add_usage": "uso: bond catalog add <url|carpeta> [--name n] [--ref tag|rama|sha] [--yes]",
	"catalog.add_already_exists": "{source} ya está como el catálogo {name}",
	"catalog.add_ref_only_git": "--ref solo vale para un catálogo por git",
	"catalog.add_folder_not_found": "no existe la carpeta {source}",
	"catalog.add_has_errors": "el catálogo de {source} tiene {errors}: no se añade (arréglalo en su repo y compruébalo con bond catalog check)",
	"catalog.add_cancelled": "cancelado: no se ha cambiado nada",
	"catalog.add_success": "catálogo {name} ({where}): {skills}, {commands}, {mcps}",
	"catalog.add_next_hint": "  elige lo suyo con bond init (o en .bond/bond.toml) y commitea .bond/",
	"catalog.list_bond_builtin": "incluido en bond",
	"catalog.default_branch": "rama por defecto",
	"catalog.list_folder": "carpeta",
	"catalog.update_usage": "uso: bond catalog update [nombre] [--ref tag|rama|sha] [--yes]",
	"catalog.update_local_catalog": "{name} es un catálogo local: no hay nada que actualizar",
	"catalog.update_not_found": "no hay ningún catálogo por git llamado {name} (bond catalog list)",
	"catalog.update_none_git": "no hay catálogos por git que actualizar",
	"catalog.update_ref_needs_name": "--ref necesita el nombre del catálogo: bond catalog update <nombre> --ref ...",
	"catalog.update_up_to_date": "{name}: al día ({ref} @ {sha})",
	"catalog.unpinned": "sin fijar",
	"catalog.update_changed": "{name}: {old} → {new} ({ref})",
	"catalog.update_cancelled": "cancelado: el lock queda como estaba",
	"catalog.remove_usage": "uso: bond catalog remove <nombre>",
	"catalog.remove_not_found": "no hay ningún catálogo {name} en .bond/bond.toml (bond catalog list)",
	"catalog.remove_success": "catálogo {name}{dropped}",
	"catalog.remove_dropped": "  (quitado también de la selección: {dropped})",
	"catalog.clean_summary": "caché de catálogos: {count}{kept}",
	"catalog.clean_kept_one": " (se queda el que fija este repo)",
	"catalog.clean_kept_many": " (se quedan los {count} que fija este repo)",
	"catalog.unknown_sub": "subcomando desconocido: {sub} (bond catalog --help)",
} as const;

export const en: Record<keyof typeof es, string> = {
	"catalog.help": `Usage: bond catalog <subcommand> [options]

Catalogs of skills, commands, and MCP servers to share between repos.

Create a catalog (in its own repo):
  create [--name n]   Prepare the current repo as a catalog: catalog.toml and the
                      skills/, commands/, and mcps/ folders, each with a README.md
                      explaining how to add its items. Asks for the name (default:
                      folder name). If catalog.toml exists, leaves it alone: only
                      adds what is missing.
  check [dir]         Check a catalog (default: current repo). Exits 1 on errors,
                      for CI.

Use it in a repo with bond (.bond/bond.toml):
  add <url|folder>    Declare it in bond.toml ([[catalog]]). For git, pins the commit
                      in .bond/lock.json: --ref tag, branch, or sha (default: default branch).
                      --name n gives it another name (default: from its catalog.toml).
  list                Bond's and repo catalogs, with their ref and commit.
  update [name]       Resolve git catalog refs again and update the lock;
                      --ref changes the ref (with name).
  remove <name>       Remove it from bond.toml, the lock, and selections from it.
  clean               Clear the cache (~/.bond/catalogs), except commits pinned by this repo.

add and update show MCP servers being added or changed first (they execute code on your
machine) and items moving from another catalog, and ask for confirmation (--yes gives it).

  --dry-run           (create) Show what it would do without writing`,

	// catalog-git.mts
	"catalog.git_needed": "git is required for team catalogs by URL (install it and try again)",
	"catalog.git_cannot_read": "cannot read {url}: {error}",
	"catalog.git_ref_not_found": 'no tag or branch "{ref}" in {url}',
	"catalog.git_no_default_branch": "{url} has no default branch: specify --ref",
	"catalog.git_cannot_download": "cannot download {url}: {error}",
	"catalog.git_commit_missing": "commit {sha} is not in {url} (was history rewritten? bond catalog update)",
	"catalog.git_cannot_extract": "cannot extract {sha} from {url}: {error}",
	"catalog.lock_cannot_read": ".bond/lock.json cannot be read ({error}): restore it from git or run bond catalog update",

	// catalog.mts - frontmatter & validation
	"catalog.fm_missing": "missing frontmatter (--- ... ---)",
	"catalog.fm_not_kv": 'line {n}: not a "key: value" or comment',
	"catalog.fm_unclosed_quote": "line {n}: unclosed quote in {key}",
	"catalog.fm_unquoted_colon": 'line {n}: unquoted value in {key} contains ": " (YAML rejects it); wrap it in quotes ("...")',
	"catalog.check_missing_toml": "missing catalog.toml (bond catalog create sets it up)",
	"catalog.check_invalid_toml": "catalog.toml is not valid TOML: {err}",
	"catalog.check_invalid_name": "catalog.toml: name {name} is invalid (lowercase letters, digits, - or _)",
	"catalog.check_missing_skill_md": "skills/{dir}: missing SKILL.md",
	"catalog.check_missing_fm": "skills/{dir}/SKILL.md: missing frontmatter (--- name and description ---)",
	"catalog.check_skill_name_mismatch": 'skills/{dir}/SKILL.md: name {name}, must be "{dir}" (the folder name)',
	"catalog.check_name_empty": "empty",
	"catalog.check_missing_skill_desc": "skills/{dir}/SKILL.md: missing description (agent uses it to decide when to load it)",
	"catalog.check_invalid_fm": "skills/{dir}/SKILL.md: frontmatter is not valid YAML: {err}",
	"catalog.check_invalid_skill_name": "skills/{dir}: invalid name (lowercase letters, digits, - or _)",
	"catalog.check_skills_not_table": "catalog.toml: skills must be a table ([skills.<name>])",
	"catalog.check_skills_orphan": "catalog.toml: [skills.{name}] does not match any skill in skills/",
	"catalog.check_skills_summary_not_string": "catalog.toml: skills.{name}.summary must be text",
	"catalog.check_skills_default_not_bool": "catalog.toml: skills.{name}.default must be true or false",
	"catalog.check_invalid_cmd_name": "commands/{name}.md: invalid name (lowercase letters, digits, - or _)",
	"catalog.check_missing_cmd_desc": "commands/{name}.md: missing description in frontmatter",
	"catalog.check_mcp_invalid_json": "{where}: invalid JSON ({err})",
	"catalog.check_mcp_not_object": "{where}: must be an object",
	"catalog.check_mcp_invalid_name": "{where}: invalid name (lowercase letters, digits, - or _)",
	"catalog.check_mcp_needs_cmd_or_url": "{where}: needs command (local server) or url (remote)",
	"catalog.check_mcp_cmd_and_url": "{where}: command or url, not both",
	"catalog.check_mcp_args_not_list": "{where}: args must be a list of strings",
	"catalog.check_mcp_field_not_object": "{where}: {field} must be an object of strings",
	"catalog.check_mcp_looks_secret": "{where}: {field}.{key} looks like a plaintext secret; use \${VARIABLE}",
	"catalog.check_mcp_missing_desc": "{where}: missing description (bond init shows it when choosing)",
	"catalog.check_mcp_desc_not_string": "{where}: description must be text",

	// catalog.mts - subcommands & counting
	"catalog.create_name_needs_val": "--name requires a value",
	"catalog.create_invalid_name": "invalid catalog name: {name} (lowercase letters, digits, - or _)",
	"catalog.create_not_git": "{root} is not a git repo: to share the catalog, version it and publish it to git",
	"catalog.create_toml_exists": "catalog.toml already exists: --name does not change it",
	"catalog.create_prompt_name": "Catalog name? (the one the team will see when using it)",
	"catalog.create_prompt_validate": "lowercase letters, digits, - or _",
	"catalog.cancelled": "cancelled",
	"catalog.create_start": "bond catalog create in {root}",
	"catalog.create_already_complete": "  catalog already has everything needed: nothing to add",
	"catalog.create_dry_run": "  [dry-run] would create {path}",
	"catalog.create_summary": `
Catalog "{name}". Next:
  1. Add skills, commands, and MCP servers (the README.md in each folder explains how).
  2. Check it: bond catalog check
  3. Commit and publish it to git: git add catalog.toml skills commands mcps`,
	"catalog.check_one_dir": "bond catalog check accepts only one directory",
	"catalog.check_dir_not_found": "directory {dir} does not exist",
	"catalog.error_prefix": "error:",
	"catalog.count_skill_one": "skill",
	"catalog.count_skill_many": "skills",
	"catalog.count_cmd_one": "command",
	"catalog.count_cmd_many": "commands",
	"catalog.count_mcp_one": "MCP server",
	"catalog.count_mcp_many": "MCP servers",
	"catalog.count_error_one": "error",
	"catalog.count_error_many": "errors",
	"catalog.count_warning_one": "warning",
	"catalog.count_warning_many": "warnings",
	"catalog.count_commit_del_one": "commit deleted",
	"catalog.count_commit_del_many": "commits deleted",
	"catalog.check_failed": "catalog {label} has {errors} ({counts})",
	"catalog.check_ok": "catalog {label} correct: {counts}{warnings}",
	"catalog.check_warnings_suffix": ", {count}",
	"catalog.no_bond_toml": "this repo has no .bond/bond.toml: run bond init first",
	"catalog.invalid_bond_toml": ".bond/bond.toml is not valid TOML: {err}",
	"catalog.mcp_review_header": "MCP servers from catalog {name} (only installed if listed in mcp = [...]):",
	"catalog.moved_item": "  {symbol} {name}: from {from} moves to {to}",
	"catalog.moved_header": "What this repo uses and now comes from another catalog:",
	"catalog.confirm_changes_unattended": "there are changes to review (above): repeat with --yes to accept them",
	"catalog.confirm_prompt": "Continue?",
	"catalog.flag_needs_value": "{flag} requires a value",
	"catalog.unknown_opt": "unknown option: {opt} (bond catalog --help)",
	"catalog.add_usage": "usage: bond catalog add <url|folder> [--name n] [--ref tag|branch|sha] [--yes]",
	"catalog.add_already_exists": "{source} is already present as catalog {name}",
	"catalog.add_ref_only_git": "--ref is only valid for a git catalog",
	"catalog.add_folder_not_found": "folder {source} does not exist",
	"catalog.add_has_errors": "catalog {source} has {errors}: not added (fix it in its repo and verify with bond catalog check)",
	"catalog.add_cancelled": "cancelled: nothing was changed",
	"catalog.add_success": "catalog {name} ({where}): {skills}, {commands}, {mcps}",
	"catalog.add_next_hint": "  select its items with bond init (or in .bond/bond.toml) and commit .bond/",
	"catalog.list_bond_builtin": "included in bond",
	"catalog.default_branch": "default branch",
	"catalog.list_folder": "folder",
	"catalog.update_usage": "usage: bond catalog update [name] [--ref tag|branch|sha] [--yes]",
	"catalog.update_local_catalog": "{name} is a local catalog: nothing to update",
	"catalog.update_not_found": "no git catalog named {name} (bond catalog list)",
	"catalog.update_none_git": "no git catalogs to update",
	"catalog.update_ref_needs_name": "--ref requires the catalog name: bond catalog update <name> --ref ...",
	"catalog.update_up_to_date": "{name}: up to date ({ref} @ {sha})",
	"catalog.unpinned": "unpinned",
	"catalog.update_changed": "{name}: {old} → {new} ({ref})",
	"catalog.update_cancelled": "cancelled: lock left as it was",
	"catalog.remove_usage": "usage: bond catalog remove <name>",
	"catalog.remove_not_found": "no catalog {name} in .bond/bond.toml (bond catalog list)",
	"catalog.remove_success": "catalog {name}{dropped}",
	"catalog.remove_dropped": "  (also removed from selection: {dropped})",
	"catalog.clean_summary": "catalogs cache: {count}{kept}",
	"catalog.clean_kept_one": " (keeping the 1 pinned by this repo)",
	"catalog.clean_kept_many": " (keeping the {count} pinned by this repo)",
	"catalog.unknown_sub": "unknown subcommand: {sub} (bond catalog --help)",
};
