---
name: "2026-10-28-decision-memory"
description: "Cada repo con bond guarda por escrito las decisiones y los encargos de sus agentes, con trazas en git, y bond decisions permite auditarlos"
created_at: "2026-10-28T09:34:29Z"
last_implementation_at: "2026-10-28T14:30:48Z"
has_completed_all_phases: true
---

# Memoria de decisiones de los agentes

## Source and revision

- Plan identifier: `bond/decision-memory/2026-10-28`.
- Source: petición del usuario en sesión («que quede dentro de bond y que cualquier proyecto tenga
  memoria de decisiones para poder auditar qué hizo cada agente»), tras un análisis de dónde se
  pierden hoy las decisiones.
- Reviewed revision: `35231af` (main, bond 1.6.3).
- Reference repository and branch: `bond`, `main`.
- Design baseline: `catalog/catalog.toml`; skills `plan-create`, `plan-execute`, `plan-team`,
  `git-conventional-commit`, `delivery-review-github`, `convention-document`; comando `handoff`;
  `global/skills/bond-delegate`, `global/skills/bond-team`; `cli/team.mts` (`prompt`),
  `cli/instructions.mts` (`BOND_RULES`), `cli/repo.mts` (`init`, `sync`, `agentsMd`, `bondToml`),
  `cli/doctor.mts`, `cli/main.mts`; `docs/reference.md`; los seis planes de `docs/plans/`.
- Approval: aprobado por el usuario en sesión el 2026-10-28 («aprueba y guarda»): contenido y
  destino de este plan, con D1–D4 elegidas en sesión y D5–D10 tal como se proponen.
- Revisión 2 (usuario, 2026-10-28, «integra P1, acepto y revisa el plan así»): los modelos
  locales no siguen instrucciones de formato, así que la escritura de decisiones pasa a una
  herramienta de bond (D11–D15). Se reordenan las fases: la antigua P4 (`bond decisions`) pasa a
  P2 con la parte de escritura; la antigua P2 (skills) pasa a P3 y la antigua P3 (encargos e
  informes) a P4; ambas dependen ahora de P2.
- Revisión 3 (usuario, 2026-10-28, «acepta P3 y P4, añade P5 y lánzala»): la prueba real con un
  agente pi encontró cuatro problemas; se añaden D16–D19 y la fase P5.
- Revisión 4 (usuario, 2026-10-28, «adelante con P6»): aceptar decisiones tiene que poder hacerse
  desde la conversación con el agente, sin salir a una terminal; se añaden D20–D21 (D20 sustituye
  a D13) y la fase P6. El plan se reabre.

## Goal

En cualquier repo preparado con bond, cada decisión no trivial (del usuario o de un agente) queda
en un fichero de `docs/decisions/`, cada encargo a un agente de `bond team` o `bond-delegate` y su
informe quedan en `docs/decisions/runs/`, y los commits llevan trailers que dicen qué agente los
hizo y a qué decisión responden. `bond decisions` lista y valida todo eso, de modo que se puede
auditar qué hizo cada agente sin depender de la conversación ni de los paneles de Herdr.

## Scope and exclusions

- Incluye: formato y skill del catálogo para registrar decisiones; activación por repo en
  `.bond/bond.toml`; integración en las skills de planes, commits, entrega y equipo; guardado de
  encargos e informes; trailers de commit; comando `bond decisions` y fila en `bond doctor`;
  ayuda, `docs/reference.md`, guía del site y `## Sin publicar`.
- Se conserva: el formato de los planes existentes (su sección de decisiones sigue valiendo y
  puede enlazar a `docs/decisions/`); el comportamiento de repos que no activen la memoria.
- Excluido: migrar las decisiones de los planes antiguos de bond (se puede hacer después con la
  skill); firmar o sellar los registros (la integridad la da git); registrar el razonamiento
  interno o la transcripción completa de los agentes; telemetría o envío fuera del repo.

## Verified context

- Hoy las decisiones solo quedan escritas en la sección *Decisions, dependencies, and risks* de
  los planes (`catalog/skills/plan-create/references/plan-template.md`) y en los cuerpos de PR
  (`delivery-review-github`). El formato es desigual: solo `2026-10-22-autoupdate-package.md`
  anota quién y cuándo.
- `plan-execute` (`references/progress.md`, paso 4) solo actualiza la fila de progreso, casillas,
  evidencia y siguiente paso: las decisiones que surgen al implementar solo van al informe en la
  conversación.
- `plan-team` declara el plan de solo lectura para los agentes de fase («report progress in your
  answer») y en el paso 9 copia evidencias, no decisiones. `bond-team` (paso 7) y `bond-delegate`
  (paso 9) leen el informe del panel con `herdr agent read` o de un `mktemp -d` fuera del repo;
  al cerrar el panel se pierde.
