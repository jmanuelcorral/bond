---
name: merge-and-clean
description: Merge a GitHub PR with rebase and delete its local and remote branches safely, always verifying integration by patch equivalence (git cherry) before any deletion, refusing to delete branches with unmerged work, refusing main and the current branch, and reporting branches held by a git worktree instead of force-removing them. Use when asked to merge a PR, land a PR, delete merged branches, or clean up branches.
user-invocable: true
disable-model-invocation: false
---

# Fusionar PR y borrar ramas

El flujo que siempre hacemos igual: **rebase a `main`, luego borrar la rama local y la remota**. Con
las comprobaciones puestas para que borrar no signifique perder trabajo.

Sin dependencias: **Node ≥ 22**, `git` y `gh`. Los comandos se ejecutan con argv, nunca con string de
shell, así que funciona igual en Windows, Linux y macOS.

## Uso

```bash
node scripts/merge.mjs 64                # fusionar la PR 64 y borrar sus ramas
node scripts/merge.mjs 64 --dry-run      # decir que se haria, sin tocar nada
node scripts/merge.mjs 64 --no-delete   # fusionar y dejar las ramas
node scripts/merge.mjs --delete-only 64  # no fusionar, solo borrar (PR ya fusionada)
node scripts/merge.mjs --clean           # podar TODAS las ramas locales ya fusionadas
node scripts/merge.mjs --clean --dry-run # que podaria
```

Códigos de salida: `0` hecho · `1` rechazo o fallo al fusionar · `3` error de uso o de entorno.

## Por qué `git cherry` y no `git log` ni `git diff`

Esto es el núcleo del asunto. Después de fusionar **con rebase**, los SHA de la rama ya no están en
`main` — el rebase los reescribe. Consecuencia:

| Comando | Qué dice tras un rebase | ¿Vale? |
| --- | --- | --- |
| `git log main..rama` | «hay commits pendientes» | **Falso alarma** |
| `git diff main..rama` | la rama «por detrás», con miles de líneas | **Falso alarma** |
| `git cherry -v main rama` | compara **identidad de parche**, no SHA | **Correcto** |

En la sesión en que se escribió esto, `git diff main..rama` llegó a mostrar *«71 files changed,
416 insertions(+), 5369 deletions(-)»* sobre una rama perfectamente fusionada. Si uno se fía de eso,
no borra nada nunca. `git cherry` sí da `0` parches `+`.

## Guardas (verificadas las tres)

1. **Trabajo no integrado → no se borra.** Se muestra el parche exacto que falta:
   ```
   RECHAZADO: 1 parche(s) de "scratch" no estan en "main":
       0faa2e4 wip: trabajo que no esta en main
   ```
2. **`main`/`master` y la rama actual → no se borran.**
3. **Rama montada en un worktree → se reporta, no se desmonta a lo bruto.**
   ```
   RETENIDA: "rama-x" esta montada en el worktree /home/.../.herdr/worktrees/...
       desmontarlo es decision tuya: git worktree remove "/home/..."
   ```
   Desmontar un worktree puede matar el panel de un agente que está trabajando ahí. La skill lo dice y
   se queda quieto.
4. **Rama actual → se sale a la base antes de borrar, pero solo si el arbol esta limpio.** Tras fusionar
   tu propia PR sigues encima de su rama y `git branch -D` no borra la rama en la que estas. Con el
   arbol limpio se hace `git checkout <base>` y se borra. Con cambios sin commitear **se rechaza** y se
   listan los ficheros: cambiarse de rama con trabajo por hacer es decision tuya, no de un script.

Además: si `git cherry` falla, **tampoco se borra** — no se asume «no hay pendiente» cuando en
realidad «no se pudo comprobar».

## Orden de una fusión completa

1. Leer la PR: estado, rama, base, si es draft.
2. Rechazar draft y PR cerrada sin fusionar.
3. Fusionar con `--rebase` (historial lineal, convención del repo).
4. `git fetch origin <base>` — verificar contra lo que hay en remoto, no contra un `main` local viejo.
5. Verificar con `git cherry` contra `origin/<base>`.
6. Salir de la rama si es la actual y el arbol esta limpio.
7. Borrar local y `origin/<rama>`.
8. `git fetch --prune` para no dejar referencias muertas.

## `--clean`

Para el caso real: **once ramas fusionadas vivas** que hay que barrer de golpe. Recorre las ramas
locales (excluye `main`/`master` y la actual) y aplica las mismas guardas a cada una. Informa de
cuántas borra y cuántas conserva, y **nunca** borra una que no haya pasado la verificación.

Siempre con `--dry-run` primero.

## Notas

- Si la PR ya está fusionada, no intenta fusionar otra vez: pasa directo a la verificación y al
  borrado.
- Si la rama ya no existe ni local ni remota, no es un error: informa y sigue.
- La remota puede fallar por permisos aunque la local se borre; se reporta por separado en vez de
  dar por hecho que falló todo.

## Distribución

Skill **propia de este repo**, en `.agents/skills/`, **no declarada** en el array `skills` de
`.bond/bond.toml`. La tiene quien se baje el repo; `bond init` no la instala en otros repos.
