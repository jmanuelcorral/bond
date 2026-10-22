# El puesto de trabajo: `bond`, `bond team`, `bond status`

Dentro de un repo, `bond` a secas abre su puesto de trabajo en Herdr: el agente por defecto del
repo, llamado `gru`, solo en su panel. Con `--shell`, una shell al lado.

```bash
cd ~/gitrepos/mi-proyecto
bond                              # agente por defecto (default_agent de .bond/bond.toml)
bond --agent claude               # otro de los agentes del repo
bond --worktree feat/login        # en un worktree de git para esa rama
bond dev ~/gitrepos/otro          # lo mismo para otro directorio
bond team . feat/a feat/b:claude  # un agente por rama, cada uno en su worktree
bond status                       # agentes vivos
```

## Qué hace `bond`

1. **Repo sin bond** (sin `.bond/bond.toml`): pregunta si inicializarlo (`bond init`). Fuera de
   un repo git, `bond` muestra la ayuda.
2. **Config al día:** si `bond.toml` cambió y la config de algún agente está desfasada, ejecuta
   `bond sync` antes de abrir (los conflictos, ficheros editados a mano, no se tocan).
3. **Agente:** el de `--agent`, si no el `default_agent` del repo, si no el de `bond setup`, si
   no el primero instalado. Tiene que admitirlo Herdr (`herdr agent start --help`) y estar
   instalado.
4. **Herdr:** fuera de Herdr arranca su servidor en segundo plano si no está; dentro, no anida
   otro.
5. **Workspace** con etiqueta `bond:<repo>` (o `bond:<repo>/<rama>` con `--worktree`). Si ya
   existe, lo enfoca y termina (también reconoce las etiquetas antiguas `pi:<repo>`).
6. **Paneles:** el agente solo, en el panel raíz; con `--shell`, una shell al lado (60 % / 40 %,
   a la derecha). El agente del checkout principal se llama `gru`, el que orquesta (`gru-2`,
   `gru-3`… si ya hay otro en Herdr); con `--worktree`, `<agente>-<repo>-<rama>`.
7. **Fuera de Herdr**, engancha su interfaz al terminar. Con `--no-attach` no; con `--no-focus`
   lo deja en segundo plano sin cambiar de workspace.

Si el agente se para en una pregunta al arrancar (Claude Code pide confiar en una carpeta nueva,
por ejemplo en un worktree), bond lo dice y no contesta por ti.

## Opciones

| Opción | Efecto |
|---|---|
| `-a`, `--agent <agente>` | Otro agente en vez del de por defecto |
| `-w`, `--worktree <rama>` | Worktree para esa rama con `herdr worktree` (lo crea, o lo abre si existe), colgado del workspace `bond:<repo>` |
| `-b`, `--base <ref>` | Con `--worktree`: de dónde sale una rama nueva |
| `--shell` | Una shell en otro panel, junto al agente |
| `-d`, `--direction <right\|down>` | Con `--shell`: dónde va la shell (defecto: `right`) |
| `-r`, `--ratio <0.1-0.9>` | Con `--shell`: fracción del panel del agente (defecto: 0.6) |
| `-l`, `--label <texto>` | Etiqueta del workspace |
| `--no-agent` | Una shell en vez del agente |
| `--no-attach` | No enganchar la interfaz de Herdr |
| `--no-focus` | En segundo plano: ni enfoca ni engancha |
| `--trust-repository` | Se pasa a `herdr worktree` (solo en repos que hayas revisado) |
| `-- args…` | Argumentos para el agente, p. ej. `-- --model halo/flash-halogen` |

## `bond team`

```bash
bond team [repo] <rama[:agente]>... [--agent <a>] [--base <ref>] [--tabs | --same-tab | --workspaces] [--yes] [--no-trust] [-- args de los agentes]
bond team status [repo] [--base <ref>] [--json | --watch [--keep-open]]
bond team prompt <rama> "la tarea" [--wait] [--timeout <ms>]
bond team clean [repo] [rama...] [--force] [--delete-branch] [--keep-table] [--dry-run]
```

