# Plan: CLI `bond`

Estado: aprobado. F1 hecha (CLI `bond`: `setup`, `doctor`, `dev`, `team`, `status`, `sessions`, `logo`). F2 hecha (`bond models` y `bond run copilot`). Siguiente: F3. Fecha: 2026-10-15.

## Objetivo

Convertir piSetup en **`bond`**, una CLI con dos niveles:

- **Global** (`bond setup`, `bond models`): lo que es de la máquina. Herramientas, integración
  de Herdr, instrucciones personales y, sobre todo, **un registro único de modelos**
  (`flash-halogen` y los que vengan) del que se genera la configuración de cada agente.
- **Repo** (`bond init`, `bond add`, `bond sync`): lo que es del proyecto. Instrucciones, MCP,
  skills y comandos, declarados **una vez** y generados para cada agente elegido (pi, Claude
  Code, Codex, Copilot, opencode, Crush, Gemini).

## Lo que sabemos de cada agente

Comprobado el 2026-10-15 con los binarios instalados (claude 2.1.296, opencode 2.0.27, copilot
1.0.95, crush 0.98.1), la documentación local de pi 1.2.0 y la documentación y el código
oficiales de Codex (rust-v0.162.1) y Gemini CLI (0.64.0).

### Configuración de proyecto

| Agente | Instrucciones | MCP de proyecto | Skills de proyecto | Comandos de proyecto |
|---|---|---|---|---|
| pi | `AGENTS.md` | `.pi/mcp.json` (`mcpServers`) | `.agents/skills`, `.pi/skills` | `.pi/prompts/*.md` (`$1`, `$@`) |
| Claude Code | `CLAUDE.md` (`AGENTS.md` solo si no hay `CLAUDE.md`) | `.mcp.json` (`mcpServers`) | solo `.claude/skills` | `.claude/commands/*.md` (`$ARGUMENTS`) |
| Codex | `AGENTS.md` | `.codex/config.toml` (`[mcp_servers.x]`) | `.agents/skills` | solo de usuario (obsoletos: usa skills) |
| Copilot CLI | `AGENTS.md`, `.github/copilot-instructions.md` | `.mcp.json` o `.github/mcp.json` | `.agents/skills`, `.github/skills`, `.claude/skills` | no hay; usa skills |
| opencode v2 | `AGENTS.md` | `opencode.json` (`mcp.servers`, `command` como array) | `.agents/skills`, `.opencode/skills`, `.claude/skills` | `.opencode/commands/*.md` (`$ARGUMENTS`) |
| Crush | `AGENTS.md`, `CRUSH.md`, `CLAUDE.md`… | `.crush.json` (`mcp`) | `.agents/skills`, `.crush/skills`, `.claude/skills` | `.crush/commands` (`$NOMBRE` con nombre) |
| Gemini CLI | `GEMINI.md` (`AGENTS.md` con `context.fileName`) | `.gemini/settings.json` (`mcpServers`, `httpUrl`) | `.agents/skills`, `.gemini/skills` | `.gemini/commands/*.toml` (`{{args}}`) |

Lo que se deduce:

- **`AGENTS.md` en la raíz es la fuente de las instrucciones.** Claude necesita un `CLAUDE.md`
  que lo importe (`@AGENTS.md`). Gemini necesita `context.fileName`.
- **`.agents/skills/` es la fuente de los skills.** Lo leen todos menos Claude, que necesita
  `.claude/skills/` (symlinks).
- **MCP: un formato distinto casi por agente.** Hay que generar un fichero para cada uno.
- **Comandos: cuatro dialectos** (`$ARGUMENTS`, `$1`, `$NOMBRE`, `{{args}}`). Donde no hay
  comandos (Codex, Copilot), se exponen como skills.

### Modelos propios (tu pasarela `halo`)

La pasarela, comprobada hoy, responde a `/v1/chat/completions` y a `/v1/responses`, pero
**no** a `/v1/messages` (la API de Anthropic).

| Agente | ¿Puede usar `halo`? | Dónde se configura |
|---|---|---|
| pi | Sí | `~/.pi/agent/models.json` |
| opencode | Sí | `~/.config/opencode/opencode.jsonc` (`providers`, paquete openai-compatible) |
| Crush | Sí (ya lo tienes) | `crush.json` (`providers`, `openai-compat`) o tu `crushrc` |
| Codex | Sí, con `wire_api = "responses"` (Codex ya no acepta chat) | `~/.codex/config.toml` (`[model_providers]`) |
| Copilot CLI | Sí, pero solo por variables de entorno | `COPILOT_PROVIDER_BASE_URL`, `COPILOT_MODEL`… → `bond run copilot` |
| Claude Code | **No**: solo endpoints con API de Anthropic | sigue con tu cuenta de Anthropic |
| Gemini CLI | **No**: solo API de Gemini | sigue con su cuenta |