- `bond team prompt` (`cli/team.mts`, `prompt()`) manda el texto con `herdr agent prompt` y no
  guarda nada.
- `git-conventional-commit` (`references/commit-messages.md`, *Attribution*) no añade firma de
  agente por defecto, pero conserva los trailers que pida el proyecto: el repo tiene que pedirlos
  de forma expresa. Tampoco permite inventar el nombre de un modelo.
- `BOND_RULES` (`cli/instructions.mts`) es el bloque global que `bond setup` lleva a cada agente;
  `agentsMd()` y `bondToml()` (`cli/repo.mts`) son las plantillas que escribe `bond init`.
- `.handoff.md` (comando `handoff`) no se commitea: sirve para retomar el trabajo, no para auditar.

## Decisions, dependencies, and risks

Decisiones (usuario, 2026-10-28, en sesión):

- **D1 — Registro**: `docs/decisions/`, un fichero Markdown por decisión, que se commitea y se
  revisa en el PR.
- **D2 — Trazas en git** (revisada en D15: opcionales): trailers en el commit: `Agent: <kind>[/<nombre>]` (el kind, `pi`,
  `claude`, `codex`..., y el nombre del agente en Herdr si lo hay; nunca un modelo inventado) y
  `Decision: <id>` cuando el commit aplica una decisión.
- **D3 — Encargos e informes**: se guardan en el repo, en `docs/decisions/runs/`.
- **D4 — CLI**: comando `bond decisions` para listar y validar, con fila en `bond doctor`.

Propuestas en el plan y aprobadas con él (usuario, 2026-10-28):

- **D5 — Identificador**: el nombre del fichero sin extensión, `YYYY-MM-DD-slug`
  (p. ej. `2026-10-28-decision-ids`), no un número correlativo: varios agentes en ramas paralelas
  no chocan al crear decisiones. Choque del mismo slug el mismo día: sufijo `-2`.
- **D6 — Formato de una decisión**: frontmatter YAML con `id`, `title`, `status`
  (`proposed` | `accepted` | `rejected` | `superseded`), `date`, `decided_by` (`user` o
  `agent:<kind>[/<nombre>]`), `accepted_by` (referencia a la aceptación del usuario, si la hay),
  `supersedes` / `superseded_by`, `links` (plan, fase, commits, PR, run). Cuerpo: *Contexto*,
  *Decisión*, *Alternativas descartadas*, *Consecuencias*. Una decisión que toma un agente sin
  confirmar entra como `proposed`; solo el usuario la pasa a `accepted`.
- **D7 — Activación**: sección `[decisions]` en `.bond/bond.toml` (`dir = "docs/decisions"`,
  ajustable). `bond init` la propone marcada; `bond sync` crea `<dir>/README.md` (índice y
  formato) si falta, y a partir de ahí es del repo, como `AGENTS.md`. Sin la sección, nada cambia.
- **D8 — Skill nueva** `decision-record` en el catálogo (`default = true`), en inglés, como el
  resto: cuándo registrar (lo que cambia un contrato, una dependencia, el alcance, una alternativa
  descartada con coste; no lo trivial), cómo y cómo enlazarlo. Las demás skills la referencian
  por nombre, sin rutas entre carpetas.
- **D9 — Fichero de run**: `runs/YYYY-MM-DD-<agente>-<slug>.md` con frontmatter (`agent`,
  `kind`, `branch`, `base`, `orchestrator`, `started_at`, `finished_at`, `status`, `commits`,
  `decisions`) y dos secciones: *Encargo* (el texto exacto enviado) e *Informe* (lo que respondió
  el agente, recortado a su parte final y sin secretos). Lo escribe bond o el orquestador en el
  checkout principal, nunca el agente de la rama.
- **D10 — Regla global**: una línea más en `BOND_RULES`: si el repo tiene `[decisions]` en
  `.bond/bond.toml`, registrar las decisiones con `decision-record` y poner los trailers en los
  commits. Así vale también para agentes que no cargan las skills por sí solos.

Revisión 2 (usuario, 2026-10-28): los modelos locales no siguen instrucciones de formato, así que
lo delicado lo hace bond, no el modelo:

- **D11 — Escritura con herramienta**: `bond decisions add` recibe título, contexto, decisión y
  alternativas (flags o JSON por stdin) y calcula el id, escribe el fichero con su frontmatter,
  añade la fila al índice del README y anota rama y HEAD. Siempre entra como `proposed`. La skill
  `decision-record` dice que se use esta herramienta, no que se escriba el fichero a mano.
- **D12 — Autoría automática**: `decided_by` lo rellena bond: desde un panel de Herdr
  (`HERDR_PANE_ID`), el agente de ese panel (`agent:<kind>/<nombre>`); fuera, `user`. El modelo
  no tiene que saber su nombre.
- **D13 — Aceptar es del usuario**: `bond decisions accept <id>` exige terminal interactiva y
  confirmación; desde el shell de un agente (sin TTY) se niega.
