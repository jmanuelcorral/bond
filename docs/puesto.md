# El puesto de trabajo: `bond`, `bond team`, `bond status`

Dentro de un repo, `bond` a secas abre su puesto de trabajo en Herdr: el agente por defecto del
repo en un panel y una shell en otro.

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
6. **Paneles:** el agente en el panel raíz y una shell al lado (60 % / 40 %, a la derecha).
   El agente se llama `<agente>-<repo>[-<rama>]`, con `-2`, `-3`… si el nombre está en uso.
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
| `-d`, `--direction <right\|down>` | Dónde va la shell (defecto: `right`) |
| `-r`, `--ratio <0.1-0.9>` | Fracción del panel del agente (defecto: 0.6) |
| `-l`, `--label <texto>` | Etiqueta del workspace |
| `--no-agent` | Solo paneles de shell |
| `--no-attach` | No enganchar la interfaz de Herdr |
| `--no-focus` | En segundo plano: ni enfoca ni engancha |
| `--trust-repository` | Se pasa a `herdr worktree` (solo en repos que hayas revisado) |
| `-- args…` | Argumentos para el agente, p. ej. `-- --model halo/flash-halogen` |

## `bond team`

```bash
bond team [repo] <rama[:agente]>... [--agent <a>] [--base <ref>] [-- args de los agentes]
```

Abre un worktree y un agente por rama, en segundo plano, y enseña la tabla de agentes de ese
repo. Sin `[repo]`, el del directorio actual. Cada rama lleva el agente de `rama:agente`; si no,
el de `--agent`; si no, el agente por defecto del repo (`default_agent` de `.bond/bond.toml`) y,
si no hay, el de `bond setup`. Avisa si un agente no está entre los del repo (no tendrá su
config) y si hay cambios sin commitear, que los worktrees no verán. El trabajo se reparte después: con
`herdr agent prompt <agente> "…"`, o desde cualquier agente con el skill `bond-team` (en pi,
`/team`), que además propone el reparto y recoge los resultados.

## Conducir los agentes

```bash
herdr agent prompt pi-mi-proyecto "revisa el diff actual" --wait --timeout 300000
herdr agent read pi-mi-proyecto --source recent-unwrapped --lines 200
herdr agent wait pi-mi-proyecto --until blocked --timeout 120000
herdr agent send-keys pi-mi-proyecto ctrl+c
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