Hoy `flash-halogen` está declarado dos veces, de forma distinta: pi usa
`halo.example` y Crush `<IP-local>:18080`. El registro global lo resuelve.

## Diseño

### Nivel global: `~/.config/bond/`

```toml
# ~/.config/bond/config.toml
agents = ["pi", "claude", "opencode", "copilot", "crush"]   # instalados que bond gestiona

[providers.halo]
base_url = "http://halo.example/v1"
apis = ["chat", "responses"]          # lo rellena `bond models probe`
api_key_env = "HALO_API_KEY"          # opcional; nunca la clave en el fichero

[[providers.halo.models]]
id = "flash-halogen"
context = 131072
max_output = 8192
reasoning = true
```

- `bond models probe <proveedor>`: consulta `/v1/models` y prueba chat, responses y messages,
  para saber qué agentes pueden usar cada modelo.
- `bond models sync`: genera la configuración de modelos de cada agente compatible. Escribe
  solo su parte, nunca el fichero entero (ver "Ficheros que no son nuestros").
- Instrucciones personales (las de hoy en `AGENTS.md`: español, estilo, git) desde
  `~/.config/bond/AGENTS.md` al fichero global de cada agente: `~/.pi/agent/AGENTS.md`,
  `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.config/opencode/AGENTS.md`,
  `~/.copilot/copilot-instructions.md`, `~/.config/crush/CRUSH.md`.
- Integración de Herdr (`herdr integration install <agente>`) y skill de Herdr compartido.

### Nivel repo: `.bond/` como fuente única

```text
mi-repo/
├── .bond/
│   ├── bond.toml          # qué agentes, MCP, skills, comandos
│   ├── commands/          # comandos en formato canónico (Markdown, $ARGUMENTS/$1)
│   └── manifest.json      # ficheros generados y su hash (no editar)
├── AGENTS.md              # instrucciones del proyecto (fuente)
├── .agents/skills/        # skills (fuente)
└── … generados: CLAUDE.md, .mcp.json, .pi/, .claude/, .codex/, opencode.json, .crush.json, .gemini/
```

```toml
# .bond/bond.toml
agents = ["pi", "claude", "copilot", "codex"]

[mcp.context7]
url = "https://mcp.context7.com/mcp"

[mcp.web]
command = "uvx"
args = ["duckduckgo-mcp-server==0.7.0"]

[skills]
use = ["code-context", "bond-delegate", "bond-team"]   # del catálogo de bond o git:…

[commands]
use = ["review", "commit", "handoff"]

[pi]
package = "git:github.com/<tú>/bond@v0.2"   # extensiones de pi: pie, cabecera, repo_map
```

`bond sync` traduce esto a los ficheros de cada agente:

| Fuente | pi | Claude | Codex | Copilot | opencode | Crush | Gemini |
|---|---|---|---|---|---|---|---|
| `AGENTS.md` | nativo | `CLAUDE.md` con `@AGENTS.md` | nativo | nativo | nativo | nativo | `context.fileName` |
| MCP | `.pi/mcp.json` | `.mcp.json` | `.codex/config.toml` | `.mcp.json` | `opencode.json` | `.crush.json` | `.gemini/settings.json` |
| skills | nativo | symlinks en `.claude/skills/` | nativo | nativo | nativo | nativo | nativo |
| comandos | `.pi/prompts/` | `.claude/commands/` | como skill | como skill | `.opencode/commands/` | `.crush/commands/` | `.gemini/commands/*.toml` |
| extras | `.pi/settings.json` (paquete, `defaultTools`) | | | | | | |

### Ficheros que no son nuestros

Es la parte delicada: `.mcp.json`, `opencode.json` o tu `crushrc` pueden existir ya, con cosas
tuyas.

- Cada fichero generado lleva su hash en `.bond/manifest.json`. Si `bond sync` ve que alguien
  lo editó a mano, no lo pisa: enseña el diff y pregunta.
- En los ficheros compartidos (JSON y TOML), bond solo gestiona **sus claves** (sus servidores
  MCP, sus proveedores) y deja el resto intacto. En los de texto, un bloque entre marcas.
- `bond sync --dry-run` enseña qué cambiaría; `bond sync --check` falla si hay desajustes (CI).
- Los secretos nunca van en ficheros: solo referencias a variables de entorno.

### Multiagente

