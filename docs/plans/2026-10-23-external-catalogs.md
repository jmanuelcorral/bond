---
name: "external-catalogs"
description: "Repos externos de skills/MCPs/comandos consumibles por bond init/sync para que los equipos compartan su config"
created_at: "2026-10-23T11:35:02Z"
has_completed_all_phases: false
last_implementation_at: "2026-10-26T08:38:23Z"
---

# Catálogos externos: compartir skills, MCPs y comandos entre equipos

## Source and revision

- Plan identifier: `external-catalogs`.
- Source: petición del usuario (2026-10-23): construir y sincronizar repos de skills/MCPs/comandos
  externos para que los equipos que usen bond puedan compartir su config. No existe plan previo
  aterrizado (comprobado en `docs/plans/`, historial de git, issues de GitHub y stash: nada).
- Reviewed revision: `dcfd6d6` (main, tras la release 1.5.1).
- Reference repository and branch: `jmanuelcorral/bond`, `main`.
- Design baseline: `cli/repo.mts` (contratos de `bond.toml`, `plan()`, `manifest.json`,
  `syncRepo`), `cli/runtime.mts` (`assetsPath`, `BOND_HOME`), `catalog/catalog.toml`,
  `docs/reference.md`, `docs/plan-v1.md` y `docs/plan-bond-cli.md` (precedente: skills
  "del catálogo de bond o `git:…`", línea 117, sin desarrollar).
- Approval: decisiones D1–D7 resueltas (2026-10-23); D8–D10 añadidas y confirmadas el
  2026-10-26 (`bond catalog create`, `check` y MCP por fichero); contenido pendiente de aprobar.

## Goal

Un equipo crea con `bond catalog create` un repo con la estructura de catálogo de bond
(`catalog.toml` + `skills/` + `commands/` + `mcps/`), lo llena y lo publica en git; cualquier
miembro lo consume con `bond init`/`bond sync`: las skills, servidores MCP y comandos externos se
instalan en los agentes igual que los del catálogo de bond, con la versión fijada por commit SHA
y reproducible en cualquier máquina y en CI.

## Scope and exclusions

- Cambia: la capa de catálogo de `cli/repo.mts` (hoy un único `assetsPath("catalog")`), el
  esquema de `.bond/bond.toml` (tabla `[[catalog]]`), `bond init` (lista interactiva y
  `--list`), un fichero nuevo `.bond/lock.json` y el comando nuevo `bond catalog`
  (`create`, `check`, `add`, `list`, `update`, `remove`, `clean`).
- Se conserva: todo el comportamiento actual del catálogo de bond (siempre presente, con nombre
  `bond`), el `manifest.json`, la resolución de conflictos por hash, los `.bak` de `--force` y
  la config de los 7 agentes.
- Fuera (explícito): publicación de catálogos (es un repo git normal del equipo), firma
  criptográfica, registro/marketplace central, versión por skill (la unidad de versión es el
  commit del repo del catálogo), un `bond.toml` base compartido (agentes, selección por defecto),
  catálogos a nivel global (`bond setup`) y cambios en las Bond Extensions.

## Verified context

Observado en `dcfd6d6`:

- `catalogPath = (...p) => assetsPath("catalog", ...p)` (`cli/repo.mts:23`): catálogo único,
  incluido en el binario/paquete. Se usa en `catalog.mcp/skills/commands()`, `catalogMeta()`,
  `printCatalog()`, `plan()` (copia de skills, comandos de Claude/Copilot, opencode y
  Codex/Gemini, copia de skills para Claude en Windows) y en el selector de `bond init`.
- `bond.toml`: `agents`, `default_agent`, `mcp`, `skills`, `commands` (listas de nombres) y
  `mcp_servers` propios. `loadRepoConfig` valida los nombres contra el catálogo y muere si no
  existen.
- Las skills elegidas se **copian** a `.agents/skills/` y se commitean; Claude las recibe por
  symlink (copia en Windows). Quien clona un repo ya tiene las skills sin descargar nada: el
  catálogo externo solo hace falta para regenerar (`sync`) o comprobar (`sync --check`).
- **pi no recibe por repo los comandos del catálogo**: le llegan por el paquete global
  `~/.bond/pi` (`cli/repo.mts:254`); por repo solo se escriben en `.pi/prompts/` los propios
  (`.bond/commands/`). Los comandos externos tendrán que ir por ese mismo camino.
- Los MCP del catálogo solo se instalan si se nombran en `mcp = [...]`: la selección ya es
  explícita.