- **D14 — Herramienta en pi**: `record_decision` en las Bond Extensions (como `repo_map`), que
  llama al mismo código. Los demás agentes usan el CLI por shell. Un servidor MCP queda fuera de
  este plan.
- **D15 — Atribución sin depender del modelo**: los runs dicen qué agente trabajó en qué rama, y
  `bond decisions` atribuye por ahí los commits de esa rama. D2 se revisa: los trailers `Agent:` y
  `Decision:` se aprovechan cuando aparecen, pero no son obligatorios. Sin hooks de git por
  defecto (chocan con husky y `core.hooksPath`). El informe del agente lo guarda
  `bond team collect <rama>` leyendo su panel.

Revisión 3 (usuario, 2026-10-28), tras la prueba real con un agente pi:

- **D16 — Frontmatter válido**: la descripción de `decision-record` contenía `Agent: and
  Decision:` sin comillas, YAML inválido que pi rechaza (Claude Code lo tolera). Se entrecomilla y
  `bond catalog check` valida el frontmatter de cada skill como YAML estricto.
- **D17 — Informe desde la sesión**: `bond team collect` toma el último mensaje del agente de su
  fichero de sesión (Herdr lo da en `agent_session`; en pi, un `.jsonl`) y solo si no puede, el
  panel, quitando el banner de arranque y los avisos de pi.
- **D18 — Las decisiones viajan con la rama**: lo que un agente registra en su worktree se
  commitea en su rama y se revisa con el código en el PR; `bond team prompt` lo pide en el encargo
  cuando la memoria está activa.
- **D19 — Sin índice compartido**: `add`, `accept`, `reject` y `supersede` dejan de reescribir la
  tabla del README, que provocaba conflictos entre ramas paralelas; el README queda con el formato
  y el índice lo da `bond decisions`. `check` deja de exigir el índice al día.

Revisión 4 (usuario, 2026-10-28): «se tienen que poder aceptar desde aquí, no vamos a salir a una
terminal y picar comandos, esto rompe el flow del desarrollo».

- **D20 — Aceptar desde la conversación** (sustituye a D13): `accept`, `reject` y `supersede`
  funcionan sin terminal cuando reciben `--confirmed-by "<referencia a lo que dijo el usuario>"`;
  la decisión guarda `accepted_by` con esa referencia y `accepted_via` con quien lo ejecutó
  (autoría de D12). Admiten varios ids y `--all-proposed`. Sin `--confirmed-by` y con terminal,
  siguen preguntando; sin ninguno de los dos, se niegan. El comando `/accept` del catálogo enseña
  las `proposed`, pregunta cuáles y solo ejecuta con una respuesta explícita del usuario, citándola.
- **D21 — Control humano del arnés**: en Claude Code, `bond sync` añade a `.claude/settings.json`
  reglas `ask` para `bond decisions accept`, `reject` y `supersede`, de modo que cada ejecución
  pasa por el cuadro de permiso de Claude Code, que el modelo no puede saltarse; se fusionan con
  las reglas que el repo ya tenga, sin pisarlas. En agentes sin ese sistema (pi) quedan la regla
  de la skill y el rastro en git.

Dependencias y riesgos:

- Dependencia: P2 depende de P1; P3 y P4 dependen de P2 y entre ellas son independientes (tocan
  zonas distintas, salvo `CHANGELOG.md` y `docs/reference.md`).
- Riesgo: ruido, con agentes que registran cada nimiedad. Mitigación: criterio explícito en la
  skill y ejemplos de qué no registrar; `bond decisions` muestra cuántas `proposed` esperan
  revisión.
- Riesgo: secretos o datos privados en los informes guardados. Mitigación: la skill y `bond team
  prompt` piden no copiar secretos ni volcados; el informe se recorta; queda en el diff del PR
  para revisarlo antes de integrar.
- Riesgo: conflicto con la regla de `git-conventional-commit` de no añadir firma de agente.
  Mitigación: los trailers solo se ponen cuando el repo los pide (`[decisions]` activo); la skill
  de commit lo dice en *Attribution*. `Agent:` nunca lleva modelo ni versión si no los da el
  entorno.
- Riesgo: un agente no sabe su nombre en Herdr. Mitigación (D12): bond lo resuelve desde
  `HERDR_PANE_ID`; el agente no tiene que pasarlo.
- Riesgo: Windows y rutas. Lo que se guarda usa `/`; pruebas en `test/` como el resto (CI en
  Linux, macOS y Windows).
- `cli/assets.gen.mts` y `dist/` no se tocan a mano; `.agents/skills/` y `.claude/` se regeneran
  con `bond sync` tras cambiar `catalog/skills/`.

## Phases

### P1: Formato, skill `decision-record` y activación por repo

