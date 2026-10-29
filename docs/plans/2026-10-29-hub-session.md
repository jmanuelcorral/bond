---
name: "2026-10-29-hub-session"
description: "Desde un repo hub con submódulos, una rama vertical abre un agente por repo y todo el equipo se ve en una sola tabla de sesión"
created_at: "2026-10-29T18:16:29Z"
has_completed_all_phases: false
---

# Sesiones de hub: una rama vertical, un agente por repo y una sola tabla

## Origen y revisión

- Identificador: `2026-10-29-hub-session`.
- Origen: petición del usuario. Trabaja desde un "repo hub" con submódulos (p. ej. frontend y
  backend separados), con agentes que trabajan cada uno en un repo; al lanzar un equipo
  (`plan-team`) le salen dos paneles de tabla, uno por repo, y quiere verlo todo en un mismo
  panel de sesión.
- Revisión: `4562ea5` en `main`.
- Base de diseño: `cli/team.mts` (`create`, `teamRows`, `defaultBase`, `renderWatch`,
  `watch`, `openWatch`, `watchLabel`, `prompt`, `collect`, `runCtx`, `clean`,
  `closeIdleTable`, `tabWorktreePath`), `cli/launch.mts` (`gitRoot`), `cli/repo.mts`
  (lectura de `.bond/bond.toml`), `catalog/skills/plan-team/SKILL.md`,
  `catalog/skills/bond-team/`, `docs/puesto.md` y `docs/reference.md`.
- Aprobación: contenido y destino aprobados por el usuario el 2026-10-29 ("si, guárdalo").

## Objetivo

Desde un repo hub con submódulos, `bond team fix/x` abre la rama `fix/x` en vertical (un
worktree y un agente por repo que toca), todo el equipo se ve en una sola tabla de sesión y
`prompt`, `collect` y `clean` funcionan desde el hub sin entrar en cada submódulo. Un repo sin
hub se comporta exactamente como hoy.

## Alcance y exclusiones

Entra: el comando `bond hub` y la sección `[hub]` de `.bond/bond.toml`; la tabla de sesión
(`bond team status` y `--watch`) sobre todos los repos del hub; `bond team` vertical en un hub
(creación, `prompt`, `collect`, `clean`); los runs en la memoria del hub; las skills
`plan-team` y `bond-team` del catálogo; ayuda, `docs/reference.md`, `docs/puesto.md` y
`CHANGELOG.md`.

Fuera: varias ramas verticales a la vez en un mismo hub (feature futura, D2); integrar ramas,
subir los punteros de los submódulos o hacer push (decisión del usuario, como hoy); `bond`
(el puesto de trabajo) y `bond init`/`bond sync` salvo validar `[hub]`; repos sin `[hub]`.

## Contexto verificado

- Todo `bond team` va atado a un repo: `repoOf(dir)` = `git rev-parse --show-toplevel` del
  directorio. `teamRows(root, base)` lista solo los worktrees enlazados de ese repo, y la base
  por defecto es la rama del checkout principal de ese repo (`defaultBase`).
- La tabla en vivo es un panel con título `tabla · <repo>` (`watchLabel`), que lanza
  `bond team status <root> --watch` (`watchCommand`); `openWatch` la reutiliza solo si coincide
  el repo. Por eso dos `bond team` en dos submódulos abren dos tablas.
- `prompt`, `collect` y `clean` resuelven la rama en `repoOf()` (el cwd): desde el hub no
  encuentran las ramas de los submódulos.
- `runCtx`/`collect` escriben los runs en la memoria del checkout principal de ese repo (el
  submódulo), no en la del hub.
- Los worktrees en paneles van en `~/.herdr/worktrees/<repo>/<rama>` (`tabWorktreePath`), con
  `<repo>` = nombre de la carpeta.
- No hay soporte de submódulos en `cli/`. En un submódulo, `.git` es un fichero que apunta a
  `.git/modules/<sub>` del superproyecto; `git -C <sub> worktree add` funciona y guarda el
  worktree en ese gitdir. `git rev-parse --show-superproject-working-tree` da el
  superproyecto (vacío si no lo hay).
- El cierre automático de la tabla (`watchIdle`, `pendingWork`, `closeIdleTable`) decide por las
  filas de un repo.

## Decisiones, dependencias y riesgos

Decisiones (registradas aceptadas en la memoria de decisiones):

- D1 — Trabajo vertical: la rama se llama igual en todos los repos que toca (usuario,
  2026-10-29). [`docs/decisions/2026-10-29-modo-hub-ramas-verticales-con-el-mismo-nombre-en-todos-los-repos.md`](../decisions/2026-10-29-modo-hub-ramas-verticales-con-el-mismo-nombre-en-todos-los-repos.md)