- `sync --check` se ejecuta en CI (`ci.yml`, `release.yml`) sobre el propio repo de bond.
- Caché global existente: `~/.bond/runtime/<versión>/`. `BOND_HOME` es el sitio natural para
  cachear catálogos externos.
- Pruebas: 157 en `test/` (`repo.test.mts` cubre sync).
- Formato del catálogo de bond (lo que `create` tiene que reproducir): `catalog.toml` con
  `[skills.<nombre>]` (`summary`, `default = false` opcional); `skills/<nombre>/SKILL.md` con
  frontmatter `name`/`description` (y `scripts/`, `references/` opcionales); `commands/<nombre>.md`
  con frontmatter `description`/`argument-hint` y `$ARGUMENTS`, `$1`…; `mcp.json` como objeto
  `nombre → {url, headers} | {command, args, env}` + `description`. Hoy nada valida este formato
  salvo `loadRepoConfig` sobre los nombres. `catalog/mcp.json` solo se lee en
  `cli/repo.mts:61` (`catalog.mcp()`) y se cita en `docs/reference.md:593-594`.

## Decisions, dependencies, and risks

Decisiones (resueltas el 2026-10-23):

- **D1 — Superficie**: `bond catalog add/list/update/remove/clean`. El catálogo incluido aparece
  en `bond catalog list` como `bond` (incluido, sin versión aparte de la de bond).
- **D2 — Fijación**: `.bond/lock.json` commiteado con el SHA resuelto por catálogo. `sync` (y
  `sync --check`) descargan el SHA fijado si falta en la caché; solo `bond catalog update` mueve
  el lock. Con la caché llena, `sync` funciona sin red.
- **D3 — Conflicto de nombres** (revisada el 2026-10-26 tras probar con common-skills): si un
  nombre está en bond y en un catálogo del equipo, **gana el del equipo** (el equipo ha decidido
  sustituir la de bond); `bond:nombre` sigue pidiendo la de bond. Si está en **dos catálogos del
  equipo**, es error con las procedencias y se elige con `catalogo:nombre`. `bond init` lo
  enseña: la de bond sale como `bond:nombre` «(la sustituye equipo)». Pedir el mismo nombre de
  dos sitios es error: en el repo solo cabe uno. Se descartó renombrar las skills de bond a
  `bond-*`: rompía repos existentes y dejaba convivir dos versiones casi iguales.
- **D4 — MCP externos**: solo se instalan los nombrados en `mcp = [...]`. `bond catalog add` y
  `update` enseñan los servidores MCP nuevos o cambiados (comando, args, url) y piden
  confirmación antes de escribir el lock (`--yes` para scripts). Sin lista blanca en `bond.toml`.
- **D5 — Caché**: compartida en `~/.bond/catalogs/<host>/<owner>/<repo>/<sha>/`. `bond catalog
  clean` la vacía salvo los SHAs que fija el repo actual (todo se puede volver a descargar).
- **D6 — Alcance v1**: skills, comandos y MCP.
- **D7 — Catálogos locales**: `path = "../skills-equipo"` además de git, en P2. Aviso si la ruta
  sale del repo, porque al resto del equipo no le sirve.

Decisiones añadidas el 2026-10-26 (confirmadas por el usuario):

- **D8 — `bond catalog create [--name n]`**, en la raíz del repo actual:
  - Pregunta el nombre del catálogo (por defecto, el de la carpeta; `--name` para scripts).
    Es el nombre que propone `bond catalog add` para `[[catalog]]`.
  - Genera `catalog.toml` (con `name` y la plantilla comentada de una entrada) y las carpetas
    `skills/`, `commands/` y `mcps/`, cada una con un `README.md` que explica cómo añadir lo
    suyo (formato, ejemplo, errores típicos). El README también hace que git guarde la
    carpeta vacía.
  - Si ya hay `catalog.toml`, no lo toca; solo añade lo que falte (carpetas y READMEs).
    Repetirlo no cambia nada.
  - No mete skills, comandos ni MCP: aparecerían en la lista de `bond init` de todo el equipo.
  - El repo del catálogo sigue siendo un repo normal en el que se trabaja con bond (`bond
    init`, `.bond/`, `.agents/skills/`, `AGENTS.md`): las carpetas del catálogo no chocan con
    nada de eso. Para probar el catálogo en el propio repo: `[[catalog]] path = "."` (P2).
  - No hace `git init` ni commit; si la carpeta no es un repo git, avisa como `bond init`.
