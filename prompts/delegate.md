---
description: Delega una tarea en otro agente pi, en un panel hermano de Herdr
argument-hint: "[rol] [tarea...]"
---
Te pido expresamente que uses Herdr para delegar una tarea en otro agente pi, en un panel
hermano de esta pestaña y en este mismo directorio.

Rol: ${1:-reviewer}
Tarea: ${@:2}

Si la tarea está vacía: revisar los cambios sin commitear y reportar solo hallazgos
accionables. Si el rol no parece un rol sino el principio de la tarea (por ejemplo "revisa"),
usa el rol `reviewer` y trata todo como tarea.

Carga el skill `herdr` y sigue sus reglas. La sintaxis exacta la manda `herdr <grupo>` de la
versión instalada. Ejecuta los comandos de Herdr con la tool `bash`: no hay tools MCP de Herdr.
Procedimiento:

1. `test "${HERDR_ENV:-}" = 1`. Si falla, dime que no estás dentro de Herdr y haz tú la tarea
   en esta sesión, sin tocar Herdr.
2. Nombre único: `<rol>-<n>` con el primer `n` (desde 1) que no esté en
   `herdr agent list` (`.result.agents[].name`). Solo `[a-z][a-z0-9_-]`, máximo 32 caracteres.
3. Dirección del split: en `herdr pane layout --pane "$HERDR_PANE_ID"`, busca tu panel en
   `.result.layout.panes[]` y mira su `rect`. Si `width >= 120` y `width >= 2 * height`,
   `right`; si no, `down`. Así cada mitad conserva al menos 60 columnas.
4. `herdr pane split --current --direction <dir> --cwd "$PWD" --no-focus` y lee el panel nuevo
   en `.result.pane.pane_id`. Si este paso o el siguiente fallan con cualquier otro error,
   enséñamelo y para: no reintentes con otro nombre ni otro panel a ciegas.
5. `herdr agent start <nombre> --kind pi --pane <panel> --timeout 60000`. Si devuelve
   `agent_not_ready`, lee el panel con `herdr agent read <nombre>`: si espera una aprobación,
   enséñamela y pregúntame; si no, `herdr agent wait <nombre> --timeout 60000` antes de seguir.
6. El delegado no ve esta conversación: escríbele un mensaje autocontenido con el objetivo, el
   alcance (ficheros, carpetas o diff), qué debe entregar y las restricciones: sin commit ni
   push, y sin editar ni crear ficheros en el repo salvo que la tarea pida cambios de forma
   expresa. Envíalo con
   `herdr agent prompt <nombre> "<mensaje>" --wait --timeout 900000`.
7. Si vuelve `blocked`, lee el panel, enséñame qué pide y espera mi respuesta; con ella,
   contéstale y sigue desde este paso. Si vuelve `timeout` o `agent_prompt_stalled`, mira
   `herdr agent get <nombre>` y `herdr agent read <nombre>` antes de decidir: nunca reenvíes
   la tarea a ciegas.
8. Lee la respuesta con `herdr agent read <nombre> --source recent-unwrapped --lines 200`. Si
   no se ve completa, pídele que la escriba como Markdown en un fichero dentro de un
   directorio creado con `mktemp -d` (fuera del repo, para no ensuciar el diff) y que responda
   solo con la ruta; luego lee ese fichero.
9. Resúmeme el resultado (con `fichero:línea` cuando aplique) y dime el nombre y el panel del
   delegado.

No cierres el panel ni el agente al terminar: se quedan para que los inspeccione. Ciérralos
solo si te lo pido.
