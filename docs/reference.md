# Referencia de bond

Cada comando, qué escribe en cada sitio y por qué.

## Comandos

| Comando | Qué hace |
|---|---|
| `bond setup` | Una vez por máquina: Herdr, endpoints de modelos, agentes; aplica modelos, integraciones, skills e instrucciones ([abajo](#bond-setup)) |
| `bond init` | Una vez por repo: agentes, agente por defecto y herramientas; genera la config de cada agente ([abajo](#configuración-por-repo-bond-init-y-bond-sync)) |
| `bond` | Dentro de un repo: abre su puesto de trabajo en Herdr ([puesto.md](puesto.md)) |
| `bond dev <dir>` | Lo mismo para otro directorio |
| `bond team` | Un agente por rama, cada uno en su worktree (en Herdr, 4 en tu pestaña y el resto en pestañas nuevas, o lo que elijas); `status` (`--watch`: tabla en vivo agrupada por estado, que se cierra sola sin trabajo pendiente), `prompt`, `clean` (al quitar el último, cierra también la tabla) ([puesto.md](puesto.md#bond-team)) |
| `bond status` | Agentes vivos en Herdr |
| `bond sessions` | Sesiones de pi y cómo retomarlas |
| `bond sync` | Regenera la config de los agentes del repo desde `.bond/bond.toml` |
| `bond models list\|probe\|sync` | Endpoints y modelos globales, y su config en cada agente |
| `bond run copilot` | Copilot CLI contra un modelo propio (variables de entorno) |
| `bond key <endpoint>` | Imprime una clave guardada (la usan los agentes) |
| `bond doctor` | Comprueba la instalación (y el repo, si estás en uno) |
| `bond update` | Pone bond al día con la última release ([abajo](#actualizar)) |
| `bond migrate` | Convierte una instalación 0.7 (config de pi enlazada al repo); `setup` lo hace solo |
| `bond logo` | El logo |

## Dónde vive cada cosa

**Global, en `~/.bond/`** (nunca en un proyecto):

| Ruta | Qué |
|---|---|
| `config.toml` | Agentes elegidos, agente por defecto, endpoints y modelos |
| `keys/<endpoint>` | Claves, una por fichero, permisos 600 |
| `AGENTS.md` | Tus instrucciones para todos los agentes |
| `state.json` | Lo que detectó la sonda y lo que bond gestiona en cada agente |
| `runtime/<versión>/` | Ficheros que lleva dentro el binario, extraídos; solo se queda la versión en uso |
| `pi` | Enlace a las Bond Extensions de la versión instalada |

**En la config de cada agente** (siempre solo lo de bond; el resto del fichero no se toca):

| Qué | Dónde |
|---|---|
| Modelos de tus endpoints | `~/.pi/agent/models.json`, `~/.config/opencode/opencode.jsonc`, `~/.config/crush/crushrc` (bloque), `~/.codex/config.toml` (bloque) |
| Tus instrucciones + reglas de bond | Un bloque en el fichero global de instrucciones de cada agente |
| Skills `bond-delegate`, `bond-team` | `~/.agents/skills/` y `~/.claude/skills/` |
| Integración de Herdr | La instala `herdr integration install <agente>` |

**En cada repo**: `.bond/bond.toml` (lo que pides), `.bond/manifest.json` (lo que generó bond),
`AGENTS.md` (tuyo) y la config de cada agente ([abajo](#configuración-por-repo-bond-init-y-bond-sync)).

## Bond Extensions (pi)

El repo de bond es también un paquete de pi (`package.json` → `"pi"`): las extensiones
`status-line.ts` (pie de estado), `bond-header.ts` (cabecera) y `repo-map.ts` (tool `repo_map`),
y los comandos `/delegate`, `/team` (`prompts/`) y `/review`, `/commit`, `/handoff`
(`catalog/commands/`). Se cargan **por repo**: `bond init` añade `"packages": ["~/.bond/pi"]` a
`.pi/settings.json` cuando el repo usa pi. En los repos sin bond, pi funciona sin ellas.

## Configuración por repo (`bond init` y `bond sync`)

Lo que es del proyecto (instrucciones, servidores MCP, skills, comandos) se declara en
`.bond/bond.toml` y `bond sync` genera lo que lee cada agente: pi, Claude Code, Copilot CLI,
Codex, opencode, Crush y Gemini CLI.

```bash
cd ~/gitrepos/mi-proyecto
bond init                        # con preguntas: agentes, agente por defecto, herramientas
bond init --yes                  # sin preguntas: lo elegido en bond setup y el catálogo por defecto
bond init --agents claude,codex --default claude --skills "" --commands review,commit
bond init --list                 # catálogo: MCP, skills, comandos
bond sync                        # tras editar .bond/bond.toml
bond sync --check                # en CI: falla si algo está desfasado
```

`bond init` pregunta con qué agentes integrar el repo (de los instalados; marcados de partida
los que elegiste en `bond setup`), cuál abre `bond` por defecto y qué herramientas del catálogo
usar (marcado lo de por defecto; las skills opcionales salen sin marcar). En un repo ya inicializado permite cambiar la selección: solo reescribe
las líneas `agents`, `default_agent`, `mcp`, `skills` y `commands` de `bond.toml`, así que tus
comentarios y tus `[mcp_servers]` se conservan, y `sync` quita lo que ya no se pide.

**Bond Extensions (pi).** Si el repo usa pi, `.pi/settings.json` declara
`"packages": ["~/.bond/pi"]`: el pie de estado, la cabecera BOND, la tool `repo_map`,
`/delegate`, `/team` y los comandos del catálogo. `~/.bond/pi` es un enlace estable a la versión
instalada de bond (en Windows, una *junction*), así la misma ruta sirve en cualquier máquina con
bond y no cambia al actualizarlo. Quien clone el repo sin bond no las tiene, pero el resto de
la config de pi funciona.

```toml
# .bond/bond.toml
agents = ["pi", "claude", "copilot", "opencode", "crush"]
default_agent = "claude"
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
| pi | `.pi/mcp.json` (`exposure: "direct"`) | catálogo: Bond Extensions; propios: `.pi/prompts/` | sí |
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

Los modelos se declaran **una vez** en `~/.bond/config.toml` (fuera del repo: son de
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
| `bond models probe [id]` | Pregunta a la pasarela qué sirve: lista de modelos y las APIs `chat`, `responses` y `messages` (una petición tras otra; las pasarelas locales no atienden varias a la vez). Lo guarda en `~/.bond/state.json` |
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

## Instrucciones globales

`~/.bond/AGENTS.md` son tus instrucciones (idioma, estilo, cómo trabajas, git…). `bond setup`
las escribe, junto con las reglas de bond, en un bloque del fichero de instrucciones global de
cada agente elegido. Para cambiarlas: edita `~/.bond/AGENTS.md` y repite `bond setup`. La
primera vez se siembran con las de una instalación anterior, si la hay.

Reglas de bond (iguales para todos): Herdr solo cuando lo pides o lo pide un comando como
`/delegate` o `/team`; `bond-delegate` y `bond-team` para trabajar con otros agentes; no cerrar
lo que no creaste ni ejecutar `herdr` sin subcomando; nada privado a búsquedas web.

Las instrucciones **del proyecto** van en el `AGENTS.md` del repo (lo crea `bond init`).

## Skills del catálogo

Carpetas en `catalog/skills/`; `catalog/catalog.toml` da el resumen que enseña `bond init` y si
salen marcadas. Juntas llevan una tarea de la issue a la release: refinar → planificar →
ejecutar una fase → commit → PR → release. Cada skill cierra con un siguiente paso recomendado,
y nada que escriba fuera del repo o publique (push, PR, comentario, tag, release) se hace sin
tu OK explícito. Una skill que falta corta solo ese paso; no se descarga.

| Skill | Para qué | En `bond init` |
|---|---|---|
| `code-context` | Reunir el contexto justo del repo y de las librerías antes de editar | marcada |
| `git-conventional-commit` | Un commit revisado con Conventional Commits, en inglés salvo que el proyecto diga otra cosa; la usa `/commit` | marcada |
| `plan-create` | Plan por fases verificables en `docs/plans/`; las fases independientes pueden ir en paralelo con `bond team` | marcada |
| `plan-execute` | Implementar una fase aprobada, con evidencia, y proponer su commit | marcada |
| `issue-refine-github` | Revisar una issue antes de empezar: dejarla, ampliarla o partirla | opcional |
| `delivery-review-github` | Revisar la fase, hacer push y abrir su PR; tras el merge, recomendar lo siguiente (y `bond team clean` si venía de un worktree) | opcional |
| `release-prepare-github` | Changelog, versión con evidencia y release aprobada; si un workflow publica al empujar el tag, ese push es la publicación | opcional |
| `convention-document` | Convertir un acuerdo confirmado en una convención documentada e indexada en `AGENTS.md` | opcional |
| `plan-team` | Ejecutar en paralelo las fases independientes de un plan: una rama, worktree y agente por fase con `bond team`, cada uno con `plan-execute` y su commit; al integrar cada rama, actualiza el plan | opcional |

Todas menos `code-context` y `plan-team` están adaptadas de
[fluzo-labs/common-skills](https://github.com/fluzo-labs/common-skills) (MIT, con su `LICENSE`
en cada carpeta): solo modo guiado (sin el autónomo), con la marca de bond y ajustadas a sus
comandos.

## Comandos del catálogo

Ficheros Markdown en `catalog/commands/`, con la sintaxis común a todos los agentes
(`$ARGUMENTS`, `$1`…): bond los convierte al formato de cada uno.

| Comando | Argumentos | Resultado |
|---|---|---|
| `/review [foco]` | foco opcional | Revisión priorizada (bugs, seguridad, errores, rendimiento, estilo) con `fichero:línea`. No edita. |
| `/commit [contexto]` | contexto extra | Commit con la skill `git-conventional-commit` (sin ella, con la que tenga el agente): enseña alcance y mensaje y espera OK. Nunca push. |
| `/handoff [ruta]` | ruta, por defecto `.handoff.md` | Estado escrito: objetivo, estado, ficheros, verificación, siguientes pasos. |

En pi, además, `/delegate` y `/team`, atajos a los skills `bond-delegate` y `bond-team`
([abajo](#herdr-skill-y-prompts)).

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
| Nada de workspaces, pestañas, worktrees ni otro directorio sin petición | `/delegate` trabaja en un panel hermano y en `$PWD`. Los worktrees los crean `bond`/`bond team` (los lanzas tú) o `/team`, que lo pide expresamente y además espera tu OK al reparto antes de crear nada. |
| Worktrees con `herdr worktree`, no `git worktree` a mano | `bond --worktree` usa `worktree create`/`open` colgados del workspace `bond:<repo>`, así Herdr los agrupa y los sabe quitar. |
| `--trust-repository` solo tras revisar el repo | `bond`/`bond team` solo lo pasan si tú pones `--trust-repository`. En paneles, `bond team` da a cada worktree la confianza de pi o Claude Code que ya tenía el checkout principal, nunca otra (`--no-trust` lo desactiva). |
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
`team/discount` y `team/readme`, esperó el OK, montó el equipo con `bond team`, cada agente hizo
commit en su rama, y el orquestador revisó ambas ramas y propuso el orden de integración.

**Paralelismo con el modelo local.** En esa prueba un agente recibió un 429 de la pasarela
`halo`: dos agentes pidiendo a la vez al mismo modelo local. El orquestador comprobó que no
había commits y reenvió la tarea al terminar el otro. Con modelos locales, el paralelismo real
lo limita la pasarela; con proveedores en la nube, la cuota.

**Argumentos.** Van separados como en una shell: `/delegate reviewer revisa el diff` da rol
`reviewer` y tarea `revisa el diff` (`${@:2}`). Si el primer argumento no parece un rol
(`/delegate revisa el diff`), el prompt le dice al agente que use `reviewer`.

## `bond setup`

`cli/setup.mts` y `cli/wizard.mts`. Interactivo y repetible (cada vez enseña lo que ya hay);
`--yes` usa lo detectado sin preguntar.

**Preguntas:**

1. **Herdr.** Si no está, enseña cómo instalarlo según el sistema (`curl … | sh`, `brew`,
   PowerShell en Windows) y el enlace https://herdr.dev/docs/install/. Se puede seguir sin él.
2. **Endpoints de modelos.** Detecta solo Ollama (`localhost:11434`) y LM Studio
   (`localhost:1234`). Ofrece añadir OpenAI o cualquier endpoint compatible con OpenAI
   (como `halo`): URL, clave si la pide y nombre. Lee sus modelos (con contexto y salida máxima
   si la pasarela los publica), deja elegir cuáles registrar y prueba qué APIs sirve (chat,
   responses) y si el modelo razona.
3. **Agentes.** Detecta los instalados (pi, Claude Code, Codex, Copilot CLI, opencode, Crush,
   Gemini CLI). Ninguno es obligatorio, pero hace falta al menos uno: si no hay ninguno, enseña
   cómo instalar cada uno y para. Eliges con cuáles trabajar y cuál es el de por defecto.

**Después aplica**, solo para los agentes elegidos:

- los modelos en los agentes que pueden usar endpoints propios (pi, opencode, Crush, Codex);
- la integración de Herdr de cada uno (si un agente aún no creó su carpeta de config, avisa y
  se instala en el siguiente `setup`);
- los skills globales `bond-delegate` y `bond-team`;
- tus instrucciones (`~/.bond/AGENTS.md`) y las reglas de bond, en un bloque del fichero de
  instrucciones global de cada agente (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`,
  `~/.copilot/copilot-instructions.md`, `~/.config/opencode/AGENTS.md`, `~/.config/crush/CRUSH.md`,
  `~/.gemini/GEMINI.md`, `~/.pi/agent/AGENTS.md`). Lo de fuera del bloque no se toca. Para
  cambiarlas: edita `~/.bond/AGENTS.md` y repite `bond setup`.

**Dónde guarda todo: `~/.bond/`** (nunca en un proyecto):

| Fichero | Qué |
|---|---|
| `config.toml` | Agentes, agente por defecto, endpoints y modelos (lo escribe `setup`; se puede editar) |
| `keys/<endpoint>` | Una clave por fichero, permisos 600 (carpeta 700) |
| `AGENTS.md` | Tus instrucciones para todos los agentes |
| `state.json` | Lo que detectó la sonda y lo que bond gestiona en cada agente |
| `runtime/<versión>/` | Los ficheros que lleva dentro el binario, extraídos |

Las claves nunca se copian a la configuración de los agentes: pi las lee con
`!bond key <endpoint>`, opencode con `{file:~/.bond/keys/<endpoint>}`, Crush con
`$(bond key <endpoint>)`, y Codex y Copilot por variable de entorno con `bond run`.
`bond key <endpoint>` imprime una clave.

La configuración de bond 0.3–0.7 (`~/.bond/`) se mueve sola a `~/.bond/` la primera vez.

| Flag | Efecto |
|---|---|
| `--yes` | Sin preguntas: lo detectado y lo ya configurado |
| `--dry-run` | Pregunta, pero solo enseña lo que haría al aplicar |
| `--herdr-config` | Aplica el snippet de Herdr (opt-in: tu `config.toml` de Herdr es tuyo) |

Desde el código fuente, además, instala las dependencias de la CLI (`npm ci`) y pone `bond`
en el PATH. Antes de aplicar, convierte una instalación anterior (`bond migrate`).

## `bond doctor`

`cli/doctor.mts`. Comprueba en unos segundos lo que deja `bond setup` y lo que depende de
fuera, y sale con 1 si algo falla:

| Comprobación | Fallo típico y arreglo |
|---|---|
| Node ≥ 22.18 | actualizar Node |
| Herdr: binario, servidor, integración de pi | `herdr`; `bond setup` |
| pi: binario, enlaces de `~/.pi/agent`, paquete `./bond` en `pi list` | `bond setup` |
| Restos de bond 0.7: config de pi enlazada al repo (aviso) | `bond migrate` |
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
| MCP `context7` | `catalog/mcp.json` (por repo) | Documentación de librerías por versión (`resolve-library-id`, `query-docs`). Remoto, sin clave. |
| MCP `duckduckgo` | `catalog/mcp.json` (por repo) | Búsqueda en DuckDuckGo y lectura de páginas (`search`, `fetch_content`). `uvx duckduckgo-mcp-server==0.7.0`, sin clave. |
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
(para la terminal) y `bond`/`bond team`, que imprimen la versión de una línea:

```bash
bond-logo                       # al ancho de la terminal
bond-logo --width 40            # forzar un ancho
bond-logo --small "texto"       # una línea: 007 BOND texto ╱╱╱
```

Es `.mts` para que Node 22+ lo ejecute como módulo ES sin marcar todo el paquete como
`"type": "module"`.

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

## `bond sessions`

```bash
bond sessions                 # las 20 más recientes de todos los proyectos
bond sessions fluzo           # filtra por nombre, directorio o id
bond sessions --here          # solo las del directorio actual
bond sessions --live          # solo las abiertas ahora en un agente de Herdr
bond sessions -n 0 --json     # todas, para scripts
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
bond update                                     # bond (--check: solo mirar)
herdr update                                    # Herdr
bun add -g @earendil-works/pi-coding-agent@latest   # pi (si se instaló con bun)
bond setup && bond doctor                       # revalida todo tras actualizar
```

`bond update` sustituye el binario si lo instalaste con `install.sh` o `install.ps1`: descarga
el de la release, comprueba su SHA-256 contra `SHA256SUMS` y prueba que arranca antes de
cambiarlo. Con Homebrew o npm te dice el comando (`brew upgrade jmanuelcorral/tap/bond`,
`npm i -g @jmanuelcorral/bond@latest`). `--version vX.Y.Z` instala una concreta, también
anterior. Venga de donde venga, la versión nueva pasa a sus ficheros `~/.bond/pi` y los skills
globales que apuntaban a los de otra, y borra las versiones viejas de `~/.bond/runtime/`.

`pi update` solo aplica a instalaciones hechas con el instalador oficial
(`curl -fsSL https://pi.dev/install.sh | sh`); con bun o npm se actualiza desde el
gestor de paquetes.

## Desinstalar

```bash
rm -r ~/.bond                     # config global, claves, instrucciones y runtime
rm -r ~/.agents/skills/bond-delegate ~/.agents/skills/bond-team ~/.claude/skills/bond-*
```

Lo que bond escribió en cada agente (modelos, bloque de instrucciones) se queda: es tuyo. En
cada repo, `.bond/` y los ficheros generados son parte del repo. Para quitar las integraciones
de Herdr: `herdr integration uninstall <agente>`.