- **D10 — MCP, un fichero por servidor**: `mcps/<nombre>.json` con
  `{url, headers} | {command, args, env}` + `description`, en todos los catálogos, también el de
  bond (`catalog/mcp.json` pasa a `catalog/mcps/context7.json` y `duckduckgo.json`). Un solo
  formato que mantener, menos conflictos al editar en equipo y cada servidor se elige por
  separado en `bond init` (`mcp = [...]`), como hoy.
- **D9 — `bond catalog check [dir]`** (dir por defecto, el actual): valida un catálogo con el
  mismo validador que usa `sync` al cargarlo (los errores coinciden): cada skill con `SKILL.md`
  y frontmatter `name` igual a su carpeta y `description`; comandos `.md` con `description`;
  cada `mcps/*.json` válido con `command` o `url`; entradas de `catalog.toml` que existen. Los
  `README.md` de las carpetas no cuentan como comando, skill ni MCP. Avisa (no falla) si un valor de
  `env`/`headers` parece un secreto en vez de `${VAR}`. Sale con código ≠ 0 si hay errores,
  para la CI del repo del catálogo.

Dependencias: ninguna externa. Riesgos:

- CI con catálogos privados: `sync --check` necesita credenciales de git para descargar. Se
  documenta (token/SSH en CI) y el error dice qué URL falló.
- Windows: rutas de caché, `git` en el PATH; el fetch se hace con la CLI de `git` y el resto lo
  absorbe `plan()`, ya probado en las tres plataformas.
- Catálogo inaccesible en `sync`: falla antes de escribir nada (no deja medio sincronizado).
- Una fuente maliciosa con skills que instruyan mal a los agentes: fuera de solución técnica;
  mitigan la fijación por SHA, la revisión de MCP al actualizar y la revisión del repo por el
  equipo.

## Phases

### P1: Crear y validar catálogos (`bond catalog create` y `check`)

- Outcome: `bond catalog create` deja en el repo actual un catálogo vacío, válido y
  documentado, `bond catalog check` lo valida, y el catálogo de bond usa ya el mismo formato
  (`catalog/mcps/`). Los equipos pueden empezar a montar su catálogo antes de que bond sepa
  consumirlo (P2).
- Owning repository: `jmanuelcorral/bond`, rama de trabajo desde `main`.
- Dependencies: ninguna; D8–D10 confirmadas.
- Affected contracts: comando nuevo `bond catalog` con `create` y `check` (ayuda propia);
  `catalog.toml` admite `name` en la raíz; MCP en `mcps/<nombre>.json` (D10), también en
  `catalog/`; el validador de catálogos es el mismo que usará `sync`.
- Acceptance criteria:
  - En un repo git sin catálogo, `bond catalog create` pregunta el nombre (por defecto, el de
    la carpeta) y crea `catalog.toml` con ese `name`, y `skills/README.md`,
    `commands/README.md` y `mcps/README.md`. Con `--name x`, no pregunta.
  - Con `catalog.toml` ya presente, no lo modifica y solo crea las carpetas y READMEs que
    falten; una segunda ejecución no cambia nada.
  - En el repo creado, `bond init` y `bond sync` funcionan como en cualquier repo y no tocan
    `skills/`, `commands/`, `mcps/` ni `catalog.toml`.
  - Fuera de un repo git: crea los ficheros y avisa.
  - `bond catalog check` sobre lo recién creado: sin errores (los README no cuentan). Sobre
    fixtures rotos (skill sin `SKILL.md`, `name` distinto de la carpeta, MCP sin `command` ni
    `url`, JSON inválido, entrada de `catalog.toml` huérfana): error concreto por cada uno y
    código ≠ 0. Secreto literal en `env`/`headers`: aviso, código 0.
  - `catalog/mcp.json` migrado a `catalog/mcps/context7.json` y `duckduckgo.json`;
    `bond catalog check catalog` pasa.
  - Sin cambios visibles en `sync`: `bond sync --check` en el repo de bond da «al día» y los
    `.mcp.json`, `.pi/mcp.json`, etc. generados son idénticos a antes de la migración.
  - Funciona en Windows (rutas y separadores).
