---
agent: "kevin"
kind: "pi"
branch: "plan/hub-guided-p8"
base: "plan/hub-session@aa7ead4"
orchestrator: "claude"
started_at: "2026-10-30T08:38:31Z"
finished_at: "2026-10-30T09:53:49Z"
status: "reported"
commits:
  - "5b55acc docs(hub): describe the guided hub flow in docs and team skills"
  - "6c569f2 fix(hub): initial commit, decision memory, --yes and prompt retry"
  - "6b8064d docs(decisions): record H4 stalled-prompt retry policy"
decisions:
  - "2026-10-30-h4-prompt-estancado-de-bond-team-se-reintenta-una-vez-y-luego-falla"
---

## Request

**2026-10-30T08:38:31Z**

Use the plan-execute skill to implement the documentation and skills part of P8 of docs/plans/2026-10-30-hub-guided.md (revision aa7ead4). P5-P7 are integrated in your base (hub.toml, bond hub init/add/sync/check, the registry, bond doctor). Update docs/puesto.md, docs/reference.md, docs/getting-started.md and their docs/en/ versions, catalog/skills/plan-team/SKILL.md and global/skills/bond-team/SKILL.md (skills in English except bond-team, which is in Spanish like its current text) to describe the real flow: bond hub init (submodule or symlink) -> bond hub check -> bond team <branch> (vertical, one agent per repo) -> prompt/collect --repo -> clean. Remove every mention of [hub] in bond.toml and of the old submodule detection. Read the real help (bin/bond hub --help, bin/bond hub init --help, bin/bond hub check --help, bin/bond team --help) instead of guessing. Run bin/bond sync so the generated copies match. Do NOT do the manual end-to-end test in Herdr: the orchestrator does it in parallel. Any manual run of bin/bond must use a temporary BOND_HOME (export BOND_HOME=$(mktemp -d)). Verify with npm run typecheck && bun test, bin/bond sync --check and (cd site && npm ci --ignore-scripts && npm run build). This is a linked worktree: treat the plan files as read-only. If verification passes, I explicitly authorize one commit with git-conventional-commit; no push, no PR. End with a report: what changed, checks and results, and the SHA.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report

Both commits created, tree clean. Final state verified.

## Informe de arreglos (H1, H2, H4, H5)

**Rama:** `plan/hub-guided-p8` · **Sin push, sin PR** · Árbol limpio.

### Qué cambió

| Bug | Arreglo | Ficheros |
|---|---|---|
| **H1** | `bond hub init` genera la config del hub (equiv. `bond sync`) y hace un **commit inicial** de sus ficheros cuando el repo no tiene ningún commit, para que `bond hub check` encuentre la base. En un hub preexistente con commits no commitea. `--dry-run` solo lo describe (sin `chdir` a un dir inexistente). | `cli/hub-init.mts` |
| **H2** | `bond hub check` acepta `--yes`/`-y`; con terminal y sin `--yes`, `--fix` pregunta antes de cada arreglo. | `cli/hub-check.mts` |
| **H4** | `bond team prompt` reintenta **una vez** un prompt que Herdr devuelve `agent_prompt_stalled` si el panel no muestra la tarea; si vuelve a estancarse sin señales, **falla con mensaje claro** (no solo avisa). Si el panel ya la muestra, se da por entregado y no reenvía. Aplica a hub y no-hub. | `cli/team.mts` |
| **H5** | `bond hub init` propone memoria de decisiones (activada por defecto con `--yes`): escribe `decision-record` + `[decisions]` en el `bond.toml` del hub, para que los runs caigan en el hub (D5). | `cli/hub-init.mts`, `cli/repo.mts` (`DECISIONS_SECTION` exportada) |

Docs y CHANGELOG actualizados: `docs/reference.md`, `docs/en/reference.md` (flags de `hub check`), `CHANGELOG.md` (`## Sin publicar`).

### Pruebas nuevas (una por bug)

- `test/hub-init.test.mts` → commit inicial + `[decisions]` + `hub check` sin fallo de base (H1, H5).
- `test/hub-check.test.mts` → `--yes`/`-y` aceptados (H2).
- `test/team-prompt-stall.test.mts` (nuevo, herdr simulado con secuencia de stall por env) → reintento llega, stalls repetidos fallan con mensaje claro, panel muestra → no reenvía (H4).

### Verificaciones

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | limpio |
| `bun test` | **418 pass / 0 fail** (413 + 5 nuevas) |
| `bin/bond sync --check` (BOND_HOME temporal) | `al día`, exit 0 |

### Commits

- `6c569f2` — `fix(hub): initial commit, decision memory, --yes and prompt retry` (10 ficheros, +333/−26)
- `6b8064d` — `docs(decisions): record H4 stalled-prompt retry policy` (registro de la decisión H4)

Nota: el criterio de aceptación de P8 (test manual end-to-end en Herdr) queda pendiente de la evidencia del orquestador, como se acordó.
