# BOND

![BOND](assets/bond-logo.png)

<details><summary>El logo en texto</summary>

```
╱╱╱╱╱╱ 007                        ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
╱╱╱╱╱╱ █▀▀▄ ▄▀▀▀▄ █▄  █ █▀▀▀▀▀▀▀▄ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
╱╱╱╱╱╱ █▀▀▄ █   █ █ ▀▄█ █       █ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
╱╱╱╱╱╱ █▄▄▀ ▀▄▄▄▀ █   █ █▄▄▄▄▄▄▄▀ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
```

</details>

**BOND** (*007 · licence to code*) es mi agente de desarrollo multiagente: el agente
**[pi](https://pi.dev)** con harness, herramientas de contexto y skills propios, lanzado y
coordinado con **[Herdr](https://herdr.dev)**. Todo versionado en un solo repo: la
configuración vive aquí, se activa con symlinks y se puede reinstalar o mover de máquina sin
perder nada.

Dos piezas:

- **pi** → el agente. Su config de usuario (`~/.pi/agent`) apunta a este repo.
- **Herdr** → el multiplexor que mantiene los paneles vivos y sabe qué estado tiene cada
  agente (`idle`, `working`, `blocked`, `done`) desde la barra lateral.

## Documentación

| Doc | Para qué |
|---|---|
| [docs/getting-started.md](docs/getting-started.md) | De cero a trabajar: requisitos, instalación, primer arranque, bucle diario, glosario |
| [docs/pidev.md](docs/pidev.md) | `pidev` y `piteam` paso a paso: kinds de agente, worktrees, equipos, limpieza, casos de fallo |
| [docs/reference.md](docs/reference.md) | Inventario completo: ficheros, cada ajuste y su porqué, integración, actualizar, desinstalar |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Diagnóstico rápido y errores habituales |
| [CHANGELOG.md](CHANGELOG.md) | Cambios por versión |

## ¿Qué hace `pidev`?

Monta en Herdr el puesto de trabajo de un proyecto en un solo comando. Sin él serían cinco
comandos de Herdr encadenados leyendo ids JSON a mano.

- Crea (o reutiliza) un **workspace** etiquetado `pi:<proyecto>` con el directorio del
  proyecto puesto.
- Parte el panel: **pi** en uno, **shell para ti** en el otro, con la proporción que pidas.
- Lanza pi como **agente con nombre** (`pi-mi-proyecto`) y espera a que Herdr lo detecte
  y lo vea listo para recibir entrada.
- Te imprime los ids para conducirlo desde cualquier otra terminal.

```
workspace  pi:mi-proyecto
└── tab
    ├── panel w3:p5   pi            (60%)
    └── panel w3:p6   shell         (40%)
```

Es reutilizable por etiqueta: relánzalo y te lleva al workspace que ya existe en vez de
crear otro. No cierra nada, no hace merge ni push y no responde por ti a los diálogos del
agente.

## Multiagente

| Qué | Cómo |
|---|---|
| Otro agente en vez de pi | `pidev <dir> --kind claude` (cualquier kind de `herdr agent start`) |
| Trabajar en un worktree | `pidev <dir> --worktree feat/x --base main` (usa `herdr worktree`) |
| Un equipo, un agente por rama | `piteam <dir> feat/a feat/b:claude --base main` |
| Delegar en otro agente (cualquier kind) en un panel hermano | Skill `bond-delegate`: en pi `/delegate reviewer:claude revisa el diff`; en Claude/Copilot `/bond-delegate …` |
| Repartir una tarea entre worktrees | Skill `bond-team`: en pi `/team <tarea>`; propone el reparto (`rama:kind`), espera tu OK, monta el equipo y resume por rama |

`bond-delegate` y `bond-team` son skills globales: los usa cualquier agente, así que un Claude
puede delegar en un pi o un pi en un Copilot. Todo respeta las reglas del skill `herdr`: Herdr solo se usa cuando tú lo pides (lanzar estos
comandos es pedirlo), nombres únicos, nada de merge, push ni limpieza automática. Detalle en
[docs/pidev.md](docs/pidev.md) y [docs/reference.md](docs/reference.md#herdr-skill-y-prompts).

## Instalación

Requisitos: Node 22.18 o más, Herdr, y `bun` o `npm` para instalar pi.

```bash
git clone https://github.com/jmanuelcorral/bond ~/gitrepos/bond
cd ~/gitrepos/bond
bin/bond setup --dry-run   # opcional: ver qué va a hacer
bin/bond setup             # deja además `bond` en el PATH
bond doctor                # comprueba que todo está bien
```

`./install.sh` sigue funcionando: es un atajo a `bond setup`.

Qué hace: instala pi si falta (con `bun`, sin `sudo`), enlaza `settings.json`,
`AGENTS.md` y `mcp.json` en `~/.pi/agent` (guardando backup de lo previo), registra el repo
como **paquete de pi** (`~/.pi/agent/bond`, de donde pi carga `extensions/`, `skills/` y
`prompts/`), deja un único skill de Herdr visible para pi e instala la integración
`~/.pi/agent/extensions/herdr-agent-state.ts`, que es lo que hace que los estados del
agente sean reales y no adivinados por pantalla.

Flags: `--dry-run`, `--no-pi`, `--herdr-config` (aplica los extras de Herdr, que son
opt-in porque tu `~/.config/herdr/config.toml` es tuyo).

## Arranque rápido

```bash
bond dev ~/gitrepos/mi-proyecto --attach
```

Dentro de pi, una sola vez: `/login` (proveedor y credenciales, van a `~/.pi/agent/auth.json`)
y `/model` (`Ctrl+S` guarda el modelo por defecto). Los modelos propios (como `halo`, en
`halo.example`) se declaran una vez en `~/.config/bond/config.toml` y
`bond models sync` los lleva a pi, opencode, Crush y Codex; `bond run copilot` los usa en
Copilot. Detalle en [docs/reference.md](docs/reference.md#modelos-globales-bond-models).

Para el día a día:

```bash
bond dev ~/gitrepos/mi-proyecto           # abre/enfoca su workspace
bond status                               # agentes vivos, estado, panel
bond sessions                             # sesiones, quién las tiene abiertas, cómo retomarlas
bond doctor                               # ¿está todo bien?
herdr agent prompt pi-mi-proyecto "revisa el diff" --wait
```

`bond dev`, `team`, `status` y `sessions` son los scripts `pidev`, `piteam`, `pistatus` y
`pisessions`, que siguen en `bin/` con las mismas opciones. Hacia dónde va `bond` (registro
global de modelos, `bond init` por repo para todos los agentes):
[docs/plan-bond-cli.md](docs/plan-bond-cli.md).

## Por repo: `bond init`

```bash
cd ~/gitrepos/mi-proyecto
bond init      # .bond/bond.toml + AGENTS.md + config de cada agente (MCP, skills, comandos)
bond sync      # tras editar .bond/bond.toml
```

Instrucciones, servidores MCP, skills y comandos se declaran una vez en el repo y bond genera
lo que lee cada agente (pi, Claude Code, Copilot, Codex, opencode, Crush, Gemini), sin pisar
lo que tengas a mano. Detalle en
[docs/reference.md](docs/reference.md#configuración-por-repo-bond-init-y-bond-sync).

## Capa de contexto

Para que el agente entienda un repo leyendo lo mínimo: tools de búsqueda nativas de pi
(`grep`, `find`, `ls`), la tool `repo_map` (mapa del repo en ~40 líneas), documentación de
librerías por versión (MCP `context7`), búsqueda web (MCP `duckduckgo`), `ast-grep` y el
skill `code-context`. Detalle y porqués en [docs/reference.md](docs/reference.md#capa-de-contexto).

```bash
pi mcp list            # comprobar los servidores MCP
```

## Estructura

```
bond/
├── package.json                  # el repo es un paquete de pi (manifiesto "pi")
├── assets/
│   └── bond-logo.png             # el logo para este README
├── lib/
│   └── bond-logo.mts             # logo de BOND: letras, degradado, campo de diagonales
├── extensions/
│   ├── bond-header.ts            # cabecera de pi con el logo de BOND
│   ├── status-line.ts            # pie: agente de Herdr, rama/worktree, contexto, coste
│   └── repo-map.ts               # tool repo_map: mapa compacto del repo
├── catalog/                      # lo que bond init instala en un repo
│   ├── mcp.json                  # servidores MCP: context7, web
│   ├── skills/code-context/      # contexto: repo-map, ast-grep, context7, web
│   └── commands/                 # review, commit, handoff (sintaxis común pi/Claude)
├── global/skills/                # bond-delegate, bond-team (globales, para cualquier agente)
├── prompts/                      # /delegate /team (atajos de pi a esos skills)
├── cli/                          # CLI bond (TypeScript, Node ≥ 22.18, sin compilar)
│   ├── main.mts                  # subcomandos
│   ├── setup.mts                 # bond setup (antes install.sh)
│   ├── doctor.mts                # bond doctor
│   ├── config.mts                # registro global de modelos (~/.config/bond/config.toml)
│   ├── models.mts                # bond models: init, list, probe, sync
│   ├── agents.mts                # generadores de modelos por agente
│   ├── run.mts                   # bond run copilot
│   ├── repo.mts                  # bond init, bond sync (config por repo)
│   └── util.mts
├── install.sh                    # atajo a `bond setup`
├── bin/
│   ├── bond                      # punto de entrada de la CLI
│   ├── pidev                     # lanza el puesto de trabajo de un proyecto
│   ├── piteam                    # un agente por rama, cada uno en su worktree
│   ├── bond-logo                 # pinta el logo en la terminal
│   ├── pistatus                  # tabla de agentes vivos
│   └── pisessions                # sesiones de pi con comando para retomarlas
├── scripts/
│   ├── pi-resources              # qué carga pi de verdad (extensiones, prompts, skills)
│   └── git-clean-settings        # filtro de git para settings.json
├── docs/
│   ├── getting-started.md
│   ├── pidev.md
│   ├── reference.md
│   └── troubleshooting.md
├── pi/agent/                     # → symlinks desde ~/.pi/agent
│   ├── settings.json             # ajustes de pi (declara el paquete ./bond)
│   ├── AGENTS.md                 # instrucciones globales (español, estilo, git, Herdr)
│   └── mcp.json                  # MCP: context7 (docs de librerías), web (DuckDuckGo)
└── herdr/
    └── config.snippet.toml       # extras de Herdr, opcionales
```

El repo está en git: es la historia de la config de tu agente y lo que permite reconstruir
el puesto de trabajo en otra máquina. pi escribe estado en `settings.json`
(`lastChangelogVersion`); el filtro `pi-settings` (`.gitattributes`) lo quita al hacer
`git add`, así que no ensucia los commits.
