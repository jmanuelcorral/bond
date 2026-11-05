/**
 * Textos de la consola de bond del área comando decisions.
 *
 * Las claves se tipan contra `es`: si añades una clave aquí y no su traducción en `en`,
 * `npm run typecheck` falla. Este fichero lo mantiene una sola rama del equipo del i18n:
 * no lo edites desde dos ramas a la vez.
 */

export const es = {
	"decisions.help": `Uso: bond decisions [subcomando] [opciones]

La memoria de decisiones del repo ([decisions] en .bond/bond.toml). Sin subcomando,
lista las decisiones.

  (lista) [--status <s>] [--agent <a>] [--json]
            Decisiones del repo, las más recientes primero.
  add --title <t> [--context <c>] --decision <d> [--alternatives <a>]
      [--consequences <c>] [--link <ref>]... [--confirmed-by <ref>] [--json]
            Registra una decisión: bond calcula el id (YYYY-MM-DD-slug), la autoría
            (desde el panel de Herdr, agent:<kind>/<nombre>; fuera, user) y escribe el
            fichero. No toca ningún índice: el listado lo da esta orden (así las ramas
            paralelas no chocan). Entra como "proposed"; con --confirmed-by "<lo que
            dijo el usuario>" (porque ya la aprobó, por ejemplo con el plan) entra
            "accepted" con esa cita y accepted_via. El cuerpo queda con los
            apartados en inglés: Context / Decision / Rejected alternatives / Consequences
            (este solo si pasas --consequences). Con --stdin, el mismo objeto en JSON
            por la entrada estándar: {"title","context","decision","alternatives",
            "consequences","links","confirmed_by"}.
  accept <id>... [--ref <aceptación>] [--confirmed-by "<lo que dijo el usuario>"] [--all-proposed]
            La pasa a "accepted". Es solo del usuario, pero puede hacerlo desde la
            conversación: con --confirmed-by (una referencia a sus palabras) no hace
            falta terminal y la decisión guarda además accepted_via: "user" (aceptó el
            usuario; quien tecleó queda ya en decided_by). Con terminal y sin
            --confirmed-by, pregunta. Sin una cosa ni otra, se niega. Admite varios ids
            y --all-proposed; un id desconocido o no "proposed" se informa sin abortar
            los demás (salida != 0 si alguno falló). --confirmed-by vacío se rechaza.
            Se niega también si quien ejecuta es el mismo agente que la registró
            (decided_by): un agente no se acepta sus propias decisiones; las registra ya
            aceptadas con add --confirmed-by, o las acepta el usuario.
  reject <id>... [--ref <motivo>] [--confirmed-by <ref>] [--all-proposed]
            La pasa a "rejected" (misma confirmación).
  supersede <id>... --by <nueva> [--confirmed-by <ref>] [--all-proposed]
            Las sustituye: las viejas quedan "superseded" y la nueva las referencia en
            "supersedes" (misma confirmación).
  show <id>                       El fichero entero de una decisión (o de un run, si el
                                  id es de uno en <dir>/runs/).
  runs [--agent <a>] [--json]     Los runs (encargos a agentes) de <dir>/runs/, con los
                                  commits de su rama y las decisiones de ese agente.
  check                           Audita la memoria: frontmatter, ids, duplicados,
                                  sustituciones, trailers Decision: y auto-aceptaciones
                                  (accepted con decided_by == accepted_via). Sale con 1
                                  si hay errores. El README no se audita: no hay índice
                                  que mantener al día.
  migrate [--dry-run] [--json]    Pasa las decisiones "accepted" cuyo accepted_via es de
                                  agente a accepted_via: "user" (aceptó el usuario).
                                  Idempotente; deja intactas las que lo tienen vacío
                                  (aceptadas en terminal). --dry-run informa sin escribir.
                                  Asume que cada accepted_by fue palabra del usuario:
                                  desde el frontmatter no se puede verificar.

  --json     Salida JSON estable en lista, add, runs, check y migrate.
  -h, --help Esta ayuda.

Autoría: la calcula bond (en un panel de Herdr, agent:<kind>/<nombre>; fuera, user).
Se puede fijar a mano con BOND_DECISION_AGENT o con [decisions] author en
~/.bond/config.toml, para que un panel delegado firme con la identidad con la que se
habla y no con el minion que bond arrancó en su worktree. Vale "user" o
"agent:<kind>[/<nombre>]"; "pi/gru" se normaliza a "agent:pi/gru".

Sin la sección [decisions], solo "add" falla (dice cómo activarla); lo demás sale con 0
explicando que el repo no usa la memoria.`,
	"decisions.need_title": 'add necesita un título (--title "..." o "title" en el JSON)',
	"decisions.need_decision": 'add necesita la decisión (--decision "..." o "decision" en el JSON)',
	"decisions.confirmed_by_empty": "--confirmed-by necesita una referencia no vacía: lo que dijo el usuario (bond decisions --help)",
	"decisions.invalid_author": '"{value}" no vale como autoría: usa "user" o "agent:<kind>[/<nombre>]" ("pi/gru" se normaliza a "agent:pi/gru") (bond decisions --help)',
	"decisions.not_found": "no existe la decisión {id} en {dir}/ (bond decisions para ver las que hay)",
	"decisions.invalid_fm": "{file}: sin frontmatter válido; arreglalo antes (bond decisions check)",
	"decisions.verb_accept": "aceptar",
	"decisions.verb_reject": "rechazar",
	"decisions.verb_supersede": "sustituir",
	"decisions.user_only_action": "{verb} la hace solo el usuario: con terminal interactiva y confirmación, o desde la conversación con --confirmed-by \"<lo que dijo el usuario>\". Desde el shell de un agente sin una cosa ni la otra no se puede (bond decisions --help)",
	"decisions.nothing_to_action": 'sin decisiones "proposed" en {dir}/: nada que {verb}.',
	"decisions.missing_id": "falta al menos un id (o --all-proposed) (bond decisions {sub} --help)",
	"decisions.supersede_self": "supersede: --by no puede ser una de las decisiones sustituidas ({id})",
	"decisions.err_not_in_dir": "{id}: no existe en {dir}/",
	"decisions.err_invalid_fm": "{file}: sin frontmatter valido; arreglalo antes (bond decisions check)",
	"decisions.err_not_proposed": '{id}: no es "proposed" (está en "{status}"), se omite',
	"decisions.err_already_superseded": "{id}: ya está sustituida por {by}, se omite",
	"decisions.err_same_author": "{id}: la registró {author}; solo el usuario puede {verb}la (o regístrala ya aceptada con add --confirmed-by)",
	"decisions.confirm_prompt": "¿{verb} la decisión {id}? [y/N] ",
	"decisions.cancelled": "cancelado: {id} no cambia.",
	"decisions.superseded_by": "superseded por {by}",
	"decisions.check_no_fm": "{file}: sin frontmatter YAML (o mal cerrado)",
	"decisions.check_missing_fields": "faltan campos: {fields}",
	"decisions.check_bad_status": '{file}: status "{status}" no es uno de {allowed}',
	"decisions.check_id_mismatch": '{file}: id "{id}" no coincide con el nombre del fichero ({want})',
	"decisions.check_duplicate_id": '{file}: id duplicada "{id}" (también en {other})',
	"decisions.no_status": "sin estado",
	"decisions.check_broken_ref": '{file}: {key} apunta a "{ref}", que no existe en {dir}/',
	"decisions.check_bad_accepted_via": '{file}: accepted_via "{via}" no es "user" ni "agent:<kind>[/<nombre>]"',
	"decisions.check_same_accepted_via": '{file}: auto-aceptada: decided_by y accepted_via son "{author}" (solo el usuario puede aceptar)',
	"decisions.check_broken_trailer": 'trailers Decision: apuntan a "{trailer}", que no existe en {dir}/',
	"decisions.doctor_dir_missing": "{dir}/ no existe todavía (ejecuta bond sync)",
	"decisions.doctor_check_failed": "no se pudo comprobar: {error}",
	"decisions.doctor_errors": "{count} error(es) en {dir}/: {first}",
	"decisions.doctor_proposed": "{proposed} propuesta(s) esperando aceptación · {total} en {dir}/",
	"decisions.doctor_all_ok": "{total} decisiones, ninguna pendiente en {dir}/",
	"decisions.opt_needs_value": "{opt} necesita un valor (bond decisions --help)",
	"decisions.unknown_opt": "opción desconocida: {opt} (bond decisions --help)",
	"decisions.no_memory": "{dir}: este repo no usa la memoria de decisiones. Para activarla, añade la sección [decisions] a .bond/bond.toml (o bond init) y ejecuta bond sync.",
	"decisions.stdin_empty": "--stdin necesita un objeto JSON por la entrada estándar (bond decisions --help)",
	"decisions.stdin_invalid_json": "--stdin no es JSON válido: {error}",
	"decisions.add_proposed_ack": "proposed · decidido por {author} · acepta con: bond decisions accept {id}",
	"decisions.err_no_memory": "este repo no tiene la memoria de decisiones activada: añade la sección [decisions] a .bond/bond.toml (bond init la propone con la skill decision-record) y ejecuta bond sync",
	"decisions.unknown_subcommand": "subcomando desconocido: {sub} (bond decisions --help)",
	"decisions.bad_status_flag": "--status tiene que ser uno de {statuses}",
	"decisions.empty_list": "sin decisiones en {dir}/ (bond decisions add --title ... --decision ...)",
	"decisions.supersede_needs_by": "supersede necesita --by <id de la decisión que la sustituye>",
	"decisions.show_usage": "uso: bond decisions show <id>",
	"decisions.empty_runs": "sin runs en {dir}/runs/",
	"decisions.runs_counts": "{commits} commit(s) · {decisions} decisión(es)",
	"decisions.check_ok": "{dir}/: {total} decisión(es) sin errores{parts}",
} as const;

