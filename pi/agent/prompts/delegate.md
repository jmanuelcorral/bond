---
description: Delega una tarea a otro agente pi en un panel hermano de Herdr
argument-hint: "[rol] [tarea]"
---
Delega trabajo en un agente gestionado por Herdr.

Rol: ${1:-reviewer}. Tarea: ${2:-revisa el diff actual y reporta solo hallazgos accionables}.

Pasos:

1. Comprueba que estás dentro de Herdr (`test "${HERDR_ENV:-}" = 1`). Si no lo estás,
   dímelo y haz tú la tarea en esta shell en vez de delegar.
2. Crea un panel hermano sin robar el foco y lee su id en `.result.pane.pane_id`:

   ```
   herdr pane split --current --direction right --cwd "$PWD" --no-focus
   ```

3. Lanza el agente con un nombre único (minúsculas, dígitos, guiones):

   ```
   herdr agent start <rol> --kind pi --pane <id-del-panel>
   ```

4. Manda la tarea y espera a que se asiente:

   ```
   herdr agent prompt <rol> "<tarea>" --wait --timeout 300000
   ```

5. Si devuelve `blocked`, lee el panel antes de responder y pregúntame. Si devuelve
   `timeout`, revisa el estado con `herdr agent get <rol>` antes de reenviar nada.
6. Lee el informe y resúmemelo:

   ```
   herdr agent read <rol> --source recent-unwrapped --lines 200
   ```

No cierres el panel al terminar: lo dejo abierto para inspección.