- Outcome: en un repo con `[decisions]` en `.bond/bond.toml`, `bond sync` deja
  `docs/decisions/README.md` y la skill `decision-record` instalada; un agente puede registrar una
  decisión con el formato de D5/D6 y un run con el de D9.
- Owning repository: `bond`.
- Dependencies: ninguna.
- Affected contracts: nueva sección `[decisions]` de `bond.toml` (lectura en `cli/repo.mts`,
  plantilla en `bondToml()`); `bond init` la propone; `bond sync` crea el README si falta; nueva
  carpeta `catalog/skills/decision-record/` (`SKILL.md`, `references/decision-template.md`,
  `references/run-template.md`) y su entrada en `catalog/catalog.toml`; regla en `BOND_RULES`.
- Acceptance criteria:
  - `bond init` en un repo nuevo escribe `[decisions]` con `dir = "docs/decisions"` y la skill
    marcada; desmarcarla deja el repo como hoy.
  - `bond sync` crea `docs/decisions/README.md` (índice vacío y formato) solo si falta; no lo
    pisa si existe. `bond sync --check` lo da por al día.
  - Un `dir` que salga del repo (`..`, ruta absoluta) se rechaza con un error claro.
  - La skill describe cuándo registrar y cuándo no, el formato, `proposed` frente a `accepted`,
    los trailers de D2 y cómo enlazar plan, commit, PR y run.
  - `bond catalog check catalog` pasa.
- Actions:
  - [x] Leer y validar `[decisions]`; plantilla en `bondToml()`; opción en `bond init`; README en
        `bond sync`; regla en `BOND_RULES`.
  - [x] Skill `decision-record` con sus plantillas y entrada en `catalog.toml`; `bond sync` en
        este repo.
  - [x] Pruebas en `test/repo.test.mts` (init, sync idempotente, `dir` fuera del repo).
  - [x] Ayuda de `init`, `docs/reference.md` (configuración por repo, skills del catálogo,
        instrucciones globales) y `## Sin publicar`.
  - [x] Run applicable checks and record actual results.
  - [x] Present evidence and stop for review before another phase.
- Verification: en la raíz, `npm run typecheck && bun test` y `bin/bond catalog check catalog`;
  a mano, `bin/bond init` en un repo temporal (`mktemp -d`, `git init`) y `bin/bond sync` dos
  veces para ver el README creado una sola vez.
- Risks and recovery: sin `[decisions]`, nada cambia; revertir la fase no deja ficheros fuera
  de los repos que la activaron.

### P2: `bond decisions`: escribir, aceptar y auditar, y `record_decision` en pi

- Outcome: un agente registra una decisión con una sola llamada (`bond decisions add` o la
  herramienta `record_decision` de pi) y bond escribe el fichero, el índice y la autoría; el
  usuario la acepta con `bond decisions accept`; `bond decisions` lista y valida la memoria y
  `bond doctor` avisa si algo está roto.
- Owning repository: `bond`.
- Dependencies: P1 (aceptada).
- Affected contracts: nuevo `cli/decisions.mts` y caso en `cli/main.mts`:
  - `bond decisions add --title <t> [--context <c>] --decision <d> [--alternatives <a>]
    [--link <ref>]... [--json]`, o el mismo objeto como JSON por stdin (`--stdin`): escribe
    `<dir>/<id>.md` con el formato de D6, `status: proposed`, `decided_by` según D12, rama y HEAD
    en `links`, y la fila en el índice del README; imprime el id (o JSON con id y ruta).
  - `bond decisions accept <id> [--ref <aceptación>]`: solo con TTY y confirmación (D13); pone
    `accepted`, `accepted_by` y actualiza el índice. `reject` y `supersede <id> --by <id>` igual.
  - `bond decisions [--status <s>] [--agent <a>] [--json]`, `show <id>`, `runs [--agent <a>]
    [--json]` y `check` (frontmatter, id = fichero, duplicados, `superseded_by` que existe,
    trailers `Decision:` que apuntan a algo que existe, índice al día; código ≠ 0 si hay errores).
  - Fila en `bond doctor` con las `proposed` pendientes y los errores de `check`.
  - Herramienta `record_decision` en las Bond Extensions de pi (`extensions/`), con esquema
    `title`, `context`, `decision`, `alternatives`, `links`, que llama a `bond decisions add`.
  - La skill `decision-record` (y sus plantillas) pasa a mandar usar la herramienta o el CLI, no
    escribir el fichero a mano; `bond sync`.