- D2 — Una sola rama vertical por sesión, un agente por repo en su worktree; varias ramas en
  paralelo queda para el futuro (usuario, 2026-10-29). [`docs/decisions/2026-10-29-modo-hub-un-agente-por-repo-y-una-sola-rama-vertical-por-sesion.md`](../decisions/2026-10-29-modo-hub-un-agente-por-repo-y-una-sola-rama-vertical-por-sesion.md)
- D3 — El hub también tiene la rama vertical (usuario, 2026-10-29). [`docs/decisions/2026-10-29-modo-hub-el-hub-tambien-tiene-la-rama-vertical.md`](../decisions/2026-10-29-modo-hub-el-hub-tambien-tiene-la-rama-vertical.md)
- D4 — La sesión incluye todos los submódulos inicializados, recursivo (usuario, 2026-10-29). [`docs/decisions/2026-10-29-modo-hub-la-sesion-incluye-todos-los-submodulos-inicializados-recursivo.md`](../decisions/2026-10-29-modo-hub-la-sesion-incluye-todos-los-submodulos-inicializados-recursivo.md)
- D5 — Los runs van a la memoria del hub; si el hub no tiene `[decisions]`, a la del submódulo
  (usuario, 2026-10-29). [`docs/decisions/2026-10-29-modo-hub-los-runs-de-los-agentes-se-guardan-en-la-memoria-del-hub.md`](../decisions/2026-10-29-modo-hub-los-runs-de-los-agentes-se-guardan-en-la-memoria-del-hub.md)
- D6 — `bond hub` configura la sesión, con la base de cada repo, en `[hub]` de
  `.bond/bond.toml` (usuario, 2026-10-29). [`docs/decisions/2026-10-29-bond-hub-configura-la-sesion-en-hub-de-bond-bond-toml.md`](../decisions/2026-10-29-bond-hub-configura-la-sesion-en-hub-de-bond-bond-toml.md)
- D7 — En el hub, la rama vertical es solo una rama, sin worktree ni agente (propuesta,
  aprobada con el plan, 2026-10-29). [`docs/decisions/2026-10-29-modo-hub-en-el-hub-la-rama-vertical-es-solo-una-rama-sin-worktree-ni-agente.md`](../decisions/2026-10-29-modo-hub-en-el-hub-la-rama-vertical-es-solo-una-rama-sin-worktree-ni-agente.md)
- D8 — `bond team prompt fix/x` manda la tarea a todos los agentes de la rama, con una nota de
  coordinación; `--repo` a uno solo (propuesta, aprobada con el plan, 2026-10-29). [`docs/decisions/2026-10-29-modo-hub-bond-team-prompt-manda-la-tarea-a-todos-los-agentes-de-la-rama.md`](../decisions/2026-10-29-modo-hub-bond-team-prompt-manda-la-tarea-a-todos-los-agentes-de-la-rama.md)
- D9 — Worktrees de un hub en `~/.herdr/worktrees/<hub>/<sub>/<rama>` (propuesta, aprobada con
  el plan, 2026-10-29). [`docs/decisions/2026-10-29-modo-hub-los-worktrees-van-en-herdr-worktrees-hub-sub-rama.md`](../decisions/2026-10-29-modo-hub-los-worktrees-van-en-herdr-worktrees-hub-sub-rama.md)
- D10 — Con una rama vertical abierta, `bond team` se niega a abrir otra (propuesta, aprobada
  con el plan, 2026-10-29). [`docs/decisions/2026-10-29-modo-hub-con-una-rama-vertical-abierta-bond-team-se-niega-a-abrir-otra.md`](../decisions/2026-10-29-modo-hub-con-una-rama-vertical-abierta-bond-team-se-niega-a-abrir-otra.md)

Dependencias: P2 y P3 dependen de P1; P4 depende de P3. P2 y P3 no dependen entre sí.

Riesgos:

