---
agent: "kevin"
kind: "pi"
branch: "feat/plan-phase-repos"
base: "main@d491926"
orchestrator: "pi/gru"
started_at: "2026-11-03T10:59:46Z"
finished_at: "2026-11-03T11:22:28Z"
status: "reported"
commits:
  - "a355f63 feat(catalog): name the repos a plan phase touches with a Repos field"
  - "f904afb test: pin the phase Repos field contract and the --repos session check"
decisions:
  - "2026-11-03-phase-plans-name-their-repos-with-a-repos-field-in-the-phase-block"
  - "2026-11-03-a-phase-without-a-repos-field-means-ask-never-all-session-repos"
---

## Request

**2026-11-03T10:59:46Z**

Estas en un worktree de bond (rama feat/plan-phase-repos) creado desde main. bond es una CLI en TypeScript (.mts, sin paso de compilacion) que opera varios agentes de codigo sobre git y el multiplexor Herdr. Un "hub" es un repo que agrupa varios repos de una sesion, declarados en `hub.toml`. Tarea: issue #44. No hay skills aqui: sigue estas instrucciones tal cual.

ISSUE #44: que la plantilla de plan permita decir a que repos afecta cada fase, para que `plan-team` abra solo esos (`bond team <rama> --repos ...`).

HALLAZGO CLAVE: esto NO es una funcionalidad nueva, es un CONTRATO HUERFANO entre tres skills.
- El flag YA EXISTE y funciona: `bond team --repos front,back` se parsea en `cli/team.mts:66` y en
  modo hub abre la vertical con el hub + esos repos (`pickRepos`, `cli/team.mts:1853`), validando
  que existan en la sesion.
