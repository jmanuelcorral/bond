---
agent: "reviewer-2"
kind: "agy"
branch: "plan/hub-session-p2"
base: "plan/hub-session@214a0c5"
orchestrator: "claude"
started_at: "2026-10-29T19:24:32Z"
finished_at: "2026-10-29T19:24:32Z"
status: "reported"
commits:
  - "e5d2147 feat(team): show a single session table in hub repos with submodules"
decisions: []
---

## Request

Read-only code review of branch plan/hub-session-p2, which implements phase P2 of docs/plans/2026-10-29-hub-session.md. Read that plan (P2 section and the decisions it links), AGENTS.md and cli/hub.mts (P1, already integrated) first. Do not switch branches in this checkout: inspect with `git diff plan/hub-session...plan/hub-session-p2` and `git show plan/hub-session-p2:<file>`.

Note: another branch (plan/hub-session-p3) implements P3 in parallel and also edits cli/team.mts; flag anything in this branch that will clash semantically with P3's scope as described in the plan.

Look for: correctness bugs, regressions for repos without [hub] (behavior and --json must be identical), Windows path issues, missing tests for P2's acceptance criteria, and violations of the plan's decisions.

Constraints: do not edit, create or commit any file, and do not run commands that change the working tree. Report only actionable findings, each with file:line, severity (blocker / should-fix / nit), the concrete failing scenario and a suggested fix. End with a verdict: approve or changes requested.

## Report

# Revisión P2 — `plan/hub-session-p2` (`e5d2147`)

Revisado: plan (P2 + D1–D10), `cli/hub.mts` (P1), diff `plan/hub-session...plan/hub-session-p2`, y `plan/hub-session-p3` para detectar choques.

## Hallazgos

### 1. BLOCKER — `teamRows` sesión-céntrico contamina `prompt`/`collect`/`clean`/`create` y choca de frente con el diseño de P3

`cli/team.mts:501-503`: `teamRows` resuelve `hubRoot(root)` por dentro y devuelve las filas de **toda la sesión** para **todos** los llamantes, no solo para `status`/`--watch` (que es el alcance de P2, "una sola tabla"). Escenarios concretos en un hub con `[hub]` antes de que P3 exista:

- `bond team prompt fix/x "tarea"` desde el hub con `fix/x` en dos submódulos (el caso D1, ramas homónimas): `team.mts:1383` hace `rows.find(r => r.branch === branch)` y elige el **primer match del orden de sesión** (hub primero, submódulos por ruta) — el prompt puede ir al agente del repo equivocado, y el run (`runCtx`) se registra contra el root actual con la fila de otro repo (contra D5).
- `bond team clean` sin argumentos desde el hub (`team.mts:1408-1415`): `targets` = integradas+managed de **toda la sesión** → quita worktrees de todos los repos sin la desambiguación `--repo` ni el manejo de rutas/`runCtx` que P3 es dueño de proveer.
- `create` desde un submódulo imprime al final el estado de toda la sesión (`team.mts:185`).

Y el choque con P3: P3 mantiene `teamRows` **por-repo** (`plan/hub-session-p3:cli/team.mts:538`, firma original) y añade `sessionRows(repos)` aparte (`:1559`) que llama `teamRows(repo.dir, repo.base)` por repo. Con el `teamRows` de P2 fusionado, cada una de esas llamadas desde la carpeta de un submódulo volvería a subir al hub y devolvería **la sesión entera** → filas duplicadas N veces y bases cruzadas (`repoBase = base ?? hr.base` ignora la base pedida). Además P3 exige "desde un submódulo, `bond team` trabaja solo en ese repo" (`hubOf` = solo si el root **es** el hub, `:1527`); el walk-up de P2 dentro de `teamRows` lo rompe para prompt/collect/clean.

**Fix sugerido**: en P2, dejar `teamRows` por-repo (como hace P3) y poner la ampliación de sesión en una función nueva (`sessionRows`) usada **solo** por `status`/`--watch`/`printStatus`/`renderWatch`. Así el campo `repo` del contrato llega a la tabla sin cambiar la semántica del resto de comandos, y la fusión con P3 se reduce a que P3 reutilice esa misma `sessionRows`.

### 2. SHOULD-FIX — `--base` en modo hub: inconsistente entre el proceso directo y el panel, y frágil por repo

