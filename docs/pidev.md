# `pidev` y `piteam`

`pidev` monta en Herdr el puesto de trabajo de un proyecto: un panel con un agente (pi, o
cualquier otro que Herdr reconozca) y otro con una shell para ti. Con `--worktree`, ese puesto
vive en un worktree de git propio. `piteam` hace lo mismo para varias ramas a la vez: un agente
por rama.

```bash
pidev ~/gitrepos/mi-proyecto                          # pi en el repo
pidev ~/gitrepos/mi-proyecto --kind claude            # Claude Code en vez de pi
pidev ~/gitrepos/mi-proyecto --worktree feat/login    # pi en un worktree de feat/login
piteam ~/gitrepos/mi-proyecto feat/a feat/b:claude --base main
```

## Paso a paso de `pidev`

**1. Comprobaciones.** `herdr` y `jq` en el PATH. El `--kind` se valida contra la lista que da
`herdr agent start --help` de la versión instalada, y su ejecutable (Herdr usa el kind como
ejecutable canónico) tiene que estar en el PATH. `--direction` solo `right` o `down`. `--base`
solo con `--worktree`, y `--worktree` solo dentro de un repo git (se usa su raíz).

**2. Etiqueta y nombre.** Etiqueta del workspace: `pi:<dir>`, o `pi:<dir>/<rama>` con
`--worktree` (o la de `--label`). Es la clave de reutilización. Nombre del agente:
`<kind>-<dir>[-<rama>]` en minúsculas y con guiones, hasta 29 caracteres (Herdr exige
`[a-z][a-z0-9_-]{0,31}`). Ejemplo: `Mi_App` con `--worktree feat/Login` → `pi-mi-app-feat-login`.

**3. Reutiliza si ya existe.** Si hay un workspace con esa etiqueta, lo enfoca y termina; con
`--no-focus` ni siquiera lo enfoca. La comparación es por etiqueta, no por ruta.

**4a. Sin `--worktree`:** `herdr workspace create --cwd <dir> --label <etiqueta>`.

**4b. Con `--worktree`:** los worktrees se cuelgan del workspace del repo `pi:<dir>`; si no
existe, se crea primero (sin agente). Sin ese workspace, Herdr abriría por su cuenta otro sin
etiqueta para el repo principal. Después:

- Si la rama ya tiene worktree (`herdr worktree list`): `herdr worktree open --branch <rama>`.
- Si no: `herdr worktree create --branch <rama> [--base <ref>]`. Si la rama no existe, se crea
  desde `--base` (o desde HEAD); si existe, se usa.

Herdr crea el worktree en `~/.herdr/worktrees/<repo>/<rama>` y le da su workspace.

**5. Parte el panel** para tu shell, con la proporción pedida y en el mismo directorio que el
agente (el del worktree, si lo hay), sin robar el foco.

**6. Lanza el agente** con `herdr agent start <nombre> --kind <kind> --pane <panel>` y lo que
pongas tras `--` como argumentos del agente. Si el nombre está vivo en otro sitio, añade `-2`,
`-3`… Si el agente no queda listo:

- `blocked`: está esperando una respuesta tuya. Pasa, por ejemplo, con Claude Code en una
  carpeta nueva (un worktree), que pregunta si confías en ella. `pidev` no responde por ti: te
  dice el panel y cómo leerlo.
- Otro caso: avisa y deja todo montado para que lo mires.

**7. Imprime el resultado** con los ids y los comandos para conducir el agente. Con
`--worktree`, también cómo quitar el worktree al terminar.

## Resultado

```
workspace  pi:mi-proyecto/feat-login        (worktree en ~/.herdr/worktrees/mi-proyecto/feat-login)
└── tab
    ├── panel w4:p1   pi-mi-proyecto-feat-login   (60%)
    └── panel w4:p2   shell                        (40%)
```

## Flags de `pidev`

