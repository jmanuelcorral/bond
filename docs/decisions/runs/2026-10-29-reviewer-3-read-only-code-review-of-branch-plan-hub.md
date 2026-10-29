---
agent: "reviewer-3"
kind: "claude"
branch: "plan/hub-session-p3"
base: "plan/hub-session@214a0c5"
orchestrator: "claude"
started_at: "2026-10-29T19:24:32Z"
finished_at: "2026-10-29T19:48:29Z"
status: "reported"
commits:
  - "e5d2147 feat(team): show a single session table in hub repos with submodules"
  - "20d3e4a fix(team): address review findings for hub session table"
  - "ce16fff docs(plan): record P2 progress and round 2 runs"
  - "6b17a3f feat(team): open a vertical branch across a hub's submodules"
  - "6a605d2 fix(team): address P3 review findings for hub teams"
decisions: []
---

## Request

Read-only code review of branch plan/hub-session-p3, which implements phase P3 of docs/plans/2026-10-29-hub-session.md. Read that plan (P3 section and the decisions it links), AGENTS.md and cli/hub.mts (P1, already integrated) first. Do not switch branches in this checkout: inspect with `git diff plan/hub-session...plan/hub-session-p3` and `git show plan/hub-session-p3:<file>`.

Note: another branch (plan/hub-session-p2) implements P2 in parallel and also edits cli/team.mts; flag anything in this branch that will clash semantically with P2's scope as described in the plan.

Look for: correctness bugs, regressions for repos without [hub] (behavior and --json must be identical), Windows path issues, missing tests for P3's acceptance criteria, and violations of the plan's decisions.

Constraints: do not edit, create or commit any file, and do not run commands that change the working tree. Report only actionable findings, each with file:line, severity (blocker / should-fix / nit), the concrete failing scenario and a suggested fix. End with a verdict: approve or changes requested.

## Report

# Segunda revisión P3 (`6b17a3f` + `6a605d2`, rebase sobre P1+P2)

Verificado en copia extraída: `bun test` completo **390 pass / 0 fail**; `team-hub.test.mts` 17 pass. El checkout no se ha tocado.

## Estado de los hallazgos anteriores

| # | Hallazgo | Estado |
|---|---|---|
| 1 | UTF-8 en `promptAgent` | **Arreglado** — `child.stdout/stderr.setEncoding("utf8")` (`cli/team.mts:1041-1042`) |
| 2 | Falsos positivos de D10 en `openVerticals` | **Arreglado** — excluye las bases de la sesión y el mensaje incluye repo y path del worktree detonante (`cli/team.mts:1672-1683`); test «un worktree suelto en una base de la sesión no es una rama vertical abierta» |
| 3 | `--delete-branch` y la rama del hub | **Arreglado** — `cleanHubBranches` (`cli/team.mts:1861-1890`): borra la rama del hub si está integrada en su base (o `--force`) y no le queda ningún worktree en **ningún** repo; si no, lo dice explícitamente. El «Las ramas se quedan» solo sale sin `--delete-branch`. Tests cubren integrado/no integrado y el caso `--repo` con worktree en el otro repo |
| 4 | Faltaba test del fallback D5 | **Cubierto** — «sin [decisions] en el hub, los runs van a la memoria del submódulo (D5)», además de `collect --agent` y base inválida del hub |
| 5 | `hubOf` silenciaba `[hub]` roto | **Arreglado** — avisa `«…: sigo sin el modo hub»` (`cli/team.mts:1644-1648`) con test del bond.toml no-TOML |
| 6 | Base del hub sin validar en `createInHub` | **Arreglado** — `noBase` incluye `s.repos[0]` (`cli/team.mts:1700-1701`) con test |
| 7 | `collect --agent` sin agente en la fila | **Arreglado** — fallback a filas sin agente + lookup en `agents(5000)` para el kind (`cli/team.mts:1829-1836`), igual que fuera del hub |

## Integración con P2

Correcta y coherente: P3 usa `sessionRows(root)` de P2 (`Row.repo`/`Row.base`) en lugar de su wrapper propio; `openWatch(s.root, anchor)` resuelve por sí solo el hub (etiqueta `tabla · <hub>`, `--base` descartada en modo hub); `callerTab(s.root, …)` calcula el hueco con `basename(hub)` que coincide con la etiqueta; `closeIdleTable(s.root, …)` en hub recomputa `sessionRows(hub)` (el filtro que le pasa P3 queda redundante pero es inocuo — el recuento refleja el estado real de disco tras la limpieza). `teamRows` sigue por repo y `status`/`--json` no se tocan en esta rama. Repo sin `[hub]`: sin cambios funcionales (el único delta es el aviso extra por bond.toml roto en prompt/collect/clean, stderr únicamente — aceptable y deseable).

## Hallazgos restantes

**1. `cli/team.mts:1686,1689` — nit — ambigüedad `repo` nombre/ruta y cast ciego.**
P2 marca las filas del hub con `repo = session.name` y las de submódulos con `repo = path`. Si un submódulo tiene por ruta el mismo nombre que el basename del hub (p. ej. hub `hub` con submódulo en `hub/`), las filas propias del hub casan en `subRows` (`r.path === row.repo`) y se tratarían como filas de ese submódulo: `clean` intentaría quitar worktrees del hub como si fueran del submódulo y `hubRunCtx` los atribuiría mal. Además `repoOfRow` los fuerza con `as HubRepo`, que ocultaría un undefined si se le escapa una fila del hub. Escenario rebuscado, pero el arreglo es barato: que `sessionRows` de P2 marque la fila del hub con `repo = "."` (o que `subRows` excluya explícitamente `row.repo === s.name`), y un `?? die(...)` en `repoOfRow` en vez del cast.

Nada más accionable: el `gone` de `cleanHubBranches:1868` es invariante del bucle (trivial), y el «rama borrada» en dry-run sigue el mismo patrón cosmético que el `removeWorktrees` no-hub, así que no lo cuento.

## Veredicto

**Approve** — los siete hallazgos anteriores están arreglados con tests que los cubren, la integración con P2 es coherente y no hay regresiones (390/0). El nit 1 se puede pulir al tocar la zona de nuevo.