- Actions:
  - [x] Validador de catálogos (`validateCatalog(dir)`, módulo propio, sin depender de
        `bond.toml`) y `bond catalog check`.
  - [x] Migrar `catalog/mcp.json` a `catalog/mcps/` y `catalog.mcp()` a leer la carpeta
        (ignorando `README.md`).
  - [x] Plantillas de `catalog.toml` y de los tres `README.md` (en español; en `assets` como el
        resto del catálogo) y `bond catalog create` con la pregunta del nombre.
  - [x] `bond catalog check catalog` en `ci.yml` (cuida que el catálogo de bond siga el formato).
  - [x] Pruebas en `test/` con carpetas temporales y fixtures rotos.
  - [x] Ayuda, `docs/reference.md` (incluidas las filas de MCP de la línea 593) y CHANGELOG.
  - [x] Presentar evidencia y parar a revisión.
- Verification: `npm run typecheck && bun test`; `bin/bond sync --check`; `bin/bond catalog
  create` dos veces en un repo temporal (la segunda sin cambios), `bin/bond catalog check` sobre
  él y sobre `catalog/`.
- Risks y recovery: los README y la plantilla son contrato visible para los equipos; cambiarlos
  luego no rompe catálogos existentes. La migración de `mcp.json` toca lo que lee `sync`; la
  cubre el criterio de salidas idénticas. Recuperación: revertir el commit.

### P2: Varios catálogos, con catálogos locales (path)

- Outcome: `bond init`/`bond sync` resuelven skills, comandos y MCP desde el catálogo de bond
  **y** desde catálogos locales declarados en `bond.toml`
  (`[[catalog]] name = "equipo"  path = "../skills-equipo"`), y `bond init` (lista y `--list`)
  enseña el origen de cada cosa.
- Owning repository: `jmanuelcorral/bond`.
- Dependencies: P1 aceptada (el validador, y `create` para montar el catálogo de prueba).
- Affected contracts: `bond.toml` (tabla `[[catalog]]` con `name` + `path`; sin ella el
  comportamiento es idéntico al actual); `bond init` (origen en la lista interactiva y en
  `--list`); `loadRepoConfig` valida contra la suma de catálogos; nombres `catalogo:nombre`.
- Acceptance criteria:
  - Un catálogo creado con `bond catalog create` y llenado con 1 skill, 1 comando y 1 MCP,
    declarado como `[[catalog]] path`: `bond sync` genera en los 7 agentes la misma forma de
    salida que con el catálogo de bond; en pi, el comando externo aparece en `.pi/prompts/`.
  - Un catálogo que no pasa el validador (P1) hace morir `sync` con los mismos errores que
    `bond catalog check`.
  - Sin `[[catalog]]`, `bond sync --check` en el repo de bond sigue dando «al día».
  - Un nombre en bond y en un catálogo del equipo: se instala el del equipo; `bond:nombre`
    instala el de bond. En dos catálogos del equipo: `sync` muere citando los dos; con
    `catalogo:nombre` se instala el elegido (D3 revisada).
  - `bond init` muestra y deja elegir lo externo con su origen; `updateSelection` conserva la
    tabla `[[catalog]]` y los comentarios.
  - `path` fuera del repo: aviso en `sync`.
  - `npm run typecheck && bun test` en limpio.
- Actions:
  - [x] Resolver de catálogos en `cli/repo.mts` (`catalogs(root)` → lista de `{name, dir}` con
        `bond` primero) y sustituir los usos de `catalogPath` por él.
  - [x] Comandos externos a pi por `.pi/prompts/` (como los propios).
  - [x] `[[catalog]]` en `bond.toml`: parseo, validación, `catalogo:nombre`, plantilla de init.
  - [x] Catálogo de prueba montado con `create` en cada prueba (en un directorio temporal, no
        en `test/fixtures/`: así prueba también `create`) y pruebas de sync para los 7 agentes.
  - [x] Origen en el selector y en `--list`; ayuda de `bond init`; CHANGELOG.
  - [x] Presentar evidencia y parar a revisión.
- Verification: `npm run typecheck && bun test`; `bond sync --check` en el repo de bond;
  `bond sync --dry-run` en un repo temporal con catálogo local, revisando las salidas de los 7
  agentes.
- Risks y recovery: el refactor toca el corazón de sync; lo cubren la suite y que sin
  `[[catalog]]` el camino es el actual. Recuperación: revertir el commit.

### P3: Catálogos git, caché, lock y revisión de MCP

- Outcome: `bond catalog add <url|path> [--name n] [--ref tag|rama|sha]` descarga el catálogo a
  la caché, fija el SHA en `.bond/lock.json` y lo añade a `bond.toml`; `sync` descarga el SHA
  fijado si falta; `bond catalog update [name]` re-resuelve la ref y mueve el lock tras revisar
  los MCP que cambian.
