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
bond team [repo] <rama[:agente]>... [--agent <a>] [--base <ref>] [-- args de los agentes]
bond team status [repo] [--base <ref>] [--json]
bond team prompt <rama> "la tarea" [--wait] [--timeout <ms>]
bond team clean [repo] [rama...] [--force] [--delete-branch] [--dry-run]
```

Abre un worktree y un agente por rama, en segundo plano, y enseña cómo va cada rama
(`status`). Sin `[repo]`, el del directorio actual. Cada rama lleva el agente de `rama:agente`; si no,
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

pi pregunta si confía en cada carpeta nueva, y cada worktree lo es. Herdr no lo ve como una
pregunta, así que bond lee el panel: la rama sale `bloqueado`, y `prompt` no manda nada, porque
su Enter elegiría "Trust" por ti y la tarea se perdería. Contesta tú en su panel; "Trust parent
folder" una vez sirve para todos los worktrees de ese repo.

**`prompt`**: manda una tarea al agente de una rama, sin tener que saber su nombre.

**`clean`**: quita worktrees (carpeta, workspace y agente); las ramas se quedan. Sin ramas,
solo los integrados que abrió Herdr; con ramas, esas. Nunca uno con el agente trabajando o
esperando, con cambios sin commitear o en el que estás, salvo con `--force`. `--delete-branch`
borra además las ramas integradas. El workspace del repo no lo cierra: te dice cómo.

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
los diálogos de los agentes.