| Flag | Defecto | Efecto |
|---|---|---|
| `directorio` posicional | `$PWD` | Proyecto a abrir |
| `-k`, `--kind` | `pi` | Agente: `pi`, `claude`, `codex`, `opencode`, `copilot`… (los que admita Herdr) |
| `-w`, `--worktree <rama>` | no | Trabaja en un worktree de esa rama, con `herdr worktree` |
| `-b`, `--base <ref>` | HEAD | Con `--worktree`: de dónde sale una rama nueva |
| `-d`, `--direction` | `right` | `right` o `down` |
| `-r`, `--ratio` | `0.6` | Fracción que ocupa el panel del agente |
| `-l`, `--label` | `pi:<dir>[/<rama>]` | Etiqueta del workspace, y clave de reutilización |
| `--trust-repository` | no | Se pasa a `herdr worktree`; solo en repos que hayas revisado |
| `--no-agent` | lanza agente | Deja los dos paneles en shell |
| `--no-focus` | enfoca | No cambia tu vista, ni al crear ni al reutilizar |
| `--attach` | no | Adjunta el TUI de Herdr al terminar (fuera de Herdr) |
| `-- args…` | | Argumentos para el agente, p. ej. `-- --model halo/flash-halogen` |

## `piteam`

```bash
piteam <repo> <rama[:kind]>... [--kind <kind>] [--base <ref>] [-- args de los agentes]
```

Llama a `pidev --worktree <rama> --no-focus` por cada rama y al final enseña la tabla de
`pistatus` filtrada a los agentes de ese repo. `rama:kind` cambia el agente para esa rama.
Si el workspace de una rama ya existe, se reutiliza (y lo dice). Una rama que falla no para a
las demás; al final se listan las que fallaron.

`piteam` solo monta el equipo. El trabajo se reparte después: a mano con
`herdr agent prompt <agente> "…"`, o desde un pi con `/team`, que además decide el reparto.

## Conducir los agentes

```bash
herdr agent prompt pi-mi-proyecto "revisa el diff actual" --wait --timeout 300000
herdr agent read pi-mi-proyecto --source recent-unwrapped --lines 200
herdr agent wait pi-mi-proyecto --until blocked --timeout 120000
herdr agent send-keys pi-mi-proyecto ctrl+c
herdr agent get pi-mi-proyecto
```

Estados: `idle` y `done` listo para entrada, `blocked` esperando una respuesta tuya,
`working` ocupado, `unknown` no lo clasifica con seguridad.

## Limpiar

```bash
herdr worktree remove --workspace <id>   # quita el worktree y su workspace; la rama se queda
herdr workspace close <id>               # cierra un workspace normal
git branch -d <rama>                     # la rama, cuando ya no la quieras
```

`worktree remove` se niega si hay cambios sin commitear; `--force` los descarta.

## Lo que `pidev` y `piteam` NO hacen

- No hacen merge, rebase ni push, ni borran ramas.
- No cierran workspaces, paneles ni worktrees.
- No responden por ti a los diálogos del agente (confianza en la carpeta, aprobaciones).
- No tocan la configuración de pi ni de Herdr.
- Si algo falla, no deshacen lo creado: avisan y lo dejan para que lo mires.

## Casos de fallo

| Síntoma | Causa y qué hacer |
|---|---|
| `kind 'x' no soportado por Herdr` | No está en `herdr agent start --help`. La lista sale de tu versión de Herdr. |
| `'claude' no está en el PATH` | El agente no está instalado o no es accesible. |
| `<kind> espera una respuesta tuya en <panel>` | Diálogo del agente (p. ej. confiar en la carpeta). Míralo con `herdr agent read <agente> --source visible` y contesta en el panel. |
| `herdr worktree create falló: … already exists` | La carpeta del worktree existe pero Herdr no lo ve como worktree de esa rama. Revisa `git worktree list` y `~/.herdr/worktrees/<repo>/`. |
| `herdr worktree … falló` pidiendo confianza | Herdr no confía en el repo. Revisa el repo y repite con `--trust-repository`. |
| `no pude leer los ids de la respuesta de Herdr` | El servidor no respondió lo esperado. `herdr status` y repite. |
| Dos workspaces para el mismo proyecto | Etiquetas distintas. Cierra el sobrante: `herdr workspace close <id>`. |
| `--attach` no hace nada | Ya estabas dentro de Herdr. |
