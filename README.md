<p align="center">
  <a href="https://josecorral.dev/bond/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/public/logo-dark.png">
      <img alt="bond" src="docs/public/logo-light.png" width="420">
    </picture>
  </a>
</p>

<p align="center"><b>Tus agentes de código, trabajando juntos.</b> · <i>007 · licence to code</i></p>

<p align="center">
  <a href="https://github.com/jmanuelcorral/bond/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/jmanuelcorral/bond/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/jmanuelcorral/bond/releases/latest"><img alt="Última release" src="https://img.shields.io/github/v/release/jmanuelcorral/bond?label=release&color=0ea5e9"></a>
  <a href="https://github.com/jmanuelcorral/bond/releases"><img alt="Descargas" src="https://img.shields.io/github/downloads/jmanuelcorral/bond/total?color=6366f1"></a>
  <a href="https://github.com/jmanuelcorral/homebrew-tap"><img alt="Homebrew" src="https://img.shields.io/badge/brew-jmanuelcorral%2Ftap%2Fbond-fbb040?logo=homebrew&logoColor=white"></a>
  <img alt="Linux, macOS y Windows" src="https://img.shields.io/badge/Linux%20%C2%B7%20macOS%20%C2%B7%20Windows-555?logo=linux&logoColor=white">
  <a href="LICENSE"><img alt="Licencia MIT" src="https://img.shields.io/github/license/jmanuelcorral/bond?color=22c55e"></a>
  <a href="https://josecorral.dev/bond/"><img alt="Documentación" src="https://img.shields.io/badge/docs-josecorral.dev%2Fbond-2dd4bf"></a>
</p>