- Acceptance criteria:
  - Sin `[decisions]`, `add` falla con un mensaje que dice cómo activarla; `bond decisions` sale
    con 0 y lo explica; `doctor` no muestra fila.
  - `add` con solo título y decisión produce un fichero que `check` da por válido y su fila en el
    índice; dos `add` con el mismo título el mismo día dan `<id>` y `<id>-2`.
  - Desde un panel de Herdr con agente, `decided_by` es `agent:<kind>/<nombre>`; fuera, `user`.
  - `accept` sin TTY se niega y no cambia nada; con TTY y confirmación pasa a `accepted`.
  - `record_decision` en pi crea la misma decisión que el CLI.
  - `check` detecta cada caso roto nombrando fichero y problema; `--json` estable y documentado.
  - Funciona sin red, en un repo sin commits y con rutas `/` en Windows.
- Actions:
  - [x] `cli/decisions.mts`, caso y ayuda en `main.mts`, fila en `doctor.mts`.
  - [x] Herramienta `record_decision` en `extensions/` y su registro en las Bond Extensions.
  - [x] Skill `decision-record` apuntando a la herramienta; `bond sync`.
  - [x] Pruebas en `test/decisions.test.mts` y `test/doctor.test.mts`.
  - [x] `docs/reference.md`, `docs/en/reference.md` y `## Sin publicar`.
  - [x] Run applicable checks and record actual results.
  - [x] Present evidence and stop for review before another phase.
- Verification: `npm run typecheck && bun test`, `bin/bond catalog check catalog`,
  `bin/bond sync --check`; a mano, en un repo temporal con `[decisions]`: `add` (flags y stdin),
  `check`, `accept` con y sin TTY (`</dev/null`), y `record_decision` desde pi en un panel de
  Herdr.
- Risks and recovery: comando y herramienta nuevos; se quitan sin efecto en el resto. Escribir el
  índice no puede pisar ediciones a mano fuera de la tabla.

### P3: Las skills de planes, ejecución, commits y entrega registran decisiones con la herramienta

- Outcome: con la memoria activa, al planificar, ejecutar una fase, hacer commit o preparar un PR,
  las decisiones se registran con `bond decisions add` / `record_decision` y se enlazan; sin ella,
  las skills se comportan como hoy.
- Owning repository: `bond`.
- Dependencies: P2.
- Affected contracts: `plan-create` (plantilla: cada decisión con id, quién y fecha; con memoria,
  se registra con la herramienta y el plan enlaza el id); `plan-execute` (`progress.md`: las
  decisiones que surgen al implementar se registran con la herramienta y se enlazan en la
  evidencia); `git-conventional-commit` (*Attribution*: trailers `Agent:` y `Decision:` opcionales
  cuando el repo tiene `[decisions]`; cuerpo con el porqué en cambios no triviales);
  `delivery-review-github` (el PR lista las decisiones y los runs del alcance, sacados de
  `bond decisions --json`); `convention-document` (una convención acordada enlaza su decisión).
  Añadido tras revisar P2: los apartados que escribe `bond decisions add` (hoy `## Context`,
  `## Decision`, `## Rejected alternatives`) y los que anuncian el README de P1 y la plantilla
  (*Contexto*, *Decisión*, *Alternativas descartadas*, *Consecuencias*) tienen que coincidir:
  en inglés en el fichero, como las skills, con `consequences` opcional en `add` y en
  `record_decision`; y la documentación dice que la barrera de `accept` (TTY) evita que un agente
  acepte por descuido, no es una medida de seguridad.
- Acceptance criteria:
  - Cada skill tocada nombra la herramienta y dice qué hacer si no está (seguir como hoy).
  - Ninguna marca una decisión como `accepted`: eso queda en `bond decisions accept`.
  - `git-conventional-commit` sigue sin firmar por defecto en repos sin `[decisions]`.
  - Las adaptadas de common-skills conservan su `LICENSE` y su nota de origen.
  - `bond sync --check` al día tras el cambio.
  - `bond decisions add` con `--consequences` (y `record_decision` con `consequences`) escribe los
    mismos apartados que anuncian el README y la plantilla; `check` sigue dando por válidas las
    decisiones ya escritas.
- Actions:
  - [x] Apartados de `add`/`record_decision`, README de `decisionsReadme()` y plantilla alineados,
        con su prueba en `test/decisions.test.mts`.
  - [x] Editar las cinco skills y sus `references/` en `catalog/skills/`; `bond sync`.
  - [x] `docs/reference.md`, `docs/en/reference.md` y `## Sin publicar`.
  - [x] Run applicable checks and record actual results.
  - [x] Present evidence and stop for review before another phase.
- Verification: `npm run typecheck && bun test`, `bin/bond catalog check catalog`,
  `bin/bond sync --check`; revisión del diff de las skills contra los criterios.
- Risks and recovery: cambios solo de texto en skills; se revierten con el commit.

### P4: Encargos e informes de `bond team`, `plan-team` y `bond-delegate`, guardados por bond

- Outcome: con la memoria activa, cada encargo a un agente del equipo deja un run en
  `docs/decisions/runs/` escrito por `bond team prompt`, y `bond team collect <rama>` le añade el
  informe leído del panel, los commits y las decisiones registradas por ese agente; las
  delegaciones de `bond-delegate` quedan igual.
