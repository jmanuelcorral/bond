---
name: "2026-10-28-agy-support"
description: "bond integra Antigravity (agy) como agente: configuración del repo, global, Herdr y memoria de decisiones"
created_at: "2026-10-28T14:56:32Z"
last_implementation_at: "2026-10-28T15:26:29Z"
has_completed_all_phases: false
---

# Soporte de Antigravity (`agy`) en bond

## Source and revision

- Plan identifier: `bond/agy-support/2026-10-28`.
- Source: petición del usuario en sesión («ahora tenemos antigravity instalado. ¿Puedes revisar si
  lo soportamos? haz un plan de pruebas» y «haz el plan de soporte de agy»), a partir del plan de
  pruebas A–E presentado en la conversación.
- Reviewed revision: `d2893a9` (main, bond 1.8.0).
- Reference repository and branch: `bond`, `main`.
- Design baseline: `cli/repo.mts` (`SUPPORTED_AGENTS`, `plan()`, `bondToml()`),
  `cli/catalog-agents.mts`, `cli/setup.mts` (`globalSkills`, `globalSkillTargets`, `herdrSkill`),
  `cli/instructions.mts` (`propagate`), `cli/doctor.mts`, `cli/team.mts` (`bond team`, confianza,
  `collect`), `cli/decisions.mts` (`resolveAuthor`); documentación incluida en `agy` 1.4.9
  (`~/.gemini/antigravity-cli/builtin/skills/agy-customizations/docs/*.md`).
- Approval: aprobado por el usuario en sesión el 2026-10-28 («aprueba y guarda»): contenido y
  destino de este plan, con A1–A4 tal como se proponen.

## Goal

Con `agy` entre los agentes de un repo, `bond init`/`sync` le dan lo mismo que a los demás
(instrucciones, skills, servidores MCP y comandos del catálogo); `bond setup` le lleva las reglas
globales de bond y las skills globales; `bond doctor` informa de su estado; y `agy` trabaja en
`bond team`/`bond-delegate` con la memoria de decisiones como pi o Claude Code.

## Scope and exclusions

- Incluye: `agy` como agente soportado (id `agy`, el mismo que usa Herdr); plugin de bond en el
  repo para MCP y comandos; plugin global para reglas y skills globales; fila en `bond doctor`;
  `bond team` y `bond-delegate` con `agy` (confianza, prompt, espera, `collect`); autoría en la
  memoria de decisiones; documentación (es y en), ayuda y `## Sin publicar`.
- Se conserva: lo que ya funciona sin bond (`AGENTS.md` y `.agents/skills/`); el comportamiento
  de los demás agentes.
- Excluido: la app de escritorio de Antigravity y su IDE (solo el CLI `agy`); instalar `agy`
  desde bond (se enseña cómo); hooks de `agy`; una herramienta `record_decision` nativa para
  `agy` (usa `bond decisions add` por shell); el cuadro de permiso de D21 para `agy` si no tiene
  un sistema de permisos configurable desde el repo.

## Verified context

Comprobado el 2026-10-28 con `agy` 1.4.9 (en `~/.local/bin/agy`):

- `agy -p` en el repo de bond cargó `AGENTS.md` y las 10 skills de `.agents/skills/` sin que bond
  haga nada, y no vio servidores MCP ni comandos del repo.
- `agy` no lee MCP del repo directamente: solo `~/.gemini/config/mcp_config.json` (global) o el
  `mcp_config.json` de un plugin. Un plugin en el repo (`.agents/plugins/bond/plugin.json` +
  `mcp_config.json` + `skills/<nombre>/SKILL.md`) funcionó en un repo temporal: `agy` vio el
  servidor (`bond_context7`, con sus herramientas) y la skill del plugin como comando.
- Los comandos de `agy` son skills (`/nombre`); los workflows (`.agents/workflows/`) están
  obsoletos.
- Un plugin global en `~/.gemini/config/plugins/<nombre>/rules/AGENTS.md` se carga como regla
  global (probado con un marcador; el plugin de prueba se borró).
