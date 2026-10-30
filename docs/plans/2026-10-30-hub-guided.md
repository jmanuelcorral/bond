---
name: "2026-10-30-hub-guided"
description: "bond crea el hub e importa sus repos de forma guiada (submódulo o symlink), con hub.toml como fuente de la sesión y una revisión que asegura que todo funciona"
created_at: "2026-10-30T06:52:48Z"
has_completed_all_phases: false
last_implementation_at: "2026-10-30T10:00:00Z"
---

# Hub guiado: crear el hub, importar los repos y comprobar que todo funciona

## Origen y revisión

- Identificador: `2026-10-30-hub-guided`.
- Origen: petición del usuario tras terminar `2026-10-29-hub-session`: "mi idea es que nosotros
  creemos el hub e importemos los repos de forma guiada (hagamos los links simbólicos, revisemos
  config, etc, así nos aseguramos de que todo va a funcionar) es más creemos un fichero de config
  con todo eso".
- Revisión: `420eb68` en `plan/hub-session` (P1–P4 de `2026-10-29-hub-session` integradas, sin
  publicar).
- Base de diseño: [`2026-10-29-hub-session.md`](2026-10-29-hub-session.md), `cli/hub.mts`
  (`hubRoot`, `hubSession`, `HubRepo`, `HubSession`, `submodules`, `hub`), `cli/repo.mts`
  (`parseHub`, `HubConfig`, `[hub]`), `cli/team.mts` (`sessionRows`, modo hub de `create`,
  `prompt`, `collect`, `clean`), `cli/doctor.mts`, `cli/setup.mts` (asistente con
  `@clack/prompts`), `docs/reference.md`, `docs/puesto.md` y las skills `plan-team` y
  `bond-team`.