- Owning repository: `bond`.
- Dependencies: P2.
- Affected contracts: `bond team prompt` escribe (o completa) el run en el checkout principal con
  el frontmatter de D9 (`--no-record` para no guardarlo); nuevo `bond team collect <rama>
  [--lines <n>]` que guarda *Informe*, `status`, `commits` (de la rama) y `decisions` (las de
  `decided_by` de ese agente); `bond-team` (pasos 5 y 7), `plan-team` (envío, recogida y paso 9) y
  `bond-delegate` (pasos 7 y 9) usan estos comandos en vez de escribir el run; el `mktemp -d` de
  `bond-delegate` se sustituye por el run cuando la memoria está activa. `bond decisions runs` y
  `show` atribuyen los commits de cada rama a su agente (D15).
- Acceptance criteria:
  - `bond team prompt <rama> "..."` con `[decisions]` crea
    `docs/decisions/runs/<fecha>-<agente>-<slug>.md` con el encargo exacto; sin `[decisions]` o
    con `--no-record`, no escribe nada; si falla la escritura, avisa y manda el prompt igual.
  - Un segundo `prompt` al mismo agente añade el encargo al mismo run.
  - `bond team collect <rama>` deja el informe, el estado, los commits y las decisiones; repetirlo
    no duplica nada.
  - El agente de la rama nunca escribe en el run ni en el plan.
  - Rutas con `/` en lo guardado; pruebas pasan en Windows.
- Actions:
  - [x] Runs en `cli/team.mts` (`prompt`, `collect`) con pruebas en `test/team.test.mts`.
  - [x] Editar `global/skills/bond-team`, `global/skills/bond-delegate` y
        `catalog/skills/plan-team`; `bond sync`.
  - [x] Ayuda de `bond team`, `docs/reference.md`, `docs/en/reference.md` y `## Sin publicar`.
  - [x] Run applicable checks and record actual results.
  - [x] Present evidence and stop for review before another phase.
- Verification: `npm run typecheck && bun test`; a mano, dentro de Herdr, `bin/bond team` con una
  rama en un repo de prueba con `[decisions]`, `bond team prompt`, `bond team collect` y
  `bond decisions runs`.
- Risks and recovery: el guardado no puede romper el envío; `collect` solo lee el panel y escribe
  en el checkout principal.

### P5: Ajustes tras la prueba real

- Outcome: con agentes pi reales, la skill `decision-record` carga, el informe guardado por
  `collect` es la respuesta final del agente, las decisiones del agente quedan commiteadas en su
  rama y dos ramas paralelas que registran decisiones se integran sin conflictos de memoria.
- Owning repository: `bond`.
- Dependencies: P4 (aceptada).
- Affected contracts: frontmatter de `catalog/skills/decision-record/SKILL.md`; `bond catalog
  check` (validación YAML estricta del frontmatter de cada skill); `bond team collect` (fuente del
  informe, D17); texto que `bond team prompt` añade al encargo con memoria activa (D18);
  `cli/decisions.mts` (`add`, `accept`, `reject`, `supersede` sin tocar el índice; `check` sin
  exigirlo, D19); `decisionsReadme()` sin tabla de índice; skills y documentación que mencionen el
  índice.
- Acceptance criteria:
  - pi carga `decision-record` sin «Skill conflicts»; `bond catalog check` falla con un mensaje
    claro ante una skill con frontmatter YAML inválido (prueba con el caso de `Agent: and
    Decision:` sin comillas).
  - `collect` sobre un agente pi guarda solo su última respuesta, sin banner ni avisos de
    arranque; si no hay fichero de sesión legible, cae al panel recortado. Probado con un `.jsonl`
    de ejemplo en `test/`.
  - Con `[decisions]`, el encargo de `bond team prompt` incluye commitear lo que el agente
    registre en la carpeta de decisiones; sin `[decisions]`, no añade nada.
  - Dos `add` en ramas distintas a partir de la misma base se fusionan sin conflictos; el README
    no cambia al registrar ni al aceptar.
  - Los README ya creados con tabla siguen siendo válidos para `check`.
- Actions:
  - [x] Frontmatter de la skill y validación en `bond catalog check`, con prueba.
  - [x] `collect` desde la sesión del agente, con prueba.
  - [x] Texto de `bond team prompt` con memoria activa, con prueba.
  - [x] Índice fuera de `add`/`accept`/`reject`/`supersede`/`check` y de `decisionsReadme()`,
        con prueba de dos ramas.
  - [x] Skills, `docs/reference.md`, `docs/en/reference.md` y `## Sin publicar`; `bond sync`.
  - [x] Run applicable checks and record actual results.
  - [x] Present evidence and stop for review before another phase.