- `bond setup` deja las skills globales en `~/.agents/skills/` y `~/.claude/skills/`
  (`globalSkillTargets`); `agy` no las ve.
- Herdr acepta `agy` en `herdr agent start --kind`.
- La confianza de `agy` está en `~/.gemini/antigravity-cli/settings.json`
  (`trustedWorkspaces`). En modo `-p`, un repo no confiado funcionó sin preguntar; en el TUI no
  está comprobado.
- `~/.local/bin` no está en el PATH de las shells no interactivas de esta máquina
  (`command -v agy` falla), aunque `agy install` lo configura para la shell interactiva.
- Sin comprobar: si Herdr da `agent_session` para `agy` y su formato
  (`~/.gemini/antigravity-cli/conversations/`); el comando de instalación oficial de `agy`; las
  rutas en macOS y Windows.

## Decisions, dependencies, and risks

Aprobadas con el plan y aceptadas en la memoria de decisiones (usuario, 2026-10-28):

- **A1 — Identificador `agy`**: el mismo que el binario y que el tipo de Herdr; nombre visible
  «Antigravity». Registro: `docs/decisions/2026-10-28-antigravity-se-integra-en-bond-con-el-id-agy.md`.
- **A2 — Plugin de bond en el repo**: los servidores MCP y los comandos del catálogo llegan a
  `agy` en `.agents/plugins/bond/` (`plugin.json`, `mcp_config.json`, `skills/<comando>/SKILL.md`),
  generado por `bond sync` como el resto. No se meten los comandos en `.agents/skills/`, que
  comparten pi y los demás. `$ARGUMENTS` y `$1…` se traducen a una instrucción para usar el texto
  que siga al comando. Registro: `docs/decisions/2026-10-28-plugin-de-bond-en-el-repo-para-mcp-y-comandos-de-agy.md`.
- **A3 — Plugin global de bond**: `bond setup` deja en `~/.gemini/config/plugins/bond/` las
  reglas globales (`rules/AGENTS.md`: tus instrucciones de `~/.bond/AGENTS.md` + `BOND_RULES`) y
  las skills globales (`skills/bond-delegate`, `skills/bond-team`, `skills/herdr`), enlazadas como
  las demás. Todo lo de bond queda en esa carpeta; nada fuera se toca. Registro: `docs/decisions/2026-10-28-plugin-global-de-bond-para-agy.md`.
- **A4 — Confianza en equipos**: como con pi y Claude Code, un worktree de `bond team` hereda la
  confianza si el checkout principal está en `trustedWorkspaces` (`--no-trust` la desactiva). Registro: `docs/decisions/2026-10-28-confianza-heredada-para-agy-en-bond-team.md`.

Dependencias y riesgos:

- P2 no depende de P1 (zonas distintas: `cli/setup.mts`/`cli/instructions.mts` frente a
  `cli/repo.mts`), salvo `cli/catalog-agents.mts`, que P1 crea y P2 usa: P2 depende de P1.
- P3 depende de P1 (necesita `agy` en `bond.toml` para `bond team`).
- Riesgo: el formato de plugins de `agy` cambia entre versiones. Mitigación: `bond doctor`
  enseña la versión de `agy` y las pruebas fijan lo que se genera.
- Riesgo: nombres con espacio de nombres (`bond_context7`): las skills que nombran herramientas
  MCP por nombre pueden no casar en `agy`. Se revisa en P1.
- Riesgo: PATH. Si `agy` no está en el PATH de Herdr o de las shells no interactivas, `bond team`
  y `doctor` fallan; `doctor` lo detecta y propone `agy install`.
- Riesgo: Windows (`agy.exe`, rutas de `~/.gemini`) sin máquina para probar a mano: lo cubre la
  CI.

## Phases

### P1: `agy` como agente del repo (`bond init`/`sync`/`doctor`)

- Outcome: `bond init --agents agy` (o con otros) configura el repo para `agy`: instrucciones y
  skills (ya funcionan), servidores MCP y comandos del catálogo en el plugin de bond; `bond doctor`
  enseña `agy`.
