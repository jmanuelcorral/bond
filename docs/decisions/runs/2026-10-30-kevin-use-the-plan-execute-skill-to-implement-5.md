---
agent: "kevin"
kind: "pi"
branch: "plan/hub-ops-p10"
base: "plan/hub-session@337df84"
orchestrator: "claude"
started_at: "2026-10-30T13:02:19Z"
finished_at: "2026-10-30T13:51:54Z"
status: "reported"
commits:
  - "9fb0a0d feat(hub): describe session repos and generate the hub block in AGENTS.md"
  - "2ea07c7 fix(hub): keep existing repo config on re-add and keep the hub block when hub.toml is invalid"
decisions: []
---

## Request

**2026-10-30T13:02:19Z**

Use the plan-execute skill to implement only P10 of docs/plans/2026-10-30-hub-ops.md (revision 337df84). This is a linked worktree: treat the plan file as read-only and report progress in your answer. If all of the phase's verification passes, I explicitly authorize one commit on this branch with the git-conventional-commit skill, using the message you would recommend; do not push, open a PR or start another phase. If verification fails or is blocked, do not commit. End with a report: what changed, checks run and their results, acceptance criteria met, risks, and the commit SHA or why there is none.
Constraints: any manual run of bin/bond hub must use `export BOND_HOME=$(mktemp -d)` first (never touch the real ~/.bond). In tests, write every path inside TOML with JSON.stringify (Windows backslashes) and use setDefaultTimeout(30_000) in files that build hubs. CLI messages, comments and docs in Spanish; commits in English.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report

## Informe de revisión P10 — cambios pedidos por agy

**Commit:** `2ea07c7` — `fix(hub): keep existing repo config on re-add and keep the hub block when hub.toml is invalid` (sobre `9fb0a0d`, rama `plan/hub-ops-p10`). Árbol limpio. Sin push, sin PR.

### 1. Bloqueante — `hub add` sobre repo existente (`cli/hub-init.mts:936-961`)

Antes: con config coincidente pero `description` existente y `--description` ausente, caía al reconstruido de la entrada → perdía `description` y `agent`, recalculaba `base` contra la rama actual del clon (y para symlink hacía `resolve`/`git remote` de nuevo). Ahora: mismo repo = no-op con `ya existe`; con `--description` distinto se actualiza **solo** `existing.description`, se guarda `hub.toml` (`act`, respeta `--dry-run`), se refresca el bloque con `syncHubAgentsBlock(root)` y se vuelve — `agent`, `base` y todo lo demás intactos, sin `resolve` ni sondeo de red en la rama de existente.

Cubierto por:
- `test/hub-init.test.mts:411` — re-add sin `--description`: `hub.toml` byte a byte idéntico (`base "develop"`, `agent "pi"`, `description`), stdout `ya existe`, `sync --check` 0.
- `test/hub-init.test.mts:428` — `--description` nuevo: solo cambia la descripción (el `viejo` desaparece del TOML y del bloque), `base`/`agent` conservados, bloque refrescado, `--check` 0.

### 2. Cambio — bloque vaciado con `hub.toml` inválido (`cli/repo.mts:839-845`)

El bucle de poda de `diffActions` vaciaba `AGENTS.md` (body `""`) cuando `plan()` no emitía el bloque por TOML inválido, contradiciendo el comentario. Añadido: `if (style === "hub" && existsSync(join(root, "hub.toml"))) continue;` — el bloque `bond:hub` gestionado se conserva tal cual (también el manifiesto lo sigue incluyendo); comentario de `plan()` (`cli/repo.mts:668-673`) actualizado para apuntar a la poda.

Cubierto por: `test/hub-init.test.mts:446` — init OK → `hub.toml` inservible → `bond sync` sale 0 con el aviso `no se actualiza`, `AGENTS.md` idéntico byte a byte, `--check` 0.

### 3. Cambio — test del bloque obsoleto (`test/hub-init.test.mts:386-410`)

Antes sobrescribía `AGENTS.md` (quitando el bloque) y renombraba la clave a `[repos.front]`, así que `--check` fallaba por otros motivos. Ahora: el texto a mano se **antepone** al `AGENTS.md` existente y en `hub.toml` solo se inserta la línea `description` bajo `[repos.front-real]` (se comprueba antes y después que la clave no se renombró). `--check` falla con `AGENTS.md` nombrado en la salida (bloque obsoleto), `sync` lo actualiza, el preámbulo manual se conserva, y se re-verifica idempotencia.

### 4. Nit — `HUB_HELP` (`cli/hub.mts:18-29`)

`add` menciona `--description` y la línea final describe lo que enseña `bond hub` (incluida la descripción de cada repo si se declaró) y el bloque generado en `AGENTS.md` con `docs/plans/` y `docs/decisions/`, en la línea de `docs/reference.md`.

### Comprobaciones

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | OK |
| `bun test` (completa, 21 ficheros) | **438 pass, 0 fail** (1745 expect) |
| `export BOND_HOME=$(mktemp -d) && bin/bond sync --check` (en el repo) | `al día`, exit 0 |

Restricciones respetadas: `BOND_HOME` temporal en la ejecución manual; `JSON.stringify` para rutas en TOML de prueba (sin rutas nuevas en los tests añadidos); mensajes/docs en español, commit en inglés; plan sin tocar; nada que commitear en `docs/decisions/` (D18 ya estaba en `51e72bf`).