- La skill YA LO ESPERA: `catalog/skills/plan-team/SKILL.md:72` dice literalmente "`--repos
  front,back` when the plan says which repos the phase touches".
- LO QUE NO EXISTE es el sitio donde decirlo: el bloque de fase de
  `catalog/skills/plan-create/references/plan-template.md` (lineas ~50-58) tiene `Affected
  contracts`, `Acceptance criteria`, `Actions`, `Verification`, `Risks and recovery` y NINGUN
  campo de repos. plan-team busca una cosa que la plantilla no define: cada agente la escribe donde
  le parece y quien lee adivina.

DECISIONES YA TOMADAS POR EL USUARIO (no las reabras, aplícalas tal cual)
1. **Forma del campo**: una linea `- Repos: front, back` dentro del bloque de fase, junto a
   `Affected contracts`. NO va como columna de la tabla de Progress (esa tabla es de ESTADO, no de
   diseno) ni como seccion aparte.
2. **Validar al escribir**: `plan-create` debe validar que cada repo nombrado existe en la sesion del
   hub, en el momento de escribir el plan. No esperar a que falle `bond team` al crear el equipo.
3. **Si el campo se omite**: `plan-team` PREGUNTA que repos abre. NO abre todos los de la sesion por
   comodo que sea: un agente en un repo que no debia es peor que una pregunta.
4. **Repo sin hub** (no hay `hub.toml`): el campo no aplica. Se IGNORA con un aviso claro, sin
   romperse.

DONDE TOCAR (importante: la fuente de verdad es el catalogo)
- `catalog/skills/plan-create/references/plan-template.md`: anade el campo `- Repos:` al bloque de
  fase, con su explicacion de cuando se pone (solo en hub) y como se valida.
- `catalog/skills/plan-create/SKILL.md`: lo que haya que decir del campo en el procedimiento.
- `catalog/skills/plan-team/SKILL.md`: que lea el campo de la fase y pase `--repos`; que pregunte si
  falta; que avise e ignore en repo sin hub. Ya hay texto en las lineas 35 y 72: ajustalo para que
  apunte al campo concreto en vez de a "when the plan says".
- `catalog/skills/plan-execute/SKILL.md`: solo si aporta algo (p. ej. mostrar los repos de la fase al
  ejecutarla en hub). No la toques por tocar.
- `cli/team.mts`: solo si hace falta una validacion nueva para "el plan nombra un repo que no esta en
  la sesion". Mira `pickRepos` antes de escribir nada: puede que ya lo cubra, y en ese caso NO lo
  dupliques.

REGLAS CRITICAS DEL REPOSITORIO
- `.agents/skills/`, `.claude/`, `.pi/`, `.mcp.json` y el bloque de `CLAUDE.md` los GENERA
  `bond sync` desde `.bond/bond.toml`. NUNCA los edites a mano: edita `catalog/skills/` y luego
  ejecuta `bond sync` para propagar. Verifica despues con `git status` que lo que cambia es lo
  esperado.
- Las skills del catalogo van EN INGLES (el resto del repo, en espanol).
- Textos de consola nuevos (si los hay en `cli/`): al catalogo `cli/messages/team.mts` con su clave
  en `es` y su traduccion en `en` (estan tipados contra `es`: sin traduccion, `npm run typecheck`
  falla). Importa `t` como ya lo hacen esos ficheros.
- NO toques: `cli/messages.mts`, `cli/instructions.mts` (lo que recibe el agente no se traduce),
  `docs/plans/*`, `bunfig.toml`.
- Docs: si cambia semantica de `--repos` o se documenta el campo del plan, actualiza
  `docs/reference.md` y `docs/en/reference.md`, y mete una entrada en `## Sin publicar` del
  `CHANGELOG.md` (regla del repo).
- Registra el contrato con `bond decisions add` (minimo: la forma del campo y la politica de
  "omitido = preguntar"), con contexto y alternativas descartadas, SIN `--confirmed-by`: el usuario
  ya lo aprobo en la conversacion pero el registro entra como propuesta para trazabilidad.

PRUEBAS
- `bond team` en un hub: `--repos` con un repo inexistente falla con mensaje claro (comprueba que ya
  lo hace; si no, cubrelo).
- Que el campo de la plantilla esta en el fichero y tiene la forma acordada (un test que lo busque en
  el catalogo es valido y barato: es un contrato, y sin test se pierde).
- Que `bond sync` propaga el campo a `.agents/skills/` (ejecutalo y comprueba que el fichero
  generado lo contiene).
- Que en repo sin hub el campo no rompe nada.
- Verifica: `npx tsc -p .` limpio y `bun test` en verde (base: 588 pass / 0 fail; tus pruebas suman).
- OJO con el entorno de CI (Linux, macOS y Windows): los fixtures que crean repos deben fijar TODO lo
  que dependa de la config global de git (`-c init.defaultBranch=main`), no usar comandos POSIX-only,
  no meter comillas embebidas en comandos que van a shell, y recordar que en Windows los symlinks son
  junctions y las rutas cortas 8.3 se canonicizan con `canonical()`. Han caido tres PRs por esto.
- Commits conventional en ingles, trailer `Agent: pi/<tu nombre>`, `Closes #44` en el ultimo. Puedes
  empujar TU rama. PROHIBIDO: fusionar, empujar a main, abrir PR, tocar otra rama.

INFORME FINAL (ultima respuesta, sin banner)
- El bloque de fase resultante tal cual queda en la plantilla (pegalo).
- Que dice ahora plan-team sobre leer el campo, preguntar si falta e ignorar sin hub (frases
  literales).
- Que validacion existe realmente para "repo del plan no esta en la sesion" y donde: si ya la cubria
  `pickRepos`, digelo; no inventes una duplicada.
- Que has tenido que cambiar en `bond sync` y que ha generado.
- Ficheros tocados y pruebas nuevas.
- `npx tsc -p .` y `bun test` tal cual.
- Ids de las decisiones registradas y SHAs de los commits.
- Si algo no se puede hacer como se pide, digelo con el motivo exacto en vez de inventar.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report

Todo commiteado y empujado a `feat/plan-phase-repos`. Working tree limpio.

## Bloque de fase resultante (`catalog/skills/plan-create/references/plan-template.md`)

```markdown
### P1: {reviewable end-to-end deliverable}

- Outcome: {what can be observed upon completion}.
- Owning repository: {confirmed destination}.
- Dependencies: {specific phases or issues; no cycles}.
- Affected contracts: {create, modify, or remove; relevant signatures, events, schema, or visible behavior}.
- Repos: {hub plans only: the session repos this phase touches, comma-separated by their `hub.toml` names or paths, e.g. `front, back`. Validate every name against the session before saving the plan (`bond hub --json` lists them); an unknown name is an error in the plan, not something to leave for `bond team` to discover at team creation. Omit the field entirely outside a hub.}
- Acceptance criteria: {verifiable outcomes and necessary negative cases}.
- Actions:
  ...
```

Y bajo el bloque, párrafo nuevo:

> In a hub (a `hub.toml` at the root, created with `bond hub init`), the `Repos` field is the one place a phase says which repos of the session it touches: `plan-team` reads it and passes it to `bond team --repos`. A phase that leaves it out does not mean "all repos": it means the team has to ask. Outside a hub the field has no meaning and `plan-team` ignores it with a notice.

## Qué dice ahora `plan-team` (frases literales)

- Paso 3: «In a hub, read each selected phase's `Repos` field (the repos of the session it touches, written by `plan-create`); you need it for `--repos` in step 5, and if it is missing you will ask the user for it.»
- Paso 4: «In a hub, name in the split the repos the phase opens (its `Repos` field, or the ones the user just gave you), so the OK covers them.»
- Paso 5: «In a hub the command is different (one branch spec, no `--base`, `--repos` taken from the phase's `Repos` field); see Hub mode. Outside a hub (no `hub.toml` at the root) the plan's `Repos` field does not apply: say so and ignore it, and use the command above as written.»
- Hub mode: «**Open the phase** with a single branch spec: `bond team plan/<slug>-p2 --repos <the phase's Repos field>` (paths or unique folder names from `hub.toml`). Read the field from the phase block of the plan, do not guess it. If the phase has no `Repos` field, ask the user which repos of the session the phase opens before creating anything: never open all of them because it is convenient, an agent in a repo that should not have been touched is worse than one question.»

`plan-execute` (paso 3): «In a hub (…), the phase's `Repos` field names the session repos the phase touches; name them in your report, and if your repo is not among them, say so instead of working anyway.»

## Validación de "repo del plan no está en la sesión"

**Ya la cubría `pickRepos` (`cli/team.mts:1810`)**: muere con `team.err_pick_not_in_session` → `--repos nope: no es un repo de la sesión (front, back)`, y en `createInHub` se llama (línea 1853) **antes** de crear la rama del hub o cualquier worktree/panel. No he añadido validación duplicada en `cli/`: **cero cambios en `cli/`**. La validación al escribir el plan (decisión 2) es del agente: `plan-create` contrasta los nombres con `bond hub --json` / `hub.toml`, y eso es texto de skill, no código.

## `bond sync`

No he cambiado `bond sync`; solo lo he ejecutado para propagar el catálogo. Ha generado:
- `~ .agents/skills/plan-create/SKILL.md`
- `~ .agents/skills/plan-create/references/plan-template.md`
- `~ .agents/skills/plan-execute/SKILL.md`
- `~ .agents/skills/plan-team/SKILL.md`
- `~ .bond/manifest.json` (hashes de los cuatro)

`bond sync --check` → «al día», exit 0. Nada de `.claude/`, `.pi/` ni `CLAUDE.md` cambió (enlazan, no copian contenido de estas skills).

## Ficheros tocados

- `catalog/skills/plan-create/references/plan-template.md` — campo `- Repos:` + nota bajo el bloque
- `catalog/skills/plan-create/SKILL.md` — paso 4: escribirlo y validarlo contra la sesión antes de guardar
- `catalog/skills/plan-team/SKILL.md` — pasos 3, 4, 5 y Hub mode apuntan al campo concreto
- `catalog/skills/plan-execute/SKILL.md` — nombra los repos de la fase en su informe (hub)
- `docs/reference.md`, `docs/en/reference.md` — campo del plan + fila de `plan-team`
- `CHANGELOG.md` — entrada en `## Sin publicar`
- `docs/decisions/2026-11-03-phase-plans-name-their-repos-...md`, `docs/decisions/2026-11-03-a-phase-without-a-repos-field-...md` (commiteados con el trabajo, viajan en la rama)
- `test/plan-phase-repos.test.mts` (nuevo, 8 tests), `test/team-hub.test.mts` (+1 test)

Pruebas nuevas: forma y posición del campo en la plantilla; que dice "hub plans only" / `hub.toml` / `bond hub --json` / omitir fuera de hub; que omitirlo no es "todos"; lo que dice cada skill consumidora; propagación por `bond sync` con segunda pasada vacía; y en hub, `--repos nope` y `--repos front,nope` fallan con mensaje claro sin crear rama ni pane (`existsSync(state) === false`).

## Verificación

```
$ npx tsc -p .
TSC_OK (exit 0)

$ bun test
 597 pass
 0 fail
 3702 expect() calls
Ran 597 tests across 32 files. [92.84s]
```

(base 588 → 597: +8 en `plan-phase-repos.test.mts`, +1 en `team-hub.test.mts`)

## Decisiones y commits

- `2026-11-03-phase-plans-name-their-repos-with-a-repos-field-in-the-phase-block` (proposed)
- `2026-11-03-a-phase-without-a-repos-field-means-ask-never-all-session-repos` (proposed)

Ambas registradas sin `--confirmed-by`, con alternativas descartadas (columna en Progress, sección aparte / default "todos", fallo duro).

- `a355f63` feat(catalog): name the repos a plan phase touches with a Repos field
- `f904afb` test: pin the phase Repos field contract and the --repos session check (`Closes #44`)

Empujado a `origin/feat/plan-phase-repos`. Sin PR, sin merge, sin tocar `main`.
