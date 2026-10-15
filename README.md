# piSetup

Setup de desarrollo con el agente **[pi](https://pi.dev)** y **[Herdr](https://herdr.dev)**
versionados en un solo repo. La configuración vive aquí, se activa con symlinks y se puede
reinstalar o mover de máquina sin perder nada.

Dos piezas:

- **pi** → el agente. Su config de usuario (`~/.pi/agent`) apunta a este repo.
- **Herdr** → el multiplexor que mantiene los paneles vivos y sabe qué estado tiene cada
  agente (`idle`, `working`, `blocked`, `done`) desde la barra lateral.

## Documentación

| Doc | Para qué |
|---|---|
| [docs/getting-started.md](docs/getting-started.md) | De cero a trabajar: requisitos, instalación, primer arranque, bucle diario, glosario |
| [docs/pidev.md](docs/pidev.md) | Qué hace el lanzador paso a paso, flags, conducción del agente, casos de fallo |
| [docs/reference.md](docs/reference.md) | Inventario completo: ficheros, cada ajuste y su porqué, integración, actualizar, desinstalar |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Diagnóstico rápido y errores habituales |

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
crear otro. Y es acotado a propósito: no crea worktrees de git, no abre pestañas extra, no
cierra nada y no toca ninguna config. Detalle completo en [docs/pidev.md](docs/pidev.md).

## Instalación

```bash
cd ~/gitrepos/piSetup
./install.sh --dry-run   # opcional: ver qué va a hacer
./install.sh
```

Qué hace: instala pi si falta (con `bun`, sin `sudo`), enlaza `settings.json`,
`models.json`, `AGENTS.md` y `prompts/` en `~/.pi/agent` (guardando backup de lo previo), genera el skill
de Herdr para pi con `herdr --skill` e instala la integración
`~/.pi/agent/extensions/herdr-agent-state.ts`, que es lo que hace que los estados del
agente sean reales y no adivinados por pantalla.

Flags: `--dry-run`, `--no-pi`, `--herdr-config` (aplica los extras de Herdr, que son
opt-in porque tu `~/.config/herdr/config.toml` es tuyo).

## Arranque rápido

```bash
export PATH="$HOME/gitrepos/piSetup/bin:$PATH"
pidev ~/gitrepos/mi-proyecto --attach
```

Dentro de pi, una sola vez: `/login` (proveedor y credenciales, van a `~/.pi/agent/auth.json`)
y `/model` (`Ctrl+S` guarda el modelo por defecto). El proveedor `halo` de la config apunta a
los modelos locales de `halo.example` y no necesita credenciales: aparece en
`/model` nada más instalado el setup.

Para el día a día:

```bash
pidev ~/gitrepos/mi-proyecto              # abre/enfoca su workspace
pistatus                                  # agentes vivos, estado, panel
herdr agent prompt pi-mi-proyecto "revisa el diff" --wait
```

## Estructura

```
piSetup/
├── install.sh                    # instalador idempotente
├── bin/
│   ├── pidev                     # lanza el puesto de trabajo de un proyecto
│   └── pistatus                  # tabla de agentes vivos
├── docs/
│   ├── getting-started.md
│   ├── pidev.md
│   ├── reference.md
│   └── troubleshooting.md
├── pi/agent/                     # → symlinks desde ~/.pi/agent
│   ├── settings.json             # ajustes de pi
│   ├── models.json               # modelos locales (proveedor `halo`)
│   ├── AGENTS.md                 # instrucciones globales (español, estilo, git, Herdr)
│   └── prompts/                  # /review /commit /handoff /delegate
└── herdr/
    └── config.snippet.toml       # extras de Herdr, opcionales
```

Conviene versionar este repo: es la historia de la config de tu agente y lo que permite
reconstruir el puesto de trabajo en otra máquina.
