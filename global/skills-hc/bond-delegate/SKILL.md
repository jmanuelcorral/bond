---
name: bond-delegate
description: Delegar una tarea en otro agente de código (pi, Claude Code, Codex, opencode, Copilot, Antigravity...) vía hc y traer su resultado. Úsalo solo cuando el usuario pida expresamente delegar en otro agente o use /delegate; no por iniciativa propia para paralelizar.
---

# Delegar en otro agente (hc)

Usarlo es la petición explícita de delegar en otro agente vía hc. La sintaxis exacta de
cada comando la manda `hc <grupo>` de la versión instalada. Ejecuta los comandos con tu
herramienta de shell: no hay tools de hc.

## Entrada

- **Rol y agente**: `rol` o `rol:kind`, por ejemplo `reviewer`, `tester:claude`,
  `revisor:codex`. Sin kind, `pi`. Si lo primero no parece un rol (por ejemplo "revisa"),
  rol `reviewer` y todo es tarea.
- **Tarea**: el resto. Si está vacía: revisar los cambios sin commitear y reportar solo
  hallazgos accionables.
- **Modelo** (opcional): si el usuario pide uno, pásalo como argumento del agente tras `--`
  (pi: `--model halo/flash-halogen`; Claude: `--model haiku`).
- **Argumentos de `agy`**: sin otros del usuario, `-- --dangerously-skip-permissions`; sin él,
  `agy` pide permiso por cada comando y el delegado no avanza.

## Procedimiento

1. `test "${BOND_APP:-}" = 1` o `command -v hc >/dev/null 2>&1`. Si falla, dilo y haz tú la tarea en esta sesión, sin hc.
2. Comprueba el kind: su ejecutable tiene que estar en el PATH (`command -v <kind>`). Con `agy`
   vale también `~/.local/bin/agy` (donde lo deja su instalador). Si no, dilo y para.
3. Nombre único: `<rol>-<n>` con el primer `n` (desde 1) que no esté en `hc ls --json`
   (`.terminals[].name`). Solo `[a-z][a-z0-9_-]`, máximo 32 caracteres.
4. En hc cada agente corre en su propia terminal (`hc run --bg`): no hay paneles hermanos ni división de pantalla.
5. Arranca el agente en una terminal en segundo plano:
   `hc run --bg --keep --no-parent --name <nombre> --cwd "$PWD" -- <ejecutable> [args]`.
   Si el kind es `agy` y no está en el PATH sino en `~/.local/bin`, usa `"$HOME/.local/bin/agy"`; y sin
   otros argumentos del usuario, `--dangerously-skip-permissions`.
   Si el agente queda `blocked`, lee la terminal (`hc read <nombre> --lines 60`): suele ser una
   pregunta del agente (confiar en la carpeta, aprobar algo). Enséñasela al usuario y espera su
   respuesta; no la contestes por él.
6. El delegado no ve esta conversación: escríbele un mensaje autocontenido con el objetivo, el
   alcance (ficheros, carpetas o diff), qué debe entregar y las restricciones: sin commit ni
   push, y sin editar ni crear ficheros salvo que la tarea pida cambios de forma expresa.
   `hc send <nombre> "<mensaje>" --wait --timeout 900`. Si el repo tiene la
   memoria de decisiones activa (`[decisions]` en `.bond/bond.toml`), guarda ese mensaje
   exacto: es el encargo que recogerás en el paso 8 con `--request`.
7. Si vuelve `blocked`, lee la terminal, enséñale al usuario qué pide y espera; con su respuesta,
   contesta (`hc send <nombre> "<respuesta>"`) y sigue. Si vuelve `timeout`, mira `hc get <nombre>` y
   `hc read <nombre>` antes de decidir: nunca reenvíes la tarea a ciegas.
8. Lee y guarda la respuesta. Con la memoria de decisiones activa, hazlo con
   `bond team collect "$(git branch --show-current)" --agent <nombre> --request "<mensaje exacto del paso 6>" --lines 200`:
   bond deja el encargo y el informe en un run de `docs/decisions/runs/` (el fichero lo
   escribe bond desde el checkout principal; tú no lo redactas a mano). El informe sale del
   fichero de sesión del agente (su última respuesta, sin banner ni razonamiento) y, si no
   es legible, de la terminal recortada. Si el informe no cabe o quieres corregirlo, vuelve a
   recoger con `--lines` mayor: el run guarda el último informe, sin duplicar. Si el
   delegado debe entregar texto largo, pídele que registre lo
   que sea una decisión con `bond decisions add` (skill `decision-record`) y que el resto lo
   resuma en su respuesta. Sin memoria, lee con
   `hc read <nombre> --lines 200` y, si no se ve
   completa, pídele que la escriba en un fichero Markdown dentro de un directorio creado
   con `mktemp -d` (fuera del repo) y que responda solo con la ruta; lee ese fichero.
9. Resume el resultado (con `fichero:línea` cuando aplique) y di el nombre, el kind y la
   terminal del delegado.

No mates la terminal ni el agente al terminar; ciérralos solo si el usuario lo pide (`hc kill <nombre>`).