Abre un worktree y un agente por rama y enseña cómo va cada rama (`status`). Dentro de Herdr,
cada agente va en un panel de tu pestaña, debajo del tuyo: en fila, con el mismo ancho. Cada uno
se llama como un minion, el primero libre (`kevin`, `stuart`, `bob`, `dave`...), y su panel se
titula `kevin · <rama>`. El worktree va en `~/.herdr/worktrees/<repo>/<rama>`. A la derecha del
tuyo se abre un panel estrecho, `tabla · <repo>`, con la tabla en vivo (`bond team status
--watch`) de todas las ramas, estén donde estén; si ya está, se reutiliza en vez de abrir otro.

Tu pestaña admite 6 paneles: el tuyo, la tabla y 4 minions (cuenta los que ya tiene). Si los
agentes nuevos no caben, `bond team` pregunta antes de crear nada:

1. `Pestañas nuevas` (por defecto): los que caben en la tuya y el resto en pestañas nuevas
   `equipo · <repo>` (`equipo · <repo> · 2`...), 4 por pestaña y en fila.
2. `Todo en mi pestaña`: filas de 4 (del quinto en adelante, debajo del de su columna), aunque
   se apriete.
3. `Workspaces aparte`: un workspace por rama, como con `--workspaces`.

`--tabs`, `--same-tab` y `--workspaces` eligen sin preguntar. Sin terminal (entrada o salida
redirigidas) o con `--yes`, no pregunta y aplica la 1. Con los que caben, nunca pregunta.
`status` y `clean` ven y cierran los paneles estén en la pestaña que estén; al cerrar el último
de una pestaña nueva, Herdr la quita. Fuera de Herdr, un workspace por rama con `herdr
worktree`, como antes. Sin `[repo]`, el del directorio actual. Cada rama lleva el agente de `rama:agente`; si no,
el de `--agent`; si no, el agente por defecto del repo (`default_agent` de `.bond/bond.toml`) y,
si no hay, el de `bond setup`. Avisa si un agente no está entre los del repo (no tendrá su
config) y si hay cambios sin commitear, que los worktrees no verán. El trabajo se reparte
después con `bond team prompt`, o desde cualquier agente con el skill `bond-team` (en pi,
`/team`), que además propone el reparto, espera tu OK y recoge los resultados. Para las fases
de un plan (`docs/plans/`), el skill del catálogo `plan-team` hace lo mismo por fases: comprueba
cuáles pueden ir a la vez, manda cada una con `plan-execute` (con commit en su rama, sin push) y
actualiza el plan al integrar cada rama.

**`status`**: una fila por worktree del repo con su estado, su agente, los commits por delante
de la base (por defecto, la rama del checkout principal) y los ficheros que toca:

| Estado | Qué quiere decir |
|---|---|
| `trabajando` | El agente está en ello |
| `bloqueado` | El agente espera una respuesta tuya (p. ej. confiar en la carpeta) |
| `sin commitear` | Hay cambios en el worktree fuera de un commit |
| `lista` | Tiene commits sin integrar: toca revisar |
| `integrada` | Ya está en la base, también si entró por rebase o squash |
| `sin commits` | Nada todavía (o se integró por fast-forward) |

pi y Claude Code preguntan si confías en cada carpeta nueva, y cada worktree lo es. En paneles,
si ya confías en el checkout principal (en pi, su entrada más cercana en
`~/.pi/agent/trust.json` es `true`; en Claude, él o una carpeta superior tiene
`hasTrustDialogAccepted` en `~/.claude.json`), bond da la misma confianza al worktree antes de
lanzar su agente, y arranca sin preguntar (`confianza heredada`). No toca nada más de esos
ficheros, respeta el cerrojo de pi y escribe de forma atómica; una carpeta en la que dijiste que
no confías se queda así. `--no-trust` lo desactiva. Sin esa confianza, con otros agentes o con
`--workspaces`, pregunta como siempre. Herdr no siempre lo ve como una pregunta, así que bond lee
el panel: la rama sale `bloqueado`, y `prompt` no manda nada, porque su Enter elegiría "Trust"
por ti y la tarea se perdería. Contesta tú en su panel; en pi, "Trust parent folder" una vez
sirve para todos los worktrees de ese repo.

