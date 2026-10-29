---
agent: "reviewer-3"
kind: "claude"
branch: "plan/hub-session-p3"
base: "plan/hub-session@214a0c5"
orchestrator: "claude"
started_at: "2026-10-29T19:24:32Z"
finished_at: "2026-10-29T19:24:32Z"
status: "reported"
commits:
  - "ba903ef feat(team): open a vertical branch across a hub's submodules"
decisions: []
---

## Request

Read-only code review of branch plan/hub-session-p3, which implements phase P3 of docs/plans/2026-10-29-hub-session.md. Read that plan (P3 section and the decisions it links), AGENTS.md and cli/hub.mts (P1, already integrated) first. Do not switch branches in this checkout: inspect with `git diff plan/hub-session...plan/hub-session-p3` and `git show plan/hub-session-p3:<file>`.

Note: another branch (plan/hub-session-p2) implements P2 in parallel and also edits cli/team.mts; flag anything in this branch that will clash semantically with P2's scope as described in the plan.

Look for: correctness bugs, regressions for repos without [hub] (behavior and --json must be identical), Windows path issues, missing tests for P3's acceptance criteria, and violations of the plan's decisions.

Constraints: do not edit, create or commit any file, and do not run commands that change the working tree. Report only actionable findings, each with file:line, severity (blocker / should-fix / nit), the concrete failing scenario and a suggested fix. End with a verdict: approve or changes requested.

## Report

# Revisión P3 (`plan/hub-session-p3`, commit `ba903ef`)

Estado del branch: `bun test` completo (375 pass) y `test/team-hub.test.mts` (10 pass) verificados en una copia extraída; el checkout no se ha tocado.

## Hallazgos

**1. `cli/team.mts:934-938` — should-fix — UTF-8 roto en `promptAgent`.**
El cambio `spawnSync(..., { encoding: "utf8" })` → `spawn` sin `setEncoding` acumula Buffers con `out += d`; un carácter multi-byte partido entre dos lecturas se corrompe a U+FFFD y `JSON.parse` falla. Escenario: `bond team prompt fix/x "tarea"` (ruta no-hub incluida) cuando Herdr responde con acentos/ñ/`·` (mensajes en español, `agent_status`) justo en un corte de chunk → la salida se toma como "no JSON" y un prompt correcto se reporta con el texto crudo o se pierde el estado con `--wait`. Es una regresión respecto al comportamiento previo. Fix: `child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");` tras el spawn.

**2. `cli/team.mts:1551-1556` (`openVerticals`) — should-fix — falsos positivos de D10.**
Cualquier worktree enlazado de un submódulo cuyo nombre de rama exista en el hub cuenta como "vertical abierta". Escenario: queda un worktree en `front` de una rama que también existe en el hub (p. ej. `release/1.0`, o una feature que se fusionó en el hub y se dejó el worktree) → `bond team fix/x` desde el hub muere con «ya tiene abierta la rama vertical release/1.0» sin haber ninguna vertical abierta, y el mensaje no dice qué worktree lo provoca. (El caso `bond team main` dentro del submódulo lo frena git porque `main` está ocupada por el checkout principal, así que el caso real es el worktree residual.) Fix: excluir de la detección las bases de la sesión (`hub.base` y `repo.base` de cada repo) e incluir en el mensaje la ruta del worktree que detona la detección.

**3. `cli/team.mts:1713-1733` (`cleanInHub`) — should-fix — `--delete-branch` no cubre la rama del hub y el mensaje miente.**
Con `--delete-branch`, `removeWorktrees` borra las ramas integradas de los submódulos pero la rama vertical del hub nunca se toca, y en la línea 1732 se imprime igualmente «Las ramas se quedan, en <hub> y en cada repo» aunque se hayan borrado ramas. Inconsistente con el `--delete-branch` no-hub. Fix: con `--delete-branch`, borrar también la rama del hub si está integrada (o al menos imprimir explícitamente «rama del hub conservada» y ajustar el mensaje condicional).

**4. `test/team-hub.test.mts` — should-fix (hueco de pruebas) — fallback de D5 sin cubrir.**
El fixture `HUB_TOML` siempre incluye `[decisions]` en el hub; la rama de `hubRunCtx` (líneas 1640-1657) donde el hub **no** tiene `[decisions]` y los runs deben ir al submódulo no se ejercita nunca, ni tampoco `collect --agent` en hub ni `--delete-branch` en hub. Los criterios de aceptación del plan sí están cubiertos (creación, prompt con nota mutua, D10, clean, runs en el hub, submódulo aislado). Fix: añadir un caso con hub sin `[decisions]` que verifique que el run cae en `docs/decisions/runs/` del submódulo.

**5. `cli/team.mts:1527` (`hubOf`) — nit — error de `[hub]` silenciado.**
`catchDie(() => hubSession(root)).value` traga el parseo inválido sin aviso: un repo con `[hub]` roto se comporta silenciosamente como no-hub, cuando la mitigación de P1 decía «se ignora con un aviso». Un `warn` una vez por comando bastaría.

**6. `cli/team.mts:1597` (`createInHub`) — nit — base del hub sin validar.**
Se comprueba `noBase` en los submódulos pero no la base del hub antes de `git branch <rama> <base>`; con base inválida sale el error crudo de git en vez del mensaje «cámbiala con bond hub --base» que se da para los demás.

**7. `cli/team.mts:1700-1708` (`collectInHub`) — nit — pérdida del flujo `--agent` sin agente en la fila.**
El collect no-hub permite `--agent <nombre>` aunque la fila no tenga agente (busca el kind en `agents(5000)`); en hub se muere con «no tiene agente en <repo>». Paridad incompleta del workflow documentado.

## Choques semánticos con P2 (ambos tocan `cli/team.mts`)

- **Doble representación de la agrupación por repo**: P3 introduce el wrapper `{ repo, row }` (`sessionRows`, línea 1559) mientras el plan de P2 pone el campo `repo` **en** `Row` (también en `--json`). Al fusionar quedan dos mecanismos; prompt/collect/clean de P3 deberían pasar a `row.repo`. Hay que elegir uno al integrar.
- **`closeIdleTable`**: `cleanInHub` (línea 1733) llama `closeIdleTable(s.root, filas-de-todos-los-repos)` con la firma P1 `(root, left)`. P2 va a reimplementar el cierre «por sesión»; si cambia la firma o resuelve la sesión desde el root, esta llamada queda rota o filtra doble. Coordinar firma antes de fusionar ninguna de las dos.
- **`openWatch`/`watchLabel`**: `createInHub` llama `openWatch(s.root, anchor)` y el test de P3 exige la etiqueta exacta `"tabla · hub"`; P2 añade la rama vertical a la cabecera y reutilización desde submódulos, lo que romperá ese test y posiblemente la firma. Idem `watchCommand`/`watchIdle`.
- **Textos compartidos** (`TEAM_HELP`, `CHANGELOG` «Sin publicar», `docs/reference.md`, `docs/puesto.md`): conflicto de merge trivial pero en las mismas líneas.

Recomendación: fijar primero las firmas de los helpers de sesión (`Row.repo`, `closeIdleTable`, `openWatch`) y rebasear P3 sobre P2 (o viceversa) adaptando `sessionRows` y las llamadas de `createInHub`/`cleanInHub`; no integrar las dos en paralelo sin esa conversación.

## Veredicto

**Changes requested** — por 1 (regresión de codificación en la ruta no-hub), 2 (bloqueo falso de D10), 3 (`--delete-branch` inconsistente en hub) y 4 (hueco de prueba del fallback D5). Los nits y la coordinación con P2 pueden resolverse en la integración.
