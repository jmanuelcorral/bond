---
agent: "stuart"
kind: "pi"
branch: "plan/hub-guided-p7"
base: "plan/hub-session@03d9d20"
orchestrator: "claude"
started_at: "2026-10-30T07:40:31Z"
finished_at: "2026-10-30T08:05:14Z"
status: "reported"
commits:
  - "aa096d6 feat(hub): add bond hub check with --fix and --json"
decisions:
  - "2026-10-30-en-bond-hub-check-rama-vertical-a-medias-son-worktrees-de-ramas-que-no-existen-en-el-hub-o-mas-de-una-vertical-abierta"
---

## Request

**2026-10-30T07:40:31Z**

Use the plan-execute skill to implement only P7 of docs/plans/2026-10-30-hub-guided.md (revision 03d9d20). P5 (hub.toml, hub.local.toml, the ~/.bond/hubs.toml registry, hubSession/hubRoot in cli/hub.mts) is already integrated in your base; read both hub plans and their decisions first. Another agent implements P6 (bond hub init/add/sync, in cli/hub-init.mts) in parallel on another branch: put your new code in its own module, cli/hub-check.mts (check, --fix, --json), and keep edits to shared files (cli/hub.mts dispatcher and help, cli/main.mts, cli/doctor.mts, docs/reference.md, CHANGELOG.md) small and localized to ease integration. Tests must never touch the real ~/.bond (use a temporary BOND_HOME, as test/hub.test.mts does). This is a linked worktree: treat the plan files as read-only and report progress in your answer. If all of the phase's verification passes, I explicitly authorize one commit on this branch with the git-conventional-commit skill, using the message you would recommend; do not push, open a PR or start another phase. If verification fails or is blocked, do not commit. End with a report: what changed, checks run and their results, acceptance criteria met, risks, and the commit SHA or why there is none.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report

## Informe P7 — `bond hub check` (plan `2026-10-30-hub-guided`, base `03d9d20`)

**Qué cambió** (commit `aa096d6` en `plan/hub-guided-p7`, 8 ficheros, +590/−3):

- `cli/hub-check.mts` (nuevo, módulo propio para no chocar con P6): `checkHubSession` con 9 comprobaciones por repo (`existe`, `enlace`, `base`, `bond init`, `config` vía `bond sync --check`, `agentes`, `worktrees`, `cambios`, `rama vertical`), `--fix` (solo enlaces y `submodule update --init`, con fallback a junction en Windows D15), `--json` (informe sin `fixFn`), `--dry-run` respetado. El re-check tras `--fix` usa una sesión fresca.
- `cli/hub.mts`: despacho `bond hub check` + ayuda (7 líneas). `cli/main.mts`: 1 línea de ayuda global. `cli/doctor.mts`: `checkHubRow()` (una fila resumen dentro de un hub) + ayuda.
- `docs/reference.md`: sección `bond hub check`. `CHANGELOG.md`: dos entradas en `## Sin publicar`.
- `test/hub-check.test.mts`: 14 pruebas con `BOND_HOME` temporal (nunca tocan el `~/.bond` real).
- Decisión registrada (proposed): semántica de "rama vertical a medias" — worktrees de ramas que no existen en el hub, o más de una abierta; los subconjuntos `--repos` son legítimos. Commiteada en `docs/decisions/` con la rama, como pediste.

**Comprobaciones ejecutadas**

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | pasa |
| `bun test` (suite completa) | 400 pass / 0 fail (386 previas + 14 nuevas) |
| Manual `bin/bond hub check` en hub de prueba (`file://` + symlink) | sano→0; symlink roto→1 nombra repo y arreglo; `--fix` recrea el enlace→0; `--json` estructura correcta; ayuda OK |
| Prueba manual del plan "en el hub de P6" | **no ejecutable**: P6 no está en mi base (rama paralela); sustituido por el hub de prueba anterior |

**Criterios de aceptación**: verde+exit 0 y problema por repo con arreglo+exit 1 ✔; fixture roto por cada comprobación (symlink roto, base inexistente, sin `bond init`, agente no instalado vía `hasAgent` inyectable, cambios sin commitear, vertical a medias) ✔; `--fix` arregla symlink y submódulo sin iniciar y nunca descarta cambios ni cambia de rama (probado explícitamente) ✔; `bond doctor` fuera de un hub no cambia ✔.

**Riesgos**: el fixture de Windows (junction fallback) no se ha podido probar en esta máquina — lo cubrirá el CI al pasar la suite; `config` por repo usa un `chdir` temporal (single-thread, restaurado en `finally`); la decisión sobre "vertical a medias" queda *proposed* hasta que la aceptes (`/accept`).

**Siguiente paso**: revisión de esta evidencia y de la decisión registrada; P6 sigue en su rama en paralelo — nada que integrar desde aquí sin tu revisión.
