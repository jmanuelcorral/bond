---
name: bond-team
description: Repartir una tarea entre varios agentes de código (pi, Claude Code, Codex, opencode...) que trabajan en paralelo, cada uno en su rama y su worktree de git, con Herdr. Úsalo solo cuando el usuario pida expresamente un equipo, repartir en worktrees o use /team.
---

# Equipo de agentes en worktrees (Herdr)

Usarlo es la petición explícita de usar Herdr y worktrees que exige el skill `herdr`: carga
también ese skill y sigue sus reglas. Ejecuta los comandos con tu herramienta de shell.

## Entrada

La tarea a repartir. Opcionalmente, qué agente quiere el usuario para cada parte ("los tests
con claude"): se indica por rama como `rama:kind`. Sin indicación, `bond team` usa el agente
por defecto del repo (`default_agent` de `.bond/bond.toml`) o, si no hay, el de `bond setup`.

Si lo que se reparte son fases de un plan local (`docs/plans/`) y el repo tiene el skill
`plan-team`, usa ese: comprueba qué fases pueden ir a la vez, manda cada una con `plan-execute`
y lleva el progreso del plan al integrar cada rama.

## Procedimiento

1. Comprueba `test "${HERDR_ENV:-}" = 1`, que estás en un repo git
   (`git rev-parse --show-toplevel`) y que `bond` está en el PATH. Si falta algo, dilo y para.
2. Si hay cambios sin commitear (`git status --porcelain`), avisa: los worktrees salen de lo
   commiteado y no los verán. Pregunta si seguir.
3. Divide la tarea en 2 o 3 subtareas **independientes** (que no toquen los mismos ficheros).
   Si no se puede, dilo y propón hacerla en una sola sesión. Para cada una: rama
   `team/<nombre-corto>`, kind y descripción autocontenida. Enseña el reparto y **espera el
   OK** del usuario antes de crear nada.
4. Con el OK, monta el equipo desde la rama actual:
   `bond team "$(git rev-parse --show-toplevel)" team/a team/b:claude --base "$(git branch --show-current)"`
   Imprime la tabla de `bond team status`. Si alguna rama sale `bloqueado` (Claude Code o pi
   preguntando si confían en la carpeta del worktree), díselo al usuario y espera a que conteste
   él: nunca respondas tú ni mandes un prompt, que su Enter contestaría la pregunta. En pi,
   elegir "Trust parent folder" una vez sirve para todos los worktrees del repo.
5. Manda a cada rama su subtarea sin esperar, para que trabajen a la vez:
   `bond team prompt <rama> "<mensaje>"` (se niega si el agente espera una respuesta). El mensaje es autocontenido y dice qué hacer,
   qué ficheros tocar y cuáles no, cómo verificarlo, y que al terminar haga **commit en su
   rama** con un mensaje en inglés, **sin push**. Ese commit es parte de lo que pide el
   usuario al pedir el equipo. Si el repo tiene la memoria de decisiones activa
   (`[decisions]` en `.bond/bond.toml`), `bond team prompt` guarda el encargo exacto en
   un run de `docs/decisions/runs/` (evítalo con `--no-record`); si la escritura falla,
   avisa y manda el prompt igual: el envío no depende del registro.
6. Espera a cada uno: `herdr agent wait <agente> --timeout 1800000` (el nombre del agente de
   cada rama sale en `bond team status`). Si alguno queda
   `blocked`, lee su panel y pregunta al usuario antes de responder. Si hay `timeout`, mira
   `herdr agent get` y `herdr agent read` antes de decidir; no reenvíes a ciegas. Con un modelo
   local compartido puede haber errores 429: si un agente se rinde sin commits, reenvíale la
   tarea cuando acabe otro.
7. Revisa: `bond team status` da por rama el estado, los commits y los ficheros. Sin cambiar
   de rama, mira `git log --oneline <base>..<rama>` y `git diff --stat <base>...<rama>`.
   Con la memoria de decisiones activa, recoge el informe de cada agente con
   `bond team collect <rama>`: toma solo su última respuesta del fichero de sesión que
   Herdr reporta en `agent_session` (en pi, un `.jsonl`) y, si no puede leerlo, del
   panel recortado (sin banner de arranque ni avisos). Guarda el informe, el estado, los
   commits de la rama y las decisiones registradas por ese agente en el run del encargo
   (repetirlo no duplica nada; `--lines <n>` cambia cuánto lee del panel). Sin memoria,
   lee el informe con `herdr agent read <agente> --source recent-unwrapped --lines 120`.
8. Resume por rama: qué hizo, commits, ficheros, verificación y conflictos probables entre
   ramas. Propón un orden de integración.

No hagas merge, rebase ni push, ni quites worktrees o workspaces: eso lo decide el usuario.
Cuando él lo pida, `bond team clean` quita los worktrees de las ramas ya integradas (las ramas
se quedan); `bond team clean <rama>` uno concreto. Nunca con `--force` sin que lo pida.
