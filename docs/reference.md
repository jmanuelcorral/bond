# Referencia del setup

Inventario completo: qué hay en el repo, dónde acaba cada cosa y cómo se toca.

## Componentes

| Pieza | Rol |
|---|---|
| **pi** | El agente. CLI mínimo y extensible (`@earendil-works/pi-coding-agent`). |
| **Herdr** | Multiplexor de terminales consciente de agentes. Servidor en segundo plano que mantiene vivos los paneles. |
| **Integración Herdr para pi** | Extensión de pi (`herdr-agent-state.ts`) que reporta a Herdr el estado real del agente. |
| **Skill de Herdr** | Documento que se carga pi para saber controlar Herdr desde dentro de un panel. |
| **`bond`** | CLI (`bin/bond`, `cli/`): `setup`, `doctor`, `models`, `run`, `init`, `sync`, `dev`, `team`, `status`, `sessions`, `logo`. |
| **`pidev`** | Lanzador del puesto de trabajo (`bond dev`). |
| **`pistatus`** | Tabla de agentes vivos. |
| **`piteam`** | Un agente por rama, cada uno en su worktree y workspace (`pidev --worktree` en bucle). |
| **Cabecera BOND** | Extensión `extensions/bond-header.ts`: logo al arrancar pi, compacto en paneles estrechos. |
| **`pisessions`** | Sesiones de pi de todos los proyectos, con el comando para retomarlas y el agente de Herdr que las tiene abiertas. |
| **Capa de contexto** | Tools `grep`/`find`/`ls`, tool `repo_map`, MCP `context7` y `duckduckgo`, `ast-grep`, skill `code-context`. |
| **Pie de estado** | Extensión `extensions/status-line.ts`: agente de Herdr, rama, worktree, contexto, coste, peticiones. |

## Dónde vive qué

El repo es la fuente de verdad; `~/.pi/agent` se enlaza a él.

| En el repo | Destino | Contenido |
|---|---|---|
| `pi/agent/settings.json` | `~/.pi/agent/settings.json` | Ajustes de pi |
| `pi/agent/AGENTS.md` | `~/.pi/agent/AGENTS.md` | Instrucciones globales |
| `pi/agent/mcp.json` | `~/.pi/agent/mcp.json` | Servidores MCP: `context7` y `duckduckgo` |
| raíz del repo (`package.json`) | `~/.pi/agent/bond` | Paquete de pi: `extensions/`, `skills/`, `prompts/` |
| (generado) `bond models sync` | `~/.pi/agent/models.json` | Modelos, desde `~/.config/bond/config.toml` |
| `herdr/config.snippet.toml` | se añade a `~/.config/herdr/config.toml` | Extras opcionales de Herdr |
| (compartido) | `~/.agents/skills/herdr/SKILL.md` | Skill de Herdr; si no existe, se genera en `~/.pi/agent/skills/herdr/` |
| (lo escribe Herdr) | `~/.pi/agent/extensions/herdr-agent-state.ts` | Integración |

Al ser symlinks, editar el fichero en `~/.pi/agent` edita el repo, que está en git.

## El repo como paquete de pi

