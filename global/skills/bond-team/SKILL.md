---
name: bond-team
description: Repartir una tarea entre varios agentes de código (pi, Claude Code, Codex, opencode...) que trabajan en paralelo, cada uno en su rama y su worktree de git, con Herdr. Úsalo solo cuando el usuario pida expresamente un equipo, repartir en worktrees o use /team.
---

# Equipo de agentes en worktrees (Herdr)

Usarlo es la petición explícita de usar Herdr y worktrees que exige el skill `herdr`: carga
también ese skill y sigue sus reglas. Ejecuta los comandos con tu herramienta de shell.

## Entrada

La tarea a repartir. Opcionalmente, qué agente quiere el usuario para cada parte ("los tests
con claude"): se indica por rama como `rama:kind`. Sin indicación, `pi`.

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
   Cada agente se llama `<kind>-<repo>-<rama>` (en minúsculas y con guiones); confírmalo en la
   tabla que imprime o con `herdr agent list`. Si alguno queda esperando una respuesta (por
   ejemplo Claude Code pidiendo confiar en la carpeta del worktree), enséñaselo al usuario y
   espera.
5. Manda a cada agente su subtarea sin esperar, para que trabajen a la vez:
   `herdr agent prompt <agente> "<mensaje>"`. El mensaje es autocontenido y dice qué hacer,
   qué ficheros tocar y cuáles no, cómo verificarlo, y que al terminar haga **commit en su
   rama** con un mensaje en inglés, **sin push**. Ese commit es parte de lo que pide el
   usuario al pedir el equipo.
6. Espera a cada uno: `herdr agent wait <agente> --timeout 1800000`. Si alguno queda
   `blocked`, lee su panel y pregunta al usuario antes de responder. Si hay `timeout`, mira
   `herdr agent get` y `herdr agent read` antes de decidir; no reenvíes a ciegas. Con un modelo
   local compartido puede haber errores 429: si un agente se rinde sin commits, reenvíale la
   tarea cuando acabe otro.
7. Revisa cada rama sin cambiar de rama: `git log --oneline <base>..<rama>` y
   `git diff --stat <base>...<rama>`; lee el informe de cada agente con
   `herdr agent read <agente> --source recent-unwrapped --lines 120`.
8. Resume por rama: qué hizo, commits, ficheros, verificación y conflictos probables entre
   ramas. Propón un orden de integración.

No hagas merge, rebase ni push, ni quites worktrees o workspaces: eso lo decide el usuario.
Para quitar uno: `herdr worktree remove --workspace <id>` (borra la carpeta, no la rama).