- Verification: `npm run typecheck && bun test`, `bin/bond catalog check catalog`,
  `bin/bond sync --check`; a mano, repetir la prueba real (repo temporal con `[decisions]`, un
  agente pi en `bond team`, `prompt`, `collect`, `bond decisions runs` y `check`).
- Risks and recovery: el formato de las sesiones de pi puede cambiar; por eso el panel queda como
  respaldo.

### P6: Aceptar decisiones desde la conversación

- Outcome: el usuario acepta, rechaza o sustituye decisiones desde la conversación con su agente
  (por ejemplo, «acepta las 19»), sin abrir otra terminal; en Claude Code cada ejecución pasa por
  el cuadro de permiso; cada decisión aceptada guarda quién lo pidió y por dónde se ejecutó.
- Owning repository: `bond`.
- Dependencies: P5 (aceptada).
- Affected contracts: `cli/decisions.mts` (`accept`, `reject`, `supersede` con `--confirmed-by`,
  varios ids y `--all-proposed`; campo `accepted_via` en el frontmatter, opcional para las
  decisiones ya escritas; `check` lo valida si está); nuevo comando del catálogo
  `catalog/commands/accept.md` con su entrada en `catalog/catalog.toml`; `cli/repo.mts`
  (`bond sync` añade las reglas `ask` de D21 a `.claude/settings.json` cuando el repo tiene
  `[decisions]` y Claude Code entre sus agentes, fusionándolas con las existentes); skill
  `decision-record` y su plantilla; `README` de `decisionsReadme()`; ayuda de `bond decisions`.
- Acceptance criteria:
  - Sin terminal y sin `--confirmed-by`, `accept` se niega como hoy; con `--confirmed-by`, acepta
    y escribe `accepted_by` (la referencia) y `accepted_via` (`agent:<kind>[/<nombre>]` o `user`).
  - `accept <id1> <id2>` y `accept --all-proposed --confirmed-by ...` aceptan varias de una vez;
    un id desconocido o no `proposed` se informa sin abortar las demás, y el código de salida es
    distinto de 0 si alguna falló.
  - `--confirmed-by` vacío o en blanco se rechaza.
  - Con terminal y sin `--confirmed-by`, el flujo interactivo de hoy no cambia.
  - `bond sync` con `[decisions]` y `claude` en `agents` deja en `.claude/settings.json` las tres
    reglas `ask` sin borrar las que ya hubiera; sin `[decisions]` o sin `claude`, no las añade;
    `bond sync --check` al día tras aplicarlas.
  - `/accept` lista las `proposed`, pide la elección del usuario y solo con respuesta explícita
    ejecuta `accept` con sus palabras en `--confirmed-by`; nunca por iniciativa propia.
  - Las decisiones ya escritas sin `accepted_via` siguen pasando `check`.
- Actions:
  - [x] `--confirmed-by`, varios ids y `--all-proposed` en `cli/decisions.mts`, con pruebas.
  - [x] Reglas `ask` en `.claude/settings.json` desde `bond sync`, con pruebas de fusión.
  - [x] Comando `catalog/commands/accept.md` y entrada en `catalog/catalog.toml`; `bond sync`.
  - [x] Skill `decision-record`, plantilla y README de decisiones.
  - [x] `docs/reference.md`, `docs/en/reference.md` y `## Sin publicar`.
  - [x] Run applicable checks and record actual results.
  - [x] Present evidence and stop for review before another phase.
- Verification: `npm run typecheck && bun test`, `bin/bond catalog check catalog`,
  `bin/bond sync --check`; a mano, en un repo temporal con `[decisions]` y `claude`: `bond sync` y
  revisar `.claude/settings.json`; `accept` con y sin `--confirmed-by` desde un shell sin
  terminal (`</dev/null`); `accept --all-proposed`. Tras integrar, el orquestador acepta desde la
  conversación las 19 decisiones ya registradas y registra D20 sustituyendo a D13.
- Risks and recovery: un agente puede ejecutar `accept --confirmed-by` sin que el usuario lo pida;
  lo mitigan la regla del comando y la skill, el cuadro de permiso en Claude Code y el rastro
  `accepted_via` en git, que permite revertir con `supersede` o un `git revert`.

## Progress (local plans only)