- Owning repository: `jmanuelcorral/bond`.
- Dependencies: P2 aceptada (el resolver de varios catálogos; el validador y la superficie
  `bond catalog` vienen de P1).
- Affected contracts: `[[catalog]]` admite `git` + `ref`; `bond catalog
  add/list/update/remove/clean`; `.bond/lock.json` (catálogo → `{url, ref, sha}`).
- Acceptance criteria:
  - `bond catalog add <fixture> --ref v1` deja `bond.toml`, lock y caché; `sync` instala lo
    elegido de ese catálogo. El nombre por defecto es el `name` de su `catalog.toml`.
  - `bond catalog add ../skills-equipo` (ruta) añade un `[[catalog]] path` sin lock.
  - Un catálogo que no pasa el validador (D9) no se añade: error igual que el de `check`.
  - Caché borrada: `sync` y `sync --check` descargan el SHA del lock (no la punta de la rama) y
    dan el mismo resultado; con la caché llena y la URL inaccesible, `sync` funciona.
  - `bond catalog update` con el tag movido: enseña los MCP nuevos/cambiados, pide confirmación
    y actualiza el SHA; sin cambios, no toca nada; rechazado, el lock queda igual.
  - `bond catalog remove` quita la entrada y el lock; tras `sync`, desaparece lo generado de él
    (y `sync` avisa si `bond.toml` aún nombra cosas suyas).
  - `bond catalog list`: `bond` (incluido) y cada externo con ref y SHA.
  - `bond catalog clean` deja solo los SHAs del repo actual.
  - URLs ssh y https del mismo repo cuentan como el mismo catálogo.
- Actions:
  - [ ] `cli/catalogs.mts`: fetch con la CLI de `git` (por SHA; si el servidor no lo permite,
        fetch de la ref y comprobación), caché por SHA, escritura atómica del lock.
  - [ ] `bond catalog` con su ayuda y la revisión de MCP (`--yes`).
  - [ ] Pruebas con un repo git de fixture por `file://` (sin red en los tests).
  - [ ] CHANGELOG, ayuda y `docs/reference.md`.
  - [ ] Presentar evidencia y parar a revisión.
- Verification: `npm run typecheck && bun test`; manual en un repo temporal: `catalog add`,
  `sync`, borrar caché, `sync --check`, `catalog update` con un tag movido.
- Risks y recovery: sin `git` en el PATH, error claro; caché corrupta, `clean` y volver a
  descargar; lock ilegible, `sync` muere antes de tocar nada.

### P4: Doctor y documentación para equipos

- Outcome: fila en `bond doctor` por catálogo y documentación del flujo completo para equipos.
- Owning repository: `jmanuelcorral/bond`.
- Dependencies: P3 aceptada.
- Affected contracts: salida de `bond doctor` (fila por catálogo); `docs/reference.md` y
  `docs/getting-started.md`.
- Acceptance criteria:
  - `bond doctor` en un repo con catálogos: por cada uno, SHA fijado, si está en caché y si hay
    versión más nueva en la ref (solo con red; sin ella, «sin verificar»).
  - `docs/reference.md` con la sección «Catálogos externos»: estructura del repo del catálogo,
    ciclo de vida (`create`, `check`, `add`, `sync`, `update`), CI con repos privados y
    seguridad.
- Actions:
  - [ ] Fila(s) en `bond doctor`.
  - [ ] Docs y CHANGELOG.
  - [ ] Presentar evidencia y parar a revisión.
- Verification: `npm run typecheck && bun test`; `bond doctor` en un repo con catálogo de
  fixture, con y sin red.

### P5 (opcional, plan aparte si crece): skill para mantener un catálogo

- Outcome: una skill del catálogo de bond que ayuda a llenar y mantener un catálogo creado con
  `bond catalog create`: escribir una skill o un comando con el formato correcto, declarar un
  MCP sin secretos y pasar `bond catalog check` antes de publicar. La estructura ya la da
  `create`; la skill no la duplica.
- Dependencies: P1 (`create` y `check` existen).
- Acceptance criteria: `bond init --list` la muestra; lo que añade un agente con ella pasa
  `bond catalog check` y se instala con `sync` sin ajustes.
- Verification: crear un catálogo, añadir una skill y un comando con la skill y consumirlo
  con P3.

## Progress (local plans only)

