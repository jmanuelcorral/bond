# Referencia de bond

Esta es la página para cuando ya sabes lo que quieres hacer y necesitas el detalle: cada
comando, qué escribe y dónde, y por qué funciona así. Si estás empezando, mejor pasa antes por
los [primeros pasos](getting-started.md) y por [el puesto de trabajo](puesto.md); aquí vendrás
a consultar cosas concretas. ¿Echas algo en falta o algo no cuadra con lo que ves? Abre un
[issue en GitHub](https://github.com/jmanuelcorral/bond/issues).

## Comandos

| Comando | Qué hace |
|---|---|
| `bond setup` | Una vez por máquina: Herdr, endpoints de modelos, agentes; aplica modelos, integraciones, skills e instrucciones ([abajo](#bond-setup)) |
| `bond init` | Una vez por repo: agentes, agente por defecto y herramientas; genera la config de cada agente ([abajo](#configuración-por-repo-bond-init-y-bond-sync)) |
| `bond` | Dentro de un repo: abre su puesto de trabajo en Herdr ([puesto.md](puesto.md)) |
| `bond dev <dir>` | Lo mismo para otro directorio |
| `bond team` | Un agente por rama, cada uno en su worktree (en Herdr, 4 en tu pestaña y el resto en pestañas nuevas, o lo que elijas); `status` (`--watch`: tabla en vivo agrupada por estado, que se cierra sola sin trabajo pendiente), `prompt` (con `[decisions]` guarda el encargo en un run; `--no-record` para no guardarlo), `collect` (guarda en el run la última respuesta del agente: de su sesión, o del panel recortado), `clean` (al quitar el último, cierra también la tabla) ([puesto.md](puesto.md#bond-team)) |
| `bond status` | Agentes vivos en Herdr |
| `bond sessions` | Sesiones de pi y cómo retomarlas |
| `bond sync` | Regenera la config de los agentes del repo desde `.bond/bond.toml` |
| `bond decisions` | Memoria de decisiones del repo: lista, `add`, `accept`, `show`, `runs`, `check` ([abajo](#bond-decisions)) |
| `bond catalog create\|check` | Prepara un repo como catálogo propio de skills, comandos y MCP, y lo comprueba ([abajo](#catálogo-propio-bond-catalog)) |
| `bond catalog add\|list\|update\|remove\|clean` | Usa en el repo el catálogo de tu equipo, por git (con el commit fijado) o por carpeta ([abajo](#catálogos-por-git-bond-catalog-add)) |
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
| `config.toml` | Agentes elegidos, agente por defecto, endpoints y modelos; `[update] auto` |
| `keys/<endpoint>` | Claves, una por fichero, permisos 600 |
| `AGENTS.md` | Tus instrucciones para todos los agentes |
| `state.json` | Lo que detectó la sonda, lo que bond gestiona en cada agente y la última comprobación de versión |
| `runtime/<versión>/` | Ficheros que lleva dentro el binario, extraídos; solo se queda la versión en uso |
| `catalogs/<host>/<repo>/<commit>/` | Catálogos del equipo por git, uno por commit; `bond catalog clean` los poda |
| `pi` | Enlace a las Bond Extensions de la versión instalada |

**En la config de cada agente** (siempre solo lo de bond; el resto del fichero no se toca):

| Qué | Dónde |
|---|---|
| Modelos de tus endpoints | `~/.pi/agent/models.json`, `~/.config/opencode/opencode.jsonc`, `~/.config/crush/crushrc` (bloque), `~/.codex/config.toml` (bloque) |
| Tus instrucciones + reglas de bond | Un bloque en el fichero global de instrucciones de cada agente |
| Skills `bond-delegate`, `bond-team` | `~/.agents/skills/` y `~/.claude/skills/` |
| Integración de Herdr | La instala `herdr integration install <agente>` |

**En cada repo**: `.bond/bond.toml` (lo que pides), `.bond/lock.json` (el commit de cada catálogo por git), `.bond/manifest.json` (lo que generó bond),
`AGENTS.md` (tuyo) y la config de cada agente ([abajo](#configuración-por-repo-bond-init-y-bond-sync)).

## Bond Extensions (pi)

El repo de bond es también un paquete de pi (`package.json` → `"pi"`): las extensiones
`status-line.ts` (pie de estado), `bond-header.ts` (cabecera), `repo-map.ts` (tool `repo_map`)
y `record-decision.ts` (tool `record_decision`), y los comandos `/delegate`, `/team`
(`prompts/`) y `/review`, `/commit`, `/handoff`, `/accept` (`catalog/commands/`). Se cargan **por repo**:
`bond init` añade `"packages": ["~/.bond/pi"]` a `.pi/settings.json` cuando el repo usa pi. En
los repos sin bond, pi funciona sin ellas.

## Configuración por repo (`bond init` y `bond sync`)

Lo que es del proyecto (instrucciones, servidores MCP, skills, comandos) se declara en
`.bond/bond.toml` y `bond sync` genera lo que lee cada agente: pi, Claude Code, Copilot CLI,
Codex, opencode, Crush, Gemini CLI y Antigravity (`agy`).

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

[decisions]                     # memoria de decisiones de los agentes; quita la sección para no usarla
dir = "docs/decisions"          # carpeta dentro del repo (relativa), ajustable

[mcp_servers.postgres]           # servidores propios del repo; secretos con ${VAR}
command = "npx"
args = ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"]
```

Comandos propios del repo: ficheros Markdown en `.bond/commands/` (sintaxis común: `$ARGUMENTS`,
`$1`…). Skills propios: carpetas con `SKILL.md` en `.agents/skills/`.

**Memoria de decisiones.** Con la sección `[decisions]` en `bond.toml`, cada decisión no
trivial —del usuario o de un agente— queda en `docs/decisions/` (un fichero por decisión,
`YYYY-MM-DD-slug.md`) y los commits pueden llevar los trailers opcionales `Agent:` y `Decision:`. `bond sync`
crea el `README.md` con el formato del registro si falta; después es del repo, como
`AGENTS.md` (no se registra en el manifiesto y sync no lo pisa). No hay índice compartido:
el listado lo da `bond decisions`. La skill `decision-record` explica cuándo y cómo
registrar decisiones y runs. Sin la sección, nada cambia. Un `dir` que salga del repo
(ruta absoluta o con `..`) se rechaza con un error. `bond init` solo propone la sección si
`decision-record` está entre las skills elegidas; al re-inicializar, una `[decisions]` que
ya tuvieras se conserva aunque desmarques la skill (se quita a mano).

**Instrucciones y skills.** `AGENTS.md` (lo crea `init` si falta; es tuyo) y `.agents/skills/`
los leen directamente pi, Copilot, Codex, opencode, Crush, Gemini y Antigravity. Las excepciones:

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
| Antigravity (`agy`) | plugin de bond: `.agents/plugins/bond/mcp_config.json` | skills del plugin: `.agents/plugins/bond/skills/<comando>/SKILL.md` | sí (`agy` 1.4.9) |

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
- **Antigravity** (`agy`) no lee servidores MCP ni comandos del repo, pero sí plugins: bond
  genera uno en `.agents/plugins/bond/` (`plugin.json`, `mcp_config.json` y una skill por
  comando, que se invoca como `/commit`, `/review`...). En las skills, `$ARGUMENTS` y `$1`…
  pasan a ser una indicación de usar el texto que sigue al comando. `agy` antepone el nombre
  del plugin a los servidores (`bond_context7`). Quitar `agy` de `agents` borra el plugin; los
  demás plugins de `.agents/plugins/` no se tocan.

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

## Catálogo propio (`bond catalog`)

<figure class="bond-video">
<video src="/videos/catalogos.mp4" controls muted playsinline preload="metadata"></video>
<figcaption>Un catálogo del equipo de principio a fin: create, una skill, check, y en fluzo add con el commit fijado, init --list y doctor.</figcaption>
</figure>

Un equipo reúne en un repo las skills, comandos y servidores MCP que comparte, con la misma
estructura que el catálogo de bond (`catalog/`):

```text
catalog.toml               name y, por skill, summary/default para bond init
skills/<nombre>/SKILL.md   frontmatter name (igual que la carpeta) y description
commands/<nombre>.md       frontmatter description; $ARGUMENTS, $1…
mcps/<nombre>.json         command/args/env o url/headers, y description; secretos con ${VAR}
```

```bash
cd ~/gitrepos/skills-equipo
bond catalog create              # pregunta el nombre (por defecto, el de la carpeta)
bond catalog create --name equipo
bond catalog check               # sale con 1 si hay errores: para la CI del catálogo
bond catalog check ruta/al/catalogo
```

- **`create`** escribe `catalog.toml` y las carpetas `skills/`, `commands/` y `mcps/`, cada
  una con un `README.md` que explica el formato con un ejemplo. No mete skills, comandos ni
  servidores. Si ya hay `catalog.toml`, no lo toca y solo añade lo que falte; repetirlo no
  cambia nada. No hace `git init` ni commit (fuera de git, avisa).
- **`check`** da un error por cada problema: skill sin `SKILL.md` o con `name` distinto de su
  carpeta, sin `description`, comando sin `description`, JSON inválido, servidor sin `command`
  ni `url`, `[skills.x]` en `catalog.toml` de una skill que no existe. Un valor de `env` o
  `headers` que parece un secreto escrito tal cual es un aviso. Los `README.md` no cuentan.
- El repo del catálogo es un repo normal: se puede trabajar en él con bond (`bond init`,
  `.bond/`, `.agents/skills/`), que no toca las carpetas del catálogo.

### Usar un catálogo en un repo

Se declara en `.bond/bond.toml` con su carpeta, relativa al repo. Lo suyo aparece en
`bond init` (con su nombre al final) y se elige igual que lo del catálogo de bond:

```toml
skills = ["code-context", "revisar-migraciones"]
mcp = ["context7", "postgres"]
commands = ["review", "notas"]

[[catalog]]
name = "equipo"                  # opcional: por defecto, el name de su catalog.toml
path = "../skills-equipo"
```

- **Mismo nombre que una de bond**: gana la del catálogo del equipo, que la sustituye (en
  `bond init` la de bond sale como `bond:nombre` «(la sustituye equipo)»). Para quedarte con la
  de bond: `"bond:nombre"`.
- **Mismo nombre en dos catálogos del equipo**: `sync` falla y pide elegir con
  `catalogo:nombre` (`"equipo:revisar"` o `"plataforma:revisar"`). En el repo solo cabe uno.
- **Validación**: `sync` comprueba el catálogo igual que `bond catalog check` y no escribe nada
  si tiene errores.
- **Comandos en pi**: los del catálogo de bond le llegan por las Bond Extensions; los de un
  catálogo del equipo se escriben en `.pi/prompts/`.
- **Ruta fuera del repo**: funciona, con aviso: al resto del equipo solo le sirve si tiene esa
  misma carpeta. Para compartirlo, por git (abajo).

### Catálogos por git (`bond catalog add`)

Lo normal en un equipo: el catálogo vive en su repo y cada proyecto lo declara por su URL, con
el commit fijado en `.bond/lock.json` (se commitea, como un lockfile).

```bash
bond catalog add https://github.com/acme/skills-equipo --ref v1   # tag, rama o sha
bond catalog add git@github.com:acme/skills-equipo.git           # sin --ref: rama por defecto
bond catalog add ../skills-equipo                                 # una carpeta: [[catalog]] path
bond catalog list                # el de bond y los del repo, con ref y commit
bond catalog update [equipo]     # vuelve a resolver la ref y mueve el lock (--ref para cambiarla)
bond catalog remove equipo       # lo quita de bond.toml, del lock y de lo elegido de él
bond catalog clean               # vacía ~/.bond/catalogs salvo los commits de este repo
```

```toml
[[catalog]]
name = "equipo"                  # obligatorio por git: es su clave en el lock
git = "https://github.com/acme/skills-equipo"
ref = "v1"
```

- **Lo que se revisa**: `add` y `update` enseñan los servidores MCP que llegan o cambian (qué
  ejecutan o adónde se conectan) y lo que el repo usa y pasa a venir de otro catálogo (una skill
  de bond que el equipo sustituye), y piden confirmación; `--yes` la da (sin terminal, sin
  `--yes`, no escriben nada). Un catálogo que no pasa `bond catalog check` no se añade.
- **Fijado**: solo `add` y `update` cambian el commit. `sync` (y `sync --check` en CI) usa el
  del lock aunque la rama haya avanzado, y lo descarga a `~/.bond/catalogs/` si no está; con la
  caché llena funciona sin red. Si `bond.toml` y el lock no cuadran (otra URL o ref), `sync`
  pide `bond catalog update`.
- **Mismo repo, otra URL**: `git@github.com:acme/x.git` y `https://github.com/acme/x` son el
  mismo catálogo: no se puede añadir dos veces.
- **Repos privados**: bond usa tu `git` y sus credenciales, sin preguntar (si pide contraseña,
  falla). En CI, el job necesita acceso de lectura al repo del catálogo.

### Ciclo de vida de un catálogo externo

1. **Crear** — `bond catalog create` en el repo del catálogo: `catalog.toml` y las carpetas
   con sus READMEs (arriba). Sin ejemplos instalables: nada llega al `bond init` del equipo sin
   que alguien lo escriba.
2. **Comprobar** — `bond catalog check` en local y en la CI del propio catálogo: sale con 1 si
   algo no vale, así nada roto llega al equipo.
3. **Publicar** — es un repo git normal del equipo: se versiona y se revisa como cualquier
   código (tags para las versiones estables, ramas para ir por delante).
4. **Añadir** — `bond catalog add <url> [--ref]` en cada proyecto que lo consume: declara el
   `[[catalog]]` en `bond.toml` y fija el commit en `.bond/lock.json` (se commitea).
5. **Sincronizar** — `bond sync` instala lo elegido desde el commit del lock, no desde la punta
   de la rama; lo generado viaja commiteado con el repo, así que clonar no descarga nada.
6. **Actualizar** — `bond catalog update [nombre]` es lo único que mueve el commit, y enseña
   antes los servidores MCP que llegan o cambian.
7. **Diagnosticar** — `bond doctor` da una fila por catálogo: el commit fijado, si está
   descargado en `~/.bond/catalogs` y si la ref tiene un commit más nuevo (con red; con
   `--quick` o sin acceso, «sin verificar»). Falla si el lock no cuadra con `bond.toml`.

**Seguridad**: la fijación por SHA hace que lo que se revisó al añadir o actualizar sea
exactamente lo que se instala; los servidores MCP se revisan siempre en `add`/`update` porque
ejecutan programas en tu máquina o abren conexiones; los secretos no se escriben en el
catálogo, se referencian con `${VARIABLE}` (`bond catalog check` avisa si uno parece escrito
tal cual); el repo del catálogo se audita como cualquier repo del equipo: sus skills instruyen
a los agentes, así que quien las escribe debe ser de confianza.

**CI con catálogos privados**: el job necesita credenciales de lectura del repo del catálogo
(token con `repo` desplegado como variable secreta y usado en el `git` del runner, o clave SSH)
antes de `bond sync --check`; si la URL falla, el error dice cuál. Con la caché llena
(`~/.bond/catalogs` cacheada entre runs) no hace falta red para el commit fijado.

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
lo que no creaste ni ejecutar `herdr` sin subcomando; nada privado a búsquedas web; y si el
repo tiene `[decisions]` en `bond.toml`, registrar las decisiones con `decision-record` y
llevar los trailers `Agent:` y `Decision:` en los commits.

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
| `decision-record` | Registrar decisiones no triviales y runs de agentes en `docs/decisions/` (id, estado, trailers `Agent:`/`Decision:`); solo en repos con `[decisions]` en `bond.toml` | marcada |
| `plan-execute` | Implementar una fase aprobada, con evidencia, y proponer su commit | marcada |
| `issue-refine-github` | Revisar una issue antes de empezar: dejarla, ampliarla o partirla | opcional |
| `delivery-review-github` | Revisar la fase, hacer push y abrir su PR; tras el merge, recomendar lo siguiente (y `bond team clean` si venía de un worktree) | opcional |
| `release-prepare-github` | Changelog, versión con evidencia y release aprobada; si un workflow publica al empujar el tag, ese push es la publicación | opcional |
| `convention-document` | Convertir un acuerdo confirmado en una convención documentada e indexada en `AGENTS.md` | opcional |
| `plan-team` | Ejecutar en paralelo las fases independientes de un plan: una rama, worktree y agente por fase con `bond team`, cada uno con `plan-execute` y su commit; al integrar cada rama, actualiza el plan | opcional |
| `catalog-maintain` | Llenar y mantener un catálogo de equipo (creado con `bond catalog create`): skills, comandos y servidores MCP con el formato correcto y `bond catalog check` en verde antes de publicar | opcional |

Todas menos `code-context`, `plan-team` y `catalog-maintain` están adaptadas de
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
| `/accept [ids]` | ids o "todas" | Aceptar/rechazar decisiones propuestas desde la conversación: lista las `proposed`, pregunta y ejecuta `bond decisions accept/reject/supersede --confirmed-by "<lo que dijo el usuario>"`. Solo con respuesta explícita. |

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
   Gemini CLI, Antigravity). Ninguno es obligatorio, pero hace falta al menos uno: si no hay ninguno, enseña
   cómo instalar cada uno y para. Eliges con cuáles trabajar y cuál es el de por defecto.
4. **Sugerencias de prompt (pi).** Se proponen activas si el registro de bond tiene un modelo
   barato para pi; si no hay ninguno, salen apagadas con un aviso. El modelo propuesto se ve en
   la pregunta y se puede fijar a mano en `[suggestions] model`.

**Después aplica**, solo para los agentes elegidos:

- los modelos en los agentes que pueden usar endpoints propios (pi, opencode, Crush, Codex);
- las sugerencias de prompt de pi: el paquete, su config y `enabledModels` (ver
  [Sugerencias de prompt de pi](#sugerencias-de-prompt-de-pi));
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
| `--no-suggestions` | No activar las sugerencias de prompt de pi |
| `--herdr-config` | Aplica el snippet de Herdr (opt-in: tu `config.toml` de Herdr es tuyo) |

Desde el código fuente, además, instala las dependencias de la CLI (`npm ci`) y pone `bond`
en el PATH. Antes de aplicar, convierte una instalación anterior (`bond migrate`).

### Sugerencias de prompt de pi

`cli/suggestions.mts`. Al terminar un turno, con el editor vacío, pi muestra en *ghost text* el
siguiente prompt sugerido; se acepta con `→` o `Tab` y se puede editar antes de enviarlo. Lo
pone `@mrclrchtr/supi-prompt-suggestions` (MIT), que bond instala en el ámbito personal de pi
(`pi install npm:…`), no por proyecto. Solo sugiere después del turno del agente: no completado
mientras escribes.

**Qué escribe bond**, todo bajo `~/.pi/agent/` y nunca en el repo:

| Fichero | Qué | Notas |
|---|---|---|
| `supi/config.json` | `promptSuggestions.model = "proveedor/modelo"` | Se **fusiona**: las secciones de otros paquetes de la suite supi se conservan. `"disabled"` = apagada |
| `settings.json` | `enabledModels: ["*"]` | Solo si no estaba o estaba vacío; una lista tuya no se toca |

Antes de tocar un fichero que ya existía se guarda copia `.prev`.

**Cómo elige el modelo.** `[suggestions] model` manda. Si no está, heurística en este orden:

1. proveedores con `free = true` del registro de bond (modelos propios sin coste);
2. dentro de ellos, los de nombre más barato y rápido (`haiku`, `mini`, `flash`, `nano`, `lite`,
   `small`, tamaños `…b`);
3. si no hay gratuitos, el mismo criterio sobre el resto del registro;
4. si nada aplica, se propone apagado.

Los modelos con `agents = [...]` que no incluyan `pi` quedan fuera, igual que los proveedores
apagados.

**El tropiezo de `enabledModels`.** La extensión saca sus candidatos de `enabledModels` de pi.
Si esa clave no está, o está vacía, la lista sale vacía y no sugiere nada — aunque el *default*
de pi sea «todos los modelos». Por eso bond escribe `["*"]`. Si luego pones una lista
restrictiva y el modelo de sugerencias queda fuera, `bond doctor` lo avisa.

**Apagar y quitar.** `bond setup --no-suggestions` (o `enabled = false` en `config.toml`) deja
`"disabled"` en el config de la extensión y no instala nada. Para quitar el paquete de en medio:
`pi remove npm:@mrclrchtr/supi-prompt-suggestions`.

**Conflicto de editor.** La extensión sustituye el componente de editor de pi
(`setEditorComponent`), así que solo una de ese tipo puede estar activa a la vez: gana la que se
carga última. `bond doctor` lista las demás que usen esa API desde el directorio de extensiones
de pi (`~/.pi/agent/extensions`); los paquetes npm de terceros no se inspeccionan.

**Red y fallos.** Si `pi install` falla (sin red, paquete caído) `bond setup` avisa y sigue: los
configs quedan escritos y se puede repetir `bond setup` más tarde.

## `bond doctor`

`cli/doctor.mts`. Comprueba en unos segundos lo que deja `bond setup` y lo que depende de
fuera, y sale con 1 si algo falla:

| Comprobación | Fallo típico y arreglo |
|---|---|
| Node ≥ 22.18 | actualizar Node |
| Herdr: binario, servidor, integración de pi | `herdr`; `bond setup` |
| pi: binario, enlaces de `~/.pi/agent`, paquete `./bond` en `pi list` | `bond setup` |
| Antigravity (si es uno de tus agentes o de los del repo): versión de `agy`; aviso si no está instalado o si está en `~/.local/bin` pero fuera del PATH (Herdr y `bond team` no lo verían) | instalarlo; añadir `~/.local/bin` al PATH |
| Restos de bond 0.7: config de pi enlazada al repo (aviso) | `bond migrate` |
| Skill de Herdr: uno solo y al día con `herdr --skill` | `bond setup`; `npx skills update herdr` |
| Filtro de git `pi-settings` | `bond setup` |
| `rg`, `fd`, `ast-grep`, `uvx`, `jq` (aviso) | instalar la que falte |
| Servidores MCP conectados (`pi mcp list`) | ver troubleshooting; `--quick` se lo salta |
| Dependencias (`node_modules`), `config.toml`, pi al día con el registro (otros agentes: aviso) | `bond setup`; `bond models sync` |
| La pasarela de cada proveedor del registro sirve los modelos declarados | revisar la pasarela |
| `bond` en el PATH y es el de este repo | `bond setup` |
| Actualizaciones: método de instalación, última comprobación, versión pendiente, omitida y si se pregunta al arrancar (informativa; aviso si hay una pendiente sin omitir; no haber mirado nunca no falla) | `bond update`; `bond update --skip vX.Y.Z` |
| Sugerencias de prompt de pi: modelo, paquete instalado, `enabledModels` y si el config de la extensión coincide con `config.toml`; otras extensiones que reemplacen el editor (aviso, nunca fallo) | `bond setup` |
| Catálogos del repo (`[[catalog]]` en `bond.toml`): por cada uno, el commit fijado en `.bond/lock.json`, si está descargado en `~/.bond/catalogs` y si la ref tiene un commit más nuevo (se consulta la red; con `--quick`, «sin verificar»); un catálogo local sale con su carpeta | `bond catalog update <nombre>` |
| Memoria de decisiones (solo si el repo tiene `[decisions]`): errores de los ficheros y propuestas pendientes; sin el directorio, avisa | `bond decisions check`; `bond decisions accept <id>`; `bond sync` |

## `bond decisions`

`cli/decisions.mts`. La memoria de decisiones del repo: qué se decidió, quién y por qué, en
ficheros Markdown versionados. Se activa con la sección `[decisions]` de `.bond/bond.toml`
(`bond init` la propone con la skill `decision-record`; `bond sync` crea el `<dir>/README.md`
con el formato del registro). No hay índice compartido: el listado lo da `bond decisions`, así
que dos ramas paralelas que registran decisiones se fusionan sin conflictos. En un repo sin
`[decisions]`, `add` falla diciendo cómo activarla y lo demás
sale con 0 explicando que no se usa la memoria.

| Comando | Qué hace |
|---|---|
| `bond decisions` | Lista las decisiones, las más recientes primero; `--status <estado>`, `--agent <subcadena>`, `--json` |
| `bond decisions add` | Registra una decisión: `--title`, `--context`, `--decision`, `--alternatives`, `--consequences`, `--link "tipo: valor"` (repetible); o con `--stdin`, el mismo objeto en JSON (incluido `consequences`). Bond calcula el id (`YYYY-MM-DD-slug`, `-2` si colisiona), la autoría y los enlaces de rama y HEAD, escribe `<dir>/<id>.md` con los apartados en inglés (*Context*, *Decision*, *Rejected alternatives*, *Consequences* — este solo si se pasan consecuencias). No toca ningún índice: el listado lo da esta orden. Entra siempre como `proposed` |
| `bond decisions accept <id>...` | La pasa a `accepted`. Desde la terminal con confirmación interactiva (`--ref <aceptación>`), o desde la conversación con `--confirmed-by "<lo que dijo el usuario>"`: sin terminal no hace falta y la decisión guarda además `accepted_via` (quién lo ejecutó: `agent:<kind>/<nombre>` desde un panel de Herdr, `user` fuera). Admite varios ids y `--all-proposed`; un id desconocido o no `proposed` se informa sin abortar los demás (salida != 0 si alguno falló). `--confirmed-by` vacío se rechaza; sin terminal y sin `--confirmed-by`, se niega |
| `bond decisions reject <id>...` | La pasa a `rejected`; misma confirmación y opciones |
| `bond decisions supersede <id>... --by <nueva>` | Las viejas quedan `superseded` y la nueva las referencia en `supersedes` (ella sigue `proposed` hasta que el usuario la acepte); misma confirmación y opciones |
| `bond decisions show <id>` | El fichero entero de la decisión (o del run si el id es de uno en `<dir>/runs/`) |
| `bond decisions runs` | Los runs (encargos a agentes) en `<dir>/runs/`, con los commits de su rama y las decisiones de ese agente; `--agent <subcadena>`, `--json` |
| `bond decisions check` | Audita la memoria: frontmatter, id contra nombre de fichero, duplicados, referencias de sustitución rotas y trailers `Decision:`. El README no se audita: no hay índice que mantener al día. Sale con 1 si hay errores |

La autoría (`decided_by`): en un panel de Herdr, `agent:<kind>/<nombre>` —bond mira el agente
del panel, el agente no necesita saber su propio nombre—; fuera de Herdr o sin agente en el
panel, `user`. Aceptar es solo del usuario, pero puede hacerlo desde la conversación:
`accept`, `reject` y `supersede` piden confirmación interactiva con terminal, o
`--confirmed-by "<lo que dijo el usuario>"` sin ella; en ese caso `accepted_by` guarda la
cita y `accepted_via` quién ejecutó (`check` valida su formato). Sin una cosa ni la otra, se
niegan: un agente no acepta por su cuenta; lo que sí puede es ejecutar el comando citando al
usuario, con el comando `/accept` como guía. La barrera evita aceptaciones por descuido; no
es una medida de seguridad: la integridad de los registros la da git, y una aceptación
indebida se ve en el diff y se revierte con `supersede` o `git revert`. Aceptar al aprobar:
si el usuario ya aprobó la decisión en la conversación (por ejemplo, al aprobar el plan que
la contiene), se registra directamente aceptada con `bond decisions add ... --confirmed-by
"<lo que dijo>"` (o `confirmed_by` en `record_decision`), sin volver a pedirle que la acepte;
solo quedan `proposed` las que un agente toma por su cuenta. No hay cuadro de permiso aparte:
las reglas `ask` que la 1.8.0 dejaba en `.claude/settings.json` las quita `bond sync`,
conservando las del usuario.

pi tiene la tool `record_decision` (`extensions/record-decision.ts`), que llama a este mismo
`bond decisions add --stdin`: el modelo pasa solo el contenido y bond escribe el registro con
su id. `bond doctor` añade la fila de decisiones: errores (fallo), propuestas
pendientes (aviso) o la memoria limpia.

Con la memoria activa, las skills del catálogo `plan-create`, `plan-execute`,
`git-conventional-commit`, `delivery-review-github` y `convention-document` registran y
enlazan decisiones con esta herramienta (`record_decision` o `bond decisions add`) al
planificar, ejecutar, commitear, preparar un PR o documentar una convención. Ninguna marca
una decisión como `accepted`: eso queda en `bond decisions accept`. Sin memoria, o si la
herramienta o el comando no están disponibles, las skills se comportan como siempre.

Los runs (encargos e informes) los escribe bond, no el modelo: `bond team prompt <rama>` deja
el encargo exacto en `<dir>/runs/<fecha>-<agente>-<slug>.md` del checkout principal antes de
mandarlo (`--no-record` lo evita; si la escritura falla, avisa y manda el prompt igual); con
memoria activa, el texto que recibe el agente lleva además una nota: lo que registre en
`<dir>/` se commitea en su rama, y no escribe en el plan ni en `<dir>/runs/`.
`bond team collect <rama>` toma solo la última respuesta del agente de su fichero de sesión
(en pi, el `.jsonl` que Herdr reporta en `agent_session`) y, si no es legible, el volcado
del panel recortado —sin banner de arranque ni avisos— (`--lines <n>`, por defecto 200), y
guarda el informe, el estado, los commits de la rama y las decisiones cuyo `decided_by` es ese
agente; repetirlo reemplaza el informe y recalcula las listas, sin duplicar. Se niega mientras
el agente trabaja o espera una respuesta, para no guardar un informe a medias. Sin run creado
por `prompt`, `collect` lo crea con `--request "<encargo>"` y `--agent <nombre>` (delegaciones
sin equipo, como `bond-delegate`). El agente de la rama nunca escribe su propio run.

El formato de los ficheros lo documenta la skill `decision-record`
(`catalog/skills/decision-record/`).

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
| MCP `context7` | `catalog/mcps/context7.json` (por repo) | Documentación de librerías por versión (`resolve-library-id`, `query-docs`). Remoto, sin clave. |
| MCP `duckduckgo` | `catalog/mcps/duckduckgo.json` (por repo) | Búsqueda en DuckDuckGo y lectura de páginas (`search`, `fetch_content`). `uvx duckduckgo-mcp-server==0.7.0`, sin clave. |
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
en `catalog/mcps/duckduckgo.json` (o reinstala `ast-grep`) y verifica con `pi mcp list`.

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
cambiarlo. Con Homebrew te dice el comando (`brew update && brew upgrade
jmanuelcorral/tap/bond`). `@jmanuelcorral/bond` aún no está publicado en npm: en una instalación
por npm te remite al paquete de la release (`npm i -g
https://github.com/jmanuelcorral/bond/releases/download/vX.Y.Z/jmanuelcorral-bond-X.Y.Z.tgz`).
`--version vX.Y.Z` instala una concreta, también anterior. Venga de donde venga, la versión
nueva pasa a sus ficheros `~/.bond/pi` y los skills globales que apuntaban a los de otra, y
borra las versiones viejas de `~/.bond/runtime/`.

Al abrir el puesto de trabajo (`bond`, `bond dev`, `bond team`; no sus subcomandos ni la
ayuda), bond mira si hay release nueva una vez cada 24 h (la marca va en `~/.bond/state.json`).
La consulta tiene un tope de ~2 s: sin red o sin respuesta, el arranque sigue sin decir nada.
Si hay versión nueva, pregunta:

1. **Actualizar ahora**: con el binario de `install.sh`/`install.ps1` hace lo mismo que
   `bond update` y sigue con la versión nueva; si el binario descargado no arranca, se queda
   el actual y avisa. Con Homebrew avisa de que `brew update` refresca el índice de todos los
   taps de la máquina (bond no puede deshacerlo), corre `brew update && brew upgrade
   jmanuelcorral/tap/bond` con la salida de brew a la vista y sigue con
   `$(brew --prefix bond)/bin/bond`. Si brew falla (lock, sin red, tap caído) o aún no trae esa
   versión, se ve el error, no cambia nada y el arranque sigue con la versión que tenías. Con
   npm o desde el código dice el comando.
2. **Omitir esa versión**: no la vuelve a nombrar; la siguiente release sí se ofrece. Lo mismo
   a mano: `bond update --skip vX.Y.Z` (sin tocar la red); `bond update --skip-reset` quita la
   omisión y la versión vuelve a ofrecerse.
3. **No volver a preguntar**: escribe `[update] auto = false` en `~/.bond/config.toml` (sin
   tocar el resto del fichero). Para recuperarlo, `auto = true` o borra la tabla.

Intro, o cualquier otra respuesta, deja la pregunta para la próxima comprobación. Sin terminal
(entrada o salida redirigidas) no pregunta: solo avisa por stderr. `BOND_NO_UPDATE=1` desactiva
la comprobación del todo; `BOND_RELEASES_URL` cambia de dónde se leen las releases.

`bond doctor` enseña cómo está: método de instalación, última comprobación, versión pendiente,
versión omitida y si se pregunta al arrancar.

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