- Aprobación: contenido y destino aprobados por el usuario el 2026-10-30 ("si, quita [hub] y
  guárdalo").

## Objetivo

Con `bond hub init` se crea un hub (un repo git que se comparte con el equipo) y se importan sus
repos de forma guiada, cada uno como submódulo o como symlink a un clon local. Todo queda
declarado en `hub.toml`, que es la única fuente de la sesión. `bond hub sync` deja el disco como
dice el fichero y `bond hub check` comprueba que cada repo está listo para trabajar con agentes.
Lo que ya hace el modo hub (tabla de sesión, equipo vertical, runs en el hub) sigue igual, pero
leyendo los repos de `hub.toml`.

## Alcance y exclusiones

Entra: el formato de `hub.toml` y de `.bond/hub.local.toml`; el registro global
`~/.bond/hubs.toml`; `bond hub init`, `add`, `sync` y `check` (con `--fix`); su entrada en
`bond doctor`; quitar `[hub]` de `bond.toml` y adaptar `hubSession`/`hubRoot` y sus usos; la
importación de submódulos que ya existan; ayuda, `docs/reference.md`, `docs/puesto.md`,
CHANGELOG y las skills `plan-team` y `bond-team`.

Fuera: varias ramas verticales a la vez en un hub (sigue siendo D2 de `2026-10-29-hub-session`);
integrar ramas, subir punteros de submódulos o hacer push; publicar una versión; enlazar repos
que no sean git; gestionar remotos o credenciales (bond usa el `git clone` del usuario).

## Contexto verificado

- Hoy `bond hub` (`cli/hub.mts`) detecta un hub que ya existe: lista los submódulos
  inicializados (recursivo) y escribe la sesión en `[hub]` de `.bond/bond.toml` (`hubBlock`,
  `withHub`), que valida `parseHub` en `cli/repo.mts`. No crea nada ni clona.
- `hubRoot(dir)` sube por `git rev-parse --show-superproject-working-tree` hasta el hub de más
  arriba con `[hub]`; `hubSession(root)` devuelve `{ root, name, repos: HubRepo[] }` con `path`,
  `dir`, `base`, `branch` y `present` por repo. Hay 14 usos de `hubRoot`/`hubSession`/`repoHub`
  fuera de `cli/hub.mts`, sobre todo en `cli/team.mts`.
- Un repo enlazado por symlink vive fuera del hub: `--show-superproject-working-tree` no da
  nada desde dentro, así que `hubRoot` no lo encuentra (por eso D14).
- `git worktree add` desde un symlink actúa sobre el repo real; los worktrees siguen yendo a
  `~/.herdr/worktrees/<hub>/<sub>/<rama>` (D9 de `2026-10-29-hub-session`). `canonical`
  (`cli/util.mts`) normaliza rutas para casar el cwd de los agentes con los worktrees: hay que
  confirmar que resuelve symlinks (realpath) en las dos direcciones.
- El asistente de `bond setup` usa `@clack/prompts`; `bond init` ya prepara un repo con
  `.bond/bond.toml`, `AGENTS.md` y la config de cada agente.
- Nada del modo hub está publicado: `[hub]` se puede quitar sin migración para usuarios.

## Decisiones, dependencias y riesgos

Decisiones nuevas (registradas aceptadas en la memoria de decisiones):

- D11 — Cada repo entra como submódulo o como symlink; los dos modos conviven (usuario,
  2026-10-30). [`docs/decisions/2026-10-30-hub-cada-repo-entra-como-submodulo-o-como-symlink.md`](../decisions/2026-10-30-hub-cada-repo-entra-como-submodulo-o-como-symlink.md)
- D12 — El hub es un repo git compartido con el equipo (usuario, 2026-10-30). [`docs/decisions/2026-10-30-hub-el-hub-es-un-repo-git-compartido-con-el-equipo.md`](../decisions/2026-10-30-hub-el-hub-es-un-repo-git-compartido-con-el-equipo.md)
- D13 — `hub.toml` versionado y `.bond/hub.local.toml` personal; se quita `[hub]` de
  `bond.toml` (propuesta, aprobada con el plan, 2026-10-30). Sustituye a D6 de
  `2026-10-29-hub-session`. [`docs/decisions/2026-10-30-hub-hub-toml-versionado-y-bond-hub-local-toml-personal-se-quita-hub.md`](../decisions/2026-10-30-hub-hub-toml-versionado-y-bond-hub-local-toml-personal-se-quita-hub.md)
- D14 — Registro global `~/.bond/hubs.toml` para encontrar el hub desde un repo enlazado
  (propuesta, aprobada con el plan, 2026-10-30). [`docs/decisions/2026-10-30-hub-registro-global-bond-hubs-toml-para-encontrar-el-hub-desde-un-repo-enlazado.md`](../decisions/2026-10-30-hub-registro-global-bond-hubs-toml-para-encontrar-el-hub-desde-un-repo-enlazado.md)
- D15 — En Windows, junction cuando no se pueden crear symlinks (propuesta, aprobada con el
  plan, 2026-10-30). [`docs/decisions/2026-10-30-hub-en-windows-junction-cuando-no-se-pueden-crear-symlinks.md`](../decisions/2026-10-30-hub-en-windows-junction-cuando-no-se-pueden-crear-symlinks.md)

Siguen vigentes las decisiones D1–D5 y D7–D10 de `2026-10-29-hub-session`. D4 (todos los
submódulos inicializados, recursivo) pasa a aplicarse a la importación: `bond hub init` en un
repo con submódulos los ofrece todos para importarlos a `hub.toml`.

Formato propuesto (P5 lo fija y lo documenta):

```toml
# hub.toml (versionado)
name = "fluzo"
base = "main"                 # rama base del propio hub

[repos.frontend]
url  = "git@github.com:fluzo/frontend.git"
path = "frontend"             # ruta dentro del hub, con /
base = "main"
link = "submodule"            # o "symlink"
agent = "claude"              # opcional; si no, el default del repo

# .bond/hub.local.toml (en .gitignore)
[repos.backend]
source = "~/gitrepos/fluzo-backend"   # clon local para link = "symlink"
```

Dependencias: P6 y P7 dependen de P5; P8 depende de P6 y P7. P6 y P7 no dependen entre sí.

Riesgos:

- Quitar `[hub]` toca los 14 usos de la sesión en `cli/team.mts`: la interfaz `HubSession` se
  mantiene para que P2 y P3 de `2026-10-29-hub-session` no cambien; las pruebas de equipo en hub
  pasan a montar su fixture con `hub.toml`.
- Symlinks y rutas: un cwd por el symlink (`hub/backend`) y la ruta real del clon tienen que
  casar como el mismo repo (realpath en `canonical`). Pruebas en Linux, macOS y Windows (CI).
- Windows: symlinks de directorio pueden fallar sin modo desarrollador; junction como respaldo
  (D15) y prueba en CI. Los symlinks del hub van al `.gitignore` del hub (las rutas son
  personales).
- Clonar es lento y puede pedir credenciales: `sync` dice qué va a clonar antes de hacerlo,
  respeta `--dry-run` y nunca borra un repo ni un clon que ya exista.
- `check --fix` solo hace cambios seguros y anunciados (crear un symlink, `git submodule update
  --init`, ofrecer `bond init`); nunca descarta cambios ni cambia de rama un repo con trabajo.
- Recuperación: cada fase es un commit propio y revertible; `hub.toml` y el registro se pueden
  borrar a mano sin tocar los repos.

## Fases

### P5: `hub.toml` como fuente de la sesión

- Resultado: la sesión de un hub sale de `hub.toml` (más `.bond/hub.local.toml` para las rutas
  locales), sean sus repos submódulos o symlinks. `[hub]` de `bond.toml` deja de existir.
  `hubRoot` encuentra el hub desde dentro de cualquier repo de la sesión, también uno enlazado,
  con git o, si no, con `~/.bond/hubs.toml`. La tabla de sesión y el equipo vertical funcionan
  igual que antes.
- Repositorio: `jmanuelcorral/bond`.
- Dependencias: ninguna (parte de `2026-10-29-hub-session` P1–P4 integradas).
- Contratos afectados: ficheros nuevos `hub.toml`, `.bond/hub.local.toml` y
  `~/.bond/hubs.toml` (formato, validación y mensajes); `HubRepo` gana `link`, `url` y `source`
  (la interfaz `HubSession` se mantiene); se quitan `parseHub`, `HubConfig`, `hubBlock`,
  `withHub` y `[hub]` de `cli/repo.mts`; `canonical` resuelve symlinks; ayuda de `bond hub`,
  `docs/reference.md` y CHANGELOG.
- Criterios de aceptación:
  - Un hub de prueba con un submódulo y un symlink en `hub.toml` da una sesión con los dos repos,
    sus bases y su modo de enlace.
  - Desde dentro del repo enlazado (por su ruta real, no por el symlink) `hubRoot` devuelve el
    hub gracias al registro; sin registro, nada.
  - `bond team status` en ese hub enseña una sola tabla con los dos repos; las pruebas de equipo
    en hub de `2026-10-29-hub-session` pasan con su fixture en `hub.toml`.
  - Un `hub.toml` inválido se explica con un mensaje que dice qué arreglar; `bond team` lo trata
    como repo normal con un aviso.
  - Un `bond.toml` con `[hub]` ya no hace nada especial (ni error).
  - Repos sin hub: sin cambios (pruebas de no regresión existentes).
- Acciones:
  - [x] Formato, lectura y validación de los tres ficheros; `hubSession`/`hubRoot` desde
    `hub.toml` y el registro; quitar `[hub]`; `canonical` con realpath; docs, CHANGELOG y
    pruebas (fixture con submódulo y symlink).
  - [x] Ejecutar las comprobaciones y anotar los resultados.
  - [ ] Presentar la evidencia y parar para revisión.
- Verificación: `npm run typecheck && bun test` en la raíz.
- Riesgos y recuperación: si algo del modo hub deja de funcionar, la fase no se acepta hasta que
  las pruebas de `test/team-hub.test.mts` pasen con el fixture nuevo.

### P6: crear el hub e importar repos

- Resultado: `bond hub init [dir]` es un asistente que crea el hub (git init, `.bond/`,
  `AGENTS.md`, `hub.toml`, `.gitignore` con los symlinks y `hub.local.toml`) o lo prepara en un
  repo que ya existe, e importa repos: por URL (submódulo) o desde un clon local (symlink),
  eligiendo base y agente de cada uno. En un repo con submódulos, los ofrece todos para
  importarlos (D4). `bond hub add <url|ruta>` importa uno más; `bond hub sync` deja el disco como
  dice `hub.toml` (clona y añade submódulos, crea symlinks o junctions, pregunta la ruta local
  que falte u ofrece clonar) y actualiza el registro global.
- Repositorio: `jmanuelcorral/bond`.
- Dependencias: P5.
- Contratos afectados: `bond hub init`, `bond hub add`, `bond hub sync` (con `--yes` y
  `--dry-run`); el `bond hub` sin argumentos enseña la sesión; ayuda, `docs/reference.md`,
  `docs/puesto.md` y CHANGELOG.
- Criterios de aceptación:
  - `bond hub init --yes` con un repo por URL (un repo local servido como `file://`) y otro por
    ruta local crea el hub con un submódulo y un symlink, y un `hub.toml` y `hub.local.toml`
    correctos; repetirlo no cambia nada.
  - Clonar el hub en otra carpeta y pasar `bond hub sync` monta el submódulo; para el symlink sin
    ruta local, con `--yes` falla diciendo cómo darla, y de forma interactiva la pregunta.
  - En un repo con submódulos, `init` los importa a `hub.toml` con su base.
  - `sync --dry-run` dice qué haría y no toca nada; nunca borra un repo ni un clon existente.
  - En Windows, si el symlink falla, crea una junction y lo dice (prueba en CI).
- Acciones:
  - [x] Asistente, `add`, `sync`, junctions en Windows, registro global, docs, CHANGELOG y
    pruebas (repos de fixture servidos por `file://`).
  - [x] Ejecutar las comprobaciones y anotar los resultados.
  - [ ] Presentar la evidencia y parar para revisión.
- Verificación: `npm run typecheck && bun test`; a mano, `bin/bond hub init` con un repo real
  por URL y otro por clon local.
- Riesgos y recuperación: si `sync` falla a medias, informa repo a repo y repetirlo continúa
  donde lo dejó.

### P7: revisión guiada del hub

- Resultado: `bond hub check` revisa cada repo de la sesión y dice qué falta y cómo arreglarlo:
  que existe y es un repo git, que su enlace es el que dice `hub.toml`, que tiene la base, que
  tiene `bond init` hecho y su config al día (`bond sync --check`), que sus agentes están
  instalados, que admite worktrees y que no tiene cambios sin commitear ni una rama vertical a
  medias. Con `--fix` arregla lo seguro (crear un enlace, `git submodule update --init`, ofrecer
  `bond init` o `bond sync`). `bond doctor` incluye un resumen de `check` cuando estás en un hub.
- Repositorio: `jmanuelcorral/bond`.
- Dependencias: P5.
- Contratos afectados: `bond hub check [--fix] [--json]`; una sección del hub en `bond doctor`;
  ayuda, `docs/reference.md` y CHANGELOG.
- Criterios de aceptación:
  - En un hub sano, `check` da todo en verde y sale con 0; con un problema, lo nombra por repo
    con el arreglo y sale con 1.
  - Cada comprobación tiene su prueba con un fixture roto a propósito (symlink roto, base que no
    existe, repo sin `bond init`, agente no instalado, cambios sin commitear).
  - `--fix` arregla el symlink roto y el submódulo sin inicializar, y nunca descarta cambios ni
    cambia de rama un repo.
  - `bond doctor` fuera de un hub no cambia.
- Acciones:
  - [ ] Comprobaciones, `--fix`, `--json`, entrada en `bond doctor`, docs, CHANGELOG y pruebas.
  - [ ] Ejecutar las comprobaciones y anotar los resultados.
  - [ ] Presentar la evidencia y parar para revisión.
- Verificación: `npm run typecheck && bun test`; a mano, `bin/bond hub check` en el hub de P6.
- Riesgos y recuperación: `--fix` pregunta antes de cada cambio salvo con `--yes`.

### P8: el flujo completo, de punta a punta

- Resultado: la documentación (`docs/puesto.md`, `docs/reference.md`, `docs/getting-started.md`
  y sus versiones en `docs/en/`) y las skills `plan-team` y `bond-team` describen el flujo nuevo
  (`bond hub init` → `check` → `bond team fix/x`); y el flujo se ha probado a mano en un hub
  real con un repo por submódulo y otro por symlink.
- Repositorio: `jmanuelcorral/bond`.
- Dependencias: P6 y P7.
- Contratos afectados: docs y skills; sin cambios de código salvo los fallos que aparezcan en la
  prueba (cada uno en su commit).
- Criterios de aceptación:
  - Prueba manual en Herdr documentada en el plan: `bond hub init` (submódulo + symlink),
    `bond hub check` en verde, `bond team fix/x`, `bond team prompt`, la tabla `tabla · <hub>`
    con los dos repos, `bond team collect --repo` con los runs en el hub y `bond team clean`
    dejándolo todo como estaba.
  - Las skills no mencionan `[hub]` de `bond.toml`; `bond sync --check` al día.
  - El site de docs construye (`cd site && npm run build`).
- Acciones:
  - [ ] Docs y skills, prueba manual y arreglos que salgan, cada uno con su prueba.
  - [ ] Ejecutar las comprobaciones y anotar los resultados.
  - [ ] Presentar la evidencia y parar para revisión.
- Verificación: `npm run typecheck && bun test`, `bond sync --check`, build del site y la prueba
  manual descrita.
- Riesgos y recuperación: si la prueba manual saca fallos de diseño (no de implementación), se
  paran y se proponen como decisión antes de seguir.

## Progreso

| Fase | Implementación | Verificación | Revisión | Evidencia |
| --- | --- | --- | --- | --- |
| P5 | implemented | passed | pending | `f8e930e` + `b87a26b` (arreglos de la revisión) integrados en `plan/hub-session`; en el checkout principal `bun test` 386/0, y las pruebas no tocan el `~/.bond/hubs.toml` real (`BOND_HOME` temporal). Sin probar en Windows (canonical/realpath y junctions, a cubrir en P6). Runs: `2026-10-30-kevin-use-the-plan-execute-skill-to-implement.md`, `2026-10-30-reviewer-5-read-only-code-review-of-branch-plan-hub.md`, `2026-10-30-kevin-a-reviewer-requested-changes-on-your-p5.md` |
| P6 | implemented | passed | pending | `ad692c2` + `0821fa7` (arreglos de la revisión) integrados en `plan/hub-session`; en el checkout principal `bun test` 395/0. Sin probar en Windows real (junctions: lo dirá el CI) ni a mano con un repo real por URL. Runs: `2026-10-30-kevin-use-the-plan-execute-skill-to-implement-2.md`, `2026-10-30-reviewer-6-read-only-code-review-of-branch-plan-hub.md`, `2026-10-30-kevin-a-reviewer-requested-changes-on-your-p6.md` |
| P7 | pending | not_run | pending | todavía nada |
| P8 | pending | not_run | pending | todavía nada |

## Siguiente paso

P6 (crear e importar) y P7 (revisión guiada) en paralelo desde `plan/hub-session`, ya con P5
integrada (su revisión humana sigue pendiente).

## Evidencia y seguimiento

- P5: rama `plan/hub-guided-p5` (kevin, agy), revisada por reviewer-5 (pi): cambios pedidos
  (ayuda y mensaje obsoletos, aviso de config inválida desde un repo de la sesión, prueba desde
  un worktree de un repo enlazado) y 4 nits, aplicados en `b87a26b`. Quedan para más adelante:
  pruebas de `canonical` en Windows (P6), caché de la sesión por proceso (rendimiento) y las
  skills/`docs/puesto.md` que aún hablan de `[hub]` (P8).

- P6: rama `plan/hub-guided-p6` (kevin, agy), revisada por reviewer-6 (pi): cambios pedidos (un
  bloqueante: `init --dry-run` moría siempre; clon interactivo que ignoraba `--dry-run`, `hub add`
  que sobrescribía una entrada, junctions irreparables en Windows, ayuda de los subcomandos
  inalcanzable), aplicados en `0821fa7`.
- Incidente: una prueba manual de un agente con `bin/bond hub` sin `BOND_HOME` temporal escribió
  el `~/.bond/hubs.toml` real (solo rutas de `/tmp`); el orquestador lo borró. Las pruebas
  automáticas fijan `BOND_HOME` temporal; las pruebas manuales de P8 tienen que hacerlo también.

Sin issues ni PRs todavía. Continúa `2026-10-29-hub-session` en la misma rama
(`plan/hub-session`), que irá en un solo PR.
