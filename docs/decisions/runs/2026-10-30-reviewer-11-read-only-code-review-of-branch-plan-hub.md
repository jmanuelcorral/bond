---
agent: "reviewer-11"
kind: "pi"
branch: "plan/hub-session"
base: "plan/hub-session@337df84"
orchestrator: "claude"
started_at: "2026-10-30T13:38:37Z"
finished_at: "2026-10-30T13:38:37Z"
status: "reported"
commits: []
decisions: []
---

## Request

Read-only code review of branch plan/hub-ops-p11 against plan/hub-session in the repo at /home/jose/gitrepos/bond (do not check out branches: use `git diff plan/hub-session...plan/hub-ops-p11` and `git show plan/hub-ops-p11:<file>`). It implements P11 of docs/plans/2026-10-30-hub-ops.md: read that phase's acceptance criteria and the decisions it links. Report only actionable findings: bugs, unmet acceptance criteria, Windows path issues (CI runs on Windows), tests that do not test what they claim, and docs/help out of sync with behavior. For each one give file:line, the concrete failure and a suggested fix; mark it blocker, change or nit. Do not edit files, commit or run bin/bond hub without `export BOND_HOME=$(mktemp -d)` first. End with a verdict: approve or request changes.

## Report

# Revisión P11 (`plan/hub-ops-p11` vs `plan/hub-session`)

Contexto verificado: plan P11 + decisiones enlazadas (fast-forward only `2026-10-30-bond-hub-pull-solo-avanza-la-base-en-fast-forward`, patrón `warn:true`/`warnings` de kevin, aviso sin cambiar exit code). En el worktree: `npm run typecheck` limpio, `bun test` 439/0 (con `BOND_HOME` temporal).

## Hallazgos

### 1. Bloqueante — aviso de "base atrasada" que `hub pull` no puede limpiar en submódulos detached
- `cli/hub-check.mts:78` (`baseBehindCheck`) + `cli/hub-pull.mts:69-72` (salto por `HEAD separado`).
- Estado normal de un submódulo (tras `git clone` + `git submodule update`, que es lo que deja `bond hub sync`): HEAD separado. Reproducido con `BOND_HOME` temporal: `check` avisa `base atrasada 1 commit(s) por detrás de origin/main → bond hub pull`, y `bond hub pull` responde `saltado: HEAD separado (no en su base "main")`. Tras el pull, **el aviso sigue**: el bucle prometido por el AC ("deja de avisar después del pull") se rompe en la configuración submódulo, que es la más común del hub.
- Fix sugerido: en `pullRepo`, cuando la base no está checkout en ningún worktree (típico: submódulo detached) y el desfase es puro behind (`ahead === 0`), avanzar la ref sin tocar el worktree: `git fetch <remote> +refs/heads/<base>:refs/heads/<base>`, reportándolo como `updated`. Alternativa mínima: que `baseBehindCheck` no proponga `bond hub pull` en ese caso, pero eso dejaría la base del submódulo atrasada para `bond team`, que es justo el problema que P11 quiere resolver (decisión: "si el clon está atrasado, los agentes trabajan sobre código viejo").

### 2. Change — el test de `--dry-run` no prueba que no se haga fetch
- `test/hub-pull.test.mts:157-176` ("--dry-run no toca nada").
- El test hace `git fetch` manual **antes** del `--dry-run` y solo comprueba que HEAD no se movió. Si la implementación hiciera fetch en dry-run (contradiciendo `cli/hub-pull.mts:19` y el AC), el test pasaría igual.
- Fix sugerido: capturar `g(subReal, "rev-parse", "origin/main")` antes y después del `--dry-run` y exigir igualdad (el fetch previo deja la tracking ref; el dry-run no debe cambiarla).

### 3. Nit — docs omiten el estado `failed` del `--json`
- `docs/reference.md:909` y `docs/en/reference.md:930`: listan `updated`, `up_to_date`, `skipped`, pero `PullStatus` incluye `failed` (`cli/hub-pull.mts:31`), que además pone el exit code a 1. Añadirlo en ambos idiomas.

### 4. Nit — aserción débil en el test del aviso
- `test/hub-check.test.mts:227`: `expect(rep.warnings).toBeGreaterThan(0)` es trivialmente cierta por los 2 avisos de `ruta` del fixture, con o sin el aviso de base. La aserción específica de abajo la cubre, pero esta no aporta nada; mejor `expect(rep.warnings).toBe(3)` o contar los de `back`.

### 5. Nit — `label` duplicada
- `cli/hub-check.mts:75` y `cli/hub-pull.mts:51`: misma función copiada; exportarla desde `hub.mts` (donde vive `HubRepo.name`).

### 6. Nit — resumen verde con fallos
- `cli/hub-pull.mts:199`: con repos `failed` la línea final sale en verde (`ok("bases revisadas")`) aunque el proceso salga con 1. Cosmético; usar `bad()` cuando `failed > 0`.

## Verificado sin problemas
- AC cubiertos y probados: ff con remoto por delante (hub + repo), saltos con motivo (cambios, otra rama, HEAD separado, divergido, sin remoto, sin upstream) sin merge/rebase/push, `--dry-run`, `--json` por repo, aviso de `check` antes/después sin cambiar exit code, patrón `warn:true` + `warnings` (decisión de kevin) respetado.
- Windows: rutas guardadas con `/`, `rev-list` split por `\s+` (tab OK), tests con junction en win32, sin `.cmd`/`.exe` nuevos; sin problemas aparentes.
- Ayuda (`HUB_HELP`, `HUB_PULL_HELP`), `docs/` (fuente del site vía `site/prepare.mjs`) y CHANGELOG en sync, salvo el nit 3.

## Veredicto

**Request changes** — el hallazgo 1 rompe el bucle `check → pull → sin aviso` en submódulos detached (estado por defecto); los nits 2-6 son menores pero el 2 debería corregirse junto con el 1.