**bond** es una CLI para trabajar con varios agentes de código a la vez: pi, Claude Code, Codex,
Copilot CLI, opencode, Crush, Gemini CLI y Antigravity, coordinados con
**[Herdr](https://herdr.dev)**. Ninguno es obligatorio: basta con tener uno.

<p align="center">
  <a href="https://josecorral.dev/bond/whats-new"><img alt="El modo hub en acción: un orquestador pi reparte un hola mundo entre un frontend React y un backend Express, un agente por repo" src="assets/hub-demo.webp" width="900"></a>
  <br>
  <sub><b>Nuevo en 1.10.0, el modo hub:</b> un orquestador pi reparte una historia entre un frontend y un backend, un agente por repo. <a href="https://josecorral.dev/bond/whats-new">Vídeo completo y novedades →</a></sub>
</p>

## En tres comandos

```bash
bond setup      # una vez por máquina: Herdr, endpoints de modelos, con qué agentes trabajas
bond init       # una vez por repo: qué agentes integrar, cuál por defecto, qué herramientas
bond            # cada día, dentro del repo: Herdr con el agente por defecto (gru)
```

- **`bond setup`** comprueba Herdr (y te dice cómo instalarlo si falta), detecta Ollama y LM
  Studio, te deja añadir OpenAI o cualquier endpoint compatible (como una pasarela propia) y
  lleva esos modelos a los agentes que pueden usarlos. Eliges tus agentes y uno por defecto;
  tus instrucciones (`~/.bond/AGENTS.md`) llegan a todos. Todo queda en `~/.bond/`, las claves
  con permisos 600.
- **`bond init`** genera la config de cada agente elegido en el repo (instrucciones, servidores
  MCP, skills, comandos) desde un único `.bond/bond.toml`, sin pisar lo que tengas a mano. Con pi,
  además las **Bond Extensions** (pie de estado, cabecera, `repo_map`, `/delegate`, `/team`).
- **`bond`** abre el puesto de trabajo en Herdr. Si ya existe, lo enfoca; si ya estás en él,
  abre el agente por defecto en ese panel. `bond --agent claude`,
  `bond --worktree feat/x` y `bond team feat/a feat/b:claude` para más agentes a la vez.

## Documentación

En la web: **[josecorral.dev/bond](https://josecorral.dev/bond/)**, en castellano
y en [inglés](https://josecorral.dev/bond/en/) (los mismos `docs/` y `docs/en/`, con
buscador). En el repo:

| Doc | Para qué |
|---|---|
| [docs/novedades.md](docs/novedades.md) | Lo nuevo de cada versión; en 1.10.0, el modo hub (con vídeo) |
| [docs/getting-started.md](docs/getting-started.md) | De cero a trabajar: instalación, setup, primer repo, bucle diario, glosario |
| [docs/puesto.md](docs/puesto.md) | `bond`, `bond team`, `bond status`: workspaces, agentes, worktrees, equipos |
| [docs/reference.md](docs/reference.md) | Referencia: cada comando, qué genera para cada agente y por qué |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Diagnóstico rápido (`bond doctor`) y errores habituales |
| [docs/plan-v1.md](docs/plan-v1.md) | Hoja de ruta hasta la 1.0 |
| [CHANGELOG.md](CHANGELOG.md) | Cambios por versión |

## Instalación

```sh
# Linux y macOS
curl -fsSL https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.sh | sh

# Homebrew (macOS y Linux)
brew install jmanuelcorral/tap/bond
```

```powershell
# Windows
powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.ps1 | iex"
```

Los instaladores descargan el binario de la [última release](https://github.com/jmanuelcorral/bond/releases/latest)
y comprueban su SHA-256. Después: `bond setup`. Para actualizar: `bond update`.

Desde el código (Node 22.18 o más): `git clone https://github.com/jmanuelcorral/bond && cd bond && npm ci --ignore-scripts && bin/bond setup`.

## Multiagente

| Qué | Cómo |
|---|---|
| Otro agente en vez del de por defecto | `bond --agent claude` |
| Trabajar en un worktree | `bond --worktree feat/x --base main` (usa `herdr worktree`) |
| Un equipo, un agente por rama | `bond team feat/a feat/b:claude --base main`: dentro de Herdr, minions en paneles de tu pestaña |
| Cómo va cada rama, mandarle trabajo, recoger | `bond team status`, `bond team prompt feat/a "…"`, `bond team clean` |
| Ver qué hace cada uno | `bond status`; `bond sessions` para retomar sesiones de pi |
| Delegar en otro agente desde un agente | Skill `bond-delegate`: en pi `/delegate reviewer:claude revisa el diff`; en Claude o Copilot `/bond-delegate …` |
| Un hub: un repo de operaciones con otros repos (submódulo o symlink) | `bond hub init` lo crea e importa los repos en `repos/`; `bond hub check`, `bond hub pull` y `bond team fix/x` (una rama vertical, un agente por repo) |
| Repartir una tarea entre worktrees desde un agente | Skill `bond-team`: en pi `/team <tarea>`; propone el reparto, espera tu OK y resume por rama |

`bond-delegate` y `bond-team` son skills globales: cualquier agente puede delegar en cualquier
otro. Todo respeta las reglas del skill `herdr`: Herdr solo se usa cuando lo pides, nombres
únicos, nada de merge, push ni limpieza automática, y nadie responde por ti a las preguntas de
un agente.

## Modo hub

Un **hub** es un repo de operaciones que agrupa otros repos (como submódulos o como symlinks a
tus clones) y trabaja con ellos en vertical: una rama con el mismo nombre en todos y un agente
por repo, coordinados desde el hub.

```bash
bond hub init                    # crea el hub, importa los repos en repos/ y les hace bond init
bond hub check                   # qué falta en cada repo y cómo arreglarlo (--fix)
bond hub pull                    # pone al día la base de cada repo (solo fast-forward)
bond team fix/login              # una rama vertical: un worktree y un agente por repo
bond team prompt fix/login "el login falla con emails en mayúsculas"
bond team collect fix/login --repo backend && bond team clean fix/login
```

La sesión vive en `hub.toml`, y el `AGENTS.md` del hub lleva un bloque generado con los repos y
las reglas del hub para el orquestador. Detalle en [Novedades](docs/novedades.md) y en la
[referencia](docs/reference.md#bond-hub).

## Flujo de trabajo con skills

`bond init` puede instalar en el repo skills que llevan una tarea de la issue a la release. Cada
paso enseña lo que va a escribir o publicar y espera tu OK:

refinar la issue → planificar por fases → ejecutar una fase → commit → PR → release

Salen marcadas `code-context`, `git-conventional-commit` (la usa `/commit`), `plan-create` y
`plan-execute`; son opcionales `issue-refine-github`, `delivery-review-github`,
`release-prepare-github` (las tres necesitan GitHub), `convention-document` y `plan-team`, que
ejecuta en paralelo las fases independientes de un plan, una rama de `bond team` por fase. Detalle en
[docs/reference.md](docs/reference.md#skills-del-catálogo).

## Capa de contexto

Para que el agente entienda un repo leyendo lo mínimo: tools de búsqueda nativas de pi
(`grep`, `find`, `ls`), la tool `repo_map` (mapa del repo en ~40 líneas), documentación de
librerías por versión (MCP `context7`), búsqueda web (MCP `duckduckgo`), `ast-grep` y el
skill `code-context`. Detalle y porqués en [docs/reference.md](docs/reference.md#capa-de-contexto).

```bash
pi mcp list            # comprobar los servidores MCP
```

## Desarrollo

```bash
npm ci --ignore-scripts          # dependencias (y TypeScript para comprobar tipos)
bin/bond <comando>               # bond desde el código fuente (Node >= 22.18)
npm run typecheck && bun test    # tipos y pruebas (test/)
bun scripts/build.mts            # dist/: binarios de Linux, macOS y Windows + paquete de npm
```

El binario lleva dentro el catálogo, los skills globales y las Bond Extensions, y los extrae
la primera vez en `~/.bond/runtime/<versión>/`. CI (`.github/workflows/ci.yml`) comprueba tipos,
pasa las pruebas, lo compila y prueba el binario en Linux, macOS y Windows. Hoja de ruta: [docs/plan-v1.md](docs/plan-v1.md).

## Estructura

```
bond/
├── bin/bond                      # punto de entrada (comprueba Node y carga cli/)
├── cli/                          # la CLI (TypeScript .mts, sin compilar desde el repo)
│   ├── main.mts                  # subcomandos
│   ├── setup.mts, wizard.mts     # bond setup
│   ├── repo.mts                  # bond init, bond sync
│   ├── catalog.mts               # bond catalog (create, check, add, list, update, remove, clean)
│   ├── catalog-git.mts           # catálogos por git: refs, caché y .bond/lock.json
│   ├── launch.mts, herdr.mts     # bond, bond dev, bond status
│   ├── team.mts                  # bond team (status, prompt, collect, clean)
│   ├── hub.mts, hub-init.mts     # bond hub: la sesión (hub.toml), init, add, sync
│   ├── hub-check.mts, hub-pull.mts   # bond hub check y bond hub pull
│   ├── sessions.mts              # bond sessions
│   ├── decisions.mts             # bond decisions: la memoria de decisiones y sus runs
│   ├── trust.mts                 # confianza de los agentes en los worktrees de bond team
│   ├── update.mts                # bond update
│   ├── config.mts, keys.mts      # ~/.bond: config.toml, claves
│   ├── endpoints.mts, models.mts, agents.mts, run.mts   # endpoints y modelos por agente
│   ├── instructions.mts          # instrucciones globales de cada agente
│   ├── catalog-agents.mts        # agentes conocidos y cómo instalarlos
│   ├── doctor.mts, suggestions.mts, migrate.mts, runtime.mts, util.mts
├── catalog/                      # lo que bond init instala en un repo
│   ├── catalog.toml              # nombre, resumen de cada skill y si sale marcada
│   ├── skills/                   # code-context, plan-create, plan-execute...
│   ├── commands/                 # review, commit, handoff (sintaxis común)
│   └── mcps/                     # servidores MCP, uno por fichero: context7, duckduckgo
├── templates/catalog/            # lo que bond catalog create escribe en un catálogo nuevo
├── global/skills/                # bond-delegate, bond-team (globales, para cualquier agente)
├── assets/                       # la vista previa animada del README
├── extensions/, prompts/, lib/   # Bond Extensions de pi (paquete: package.json → "pi")
├── scripts/build.mts             # binarios y paquete de npm
├── docs/                         # la documentación (también en GitHub Pages)
├── site/                         # el site de docs/ con VitePress (.github/workflows/pages.yml)
└── .github/workflows/ci.yml      # compila y prueba en Linux, macOS y Windows
```

`herdr/config.snippet.toml` lo aplica `bond setup --herdr-config`; `scripts/pi-resources` lista
lo que pi carga de verdad en un directorio (para depurar).

## Licencia

[MIT](LICENSE). El pie de estado y `bond sessions` parten de ideas de
[Jeyapaul/pi](https://github.com/Jeyapaul/pi) (MIT).
