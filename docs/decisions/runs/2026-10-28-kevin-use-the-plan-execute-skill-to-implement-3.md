---
agent: "kevin"
kind: "claude"
branch: "plan/agy-support-p2"
base: "main@4293bca"
orchestrator: "claude"
started_at: "2026-10-28T15:26:58Z"
finished_at: "2026-10-28T15:34:54Z"
status: "reported"
commits:
  - "f1b6c01 feat(setup): add a global bond plugin for Antigravity (agy)"
decisions:
  - "2026-10-28-plugin-global-de-agy-con-el-nombre-bond-global"
---

## Request

**2026-10-28T15:26:58Z**

Use the plan-execute skill to implement only P2 of docs/plans/2026-10-28-agy-support.md (revision 4293bca). This is a linked worktree: treat the plan file as read-only and report progress in your answer. Another agent implements P3 in parallel on another branch: stay within P2's affected contracts. Antigravity's CLI is at ~/.local/bin/agy (not on the PATH of non-interactive shells; call it by full path); its bundled docs are in ~/.gemini/antigravity-cli/builtin/skills/agy-customizations/docs/. Run real agy checks only in temporary repos and with a temporary HOME or config dir when they write global files; do not modify the real ~/.gemini/config/ or ~/.claude/. Record any non-trivial decision you take on your own with bond decisions add (it stays proposed) and commit it on this branch. When testing commands that read stdin from a child process, never use execFile with 'input'; always set a timeout. If all of the phase's verification passes, I explicitly authorize one commit on this branch with the git-conventional-commit skill, using the message you would recommend; do not push, open a PR or start another phase. If verification fails or is blocked, do not commit. End with a report: what changed, checks run and their results, acceptance criteria met, risks, and the commit SHA or why there is none.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report

## P2 hecha: commit `f1b6c01` en `plan/agy-support-p2`

Con `agy` entre los agentes, `bond setup` deja ya un plugin global de bond que `agy` carga en cualquier repo, incluso en uno que tiene su propio plugin de bond. La prueba real lo confirma y todas las comprobaciones pasan. No he empujado, ni abierto PR, ni tocado el plan ni `docs/decisions/runs/`.

### Un hallazgo que cambia un detalle de A3
La carpeta sigue siendo `~/.gemini/config/plugins/bond/`, como dice A3, pero el manifiesto se llama `bond-global` y no `bond`. Con el mismo nombre, en un repo con el plugin de P1 (`.agents/plugins/bond`), `agy` solo cargaba el del repo y se perdían las reglas y las skills globales. Probé las dos variantes: lo que choca es el `name` de `plugin.json`, no el nombre de la carpeta. Lo registré como decisión `2026-10-28-plugin-global-de-agy-con-el-nombre-bond-global`, que está `proposed` y va en el commit. Si te parece bien: `bond decisions accept 2026-10-28-plugin-global-de-agy-con-el-nombre-bond-global`.

### Qué cambia
- **`bond setup`** (`cli/setup.mts`): escribe `plugin.json` y enlaza en `skills/` las skills `bond-delegate`, `bond-team` y la de Herdr que ya haya en la máquina (en Windows, las copia). `globalSkillTargets` añade las skills del plugin cuando existe, así que `bond update` también las actualiza.
- **Reglas** (`cli/catalog-agents.mts`): `agy` tiene ya su fichero de instrucciones, `rules/AGENTS.md` del plugin, y `propagate` escribe ahí tus instrucciones más `BOND_RULES`.
- **`bond doctor`**: nueva fila «plugin agy», solo si `agy` es uno de tus agentes. Comprueba el manifiesto, que las reglas estén al día con `~/.bond/AGENTS.md` y que las skills estén enlazadas.
- **Documentación**: ayuda de `bond setup`, `docs/reference.md` y `docs/en/reference.md` (setup, tabla de doctor, skills globales, desinstalar) y `## Sin publicar`.
- **Pruebas**: `test/setup-agy.test.mts`, nueva, corre en un proceso con HOME temporal; casos nuevos en `test/doctor.test.mts`.

### Comprobaciones
| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | sin errores |
| `bun test` | 322/322 |
| `bin/bond sync --check` | al día |
| `agy -p` en un repo git cualquiera (HOME temporal) | cita la palabra clave de tus instrucciones y `## Bond: Herdr y otros agentes`; lista `bond-delegate`, `bond-team` y `herdr` |
| `agy -p` en un repo con `bond init --agents agy` | ve las reglas globales, las skills globales, `/commit`, `/review`… y los MCP `bond_context7` y `bond_duckduckgo` |
| `bond doctor --quick` con HOME temporal | ✓ con el plugin al día; ✗ con «→ bond setup» tras cambiar tus instrucciones y quitar un enlace |
| `~/.gemini/config/` real | sin tocar |

En las pruebas con HOME temporal, solo enlacé el estado de `agy` (`~/.gemini/antigravity-cli`) para que tuviera la sesión iniciada; `config/` era nueva.

### Criterios de aceptación
- **Se crea el plugin con `plugin.json`, `rules/AGENTS.md` y `skills/`:** se cumple. En Windows las skills se copian; eso solo lo cubre la CI.
- **Repetirlo no duplica nada y no toca el resto de `~/.gemini/config/`:** se cumple; las pruebas comparan el árbol antes y después.
- **Sin `agy` entre los agentes no se crea nada:** se cumple.
- **`bond doctor` dice si el plugin está al día:** se cumple.
- **Prueba real con `agy -p`:** se cumple.

### Riesgos
- La activación de plugins en el `config.json` de `agy` va por nombre de carpeta, y las dos carpetas se llaman `bond`: desactivar una podría desactivar las dos. No lo he probado.
- Si quitas `agy` de tus agentes, el plugin global se queda, como los bloques de instrucciones de los demás agentes. Se quita con `rm -r ~/.gemini/config/plugins/bond`, documentado en «Desinstalar».
- `bond decisions check` falla por dos trailers `Decision:` que apuntan a decisiones de P3 que no existen en esta rama (las de confianza del worktree y de la integración de Herdr para `agy`). Mis dos trailers sí apuntan a ficheros que existen.

**Siguiente paso recomendado:** revisa el commit y la decisión `bond-global` antes de integrar P2 con P3, sobre todo porque se aparta del nombre que preveía A3. Respuesta corta: «acepto la decisión bond-global e integra P2», o «para».