- `status --watch --base X` en un hub (`team.mts:657-661`) pasa `X` a `watch` → `teamRows(hub, X)` → `repoBase = base ?? hr.base` **sobrescribe la base de todos los repos** con `X` (`team.mts:568`). Si `X` no existe en un repo, muere la tabla entera.
- Sin embargo `watchCommand` (`team.mts:884-887`) **descarta** `--base` en modo hub (`base && !hub`), así que el panel que abre `openWatch` se comporta distinto del `bond team status --watch --base X` lanzado a mano.

Escenario: `bond team status --watch --base main` en un hub donde un submódulo tiene su base en `v2` → o bien la tabla muere cada tick ("la base no existe en front: main") o el panel y el proceso directo muestran commits contra bases distintas.

**Fix**: en modo hub, rechazar `--base` con mensaje claro (como hace P3 en `createInHub`: "cada repo sale de su base de `[hub]`") o ignorarlo de forma consistente en ambas rutas. Igual para `status` plano: sobre-escribir todas las bases no está en el contrato.

### 3. SHOULD-FIX — una base inválida en cualquier repo tumba toda la tabla, sin tolerancia por repo

`team.mts:568`: `die(...)` dentro del bucle de la sesión. Un submódulo con la base mal puesta en `[hub]` deja sin tabla el hub entero, aunque los demás repos estén sanos. P3 ya demuestra el patrón correcto (`catchDie` + `warn` por repo en `sessionRows`, `plan/hub-session-p3:cli/team.mts:1559-1566`). Aplicar lo mismo aquí (o unificar con la `sessionRows` del punto 1).

### 4. SHOULD-FIX — faltan pruebas de dos criterios de aceptación de P2

En `test/team.test.mts` / `test/hub.test.mts`:

- **"La tabla se cierra sola solo cuando no queda trabajo en ningún repo de la sesión"**: no hay ningún test de `watchIdle` con filas multi-repo (una repo con trabajo → `busy`; todas integradas → `close`). Los tests existentes (`team.test.mts:414-436`) son de una sola repo.
- **"En un repo sin `[hub]`, la salida de `status`, `--json` y `--watch` es idéntica a hoy (prueba de no regresión)"**: no se añadió. La no-regresión se cumple por construcción (`repo`/`base` quedan `undefined` y `JSON.stringify` los omite — comprobado), pero el plan la pide explícitamente y es barato: assert de que las filas sin hub no traen claves `repo`/`base` y de que la cabecera no incluye `REPO`.
- Reutilización del panel desde submódulo (criterio 2) solo está cubierta de través por `watchCommand`; el `openWatch`/`findWatchPane` con etiqueta `tabla · <hub>` no tiene test propio.

### 5. NIT — `callerTab`/`create` buscan la tabla con `basename(root)` en vez del nombre del hub

`team.mts:226`: `findWatchPane(panes, me?.tab_id, basename(root))`. Si se lanza `bond team` desde un submódulo con la tabla del hub abierta (`tabla · <hub>`), no la encuentra → `tabRoom` cuenta mal (un panel de más en la pestaña). P3 reemplaza el flujo de creación en hub, pero mientras tanto el desajuste existe.

### 6. NIT — en la tabla en vivo hub se pierde la columna RAMA

`renderWatch` (`team.mts:727-731`) sustituye RAMA por REPO. Con ramas distintas por repo (posible hasta que D10 se imponga en P3), la rama de cada fila es invisible y la cabecera se llena de un `join(", ")` de todas las distintas. El plan pide "columna REPO y base por fila"; encajaría REPO + RAMA, o al menos no fusionar ramas en la cabecera.

### 7. NIT — coste extra por tick en repos sin hub

Cada `teamRows` (cada 2 s en `--watch`) ejecuta `hubRoot` → 2 spawns de git extra (`--show-toplevel` + `--show-superproject-working-tree`) incluso en repos que nunca son hub. Mitigable cacheando por root en la sesión de watch.

## Lo que sí cuadra

- No regresión `--json` sin hub: verificado, claves idénticas (undefined omitidas).
- Cierre por sesión (`watchIdle` sobre filas de sesión) y etiqueta/reutilización `tabla · <hub>`: lógica correcta.
- Windows: `hubSession` construye con `join(..., ...path.split("/"))`, `herdrDir` con `sep`, `submodules` normaliza `\`; sin problemas nuevos apreciables.
- Docs y CHANGELOG actualizados conforme al contrato; render 20/35/50/80 probado.

## Veredicto

**Changes requested** — el punto 1 es bloqueante (regresión real de `prompt`/`clean` en hubs y diseño incompatible con la `sessionRows` de P3; fusionar tal cual rompe P3). Los puntos 2–4 deberían entrar en esta misma ronda.