| Phase | Implementation | Verification | Review | Evidence |
| --- | --- | --- | --- | --- |
| P1 | implemented | passed | accepted | rama `plan/decision-memory-p1` (kevin, pi), commits `47c338a` y `6701239`, integrada en `main` por fast-forward; en `main`: `npm run typecheck` limpio, `bun test` 235/235, `bond catalog check catalog` correcto, `bond sync --check` al día; aceptada por el usuario en sesión el 2026-10-28 |
| P2 | implemented | passed | accepted | rama `plan/decision-memory-p2` (kevin, pi), commit `5354318`, integrada en `main` por fast-forward; en `main`: `npm run typecheck` limpio, `bun test` 267/267, `bond catalog check catalog` correcto, `bond sync --check` al día; a mano: `add` por flags y stdin, sufijo `-2`, `\|` escapado en el índice, autoría `agent:claude` desde un panel de Herdr, `accept` sin TTY negado (exit 1); aceptada por el usuario en sesión el 2026-10-28 |
| P3 | implemented | passed | accepted | rama `plan/decision-memory-p3` (kevin, pi), commit `ac7cec7`, integrada en `main` por fast-forward; `bun test` 272/272 en la rama y 279/279 en `main` con P4; aceptada por el usuario en sesión el 2026-10-28 |
| P4 | implemented | passed | accepted | rama `plan/decision-memory-p4` (stuart, pi), commit `3206cdf` rebasado sobre P3 como `4b823f1` (conflictos en `CHANGELOG.md`, docs y `.bond/manifest.json`, resueltos conservando ambas fases), integrada en `main` por fast-forward; en `main`: typecheck limpio, `bun test` 279/279, `bond sync --check` al día; prueba real con un agente pi (ver Evidence); aceptada por el usuario en sesión el 2026-10-28 |
| P5 | implemented | passed | accepted | rama `plan/decision-memory-p5` (kevin, pi), commit `3a4134d`, integrada en `main` por fast-forward; en `main`: typecheck limpio, `bun test` 287/287, `bond catalog check catalog` correcto, `bond sync --check` al día; prueba real repetida (ver Evidence); dos fallos de la prueba corregidos en `7102559` (289/289); aceptada por el usuario en sesión el 2026-10-28 |
| P6 | implemented | passed | accepted | rama `plan/decision-memory-p6` (kevin, pi), commit `5ee1d77`, integrada en `main` por fast-forward, más tildes en `d50bf02`; en `main`: typecheck limpio, `bun test` 307/307, `bond sync --check` al día; a mano en repo temporal: reglas `ask` en `.claude/settings.json`, `accept` sin terminal negado sin `--confirmed-by` y con referencia vacía, `--all-proposed --confirmed-by` acepta con `accepted_via: agent:claude`; run del encargo en `docs/decisions/runs/`; aceptada por el usuario en sesión el 2026-10-28 |

## Next step

Plan completo. Pendiente fuera del plan: aceptar las decisiones registradas en `docs/decisions/`
desde la conversación (`/accept`), registrar D20 sustituyendo a D13, y publicar P6 en una
versión nueva.

## Evidence and tracking

- P1: `47c338a` (`feat(decisions): add the agent decision memory format and activation`) y
  `6701239` (`fix(decisions): tie [decisions] activation to the decision-record skill`), en `main`.
  En la revisión de la primera entrega falló el criterio «desmarcarla deja el repo como hoy»; se
  devolvió al agente y lo corrigió en el segundo commit.
- P2: `5354318` (`feat(decisions): add bond decisions and the record_decision pi tool`), en
  `main`. Primero se colgó probando la herramienta (`execFile` con `input`, que no existe); se
  interrumpió con permiso del usuario y se le dio el arreglo (`spawn` con `stdin.end()`).
- P3: `ac7cec7` (`feat(decisions): wire catalog skills to the decision memory tool`), en `main`.
- P4: `4b823f1` (`feat: record team requests and reports in the decision memory`), en `main`.
- Prueba real (2026-10-28), repo temporal con `[decisions]` y un agente pi (bob) en `bond team`:
  `prompt` guardó el encargo en `runs/`; bob usó `record_decision` y bond le atribuyó
  `agent:pi/bob`; `collect` dejó el run `reported` con su commit y su decisión. Problemas: pi
  rechazó la skill `decision-record` por YAML inválido; el informe incluía el banner de pi; la
  decisión quedó sin commitear en el worktree; el índice del README se reescribe en cada `add`
  (conflictos en paralelo). Origen de P5.
- P5: `3a4134d` (`fix(decisions): apply P5 fixes found testing the memory with real agents`), en
  `main`.
- Segunda prueba real (2026-10-28), mismo repo temporal, rama `team/despedida`, agente pi (kevin)
  con una tarea que no nombraba la herramienta: pi cargó `decision-record` sin «Skill
  conflicts»; el modelo local usó `record_decision` por su cuenta (`agent:pi/kevin`, `proposed`);
  commiteó la decisión en su rama junto a su trabajo, con trailers `Agent:` y `Decision:`; el
  README no cambió; `collect` guardó solo su respuesta final desde la sesión; `bond decisions
  runs` y `check` limpios. Dos fallos encontrados (`collect` aceptaba un agente aún trabajando y
  `add` repetía el enlace de la rama), corregidos en `7102559`.
- P6: `5ee1d77` (`feat: accept decisions from the conversation with --confirmed-by`), en `main`; primer
  encargo de bond registrado por su propia memoria (`docs/decisions/runs/`).