- Owning repository: `bond`.
- Dependencies: ninguna.
- Affected contracts: `SUPPORTED_AGENTS` y `cli/catalog-agents.mts` (entrada `agy`: binario,
  instalación, web, instrucciones globales); `plan()` en `cli/repo.mts` (salidas para `agy`:
  `.agents/plugins/bond/plugin.json`, `mcp_config.json` con los MCP elegidos y los propios del
  repo, `skills/<comando>/SKILL.md` por cada comando del catálogo y propio); `bond doctor` (fila
  de `agy`: versión, PATH); ayuda de `bond init` y `bond.toml` (lista de agentes).
- Acceptance criteria:
  - `bond init --agents agy --yes` en un repo nuevo genera el plugin con los MCP y comandos por
    defecto; `bond sync --check` queda al día; un segundo `sync` no cambia nada.
  - Quitar `agy` de `agents` y pasar `sync` borra el plugin (como los ficheros de otros agentes)
    y no toca nada que no sea de bond.
  - Un servidor propio de `[mcp_servers]` (stdio o url) aparece en `mcp_config.json`; los
    `${VAR}` se pasan sin expandir, como para los demás agentes.
  - Cada comando del catálogo es una skill válida del plugin (frontmatter YAML válido) y el
    texto del usuario tras `/comando` sustituye a `$ARGUMENTS`.
  - `bond doctor` enseña `agy` con su versión; sin `agy` en el PATH, avisa con el arreglo.
  - Prueba real: `agy -p` en un repo con bond ve los MCP del plugin y los comandos
    (`/commit`, `/review`, `/handoff`, `/accept`).
- Actions:
  - [x] Entrada `agy` en `SUPPORTED_AGENTS` y `catalog-agents.mts`.
  - [x] Salidas del plugin en `plan()` y traducción de comandos a skills, con pruebas.
  - [x] Fila de `agy` en `bond doctor`, con prueba.
  - [x] Ayuda, `docs/reference.md`, `docs/en/reference.md` y `## Sin publicar`.
  - [x] Run applicable checks and record actual results.
  - [x] Present evidence and stop for review before another phase.
- Verification: `npm run typecheck && bun test`, `bin/bond sync --check`; a mano, repo temporal
  con `bin/bond init --agents agy --yes`, revisar `.agents/plugins/bond/` y preguntar a
  `agy -p` por sus MCP y comandos.
- Risks and recovery: generar ficheros nuevos solo cuando `agy` está entre los agentes; se
  revierte quitando `agy` y pasando `sync`.

### P2: `bond setup` para `agy` (reglas y skills globales)

- Outcome: tras `bond setup` con `agy`, `agy` carga en cualquier repo las reglas globales de bond
  y tus instrucciones personales, y las skills `bond-delegate`, `bond-team` y `herdr`.
- Owning repository: `bond`.
- Dependencies: P1 (entrada `agy` en `catalog-agents.mts`).
- Affected contracts: `cli/setup.mts` (`globalSkillTargets` o equivalente para `agy`;
  `herdrSkill`), `cli/instructions.mts` (`propagate` escribe `rules/AGENTS.md` del plugin global),
  `bond doctor` (estado del plugin global), desinstalación en `docs/reference.md`.
- Acceptance criteria:
  - `bond setup` con `agy` crea `~/.gemini/config/plugins/bond/` con `plugin.json`,
    `rules/AGENTS.md` (instrucciones personales + `BOND_RULES`) y `skills/` enlazadas (copiadas en
    Windows).
  - Repetirlo no duplica nada; no toca otros ficheros de `~/.gemini/config/`.
  - Sin `agy` entre los agentes de `bond setup`, no se crea nada.
  - `bond doctor` dice si el plugin global está al día.
  - Prueba real: `agy -p` en un repo cualquiera cita una regla de `BOND_RULES` y lista
    `bond-delegate` y `bond-team`.