- `pidev`, `piteam`, `pistatus` y `pisessions` pasan a ser `bond dev`, `bond team`,
  `bond status` y `bond sessions`. Los nombres viejos quedan como alias un tiempo.
- `/delegate` y `/team` se convierten en skills (`bond-delegate`, `bond-team`) que admiten el
  tipo de agente (`rama:kind`). Así un Claude puede delegar en un pi, o al revés. En pi siguen
  también como prompts.
- `bond run <agente>` lanza un agente con el entorno que necesite (p. ej. Copilot con `halo`).

## Comandos

| Comando | Nivel | Qué hace |
|---|---|---|
| `bond setup` | global | Sustituye a `install.sh`: herramientas, integraciones de Herdr, instrucciones personales |
| `bond models list\|add\|probe\|sync` | global | Registro de modelos y generación por agente |
| `bond init [--agents …]` | repo | Crea `.bond/bond.toml` (con preguntas o flags) y sincroniza |
| `bond add\|remove agent\|mcp\|skill\|command <x>` | repo | Edita `bond.toml` y sincroniza |
| `bond sync [--dry-run\|--check]` | repo | Regenera los ficheros de cada agente |
| `bond doctor` | los dos | Comprueba que cada agente ve lo que debe (`pi mcp list`, `claude mcp list`…) |
| `bond dev\|team\|status\|sessions` | Herdr | Lo que hoy hacen `pidev`, `piteam`, `pistatus`, `pisessions` |
| `bond run <agente>` | | Lanza un agente con su entorno |
| `bond logo` | | El logo |

## Fases

Cada fase termina usable, con pruebas y documentación.

| Fase | Entrega | Cómo se verifica |
|---|---|---|
| **F0** Decisiones | Las de abajo, cerradas | — |
| **F1** Esqueleto | CLI `bond` instalable; `setup` hace lo mismo que `install.sh` hoy; `dev/team/status/sessions/logo` envuelven los scripts actuales; `doctor` para pi | Mismo resultado que `install.sh` en una máquina limpia (contenedor o `PI_CODING_AGENT_DIR` temporal) |
| **F2** Modelos globales | `config.toml`, `models probe/sync` para pi, opencode, Crush y Codex; `bond run copilot` | Cada agente responde con `flash-halogen` en modo no interactivo |
| **F3** Repo, pi y Claude | `init`, `sync`, manifest; generadores de instrucciones, MCP, skills y comandos para pi y Claude | Tests con ficheros de referencia por generador; `pi mcp list` y `claude mcp list` en un repo de prueba |
| **F4** Resto de agentes | Generadores para Codex, Copilot, opencode, Crush y Gemini; comandos como skills donde haga falta | Ídem con cada agente instalado; los no instalados, solo los ficheros de referencia |
| **F5** Multiagente | Skills `bond-delegate`/`bond-team` con kind; integración de Herdr por agente | Prueba en Herdr: un pi delega en un Claude, y un `/team` con ramas `pi` y `claude` |
| **F6** Publicación | Repo renombrado y publicado, versiones con tags, migración de piSetup | Instalar `bond` desde git en otra carpeta o máquina e inicializar un repo |

## Riesgos

- **Los formatos cambian.** opencode v2 ya cambió las claves de MCP y proveedores. Un generador
  por agente y versión, y `bond doctor` avisa si la versión instalada no es la probada.
- **Pisar configuración ajena.** Lo cubre el manifest, gestionar solo nuestras claves y `--dry-run`.
- **Confianza de proyecto.** Cada agente pide confiar en el repo a su manera; `bond init` lo
  explica y `doctor` lo detecta.
- **Paralelismo con el modelo local.** Varios agentes contra `halo` dan errores 429 (visto en
  `/team`). `bond team` debería poder repartir agentes entre modelos o limitar la concurrencia.
- **Claude y Gemini no usan `halo`.** Es un límite de los agentes, no de bond: se documenta en
  `bond models`.

## Decisiones

| # | Decisión | Elegido |
|---|---|---|
| 1 | Lenguaje de la CLI | TypeScript sobre Node ≥ 22, módulos `.mts` ejecutados sin compilar |
| 2 | Formato de configuración | TOML (`config.toml`, `bond.toml`) |
| 3 | ¿Se commitean los ficheros generados? | Sí, con `bond sync --check` para CI |
| 4 | Publicación y renombrado | Pendiente: se decide en F6 (¿público o privado?) |
| 5 | Primera ronda de agentes | pi y Claude Code (F3); el resto en F4 |
| 6 | URL de `halo` | `http://halo.example/v1` (la IP local es el mismo servicio detrás del proxy) |
