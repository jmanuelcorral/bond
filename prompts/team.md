---
description: Reparte una tarea entre varios agentes, cada uno en su worktree de git (Herdr)
argument-hint: "<tarea...>"
---
Te pido expresamente que uses Herdr y worktrees de git para repartir esta tarea entre varios
agentes que trabajen en paralelo, cada uno en su propia rama y su propio workspace.

Tarea: $@

Carga el skill `herdr` y sigue sus reglas. Ejecuta los comandos con la tool `bash`. Los
scripts de este setup están en `~/.pi/agent/pisetup/bin/`. Procedimiento:

1. Comprueba `test "${HERDR_ENV:-}" = 1` y que estás en un repo git
   (`git rev-parse --show-toplevel`). Si falla algo, dímelo y para.
2. Si hay cambios sin commitear (`git status --porcelain`), avísame: los worktrees salen de
   lo commiteado y no los verán. Pregunta si sigo igualmente.
3. Divide la tarea en 2 o 3 subtareas **independientes** (que no toquen los mismos ficheros).
   Si no se puede dividir así, dímelo y propón hacerla tú solo. Para cada subtarea: una rama
   `team/<nombre-corto>` y una descripción autocontenida. Enséñame el reparto y **espera mi
   OK** antes de crear nada.
4. Con el OK, monta el equipo desde la rama actual:
   `~/.pi/agent/pisetup/bin/piteam "$(git rev-parse --show-toplevel)" <rama1> <rama2> --base "$(git branch --show-current)"`
   Los agentes se llaman `pi-<repo>-<rama>` (la rama en minúsculas y con guiones); confírmalo
   en la tabla que imprime o con `herdr agent list`.
5. Manda a cada agente su subtarea sin esperar, para que trabajen a la vez:
   `herdr agent prompt <agente> "<mensaje>"`. El mensaje es autocontenido (no ven esta
   conversación) y dice: qué hacer, qué ficheros tocar y cuáles no, cómo verificarlo, y que al
   terminar haga **commit en su rama** con un mensaje en inglés, **sin push** y sin tocar
   otras ramas. Eso es lo que te pido para este equipo.
6. Espera a cada uno: `herdr agent wait <agente> --timeout 1800000`. Si alguno queda `blocked`,
   lee su panel y pregúntame antes de responder. Si hay `timeout`, mira `herdr agent get` y
   `herdr agent read` antes de decidir; no reenvíes a ciegas.
7. Revisa el resultado de cada rama sin cambiar de rama: `git log --oneline <base>..<rama>` y
   `git diff --stat <base>...<rama>`. Lee el informe de cada agente con
   `herdr agent read <agente> --source recent-unwrapped --lines 120`.
8. Resúmeme por rama: qué hizo, commits, ficheros, verificación y si hay conflictos probables
   entre ramas. Propón un orden de integración.

No hagas merge, rebase ni push, ni quites worktrees o workspaces: eso lo decido yo. Para
quitar uno después: `herdr worktree remove --workspace <id>` (borra la carpeta, no la rama).