- Actions:
  - [ ] Plugin global en `bond setup` y en `propagate`, con pruebas.
  - [ ] Fila o detalle en `bond doctor`, con prueba.
  - [ ] `docs/reference.md` (setup, instrucciones globales, desinstalar), `docs/en/reference.md`
        y `## Sin publicar`.
  - [ ] Run applicable checks and record actual results.
  - [ ] Present evidence and stop for review before another phase.
- Verification: `npm run typecheck && bun test`; a mano, `bin/bond setup` con `agy` y
  `agy -p` como en el criterio; revisar que `~/.gemini/config/` solo cambia en `plugins/bond/`.
- Risks and recovery: todo queda en una carpeta propia; se quita borrándola.

### P3: `agy` en equipos, delegaciones y memoria de decisiones

- Outcome: `bond team <rama>:agy` y `/delegate rol:agy` funcionan como con pi; la autoría sale
  `agent:agy/<nombre>`; `bond team collect` guarda el informe de `agy`.
- Owning repository: `bond`.
- Dependencies: P1.
- Affected contracts: `cli/team.mts` (confianza heredada para `agy` según A4; `collect` desde la
  sesión de `agy` si Herdr la da, si no el panel recortado sin el arranque de `agy`); skills
  `bond-team`, `bond-delegate` y `plan-team` si hace falta mencionar `agy`; documentación.
- Acceptance criteria:
  - `bond team <rama>:agy` abre `agy` en un panel; con el checkout principal confiado, arranca
    sin preguntar; con `--no-trust` o sin confianza, la tabla lo marca `bloqueado` si pregunta.
  - `bond team prompt` le llega y la espera detecta cuándo termina.
  - Una decisión que `agy` registra con `bond decisions add` sale como `agent:agy/<nombre>` y
    `collect` deja en el run su última respuesta, sin el arranque del TUI.
  - Prueba real con un agente `agy` en un repo temporal con `[decisions]`, como la de pi.
- Actions:
  - [ ] Confianza para `agy` en `bond team`, con pruebas.
  - [ ] `collect` para `agy` (sesión o panel), con pruebas y un ejemplo de sesión en `test/`.
  - [ ] Skills y documentación, `## Sin publicar`.
  - [ ] Run applicable checks and record actual results.
  - [ ] Present evidence and stop for review before another phase.
- Verification: `npm run typecheck && bun test`; a mano, dentro de Herdr, la prueba real del
  criterio (la hace el orquestador tras integrar).
- Risks and recovery: si Herdr no da la sesión de `agy`, el panel recortado queda como única
  fuente; se documenta.

## Progress (local plans only)

| Phase | Implementation | Verification | Review | Evidence |
| --- | --- | --- | --- | --- |
| P1 | implemented | passed | accepted | rama `plan/agy-support-p1` (kevin, Claude Code), commit `be7395d`, integrada en `main` por fast-forward; en `main`: typecheck limpio, `bun test` 314/314, `bond sync --check` al día; prueba real: en un repo temporal con `bond init --agents agy`, `agy -p` ve `bond_context7`, `bond_duckduckgo` y `/accept`, `/commit`, `/handoff`, `/review`; decisión del agente `2026-10-28-agy-sin-instrucciones-globales-hasta-el-plugin-global` aceptada; aceptada por el usuario en sesión el 2026-10-28 |
| P2 | pending | not_run | pending | none yet |
| P3 | pending | not_run | pending | none yet |

## Next step

P2 y P3 de `docs/plans/2026-10-28-agy-support.md` en paralelo con `plan-team`: las dos dependen
solo de P1, aceptada. P2 añade además las instrucciones globales de `agy` que P1 dejó fuera
(decisión `2026-10-28-agy-sin-instrucciones-globales-hasta-el-plugin-global`).

## Evidence and tracking

- Pruebas previas al plan (2026-10-28): `agy -p` en el repo de bond y en un repo temporal con un
  plugin `.agents/plugins/bond/` y un plugin global de prueba (borrado después).
- P1: `be7395d` (`feat(agents): support Antigravity (agy) in bond init, sync and doctor`), en `main`; run en `docs/decisions/runs/2026-10-28-kevin-use-the-plan-execute-skill-to-implement-2.md`.