Con `--watch`, la tabla en vivo: ocupa la pantalla, se refresca cada 2 s y sale con `q` o
Ctrl+C dejando el terminal como estaba. Las ramas van agrupadas por estado, primero lo que te
espera, y los grupos vacíos no salen:

```text
   MINION  RAMA    COMMITS  FICHEROS

⛔ Necesita tu respuesta
⛔ stuart  feat/b  -        -
   └ pregunta: confiar en la carpeta del proyecto

🔄 Trabajando
🔄 kevin   feat/a  +2       3

✏️ Sin commitear
✏️ bob     feat/e  -        1

📦 Por revisar
📦 -       feat/c  +1       1

✅ Integradas / sin empezar
✅ -       feat/d  +1       -
```

Cada fila lleva el icono de su estado (en color: rojo si te espera, amarillo si se mueve, verde
si toca revisar, tenue si no hay nada), el minion, la rama, los commits y los ficheros; bajo una
rama bloqueada, la pregunta que espera. El título de cada grupo dice el estado con palabras, así
que se entiende aunque el terminal no pinte bien los emoji, y las columnas se alinean contando
cada emoji como dos. En el panel de la tabla (`tabla · <repo>`), cuando ninguna
rama tiene trabajo pendiente (ni `trabajando`, `bloqueado`, `sin commitear` ni `lista`, ni un
agente abierto que aún no ha hecho commits; una rama a la que la tabla ya vio commits y vuelve a
`sin commits` se ha integrado por merge), muestra `sin trabajo pendiente`, espera unos
segundos a que se vea y cierra el panel; si vuelve a haber trabajo antes, sigue. No se cierra
si es el panel enfocado, ni con `--keep-open`, ni ejecutada a mano en otro panel: ahí solo avisa.

**`prompt`**: manda una tarea al agente de una rama, sin tener que saber su nombre.

**`clean`**: quita worktrees (carpeta, y su panel o workspace con el agente); las ramas se quedan. Sin ramas,
solo los integrados que abrió Herdr; con ramas, esas. Nunca uno con el agente trabajando o
esperando, con cambios sin commitear o en el que estás, salvo con `--force`. `--delete-branch`
borra además las ramas integradas. Si al acabar no queda ningún agente del equipo, cierra también
el panel de la tabla en vivo, y tu pestaña queda como estaba; `--keep-table` lo deja abierto (si
la tabla no tiene nada pendiente, luego se cierra ella sola salvo con `--keep-open`). El
workspace del repo no lo cierra: te dice cómo.

## Conducir los agentes

```bash
herdr agent prompt gru "revisa el diff actual" --wait --timeout 300000
herdr agent read gru --source recent-unwrapped --lines 200
herdr agent wait gru --until blocked --timeout 120000
herdr agent send-keys gru ctrl+c
```

Estados: `idle` y `done` listo para entrada, `blocked` esperando una respuesta tuya,
`working` ocupado, `unknown` Herdr no lo clasifica con seguridad.

## Limpiar

```bash
herdr worktree remove --workspace <id>   # quita el worktree y su workspace; la rama se queda
herdr workspace close <id>               # cierra un workspace normal
git branch -d <rama>                     # la rama, cuando ya no la quieras
```

bond no hace merge, rebase ni push, no borra ramas ni cierra workspaces, y no responde por ti a
los diálogos de los agentes: la confianza heredada de `bond team` solo repite la que ya diste al
checkout principal.
