---
name: "2026-10-28-decision-memory"
description: "Cada repo con bond guarda por escrito las decisiones y los encargos de sus agentes, con trazas en git, y bond decisions permite auditarlos"
created_at: "2026-10-28T09:34:29Z"
has_completed_all_phases: false
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
- **D2 — Trazas en git**: trailers en el commit: `Agent: <kind>[/<nombre>]` (el kind, `pi`,
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

Dependencias y riesgos:

- Dependencia: P2, P3 y P4 dependen de P1 (formato, skill y activación). Entre ellas son
  independientes y tocan zonas distintas, salvo `CHANGELOG.md` y `docs/reference.md`.
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
- Riesgo: un agente no sabe su nombre en Herdr. Mitigación: `bond team prompt` y `bond-delegate`
  lo incluyen en el encargo; sin él, `Agent: <kind>` a secas.
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
  - [ ] Leer y validar `[decisions]`; plantilla en `bondToml()`; opción en `bond init`; README en
        `bond sync`; regla en `BOND_RULES`.
  - [ ] Skill `decision-record` con sus plantillas y entrada en `catalog.toml`; `bond sync` en
        este repo.
  - [ ] Pruebas en `test/repo.test.mts` (init, sync idempotente, `dir` fuera del repo).
  - [ ] Ayuda de `init`, `docs/reference.md` (configuración por repo, skills del catálogo,
        instrucciones globales) y `## Sin publicar`.
  - [ ] Run applicable checks and record actual results.
  - [ ] Present evidence and stop for review before another phase.
- Verification: en la raíz, `npm run typecheck && bun test` y `bin/bond catalog check catalog`;
  a mano, `bin/bond init` en un repo temporal (`mktemp -d`, `git init`) y `bin/bond sync` dos
  veces para ver el README creado una sola vez.
- Risks and recovery: sin `[decisions]`, nada cambia; revertir la fase no deja ficheros fuera
  de los repos que la activaron.

### P2: Las skills de planes, ejecución, commits y entrega registran decisiones

- Outcome: con la memoria activa, al planificar, ejecutar una fase, hacer commit o preparar un PR,
  las decisiones van a `docs/decisions/` y se enlazan; sin ella, las skills se comportan como hoy.
- Owning repository: `bond`.
- Dependencies: P1.
- Affected contracts: `plan-create` (plantilla: cada decisión con id, quién y fecha; si hay
  memoria, enlace a `docs/decisions/<id>.md`); `plan-execute` (`progress.md`: puede añadir
  decisiones surgidas al implementar, como `proposed`, y enlazarlas en la sección de decisiones y
  en la evidencia); `git-conventional-commit` (*Attribution*: trailers `Agent:` y `Decision:`
  cuando el repo tiene `[decisions]`; cuerpo con el porqué en cambios no triviales);
  `delivery-review-github` (el PR lista las decisiones y los runs del alcance);
  `convention-document` (una convención acordada enlaza su decisión).
- Acceptance criteria:
  - Cada skill tocada referencia `decision-record` por nombre y dice qué hacer si no está
    instalada (seguir como hoy, sin descargarla).
  - Ninguna marca una decisión como `accepted` sin aceptación real del usuario.
  - `git-conventional-commit` sigue sin firmar por defecto en repos sin `[decisions]`.
  - Las adaptadas de common-skills conservan su `LICENSE` y su nota de origen.
  - `bond sync --check` al día tras el cambio.
- Actions:
  - [ ] Editar las cinco skills y sus `references/` en `catalog/skills/`; `bond sync`.
  - [ ] `docs/reference.md` (skills del catálogo) y `## Sin publicar`.
  - [ ] Run applicable checks and record actual results.
  - [ ] Present evidence and stop for review before another phase.
- Verification: `npm run typecheck && bun test`, `bin/bond catalog check catalog`,
  `bin/bond sync --check`; revisión del diff de las skills contra los criterios.
- Risks and recovery: cambios solo de texto en skills; se revierten con el commit.

### P3: Encargos e informes de `bond team`, `plan-team` y `bond-delegate`

- Outcome: con la memoria activa, cada encargo a un agente del equipo o delegado deja un run en
  `docs/decisions/runs/` con el texto enviado y, al recoger, su informe; los commits de la rama
  llevan `Agent:` con el nombre del agente.
- Owning repository: `bond`.
- Dependencies: P1.
- Affected contracts: `bond team prompt` escribe (o completa) el run en el checkout principal y
  añade al encargo el nombre del agente y la petición de trailers y de una sección «Decisions» en
  su informe; nueva opción `bond team prompt --no-record` para no guardarlo; `bond-team` (pasos 5
  y 7), `plan-team` (pasos de envío, recogida y paso 9) y `bond-delegate` (pasos 7 y 9) guardan el
  informe en el run y enlazan las decisiones que traiga, como `proposed`; el `mktemp -d` de
  `bond-delegate` se sustituye por el run cuando la memoria está activa.
- Acceptance criteria:
  - `bond team prompt <rama> "..."` en un repo con `[decisions]` crea
    `docs/decisions/runs/<fecha>-<agente>-<slug>.md` con el encargo exacto y el frontmatter de D9;
    sin `[decisions]` o con `--no-record`, no escribe nada.
  - Un segundo `prompt` al mismo agente añade el encargo al mismo run, no crea otro.
  - El agente de la rama nunca escribe en el run ni en el plan (lo hace el orquestador en el
    checkout principal).
  - Tras la recogida, el run tiene *Informe*, `status`, `commits` y `decisions`.
  - Rutas con `/` en lo guardado; pruebas pasan en Windows.
- Actions:
  - [ ] Guardado del run en `cli/team.mts` (`prompt`) con su prueba en `test/team.test.mts`.
  - [ ] Editar `global/skills/bond-team`, `global/skills/bond-delegate` y
        `catalog/skills/plan-team`; `bond sync`.
  - [ ] Ayuda de `bond team`, `docs/reference.md` (Herdr y multiagente) y `## Sin publicar`.
  - [ ] Run applicable checks and record actual results.
  - [ ] Present evidence and stop for review before another phase.
- Verification: `npm run typecheck && bun test`; a mano, dentro de Herdr, `bin/bond team` con una
  rama en un repo de prueba con `[decisions]`, un `bond team prompt` y comprobar el run y el
  trailer `Agent:` del commit de la rama.
- Risks and recovery: el guardado no puede romper el envío: si falla la escritura, se avisa y el
  prompt se manda igual.

### P4: `bond decisions` y fila en `bond doctor`

- Outcome: `bond decisions` lista decisiones y runs con filtros y valida la memoria, cruzándola
  con los trailers de git; `bond doctor` avisa si algo está roto.
- Owning repository: `bond`.
- Dependencies: P1.
- Affected contracts: nuevo `cli/decisions.mts` y caso en `cli/main.mts`:
  - `bond decisions [--status <s>] [--agent <a>] [--json]`: tabla con id, estado, quién, fecha y
    título.
  - `bond decisions show <id>`: la decisión, sus commits (por trailer `Decision:`) y sus runs.
  - `bond decisions runs [--agent <a>] [--json]`: los encargos y su estado.
  - `bond decisions check`: frontmatter válido, ids que coinciden con el fichero, sin duplicados,
    `superseded_by` que apunta a algo que existe, trailers `Decision:` que apuntan a decisiones
    que existen; sale con código distinto de 0 si hay errores.
  - Fila en `bond doctor` con el número de `proposed` pendientes y los errores de `check`.
- Acceptance criteria:
  - Sin `[decisions]`, `bond decisions` dice cómo activarla y sale con 0; `doctor` no muestra fila.
  - `check` detecta cada caso roto con un mensaje que nombra el fichero y el problema.
  - `--json` es estable y se documenta.
  - Funciona sin red y en un repo sin commits.
- Actions:
  - [ ] `cli/decisions.mts`, caso en `main.mts`, fila en `doctor.mts`, pruebas en
        `test/decisions.test.mts` y `test/doctor.test.mts`.
  - [ ] Ayuda en `main.mts`, `docs/reference.md` (comandos y `bond doctor`), guía del site si
        aplica y `## Sin publicar`.
  - [ ] Run applicable checks and record actual results.
  - [ ] Present evidence and stop for review before another phase.
- Verification: `npm run typecheck && bun test`; a mano, `bin/bond decisions`, `show`, `runs` y
  `check` en un repo temporal con decisiones válidas y rotas; `bin/bond doctor`.
- Risks and recovery: comando nuevo de solo lectura; se quita sin efecto en el resto.

## Progress (local plans only)

| Phase | Implementation | Verification | Review | Evidence |
| --- | --- | --- | --- | --- |
| P1 | pending | not_run | pending | none yet |
| P2 | pending | not_run | pending | none yet |
| P3 | pending | not_run | pending | none yet |
| P4 | pending | not_run | pending | none yet |

## Next step

Ejecutar P1 de `docs/plans/2026-10-28-decision-memory.md`: fija el formato, la skill y la
activación de los que dependen las demás. Tras aceptarla, P2, P3 y P4 se pueden hacer en paralelo
con `plan-team`. Respuesta corta: «ejecuta P1».

## Evidence and tracking

Sin issues ni PRs todavía.