export const en: Record<keyof typeof es, string> = {
	"decisions.help": `Usage: bond decisions [subcommand] [options]

The repo decision memory ([decisions] in .bond/bond.toml). Without a subcommand,
lists decisions.

  (list) [--status <s>] [--agent <a>] [--json]
            Repo decisions, most recent first.
  add --title <t> [--context <c>] --decision <d> [--alternatives <a>]
      [--consequences <c>] [--link <ref>]... [--confirmed-by <ref>] [--json]
            Records a decision: bond calculates the id (YYYY-MM-DD-slug), authorship
            (from Herdr pane, agent:<kind>/<name>; outside, user) and writes the
            file. Does not touch any index: the list is provided by this command
            (so parallel branches do not conflict). Enters as "proposed"; with
            --confirmed-by "<what the user said>" (because it was already approved,
            e.g. with the plan) enters "accepted" with that quote and accepted_via.
            The body keeps section headers in English: Context / Decision /
            Rejected alternatives / Consequences (the latter only with --consequences).
            With --stdin, the same object in JSON via standard input:
            {"title","context","decision","alternatives","consequences","links",
            "confirmed_by"}.
  accept <id>... [--ref <acceptance>] [--confirmed-by "<what the user said>"] [--all-proposed]
            Changes status to "accepted". Only the user can do this, but may do so
            from conversation: with --confirmed-by (a reference to their words) no
            terminal is required and the decision also records accepted_via: "user"
            (the user accepted; whoever typed it is already in decided_by). With a
            terminal and without --confirmed-by, prompts. Without either, refuses.
            Accepts multiple ids and --all-proposed; an unknown id or one not
            "proposed" is reported without aborting others (exit != 0 if any failed).
            Empty --confirmed-by is rejected. Also refuses when the running agent is
            the one that recorded the decision (decided_by): an agent does not accept
            its own decisions; it records them already accepted with add
            --confirmed-by, or the user accepts them.
  reject <id>... [--ref <reason>] [--confirmed-by <ref>] [--all-proposed]
            Changes status to "rejected" (same confirmation).
  supersede <id>... --by <new> [--confirmed-by <ref>] [--all-proposed]
            Replaces them: old ones become "superseded" and the new one references
            them in "supersedes" (same confirmation).
  show <id>                       The entire file of a decision (or of a run, if the
                                  id is in <dir>/runs/).
  runs [--agent <a>] [--json]     Runs (agent tasks) in <dir>/runs/, with commits
                                  from their branch and decisions by that agent.
  check                           Audits decision memory: frontmatter, ids, duplicates,
                                  supersessions, Decision: trailers, and self-acceptances
                                  (accepted with decided_by == accepted_via). Exits with
                                  1 on errors. The README is not audited: there is no
                                  index to maintain.
  migrate [--dry-run] [--json]    Rewrites "accepted" decisions whose accepted_via is an
                                  agent to accepted_via: "user" (the user accepted).
                                  Idempotent; leaves the empty ones alone (accepted in a
                                  terminal). --dry-run reports without writing. Assumes
                                  every accepted_by was the user's word: the front matter
                                  cannot verify it.

  --json     Stable JSON output for list, add, runs, check, and migrate.
  -h, --help This help.

Authorship: bond computes it (in a Herdr pane, agent:<kind>/<name>; outside, user).
It can be pinned with BOND_DECISION_AGENT or [decisions] author in ~/.bond/config.toml,
so a delegated pane signs with the identity you talk to instead of the minion bond
started in its worktree. Valid: "user" or "agent:<kind>[/<name>]"; "pi/gru" normalizes
to "agent:pi/gru".

Without the [decisions] section, only "add" fails (explaining how to enable it);
everything else exits with 0 explaining that the repo does not use decision memory.`,
	"decisions.need_title": 'add requires a title (--title "..." or "title" in JSON)',
	"decisions.need_decision": 'add requires the decision (--decision "..." or "decision" in JSON)',
	"decisions.confirmed_by_empty": "--confirmed-by requires a non-empty reference: what the user said (bond decisions --help)",
	"decisions.invalid_author": '"{value}" is not a valid author: use "user" or "agent:<kind>[/<name>]" ("pi/gru" normalizes to "agent:pi/gru") (bond decisions --help)',
	"decisions.not_found": "decision {id} does not exist in {dir}/ (bond decisions to see existing ones)",
	"decisions.invalid_fm": "{file}: missing valid frontmatter; fix it first (bond decisions check)",
	"decisions.verb_accept": "accept",
	"decisions.verb_reject": "reject",
	"decisions.verb_supersede": "supersede",
	"decisions.user_only_action": "only the user can {verb}: with an interactive terminal and confirmation, or from conversation with --confirmed-by \"<what the user said>\". From an agent shell without either it cannot be done (bond decisions --help)",
	"decisions.nothing_to_action": 'no "proposed" decisions in {dir}/: nothing to {verb}.',
	"decisions.missing_id": "missing at least one id (or --all-proposed) (bond decisions {sub} --help)",
	"decisions.supersede_self": "supersede: --by cannot be one of the superseded decisions ({id})",
	"decisions.err_not_in_dir": "{id}: does not exist in {dir}/",
	"decisions.err_invalid_fm": "{file}: missing valid frontmatter; fix it first (bond decisions check)",
	"decisions.err_not_proposed": '{id}: not "proposed" (status is "{status}"), skipping',
	"decisions.err_already_superseded": "{id}: already superseded by {by}, skipping",
	"decisions.err_same_author": "{id}: recorded by {author}; only the user can {verb} it (or record it already accepted with add --confirmed-by)",
	"decisions.confirm_prompt": "{verb} decision {id}? [y/N] ",
	"decisions.cancelled": "cancelled: {id} unchanged.",
	"decisions.superseded_by": "superseded by {by}",
	"decisions.check_no_fm": "{file}: missing YAML frontmatter (or improperly closed)",
	"decisions.check_missing_fields": "missing fields: {fields}",
	"decisions.check_bad_status": '{file}: status "{status}" is not one of {allowed}',
	"decisions.check_id_mismatch": '{file}: id "{id}" does not match file name ({want})',
	"decisions.check_duplicate_id": '{file}: duplicate id "{id}" (also in {other})',
	"decisions.no_status": "no status",
	"decisions.check_broken_ref": '{file}: {key} points to "{ref}", which does not exist in {dir}/',
	"decisions.check_bad_accepted_via": '{file}: accepted_via "{via}" is not "user" nor "agent:<kind>[/<name>]"',
	"decisions.check_same_accepted_via": '{file}: self-accepted: decided_by and accepted_via are "{author}" (only the user can accept)',
	"decisions.check_broken_trailer": 'Decision: trailers point to "{trailer}", which does not exist in {dir}/',
	"decisions.doctor_dir_missing": "{dir}/ does not exist yet (run bond sync)",
	"decisions.doctor_check_failed": "could not check: {error}",
	"decisions.doctor_errors": "{count} error(s) in {dir}/: {first}",
	"decisions.doctor_proposed": "{proposed} proposal(s) awaiting acceptance · {total} in {dir}/",
	"decisions.doctor_all_ok": "{total} decisions, none pending in {dir}/",
	"decisions.opt_needs_value": "{opt} requires a value (bond decisions --help)",
	"decisions.unknown_opt": "unknown option: {opt} (bond decisions --help)",
	"decisions.no_memory": "{dir}: this repo does not use decision memory. To enable it, add the [decisions] section to .bond/bond.toml (or bond init) and run bond sync.",
	"decisions.stdin_empty": "--stdin requires a JSON object via standard input (bond decisions --help)",
	"decisions.stdin_invalid_json": "--stdin is not valid JSON: {error}",
	"decisions.add_proposed_ack": "proposed · decided by {author} · accept with: bond decisions accept {id}",
	"decisions.err_no_memory": "this repo does not have decision memory enabled: add the [decisions] section to .bond/bond.toml (bond init suggests it with decision-record skill) and run bond sync",
	"decisions.unknown_subcommand": "unknown subcommand: {sub} (bond decisions --help)",
	"decisions.bad_status_flag": "--status must be one of {statuses}",
	"decisions.empty_list": "no decisions in {dir}/ (bond decisions add --title ... --decision ...)",
	"decisions.supersede_needs_by": "supersede requires --by <id of the decision that replaces it>",
	"decisions.show_usage": "usage: bond decisions show <id>",
	"decisions.empty_runs": "no runs in {dir}/runs/",
	"decisions.runs_counts": "{commits} commit(s) · {decisions} decision(s)",
	"decisions.check_ok": "{dir}/: {total} decision(s) without errors{parts}",
};
