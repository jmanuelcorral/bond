---
name: bond-delegate
description: Delegar una tarea en otro agente de código (pi, Claude Code, Codex, opencode, Copilot...) en un panel hermano de Herdr y traer su resultado. Úsalo solo cuando el usuario pida expresamente delegar en otro agente o use /delegate; no por iniciativa propia para paralelizar.
---

# Delegar en otro agente (Herdr)

Usarlo es la petición explícita de usar Herdr que exige el skill `herdr`: carga también ese
skill y sigue sus reglas. La sintaxis exacta de cada comando la manda `herdr <grupo>` de la
versión instalada. Ejecuta los comandos con tu herramienta de shell: no hay tools de Herdr.

## Entrada

- **Rol y agente**: `rol` o `rol:kind`, por ejemplo `reviewer`, `tester:claude`,
  `revisor:codex`. Sin kind, `pi`. Si lo primero no parece un rol (por ejemplo "revisa"),
  rol `reviewer` y todo es tarea.
- **Tarea**: el resto. Si está vacía: revisar los cambios sin commitear y reportar solo
  hallazgos accionables.
- **Modelo** (opcional): si el usuario pide uno, pásalo como argumento del agente tras `--`
  (pi: `--model halo/flash-halogen`; Claude: `--model haiku`).

## Procedimiento

1. `test "${HERDR_ENV:-}" = 1`. Si falla, dilo y haz tú la tarea en esta sesión, sin Herdr.
2. Comprueba el kind: tiene que aparecer en `herdr agent start --help` (possible values) y
   su ejecutable en el PATH (`command -v <kind>`). Si no, dilo y para.
3. Nombre único: `<rol>-<n>` con el primer `n` (desde 1) que no esté en `herdr agent list`
   (`.result.agents[].name`). Solo `[a-z][a-z0-9_-]`, máximo 32 caracteres.
4. Dirección: en `herdr pane layout --pane "$HERDR_PANE_ID"`, busca tu panel en
   `.result.layout.panes[]`. Si `rect.width >= 120` y `rect.width >= 2 * rect.height`,
   `right`; si no, `down`.
5. `herdr pane split --current --direction <dir> --cwd "$PWD" --no-focus` y lee el panel nuevo
   en `.result.pane.pane_id`. Si falla con cualquier error, enséñalo y para.
6. `herdr agent start <nombre> --kind <kind> --pane <panel> --timeout 90000 [-- args]`.
   Si devuelve `agent_not_ready` o el agente queda `blocked`, lee el panel
   (`herdr agent read <nombre> --source visible`): suele ser una pregunta del agente
   (confiar en la carpeta, aprobar algo). Enséñasela al usuario y espera su respuesta; no la
   contestes por él.
7. El delegado no ve esta conversación: escríbele un mensaje autocontenido con el objetivo, el
   alcance (ficheros, carpetas o diff), qué debe entregar y las restricciones: sin commit ni
   push, y sin editar ni crear ficheros salvo que la tarea pida cambios de forma expresa.
   `herdr agent prompt <nombre> "<mensaje>" --wait --timeout 900000`. Si el repo tiene la
   memoria de decisiones activa (`[decisions]` en `.bond/bond.toml`), guarda ese mensaje
   exacto: es el encargo que recogerás en el paso 9 con `--request`.
8. Si vuelve `blocked`, lee el panel, enséñale al usuario qué pide y espera; con su respuesta,
   contesta y sigue. Si vuelve `timeout` o `agent_prompt_stalled`, mira `herdr agent get` y
   `herdr agent read` antes de decidir: nunca reenvíes la tarea a ciegas.
9. Lee y guarda la respuesta. Con la memoria de decisiones activa, hazlo con
   `bond team collect "$(git branch --show-current)" --agent <nombre> --request "<mensaje exacto del paso 7>" --lines 200`:
   bond deja el encargo y el informe en un run de `docs/decisions/runs/` (el fichero lo
   escribe bond desde el checkout principal; tú no lo redactas a mano). El informe sale del
   fichero de sesión del agente (su última respuesta, sin banner ni razonamiento) y, si no
   es legible, del panel recortado. Si el informe no cabe o quieres corregirlo, vuelve a
   recoger con `--lines` mayor: el run guarda el último informe, sin duplicar. Si el
   delegado debe entregar texto largo, pídele que registre lo
   que sea una decisión con `bond decisions add` (skill `decision-record`) y que el resto lo
   resuma en su respuesta. Sin memoria, lee con
   `herdr agent read <nombre> --source recent-unwrapped --lines 200` y, si no se ve
   completa, pídele que la escriba en un fichero Markdown dentro de un directorio creado
   con `mktemp -d` (fuera del repo) y que responda solo con la ruta; lee ese fichero.
10. Resume el resultado (con `fichero:línea` cuando aplique) y di el nombre, el kind y el
    panel del delegado.

No cierres el panel ni el agente al terminar; ciérralos solo si el usuario lo pide.