- Windows: en submódulos y worktrees `.git` es un fichero y git puede devolver rutas con `\`.
  Mitigación: normalizar con `canonical` y guardar en `[hub]` rutas relativas con `/`; las
  pruebas de fixture corren en el CI de Windows.
- Submódulos en HEAD separado (lo normal tras `git submodule update`): `defaultBase` muere sin
  rama. Mitigación: la base sale de `[hub]` (D6), y `bond hub` exige elegir una si el repo no
  está en una rama.
- No regresión: todo lo de hub se activa solo con `[hub]`; pruebas de que la salida de
  `bond team status` en un repo sin hub no cambia.
- Paneles: como mucho tantos agentes como repos, más el panel del usuario y la tabla; con más de
  4 repos se reparten en pestañas nuevas como hoy.
- Recuperación: cada fase es un commit propio y revertible; `[hub]` se puede quitar del
  `bond.toml` para volver al comportamiento de hoy.

## Fases

### P1: `bond hub` y la sesión del hub

- Resultado: `bond hub` en un repo con submódulos detecta los submódulos inicializados
  (recursivo), pregunta la base de cada repo (por defecto su rama actual) y escribe `[hub]` en
  `.bond/bond.toml`; `bond hub` sin cambios pendientes enseña la sesión (repos, ruta, base y
  rama actual); `bond hub sync` añade o quita repos cuando cambian los submódulos. Desde un
  submódulo se encuentra el hub subiendo por `--show-superproject-working-tree`.
- Repositorio: `jmanuelcorral/bond`.
- Dependencias: ninguna.
- Contratos afectados: comando nuevo `bond hub [sync] [--yes]`; sección nueva `[hub]` en
  `.bond/bond.toml` (`base` del hub, `repos.<ruta>.base`, `exclude` opcional), validada al
  leerla; módulo nuevo (p. ej. `cli/hub.mts`) con `hubRoot(dir)` y `hubSession(root)` que
  devuelven el hub y sus repos con su base; ayuda general y `docs/reference.md`.
- Criterios de aceptación:
  - En un hub de prueba con 2 submódulos (uno anidado) `bond hub --yes` escribe `[hub]` con los
    3 repos y sus bases; repetirlo no cambia nada.
  - Un submódulo sin inicializar se avisa y no entra; un repo en HEAD separado pide base (con
    `--yes`, falla con un mensaje que dice cómo indicarla).
  - En un repo sin submódulos, explica qué hace falta y no escribe nada.
  - `hubRoot` desde un submódulo anidado devuelve el hub de arriba; desde un repo sin hub,
    nada.
  - `bond team` y `bond` en un repo sin `[hub]` no cambian.
- Acciones:
  - [ ] Comando, sección `[hub]`, detección de submódulos y del hub, ayuda, docs, CHANGELOG y
    pruebas con un hub de fixture (repos locales y `git submodule add` en un directorio
    temporal).
  - [ ] Ejecutar las comprobaciones y anotar los resultados.
  - [ ] Presentar la evidencia y parar para revisión.
- Verificación: `npm run typecheck && bun test` en la raíz; a mano, `bin/bond hub` en un hub
  real.
- Riesgos y recuperación: si `[hub]` rompe la lectura de `bond.toml` en algún caso, la sección
  se ignora con un aviso en vez de abortar.

### P2: una sola tabla para toda la sesión

- Resultado: en un hub, `bond team status` y `--watch` (desde el hub o desde cualquiera de sus
  submódulos) enseñan los worktrees de todos los repos de la sesión, cada uno comparado con su
  base de `[hub]`, en un único panel `tabla · <hub>`. Una fila por repo, agrupadas por estado
  como hoy; la cabecera lleva la rama vertical abierta.
- Repositorio: `jmanuelcorral/bond`.
- Dependencias: P1.
- Contratos afectados: `teamRows` gana el repo de cada fila (campo `repo` también en
  `--json`); `renderWatch` con columna `REPO` y base por fila en modo hub; `watchLabel`,
  `openWatch`, `watchCommand`, `watchIdle` y `closeIdleTable` por sesión; `bond team status`
  en `docs/puesto.md` y `docs/reference.md`.
- Criterios de aceptación:
  - Con worktrees abiertos en 2 submódulos sale una sola tabla, con las filas de los dos.
  - Lanzar la tabla desde un submódulo reutiliza el panel `tabla · <hub>` si ya existe.
  - La tabla se cierra sola solo cuando no queda trabajo en ningún repo de la sesión.
  - En un repo sin `[hub]`, la salida de `status`, `--json` y `--watch` es idéntica a la de
    hoy (prueba de no regresión).
- Acciones:
  - [ ] Filas de sesión, render, panel único y cierre por sesión, con docs, CHANGELOG y pruebas
    (render en anchos 20/35/50/80 incluido).
  - [ ] Ejecutar las comprobaciones y anotar los resultados.
  - [ ] Presentar la evidencia y parar para revisión.
- Verificación: `npm run typecheck && bun test`; a mano en Herdr, dos worktrees en dos
  submódulos de un hub real y una sola tabla.
- Riesgos y recuperación: si `--json` cambia para repos sin hub, la fase no se acepta.

### P3: equipo vertical desde el hub

- Resultado: `bond team fix/x[:agente] [--repos a,b]` en un hub crea la rama `fix/x` en el hub
  (D3, D7) y abre un worktree y un agente en cada repo de la sesión (o en los de `--repos`),
  cada uno desde su base y con el agente por defecto de su `bond.toml` (o el pedido).
  `prompt fix/x` llega a todos los agentes de la rama con la nota de coordinación (D8);
  `--repo` a uno. `collect` y `clean` buscan la rama en todos los repos (`--repo` si hay
  ambigüedad); `clean fix/x` quita los worktrees de todos los repos. Los runs van al hub (D5).
- Repositorio: `jmanuelcorral/bond`.
- Dependencias: P1 (P2 para verlo en una tabla, no para funcionar).
- Contratos afectados: `bond team` en un hub (una sola rama, `--repos`), `prompt`/`collect`/
  `clean` con `--repo`; `tabWorktreePath` con `<hub>/<sub>` en modo hub (D9); `runCtx` y
  `collect` con la memoria del hub; ayuda de `bond team`, `docs/puesto.md`,
  `docs/reference.md` y CHANGELOG.
- Criterios de aceptación:
  - `bond team fix/x` en un hub de 2 submódulos abre 2 agentes, uno por submódulo, y crea
    `fix/x` en el hub sin worktree.
  - `bond team prompt fix/x "…"` llega a los dos y cada mensaje nombra al otro agente y su repo.
  - Con `fix/x` abierta, `bond team fix/y` falla sin crear nada y dice cómo cerrar `fix/x` (D10).
  - `bond team clean fix/x` deja el hub y los submódulos como estaban (las ramas se quedan).
  - Los runs de `prompt` y `collect` quedan en `docs/decisions/runs/` del hub.
  - `bond team` dentro de un submódulo sigue abriendo solo ese repo, como hoy.
- Acciones:
  - [ ] Creación vertical, rutas de worktree, prompt/collect/clean por sesión y runs en el hub,
    con docs, CHANGELOG y pruebas (fixture de hub; las órdenes a Herdr, simuladas como en las
    pruebas de equipo existentes).
  - [ ] Ejecutar las comprobaciones y anotar los resultados.
  - [ ] Presentar la evidencia y parar para revisión.
- Verificación: `npm run typecheck && bun test`; a mano en Herdr, un ciclo completo
  (`bond team fix/x`, `prompt`, `collect`, `clean`) en un hub real.
- Riesgos y recuperación: si la creación falla a medias (un repo sí, otro no), se informa repo a
  repo y `bond team clean fix/x` deja todo como estaba.

### P4: skills en modo hub

- Resultado: `plan-team` y `bond-team` del catálogo (en inglés) saben trabajar en un hub: una
  fase ocupa una rama vertical (un agente por repo), se manda con un solo `prompt`, se recoge
  repo a repo y, al integrar, `plan-team` recuerda que falta subir los punteros en la rama del
  hub sin hacerlo él.
- Repositorio: `jmanuelcorral/bond`.
- Dependencias: P3.
- Contratos afectados: `catalog/skills/plan-team/SKILL.md`, `catalog/skills/bond-team/` y,
  tras `bond sync`, sus copias generadas; CHANGELOG.
- Criterios de aceptación:
  - Las skills distinguen repo normal y hub (sección `[hub]`) y en un hub no abren dos ramas
    verticales a la vez.
  - Nunca integran, suben punteros, hacen push ni borran ramas por su cuenta.
  - `bond catalog check` (o las pruebas del catálogo) pasan.
- Acciones:
  - [ ] Actualizar las dos skills, pasar `bond sync` y las pruebas del catálogo.
  - [ ] Ejecutar las comprobaciones y anotar los resultados.
  - [ ] Presentar la evidencia y parar para revisión.
- Verificación: `npm run typecheck && bun test`; a mano, `plan-team` con un plan de dos fases
  en un hub real.
- Riesgos y recuperación: sin riesgo de datos; se revierte el commit.

## Progreso

| Fase | Implementación | Verificación | Revisión | Evidencia |
| --- | --- | --- | --- | --- |
| P1 | pending | not_run | pending | todavía nada |
| P2 | pending | not_run | pending | todavía nada |
| P3 | pending | not_run | pending | todavía nada |
| P4 | pending | not_run | pending | todavía nada |

## Siguiente paso

Ejecutar P1 (`bond hub` y la sesión del hub): es la única fase sin dependencias y P2 y P3
la necesitan. Respuesta corta: "ejecuta P1". Alternativa: parar aquí.

## Evidencia y seguimiento

Sin issues ni PRs todavía.