| Phase | Implementation | Verification | Review | Evidence |
| --- | --- | --- | --- | --- |
| P1 | implemented | passed | accepted | PR #11 fusionado (rebase) el 2026-10-26, CI verde en Linux, macOS y Windows; ver «Evidencia P1» |
| P2 | implemented | passed (Linux) | pending | ver «Evidencia P2» |
| P3 | pending | not_run | pending | none yet |
| P4 | pending | not_run | pending | none yet |
| P5 | pending | not_run | pending | none yet |

## Next step

Revisar P2 (rama `feat/catalog-local`, sin commitear) y elegir su commit; la CI del PR comprueba
Windows y macOS. Con P2 aceptada, la siguiente fase es P3 (catálogos git, caché, lock y revisión
de MCP).

## Evidence and tracking

Sin issues ni PRs todavía (0 issues en `jmanuelcorral/bond`). Si se publica el diseño en
GitHub, los issues pasan a ser la autoridad de estado y esta tabla pasa a snapshot.

### Evidencia P1 (2026-10-26, árbol de trabajo sobre `dcfd6d6`, rama `feat/catalog-create`)

- `npm run typecheck`: sin errores. `bun test`: 176 pass, 0 fail (16 nuevas en
  `test/catalog.test.mts`).
- `bin/bond sync --check` en el repo de bond: «al día». `bin/bond catalog check catalog`:
  correcto, 9 skills, 3 comandos, 2 servidores MCP.
- Migración de MCP: `init --agents` con los 7 agentes en dos repos temporales, uno con bond en
  `dcfd6d6` (`git archive`) y otro con este árbol: ficheros generados y `manifest.json`
  idénticos (solo cambia el título de `AGENTS.md`, que es el nombre de cada repo).
- Binario: `bun scripts/build.mts --targets linux-x64 --no-npm`; con él, `catalog create
  --name equipo`, `catalog check` y `catalog check catalog` correctos (las plantillas van
  dentro).
- Pregunta interactiva del nombre: probada a mano por el usuario en una terminal (2026-10-26),
  correcta. Las pruebas automáticas cubren el valor por defecto y `--name`.
- Prueba manual de punta a punta: crear, llenar (skill, comando, MCP), `check` correcto,
  romperlo (2 errores y 1 aviso, código 1), repetir `create` sin cambios y `bond init`/`sync`
  en el propio repo del catálogo.
- Pendiente: Windows y macOS (pasos nuevos en `ci.yml`, se ejecutan en el PR).

### Evidencia P2 (2026-10-26, árbol de trabajo sobre `cba87dc`, rama `feat/catalog-local`)

- `npm run typecheck`: sin errores. `bun test`: 189 pass, 0 fail (13 nuevas en
  `test/catalogs.test.mts`): los 7 agentes con un catálogo montado con `bond catalog create`
  (skill, comando y MCP; en pi el comando va a `.pi/prompts/` y los de bond no), segunda pasada
  sin cambios, quitar el catálogo borra lo generado, nombre por defecto desde su `catalog.toml`,
  `init --list` con origen, `init` con flags conserva `[[catalog]]`, el del equipo sustituye
  al de bond (y `bond:nombre`), ambigüedad entre dos catálogos del equipo y `catalogo:nombre`,
  el mismo nombre de dos sitios, catálogo roto con los mismos errores que
  `check` (y sin escribir nada), declaraciones mal hechas, ruta fuera del repo con aviso y
  `updateBondToml` con `[[catalog]]`.
- `bin/bond sync --check` en el repo de bond: «al día».
- Sin `[[catalog]]`: `init --agents` con los 7 agentes con bond en `cba87dc` (`git archive`) y
  con este árbol: ficheros generados y `manifest.json` idénticos; en `bond.toml` solo cambia la
  plantilla comentada de `[[catalog]]`.
- Hallazgo: `bond catalog create` escribe en la raíz del repo git aunque se lance desde una
  subcarpeta (es lo decidido en D8); las pruebas montan el catálogo como su propio repo.
- Prueba con una copia de fluzo-labs/common-skills (`bond catalog create` le añade
  `catalog.toml`, `commands/` y `mcps/`; `check` correcto, 7 skills): un repo con
  `bond init --yes` y luego `[[catalog]] path` a la copia sincroniza sin errores; sus
  `plan-create`, `plan-execute` y `git-conventional-commit` sustituyen a las de bond y
  `code-context` sigue siendo la de bond. Antes de revisar D3, ese mismo repo fallaba por
  ambigüedad.
- Pendiente: Windows y macOS (CI del PR) y el selector interactivo de `bond init` con un catálogo
  del equipo (sin terminal en las pruebas; lo cubren `--list` y `init` con flags, que usan las
  mismas filas).