`package.json` declara el repo como [paquete de pi](https://pi.dev/docs/latest/packages):

```json
"pi": {
  "extensions": ["./extensions"],
  "prompts": ["./prompts", "./catalog/commands"]
}
```

Los skills no van en el paquete: se instalan por repo con `bond init` (ver
[Configuración por repo](#configuración-por-repo-bond-init-y-bond-sync)). Si el paquete los
trajera, pi vería dos veces los que también están en el `.agents/skills/` del repo.

`settings.json` lo carga con `"packages": ["./bond"]`. Las rutas de paquetes en los
ajustes de usuario se resuelven desde `~/.pi/agent`, así que `bond setup` crea el symlink
`~/.pi/agent/bond -> <repo>`: el repo puede vivir en cualquier ruta y `settings.json` no
cambia. Un paquete local se carga desde su sitio, sin copiarlo, así que editar el repo y hacer
`/reload` basta.

Para añadir algo: un `.ts` en `extensions/` o un `.md` en `prompts/` (solo pi) o en
`catalog/commands/` (pi y, por repo, Claude); un skill nuevo, como carpeta en `catalog/skills/`. Verifica con `pi list` y `scripts/pi-resources`.

## `settings.json` y git

pi escribe en `settings.json` (es suyo): `lastChangelogVersion` en cada actualización, y
también lo que guardes con `Ctrl+S` en `/model` o `/thinking`. Como el fichero es un symlink
al repo, esos cambios caen en el repo:

- `lastChangelogVersion` es estado de máquina. El filtro de git `pi-settings`
  (`.gitattributes` + `scripts/git-clean-settings`, que registra `bond setup`) lo quita al
  hacer `git add`. El fichero de trabajo no se toca.
- Modelo y thinking por defecto sí son configuración: aparecen en `git diff` y se versionan
  si los commiteas.

## Layout de `~/.pi/agent`

Lo que pi reconoce ahí (lo que no creamos, lo crea pi al usarlo):

| Ruta | Qué guarda |
|---|---|
| `settings.json` | Ajustes de usuario |
| `keybindings.json` | Atajos de la UI de pi |
| `models.json` | Endpoints y modelos compatibles |
| `auth.json` | Claves y credenciales OAuth (**no versionar**) |
| `AGENTS.md` | Instrucciones globales |
| `SYSTEM.md` / `APPEND_SYSTEM.md` | Sustituye / añade al system prompt |
| `extensions/` | Extensiones de pi (aquí cae la de Herdr) |
| `skills/` | Skills y sus ficheros de apoyo |
| `prompts/` | Plantillas expuestas como comandos `/` |
| `themes/` | Temas |

La ubicación se puede cambiar con la variable `PI_CODING_AGENT_DIR`. La config de proyecto
vive en `.pi/` dentro del directorio de trabajo y carga tras conceder confianza al proyecto.

## Ajustes de pi puestos

En `pi/agent/settings.json`. Todos cambiables; esto es lo puesto y el por qué.

| Clave | Valor | Razón |
|---|---|---|
| `tuiMode` | `regular` | pi no usa pantalla alternativa: el transcript queda en el scrollback del panel de Herdr y se puede releer con el ratón o con `pane read`. Con `fullscreen` se comporta como app a pantalla completa dentro del panel. |
| `quietStartup` | `header` | Menos ruido al arrancar en paneles estrechos. |
| `defaultTools` | `+grep`, `+find`, `+ls` | Añade a las tools por defecto las de búsqueda nativas de pi (usan `rg` y `fd`): salida acotada, mejor que `rg` por `bash`. Ver [Capa de contexto](#capa-de-contexto). |
| `defaultThinkingLevel` | `medium` | Equilibrio coste/calidad. Se cambia con `/thinking` (`Ctrl+S` guarda). |
| `hideThinkingBlock` | `false` | Ver el razonamiento en el transcript. |
| `enableInstallTelemetry` | `false` | Sin telemetría de instalación/actualización. |
| `compaction.enabled` | `true` | Resumen automático al llenarse el contexto. |
| `compaction.reserveTokens` | `16384` | Reservado para la respuesta del modelo. |
| `compaction.keepRecentTokens` | `20000` | Reciente que se conserva sin resumir. |
| `retry.*` | `3` intentos, backoff `2s` a `60s` | Tolerancia a fallos transitorios del proveedor. |

Regla general de reintentos: dejar `retry.provider.maxRetries` en `0` salvo necesidad, para
que pi gestione él mismo los errores de cuota.

## Configuración por repo (`bond init` y `bond sync`)

Lo que es del proyecto (instrucciones, servidores MCP, skills, comandos) se declara en
`.bond/bond.toml` y `bond sync` genera lo que lee cada agente: pi, Claude Code, Copilot CLI,
Codex, opencode, Crush y Gemini CLI.

```bash
cd ~/gitrepos/mi-proyecto
bond init --list                 # catálogo: MCP, skills, comandos
bond init                        # todo el catálogo, para los agentes instalados
bond init --agents claude,codex --skills "" --commands review,commit
bond sync                        # tras editar .bond/bond.toml
bond sync --check                # en CI: falla si algo está desfasado
```

```toml
# .bond/bond.toml
agents = ["pi", "claude", "copilot", "opencode", "crush"]
mcp = ["context7", "duckduckgo"]
skills = ["code-context"]
commands = ["commit", "handoff", "review"]

[mcp_servers.postgres]           # servidores propios del repo; secretos con ${VAR}
command = "npx"
args = ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"]
```

Comandos propios del repo: ficheros Markdown en `.bond/commands/` (sintaxis común: `$ARGUMENTS`,
`$1`…). Skills propios: carpetas con `SKILL.md` en `.agents/skills/`.

**Instrucciones y skills.** `AGENTS.md` (lo crea `init` si falta; es tuyo) y `.agents/skills/`
los leen directamente pi, Copilot, Codex, opencode, Crush y Gemini. Las excepciones:

- Claude Code: `CLAUDE.md` con un bloque `@AGENTS.md` y un symlink por skill en
  `.claude/skills/`.
- Gemini: `context.fileName = ["AGENTS.md", "GEMINI.md"]` en `.gemini/settings.json`.

**MCP y comandos:**

| Agente | MCP del repo | Comandos | Probado |
|---|---|---|---|
| pi | `.pi/mcp.json` (`exposure: "direct"`) | catálogo: paquete global de bond; propios: `.pi/prompts/` | sí |
| Claude Code | `.mcp.json` | `.claude/commands/` | sí |
| Copilot CLI | el mismo `.mcp.json` | lee `.claude/commands/` como skills | sí |
| opencode v2 | `opencode.json` → `mcp.servers` | `.opencode/commands/` | sí (MCP) |
| Crush | `.crush.json` → `mcp` | no se generan (ver abajo) | sí (MCP) |
| Codex | bloque en `.codex/config.toml` (`[mcp_servers.x]`) | no tiene comandos de proyecto | no instalado |
| Gemini CLI | `.gemini/settings.json` → `mcpServers` (`httpUrl` para HTTP) | `.gemini/commands/*.toml` (`{{args}}`) | no instalado |

Comprobado con los agentes instalados: pi carga el skill y el comando propio y conecta los
MCP; Claude Code lee `AGENTS.md` a través de `CLAUDE.md`, ve los skills enlazados y ejecuta
comandos; Copilot lista los servidores del `.mcp.json` y los comandos de `.claude/commands`;
opencode y Crush conectan sus servidores. Codex y Gemini: ficheros generados según su
documentación y validados (TOML), pero sin probar con el agente.

Detalles por agente:

- **Copilot** solo carga los MCP del repo si confías en la carpeta (lo pregunta la primera vez;
  se guarda en `trustedFolders` de `~/.copilot/config.json`).
- **opencode** reconoce el proyecto cuando el repo tiene al menos un commit, y la primera
  consulta tras ese commit puede no ver aún los servidores. Usa un servicio en segundo plano:
  si cambias `XDG_CONFIG_HOME` para probar algo, ese servicio se queda con esa configuración
  hasta que lo pares.
- **Crush**: sus comandos de proyecto van en `.crush/commands/`, dentro de su directorio de
  datos, que él mismo ignora en git; por eso bond no los genera. Crush ofrece los skills como
  comandos.
- **Codex** solo carga `.codex/config.toml` en proyectos de confianza, y no tiene comandos de
  proyecto (solo de usuario y obsoletos en favor de skills).

### Qué toca y qué no

`.bond/manifest.json` apunta todo lo que escribió bond:

- **Ficheros de bond** (skills copiados, comandos): con su hash. Si alguien edita uno a mano,
  `sync` no lo pisa y lo marca con `!`; `--force` lo sobrescribe guardando copia `.bak`.
- **JSON compartidos** (`.mcp.json`, `.pi/mcp.json`, `.pi/settings.json`): bond solo reescribe
  sus claves; un servidor tuyo en `.mcp.json` se queda.
- **`CLAUDE.md`**: un bloque entre marcas `<!-- >>> bond >>> -->`; el resto es tuyo.
- **Quitar algo** de `bond.toml` (un skill, un agente) borra lo que generó bond, salvo lo que se
  editó a mano, y los directorios que quedan vacíos.

Se commitea todo: `.bond/`, `AGENTS.md` y lo generado. Así quien clone el repo sin bond
tiene igualmente la configuración de su agente.

**Confianza.** La primera vez, pi pregunta si confías en el proyecto (sin eso no carga `.pi/`)
y Claude Code pide aprobar los servidores de `.mcp.json`. bond no aprueba nada por ti.
`bond doctor` dentro de un repo con `.bond/` comprueba además que está al día.

## Modelos globales (`bond models`)

Los modelos se declaran **una vez** en `~/.config/bond/config.toml` (fuera del repo: son de
tu máquina) y `bond models sync` genera la configuración de cada agente que puede usarlos.

```toml
[providers.halo]
name = "Halo (local)"
base_url = "http://halo.example/v1"
free = true                       # coste 0: el pie de pi no simula gasto
# api_key_env = "HALO_API_KEY"    # si la pasarela pide clave: el NOMBRE de la variable

[[providers.halo.models]]
id = "flash-halogen"
context = 131072
max_output = 8192
reasoning = true
# agents = ["pi", "opencode"]     # opcional: solo para esos agentes
# enabled = false                 # apagado pero documentado

[providers.halo.pi]               # ajustes que solo usa pi, copiados tal cual
api = "openai-completions"
[providers.halo.pi.compat]
maxTokensField = "max_tokens"
# ...
```

| Comando | Qué hace |
|---|---|
| `bond models init` | Crea `config.toml`. Si hay un `models.json` de pi, importa sus proveedores (y los modelos comentados con `//`, como `enabled = false`) |
| `bond models list` | Proveedores, modelos, APIs y qué agentes pueden usar cada uno |
| `bond models probe [id]` | Pregunta a la pasarela qué sirve: lista de modelos y las APIs `chat`, `responses` y `messages` (una petición tras otra; las pasarelas locales no atienden varias a la vez). Lo guarda en `~/.config/bond/state.json` |
| `bond models sync` | Escribe la config de modelos de cada agente instalado. `--agent x`, `--dry-run` (enseña el diff), `--check` (sale con 1 si hay algo desfasado) |
| `bond run copilot` | Lanza Copilot CLI contra un modelo del registro (ver abajo) |

`bond setup` crea `config.toml` si falta y sincroniza pi; el resto de agentes, con
`bond models sync`. `bond doctor` avisa si algún agente quedó desfasado.

### Qué escribe en cada agente

| Agente | Fichero | Cómo | Necesita de la pasarela |
|---|---|---|---|
| pi | `~/.pi/agent/models.json` | Sus proveedores dentro de `providers`; el resto del fichero, igual | API de chat |
| opencode v2 | `~/.config/opencode/opencode.json(c)` | Ídem en `providers` (`settings.baseURL`, `limit.context/output`) | API de chat |
| Crush | `~/.config/crush/crushrc` | Bloque `# >>> bond >>>` al final, con `provider add` / `model add` | API de chat |
| Codex | `~/.codex/config.toml` | Bloque al final: `[model_providers.x]` con `wire_api = "responses"` y un perfil por modelo (`codex -p halo-flash-halogen`) | API Responses |
| Copilot CLI | (nada) | `bond run copilot` pone `COPILOT_PROVIDER_BASE_URL`, `COPILOT_MODEL`, límites y API | chat o Responses |
| Claude Code | — | No puede: solo habla la API de Anthropic (`/v1/messages`) | — |
| Gemini CLI | — | No puede: solo habla la API de Gemini | — |

Reglas para no pisar lo ajeno:

- En los JSON, bond solo reescribe los proveedores que gestiona (los de ahora y los que
  escribió la vez anterior, apuntados en `state.json`). Si quitas un proveedor del registro,
  desaparece de los agentes; lo que añadiste tú a mano se queda.
- En Crush y Codex, todo lo de bond va entre marcas; fuera de ellas no se toca nada. Si en
  `crushrc` defines a mano un proveedor con el mismo id, bond no lo duplica y avisa: manda lo
  tuyo. (Hoy pasa con `halo`, que tu `crushrc` define con la IP local `<IP-local>:18080`:
  bórralo de ahí si quieres que lo gestione bond.)
- La primera vez que bond toca un fichero, guarda una copia `.bak.<fecha>`.
- Los JSON con comentarios los pierden al reescribirse; bond avisa antes.

Comprobado de punta a punta con `flash-halogen`: pi (`pi -p`), opencode (`opencode run`),
Crush (`crush models`) y Copilot (`bond run copilot -p`) responden a través de `halo`. Codex
no está instalado: su bloque se genera pero no se ha probado con un Codex real.

### `bond run copilot`

```bash
bond run copilot                                  # primer modelo usable
bond run copilot --model halo/flash-halogen -p "explica este repo"
```

Copilot CLI admite un proveedor propio (BYOK) solo con variables de entorno, así que no hay
fichero que generar: `bond run` las pone y lanza `copilot` con el resto de argumentos. No
necesita cuenta de GitHub.

### La pasarela `halo`

`http://halo.example/v1` (llama-swap; la IP `<IP-local>:18080` es el mismo
servicio detrás del proxy). HTTP a pelo: el certificado de la host no cubre este nombre y con
HTTPS falla `tls: unrecognized name`. Sirve `/v1/chat/completions` y `/v1/responses`, no
`/v1/messages`.

Ajustes de pi (`[providers.halo.pi.compat]`), puestos a mano porque pi autodetecta estas cosas
por URL y esta host no la conoce:

| Clave | Valor | Verificado en la pasarela |
|---|---|---|
| `maxTokensField` | `max_tokens` | Acepta también `max_completion_tokens`; se fija `max_tokens` para no depender de la autodetección |
| `thinkingFormat` | `openai` | El razonamiento vuelve en `reasoning_content` (también en streaming) |
| `supportsReasoningEffort` | `true` | Acepta `reasoning_effort` |
| `supportsUsageInStreaming` | `true` | Acepta `stream_options.include_usage` y devuelve `usage` al final |
| `supportsFinishReason` | `true` | Los chunks traen `finish_reason` |
| `supportsDeveloperRole` | `true` | Acepta el rol `developer` |
| `supportsStore` | `false` | `store` se acepta pero no significa nada aquí |

| Modelo | Estado | Contexto | Salida máx. | Razona | Herramientas |
|---|---|---|---|---|---|
| `flash-halogen` | activo | 131072 | 8192 | sí (`reasoning_content`) | sí, también en streaming |
| `gufo-qwen38-27b` | `enabled = false` | 131072 | 2048 | no | sí (`auto` y `required`; no acepta `tool_choice` nombrado) |

`laya` y `winnow-12b-cpu` salen en `GET /v1/models` pero devolvían 404 al pedirles un chat, así
que no están declarados. `bond models probe` enseña qué lista la pasarela en cada momento.

### Gotchas de los modelos locales

- **Carga bajo demanda.** La pasarela tiene los modelos descargados y los sube a RAM al primer
  uso: el primer `prompt` tras un rato parado puede tardar mucho más que el resto.
- **`gufo` corta a 2048 tokens de salida.** Para un agente de código es justo: diffs o archivos
  largos se truncan. Si lo reactivas, tenlo en cuenta.
- **`settings.json` reserva 16384 tokens de respuesta** (`compaction.reserveTokens`) por encima
  del `maxTokens` de `gufo`; el límite real lo manda el modelo, no ese ajuste.
- **Sin TLS.** El tráfico, incluido el prompt, va en claro por la red. Vale en una LAN de
  confianza; no lo saques de ella.
- **No uses el proveedor `llama.cpp` que trae pi** (`/login llama.cpp`, `LLAMA_BASE_URL`) para
  esto: está pensado para el router de llama.cpp en local, exige login interactivo y gestión de
  carga con `/llama`. Con el registro de bond funciona headless en los paneles de Herdr.
- **Varios agentes a la vez** contra la misma pasarela local dan errores 429: no atiende varias
  peticiones en paralelo.

## Instrucciones globales (`AGENTS.md`)

Se aplican en todos los proyectos, en cualquier carpeta. Cubren:

- **Idioma**: respuestas en español; código, identificadores y commits en inglés.
- **Método**: leer antes de editar, no asumir APIs, verificar con lo más específico primero,
  no repetir un enfoque que ya falló.
- **Git**: ni commit ni push sin pedido explícito.
- **Contexto**: tools `grep`/`find`/`ls` antes que `bash`, `repo_map` al entrar en un repo,
  skill `code-context` para APIs externas; nada privado a la búsqueda web.
- **Herdr**: alineado con el skill `herdr` (ver [Herdr: skill y prompts](#herdr-skill-y-prompts)).
  Solo se usa cuando lo pides tú o un comando como `/delegate`; nada de paneles ni agentes por
  iniciativa propia, ni workspaces o worktrees sin petición; `--no-focus`, `--cwd "$PWD"`,
  ids del JSON y nombres únicos; no cerrar lo ajeno; no ejecutar `herdr` sin subcomando; y
  fuera de Herdr no controlar ninguna sesión.
- **Seguridad**: no volcar secretos (`auth.json`, `.npmrc`, tokens) en respuestas ni logs.

## Plantillas de prompt

Ficheros Markdown en `prompts/` (parte del paquete); el nombre de fichero es el comando.

| Comando | Argumentos | Resultado |
|---|---|---|
| `/review [foco]` | foco, por defecto "los cambios sin commitear" | Revisión priorizada (bugs, seguridad, errores, rendimiento, estilo) con `fichero:línea`. No edita. |
| `/commit [contexto]` | contexto extra | Propuesta de mensaje en inglés, muestra y espera OK. Nunca push. |
| `/handoff [ruta]` | ruta, por defecto `.pi-handoff.md` | Estado escrito: objetivo, estado, ficheros, verificación, siguientes pasos. |
| `/team <tarea...>` | tarea a repartir | Propone 2-3 subtareas independientes con su rama, espera tu OK, monta el equipo con `piteam`, reparte, espera, revisa cada rama y propone orden de integración. Sin merge ni push. |
| `/delegate [rol] [tarea...]` | rol `reviewer`; tarea por defecto, revisar los cambios sin commitear | Lanza otro pi con nombre único en un panel hermano, le pasa la tarea, espera, lee y resume. Ver [abajo](#herdr-skill-y-prompts). |

Sustituciones disponibles en cualquier plantilla: `$1`, `$@` / `$ARGUMENTS`,
`${1:-defecto}`, `${@:N}`, `${@:N:L}`.

## Integración de Herdr para pi

```bash
herdr integration status | grep '^pi:'
# pi: current (v9) (~/.pi/agent/extensions/herdr-agent-state.ts)
```

Sin ella, Herdr clasifica a pi mirando la pantalla. Con ella, el propio pi reporta su ciclo
de vida, así que `working` / `blocked` / `done` pasan a ser fiables y las notificaciones
llegan bien. Se instala con `herdr integration install pi` y se quita con
`herdr integration uninstall pi`.

## Skill de Herdr

pi lee skills de `~/.pi/agent/skills/` y también de `~/.agents/skills/`, la ubicación
compartida con otros agentes (Claude Code, opencode…), que es donde lo deja `npx skills add`.
Dos skills con el mismo nombre colisionan, así que `bond setup` deja solo uno:

- Si existe `~/.agents/skills/herdr/SKILL.md`, usa ese y borra la copia de
  `~/.pi/agent/skills/herdr/` si es la que generaba él (si la editaste, avisa y no la toca).
  Si el compartido no coincide con `herdr --skill`, avisa de que está desfasado.
- Si no existe, ejecuta `herdr --skill` y lo guarda en `~/.pi/agent/skills/herdr/SKILL.md`,
  para que describa la CLI **de la versión instalada**.

No se versiona en el repo.

Con el skill cargado, un pi que está dentro de un panel de Herdr sabe partir paneles, lanzar
comandos sin robar el foco, leer salida de otros paneles y esperar a otros agentes. Es lo
que hace posible `/delegate`.

## Herdr: skill y prompts

### Multiagente entre agentes distintos

La delegación y los equipos son **skills globales** (`global/skills/`), porque dependen de
Herdr, una herramienta de la máquina, igual que el skill `herdr`. `bond setup` los enlaza en
`~/.agents/skills/` (lo leen pi, Codex, Copilot, opencode, Crush y Gemini) y en
`~/.claude/skills/` (Claude Code), así que cualquier agente puede orquestar a cualquier otro:

| Skill | Qué hace | Cómo se pide |
|---|---|---|
| `bond-delegate` | Lanza otro agente en un panel hermano, le pasa la tarea, espera y resume | pi: `/delegate rol:kind tarea`; Claude/Copilot: `/bond-delegate …` o pidiéndolo |
| `bond-team` | Reparte una tarea en 2-3 ramas con `bond team` (`rama:kind`), espera el OK, recoge y resume | pi: `/team tarea`; resto: `/bond-team …` o pidiéndolo |

El kind es cualquiera de `herdr agent start --help` con su ejecutable instalado; sin kind,
`pi`. Un modelo concreto para el delegado va tras `--` (`--model haiku` en Claude). En pi,
`/delegate` y `/team` son atajos que cargan estos skills.

Los skills solo se activan si lo pides (lo dice su descripción, como exige el skill `herdr`).
Cuando el delegado se para en una pregunta (confiar en la carpeta, aprobar algo), el
orquestador te la enseña y espera tu respuesta: no contesta por ti.

**Integraciones de Herdr.** `bond setup` instala `herdr integration install <agente>` para
cada agente instalado que Herdr soporte (hoy: pi, Claude Code, Copilot, opencode; Crush no
tiene integración y Herdr lo detecta por pantalla). Con la integración, el estado `working`,
`blocked` o `done` lo cuenta el propio agente. `bond doctor` las comprueba.

**Probado** en un workspace de prueba: un Claude Code (Haiku) orquestador usó `bond-delegate`
para delegar en Copilot; Copilot se paró en la pregunta de confianza, Claude la enseñó y
esperó, y con la respuesta Copilot hizo la tarea (`wc -l`, resultado correcto). La prueba
encontró el choque del servidor `web` con el espacio de nombres reservado de OpenAI, ya
resuelto (ahora `duckduckgo`). Pendiente: pi orquestando a otro kind con `halo` (la pasarela
estaba saturada durante la prueba).

### Reglas del skill `herdr`

El skill `herdr` (lo escribe Herdr, no este repo) fija unas reglas que todo lo de este setup
respeta, para que el agente no reciba instrucciones contradictorias:

| Regla del skill | Cómo se cumple aquí |
|---|---|
| Solo se usa si el usuario lo pide, no porque algo tarde o se pueda paralelizar | `AGENTS.md` lo repite. Los skills `bond-delegate`/`bond-team` solo se activan a petición, y los prompts `/delegate` y `/team` empiezan con "Te pido expresamente que uses Herdr…": invocarlos es la petición explícita. |
| Nada de workspaces, pestañas, worktrees ni otro directorio sin petición | `/delegate` trabaja en un panel hermano y en `$PWD`. Los worktrees los crean `pidev`/`piteam` (los lanzas tú) o `/team`, que lo pide expresamente y además espera tu OK al reparto antes de crear nada. |
| Worktrees con `herdr worktree`, no `git worktree` a mano | `pidev --worktree` usa `worktree create`/`open` colgados del workspace `pi:<repo>`, así Herdr los agrupa y los sabe quitar. |
| `--trust-repository` solo tras revisar el repo | `pidev`/`piteam` solo lo pasan si tú pones `--trust-repository`. |
| La CLI instalada manda sobre la memoria | Los prompts remiten al skill y a `herdr <grupo>`; solo fijan el procedimiento. |
| Nombres de agente únicos | `/delegate` usa `<rol>-<n>` con el primer `n` libre en `herdr agent list`. |
| Split según la forma del panel | `/delegate` lee su `rect` en `herdr pane layout`: `right` si `width >= 120` y `width >= 2*height`, si no `down`. |
| `agent_not_ready`, `blocked`, `timeout`, `agent_prompt_stalled` | Cubiertos: mirar el panel antes de actuar, preguntarte ante una aprobación, nunca reenviar a ciegas. |
| Respuesta incompleta al leer | Plan B: el delegado la escribe en un fichero bajo `mktemp -d` y se lee de ahí. |
| No cerrar lo que no creaste; no ejecutar `herdr` sin subcomando | En `AGENTS.md` y en `/delegate` (el panel y el agente se quedan abiertos). |

**Probado** con `halo/flash-halogen` como orquestador en un workspace de prueba: tres
delegaciones seguidas dieron `reviewer-1`, `tester-1` y `reviewer-2` (nombres únicos), split
a la derecha en un panel de 263×50 y 132×50 y hacia abajo en uno de 66×50, mensaje
autocontenido al delegado, lectura y verificación del resultado por el orquestador.

`/team` también probado: en un repo de prueba repartió "función con test" y "README" en
`team/discount` y `team/readme`, esperó el OK, montó el equipo con `piteam`, cada agente hizo
commit en su rama, y el orquestador revisó ambas ramas y propuso el orden de integración.

**Paralelismo con el modelo local.** En esa prueba un agente recibió un 429 de la pasarela
`halo`: dos agentes pidiendo a la vez al mismo modelo local. El orquestador comprobó que no
había commits y reenvió la tarea al terminar el otro. Con modelos locales, el paralelismo real
lo limita la pasarela; con proveedores en la nube, la cuota.

**Argumentos.** Van separados como en una shell: `/delegate reviewer revisa el diff` da rol
`reviewer` y tarea `revisa el diff` (`${@:2}`). Si el primer argumento no parece un rol
(`/delegate revisa el diff`), el prompt le dice al agente que use `reviewer`.

## `bond setup` (antes `install.sh`)

`cli/setup.mts`. `./install.sh` es ahora un atajo que llama a `bond setup` con las mismas
opciones. Orden que sigue:

1. Comprueba `herdr` en el PATH.
2. Instala pi si falta: `bun add -g @earendil-works/pi-coding-agent`, o si no hay bun
   `npm install -g --ignore-scripts --prefix ~/.npm-global ...`.
3. Crea `~/.pi/agent/extensions`.
4. Instala las dependencias de la CLI (`npm ci --ignore-scripts`) si faltan.
5. Enlaza `settings.json`, `AGENTS.md` y `mcp.json` (backup `.bak.<fecha>` de lo previo).
5. Enlaza el repo como paquete en `~/.pi/agent/bond` y quita el symlink antiguo
   `~/.pi/agent/prompts` si apuntaba al repo.
6. Deja un único skill de Herdr (ver arriba).
7. Registra el filtro de git `pi-settings` en el repo.
8. Avisa de las herramientas de contexto que falten (`rg`, `fd`, `ast-grep`, `uvx`, `jq`).
9. Instala la integración de Herdr para pi si no está `current`.
10. Con `--herdr-config`, añade el snippet a `~/.config/herdr/config.toml` entre marcas
    `>>> bond >>>` y recarga el servidor.
11. Enlaza `bond` en el primero de `~/.local/bin`, `~/bin` o `~/.bun/bin` que esté en el PATH.
    Si ya hay otro `bond`, no lo toca.

| Flag | Efecto |
|---|---|
| `--dry-run` | Imprime las acciones sin ejecutar nada |
| `--no-pi` | Se salta la instalación del CLI de pi |
| `--herdr-config` | Aplica el snippet de Herdr (opt-in: tu `config.toml` es tuyo) |
| `-h`, `--help` | Uso |

Respeta `PI_CODING_AGENT_DIR`: con un directorio vacío hace una instalación desde cero sin
tocar la tuya, que es como se prueba.

## `bond doctor`

`cli/doctor.mts`. Comprueba en unos segundos lo que deja `bond setup` y lo que depende de
fuera, y sale con 1 si algo falla:

| Comprobación | Fallo típico y arreglo |
|---|---|
| Node ≥ 22.18 | actualizar Node |
| Herdr: binario, servidor, integración de pi | `herdr`; `bond setup` |
| pi: binario, enlaces de `~/.pi/agent`, paquete `./bond` en `pi list` | `bond setup` |
| Symlink antiguo `~/.pi/agent/prompts` (aviso) | `bond setup` |
| Skill de Herdr: uno solo y al día con `herdr --skill` | `bond setup`; `npx skills update herdr` |
| Filtro de git `pi-settings` | `bond setup` |
| `rg`, `fd`, `ast-grep`, `uvx`, `jq` (aviso) | instalar la que falte |
| Servidores MCP conectados (`pi mcp list`) | ver troubleshooting; `--quick` se lo salta |
| Dependencias (`node_modules`), `config.toml`, pi al día con el registro (otros agentes: aviso) | `bond setup`; `bond models sync` |
| La pasarela de cada proveedor del registro sirve los modelos declarados | revisar la pasarela |
| `bond` en el PATH y es el de este repo | `bond setup` |

## Snippet de Herdr

`herdr/config.snippet.toml`, solo con claves verificadas contra `herdr --default-config`:

| Clave | Efecto |
|---|---|
| `terminal.new_cwd = "follow"` | Paneles, pestañas y workspaces nuevos nacen en el directorio del panel de origen |
| `ui.show_agent_labels_on_pane_borders = true` | En paneles divididos se ve qué agente ocupa cada uno |

Para ver todas las opciones de Herdr: `herdr --default-config`. Para recargar tras editar:
`herdr server reload-config`.

## Variables de entorno

| Variable | Quién la pone | Para qué |
|---|---|---|
| `HERDR_ENV` | Herdr en cada panel | `1` significa "estoy dentro de un panel de Herdr" |
| `HERDR_WORKSPACE_ID` | Herdr | Id del workspace del panel (`w3`) |
| `HERDR_TAB_ID` | Herdr | Id de la pestaña (`w3:t1`) |
| `HERDR_PANE_ID` | Herdr | Id del panel (`w3:p5`) |
| `PI_CODING_AGENT_DIR` | Tú, si quieres | Cambiar `~/.pi/agent` de sitio |

## Capa de contexto

Lo que el agente tiene para entender un repo leyendo lo mínimo. Todo probado de punta a punta
con `halo/flash-halogen`.

| Pieza | Dónde | Para qué |
|---|---|---|
| Tools `grep`, `find`, `ls` | `settings.json` → `defaultTools` | Búsqueda con salida acotada. Necesitan `rg` y `fd`. |
| Tool `repo_map` | `extensions/repo-map.ts` | Mapa del repo en ~40 líneas: manifiestos y comandos, árbol con nº de ficheros, lenguajes, ficheros más tocados. |
| MCP `context7` | `pi/agent/mcp.json` | Documentación de librerías por versión (`resolve-library-id`, `query-docs`). Remoto, sin clave. |
| MCP `duckduckgo` | `pi/agent/mcp.json` | Búsqueda en DuckDuckGo y lectura de páginas (`search`, `fetch_content`). `uvx duckduckgo-mcp-server==0.7.0`, sin clave. |
| `ast-grep` | `bun add -g @ast-grep/cli@0.45.3` | Búsqueda estructural por sintaxis. |
| Skill `code-context` | `catalog/skills/code-context/` (por repo, con `bond init`) | Cuándo usar cada cosa, recetas de `ast-grep` por lenguaje. |

**Por qué `repo_map` es una tool y no solo un script del skill.** En la prueba, el modelo local
no cargó el skill por iniciativa propia y se orientó con `git log` a mano (y contó mal). Con la
tool declarada la llama la primera y el resultado cuadra. Los modelos pequeños usan mucho mejor
una tool que un skill que tienen que decidir abrir.

**Por qué el servidor de búsqueda se llama `duckduckgo` y no `web`.** La API de OpenAI reserva
el espacio de nombres `web` para sus tools: Copilot (con modelos de OpenAI) fallaba con
`Function 'web.web-expand_link' is not allowed in reserved namespace 'web'`, y Codex usa la misma
API. En `bond.toml`, `"web"` sigue aceptándose como alias (con aviso).

**Por qué los MCP van con `exposure: "direct"`.** Por defecto pi expone las tools MCP solo a
través de `codemode` (el modelo escribe JavaScript que las llama). Para un modelo local eso es
un paso más donde fallar, y con 5 tools en total no hace falta ahorrar declaraciones. Si se
añaden servidores grandes, conviene `"exposure": "deferred"` y `tool_search`.

**Versiones fijadas.** El servidor `duckduckgo` y `ast-grep` van con versión exacta y de al menos dos
semanas de antigüedad, para no ejecutar lo publicado ayer. Para actualizar: cambia la versión
en `mcp.json` (o reinstala `ast-grep`) y verifica con `pi mcp list`.

**Privacidad.** `context7` y `duckduckgo` son servicios externos: reciben las consultas, no el código.
`AGENTS.md` pide no mandar a la web código ni datos privados.

Comprobar y depurar:

```bash
pi mcp list                       # conecta cada servidor y lista sus tools
scripts/pi-resources              # tools y skills que pi carga del paquete
tail ~/.pi/agent/mcp.log          # logs de los servidores
```

Dentro de pi, `/mcp` muestra estado, tools y exposición, y permite desactivar un servidor.

Para usar una clave de Context7 (más cuota), añade a su entrada
`"headers": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}" }` y exporta la variable; no pongas la
clave en el fichero.

## Cabecera BOND (`extensions/bond-header.ts`)

Sustituye la cabecera de pi por el logo de BOND: la palabra en 3 filas de medios bloques
(`▀ ▄ █`) con degradado de magenta (`#FF3EC9`) a azul oscuro (`#1F2FA8`), una fila de datos
encima (`007` a la izquierda, versión de pi a la derecha) y un campo de diagonales `╱`. El
estilo está inspirado en el logo de Crush (charmbracelet); las letras y el código son propios,
porque el de Crush tiene licencia FSL.

```
╱╱╱╱╱╱ 007                        ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
╱╱╱╱╱╱ █▀▀▄ ▄▀▀▀▄ █▄  █ █▀▀▀▀▀▀▀▄ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
╱╱╱╱╱╱ █▀▀▄ █   █ █ ▀▄█ █       █ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
╱╱╱╱╱╱ █▄▄▀ ▀▄▄▄▀ █   █ █▄▄▄▄▄▄▄▀ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
```

- Se adapta al ancho: con sitio, diagonales a los lados y en escalera a la derecha (con tope
  de 32); en paneles medianos, diagonales arriba y abajo; en muy estrechos, una línea
  `007 BOND ╱╱╱`.
- Como en Crush, una letra (B, O o D) se estira al azar, una vez por sesión.
- `/header` vuelve a la cabecera de pi, con sus atajos de teclado.

El logo vive en `lib/bond-logo.mts`, sin dependencias. Lo usan la cabecera, `bin/bond-logo`
(para la terminal) y `pidev`/`piteam`, que imprimen la versión de una línea:

```bash
bond-logo                       # al ancho de la terminal
bond-logo --width 40            # forzar un ancho
bond-logo --small "texto"       # una línea: 007 BOND texto ╱╱╱
```

Es `.mts` para que Node 22+ lo ejecute como módulo ES sin marcar todo el paquete como
`"type": "module"` (que rompería `pisessions`, que usa `require`).

## Pie de estado (`extensions/status-line.ts`)

Sustituye el pie de pi por uno pensado para varios agentes en paneles estrechos:

```
w1-hardening@w6:p5 · fluzo · main [wt] · flash-halogen (medium) → otro-modelo
████░░░░░░░░ 34% · $0.12 ↑48k ↓3.1k · sess 12:04 api 3:10 · +120/-14 · req ✓31 ✗1
<estados de otras extensiones, si hay>
```

| Pieza | De dónde sale |
|---|---|
| `nombre@panel` | `HERDR_PANE_ID` y `herdr agent list` (se refresca cada 30 s). Fuera de Herdr no aparece. |
| `[wt]` | El directorio es un worktree de git (`--git-dir` distinto de `--git-common-dir`). |
| `→ modelo` | El último mensaje lo respondió otro modelo que el seleccionado (modelos virtuales o routers). |
| Barra | `ctx.getContextUsage()`: verde < 50 %, amarillo < 80 %, rojo a partir de ahí. |
| Coste | Solo si es mayor que 0; con los modelos locales de `halo` se ven solo los tokens. |
| `req ✓ ✗` | Peticiones al modelo correctas y fallidas en esta sesión. |
| Rate limit | Cuenta atrás con la espera que pide el proveedor (cabecera `retry-after` o texto del error). |

La tercera línea pinta los estados que otras extensiones ponen con `ctx.ui.setStatus()`, que
un pie propio taparía si no. `/statusline` alterna entre este pie y el de pi.

Adaptado de `status-line.ts` de [Jeyapaul/pi](https://github.com/Jeyapaul/pi) (MIT).

## `pisessions`

```bash
pisessions                 # las 20 más recientes de todos los proyectos
pisessions fluzo           # filtra por nombre, directorio o id
pisessions --here          # solo las del directorio actual
pisessions --live          # solo las abiertas ahora en un agente de Herdr
pisessions -n 0 --json     # todas, para scripts
```

Lee `~/.pi/agent/sessions/` (o `PI_CODING_AGENT_SESSION_DIR`). Para cada sesión muestra
directorio, nombre (`/name` en pi), mensajes, coste, el agente de Herdr que la tiene abierta
(cruzando `agent_session` de `herdr agent list`) y el comando para retomarla:

```bash
cd ~/gitrepos/fluzo && pi --session 01a13acd
```

El `cd` va delante porque pi busca un id parcial primero entre las sesiones del directorio
actual; si lo encuentra en otro proyecto, pregunta antes de abrirlo. El id es el prefijo más
corto (mínimo 8) que no comparte ninguna otra sesión: los UUIDv7 empiezan por la hora y dos
sesiones del mismo minuto comparten los primeros caracteres.

Las sesiones cuyo directorio ya no existe (un worktree borrado) salen atenuadas y marcadas
`(no existe)`.

## Herdr CLI de uso frecuente

```bash
# Las respuestas de la CLI son JSON con los datos bajo .result
# (p. ej. .result.agents, .result.workspaces).
herdr status                      # cliente, servidor, compatibilidad, socket
herdr workspace list              # workspaces con ids y estados
herdr workspace focus w3
herdr tab list --workspace w3
herdr pane list --workspace w3
herdr pane split --current --direction right --cwd "$PWD" --no-focus
herdr pane run w3:p6 "npm test"
herdr pane wait-output w3:p6 --match "test result" --timeout 120000
herdr pane read w3:p6 --source recent-unwrapped --lines 200
herdr agent list
herdr agent prompt pi-mi "tarea" --wait
herdr agent wait pi-mi --until blocked
herdr agent explain pi-mi         # por qué lo clasificó así
herdr integration status
```

Fuentes de `pane read`: `visible` (lo pintado), `recent` (con saltos de línea suaves),
`recent-unwrapped` (ideal para logs y transcripciones), `detection` (instantánea que usa el
detector).

## Actualizar

```bash
herdr update                                    # Herdr
bun add -g @earendil-works/pi-coding-agent@latest   # pi (si se instaló con bun)
bond setup && bond doctor                       # revalida todo tras actualizar
```

`pi update` solo aplica a instalaciones hechas con el instalador oficial
(`curl -fsSL https://pi.dev/install.sh | sh`); con bun o npm se actualiza desde el
gestor de paquetes.

## Desinstalar

```bash
# Desactivar la config versionada (solo los symlinks)
rm ~/.pi/agent/settings.json ~/.pi/agent/AGENTS.md ~/.pi/agent/mcp.json ~/.pi/agent/bond
rm -r ~/.config/bond              # registro de modelos (los models.json generados se quedan)
rm "$(command -v bond)"          # el enlace de bond en el PATH
rm -rf ~/.pi/agent/skills/herdr   # solo si lo generó bond setup

# Quitar la integración de Herdr
herdr integration uninstall pi

# Quitar el CLI de pi
bun uninstall -g @earendil-works/pi-coding-agent    # o npm uninstall -g ...
```

Los backups `.bak.<fecha>` que creó `bond setup` siguen en `~/.pi/agent`. Sesiones y
credenciales no se tocan.
