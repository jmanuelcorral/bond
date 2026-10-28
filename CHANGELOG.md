# Cambios

## Sin publicar

- Confianza del orquestador en `bond team`: si el agente del panel que lanza el equipo (pi,
  Claude Code o `agy`) confía en el checkout principal, todos los agentes pi, Claude Code y `agy`
  del equipo arrancan confiando en su worktree, aunque su agente no hubiera abierto nunca el
  repo. En `agy` se escribe en `trustedWorkspaces`. Sin esa confianza, cada agente hereda la suya
  como hasta ahora; `--no-trust` lo desactiva.
- Aceptar al aprobar: `bond decisions add` (y `record_decision` en pi) admite
  `--confirmed-by "<lo que dijo el usuario>"` (`confirmed_by` en el JSON) y registra la
  decisión ya `accepted`, con esa cita y `accepted_via`. Las skills `plan-create`,
  `decision-record`, `plan-execute` y `convention-document` lo usan: las decisiones que apruebas
  con un plan quedan aceptadas sin tener que aceptarlas otra vez; solo quedan `proposed` las que
  un agente toma por su cuenta.
- Sin cuadro de permiso para aceptar: `bond sync` ya no deja reglas `ask` para `bond decisions
  accept`, `reject` y `supersede` en `.claude/settings.json`, y quita las que dejó la 1.8.0
  conservando las tuyas. Si lo has pedido por chat, no hay que validar el comando otra vez.
- Antigravity (`agy`) como agente del repo: `bond init --agents agy` y `bond sync` generan un
  plugin de bond en `.agents/plugins/bond/` con los servidores MCP (del catálogo y los de
  `[mcp_servers]`) y los comandos del catálogo y propios, cada uno como skill (`/commit`,
  `/review`...). `agy` ya leía `AGENTS.md` y `.agents/skills/` por su cuenta. Quitar `agy` de
  `agents` borra el plugin. `bond doctor` enseña la versión de `agy` y avisa si no está
  instalado o si está en `~/.local/bin` pero fuera del PATH. Su uso en `bond team` llegará
  aparte.
- `bond setup` con Antigravity (`agy`): deja un plugin global de bond en
  `~/.gemini/config/plugins/bond/` con tus instrucciones y las reglas de bond
  (`rules/AGENTS.md`) y las skills `bond-delegate`, `bond-team` y `herdr`, así que `agy` las
  carga en cualquier repo. No toca nada más de `~/.gemini/config/`; sin `agy` entre tus agentes,
  no crea nada. El plugin se llama `bond-global` para que conviva con el plugin `bond` del repo
  (con el mismo nombre, `agy` solo cargaba el del repo). `bond doctor` dice si está al día.
- `bond team collect` con agentes Claude Code: toma el informe de su transcript
  (`~/.claude/projects/*/<sesión>.jsonl`, por el id que da Herdr) en vez del panel; cuenta como
  decisiones del agente solo las firmadas `agent:<kind>/<nombre>` que no estaban en la base
  (antes sumaba las del orquestador del mismo tipo y las ya existentes); y compara con la base
  guardada al mandar el encargo, así que recoger después de integrar la rama sigue mostrando sus
  commits y decisiones.
- Antigravity (`agy`) en equipos y delegaciones: `bond team <rama>:agy` da al worktree la
  confianza que ya tenía el checkout principal en `trustedWorkspaces` de
  `~/.gemini/antigravity-cli/settings.json` (`--no-trust` lo evita), y si `agy` pregunta si
  confías en la carpeta, la rama sale `bloqueado` y `prompt` no manda nada. `bond team collect`
  toma su última respuesta del `transcript.jsonl` de la conversación cuando Herdr la reporta
  (con `herdr integration install antigravity-cli`) y, si no, del panel sin el logo ni la
  bienvenida de `agy`.
- Antigravity (`agy`) en equipos, tras probarlo de verdad en Herdr: `bond team <rama>:agy`
  arranca `agy` aunque solo esté en `~/.local/bin` (añade esa carpeta al PATH de la shell del
  panel antes de lanzarlo) y con `--dangerously-skip-permissions`, porque sin él pide permiso por
  cada comando y no avanza (tus argumentos tras `--` lo sustituyen; la skill `bond-delegate` hace
  lo mismo). El aviso de novedades de `agy` al arrancar («esc to dismiss») ya no deja la rama
  `bloqueado` ni dice «espera una respuesta tuya»; la pregunta de confianza sí. `bond setup`
  instala la integración `antigravity-cli` de Herdr (antes la saltaba porque no se llama como el
  agente) y `bond doctor` la comprueba; con ella, `collect` toma el informe de la conversación de
  `agy`. Sin ella, del panel queda solo la respuesta final, sin el banner, el encargo repetido ni
  las líneas de razonamiento y herramientas.
- `bond decisions check` mira solo los trailers `Decision:` de la rama actual: antes leía los de
  todas las ramas y, con agentes en paralelo, una rama fallaba por las decisiones de otra.

## 1.8.0

Aceptar decisiones sin salir de la conversación con tu agente: le dices cuáles aceptas y queda
constancia de que lo pediste tú y de quién lo ejecutó.

- `bond decisions accept`, `reject` y `supersede` admiten `--confirmed-by "<lo que dijo el
  usuario>"` y con él no necesitan terminal. La decisión guarda esa referencia en `accepted_by`
  y en `accepted_via` quién lo ejecutó (`agent:<kind>/<nombre>` desde un panel de Herdr, `user`
  fuera); `check` valida su formato. Aceptan varios ids y `--all-proposed`: un id desconocido o
  que no está `proposed` se informa sin cortar los demás, y la salida es distinta de 0 si alguno
  falla. Sin terminal y sin `--confirmed-by` se siguen negando, y un `--confirmed-by` vacío se
  rechaza.
- Comando nuevo del catálogo, `/accept`: enseña las decisiones `proposed`, te pregunta cuáles
  quieres y solo entonces las acepta, rechaza o sustituye citando tus palabras.
- En Claude Code, con `[decisions]`, `bond sync` añade a `.claude/settings.json` reglas `ask`
  para `accept`, `reject` y `supersede`: cada una pasa por el cuadro de permiso de Claude Code.
  Se fusionan con las reglas del repo sin pisarlas, y al quitar `[decisions]` solo se van las de
  bond.
- `bond decisions supersede` dejaba en `supersedes` de la decisión nueva su propio id en lugar
  del de la sustituida.
- El comentario de `[decisions]` que escribe `bond init` en `.bond/bond.toml` ya no habla de un
  índice en el README (desde la 1.7.0 no lo hay) y dice que los trailers `Agent:` y `Decision:`
  son opcionales.

## 1.7.0

Memoria de decisiones de los agentes: en un repo con bond, las decisiones, los encargos a otros
agentes y lo que respondieron quedan por escrito en el repo, para auditar después qué hizo cada
uno. La escritura la hace bond, no el modelo: funciona también con modelos locales que no
siguen formatos a mano.

- Se activa por repo con la sección `[decisions]` de `.bond/bond.toml` (`dir = "docs/decisions"`,
  ajustable dentro del repo). `bond init` la propone cuando eliges la skill `decision-record`,
  marcada por defecto; al reinicializar, una sección que ya tuvieras se conserva. `bond sync`
  crea `<dir>/README.md` con el formato si falta; después es del repo. Sin `[decisions]`, nada
  cambia.
- `bond decisions add` registra una decisión: el agente pasa el título, el contexto, la decisión
  y, si las hay, alternativas, consecuencias y enlaces (por flags o JSON con `--stdin`), y bond
  escribe `<dir>/<YYYY-MM-DD-slug>.md` con su frontmatter, la rama y el HEAD. La autoría la pone
  bond: en un panel de Herdr, el agente de ese panel (`agent:pi/kevin`); fuera, `user`. Siempre
  entra como `proposed`.
- `bond decisions accept`, `reject` y `supersede` son del usuario: piden terminal interactiva y
  confirmación, y se niegan desde el shell de un agente. Evita aceptaciones por descuido; no es
  una medida de seguridad (la integridad la da git).
- Para auditar: `bond decisions` lista (`--status`, `--agent`, `--json`), `show <id>` enseña una
  decisión o un run, `runs` lista los encargos y `check` valida frontmatter, ids, sustituciones y
  trailers `Decision:` (sale con 1 si hay errores). `bond doctor` añade una fila con los errores
  y las decisiones pendientes de aceptar.
- En pi, la herramienta `record_decision` (Bond Extensions) llama a `bond decisions add`.
- Encargos e informes: con la memoria activa, `bond team prompt` guarda el encargo exacto en
  `<dir>/runs/` antes de mandarlo (`--no-record` para no guardarlo; si falla al escribir, avisa
  y manda el prompt igual) y le pide al agente que commitee en su rama lo que registre. La nueva
  `bond team collect <rama>` guarda en el run la última respuesta del agente (de su fichero de
  sesión o, si no se puede, del panel sin el banner de arranque), el estado, los commits de la
  rama y las decisiones de ese agente; se niega mientras el agente trabaja o espera una respuesta
  y repetirlo no duplica nada. Con `--request` y `--agent` sirve también para delegaciones sin
  equipo.
- Las decisiones viajan con la rama y se revisan con el código; no hay un índice compartido que
  dé conflictos entre agentes en paralelo.
- Skills: `decision-record` es nueva; `plan-create`, `plan-execute`, `git-conventional-commit`,
  `delivery-review-github` y `convention-document` registran y enlazan sus decisiones con la
  herramienta; `bond-team`, `plan-team` y `bond-delegate` guardan encargos e informes con
  `prompt` y `collect`. Con la memoria activa, los commits pueden llevar los trailers opcionales
  `Agent:` y `Decision:`; sin ella, las skills no firman nada. Una regla global de `bond setup`
  pide usar la memoria en los repos que la tienen.
- `bond catalog check` falla si el frontmatter de una skill no es YAML válido (por ejemplo, una
  `description` sin comillas con `: ` dentro), que pi se niega a cargar aunque Claude Code lo
  tolere.

## 1.6.3

- `bond team status` da por `integrada` una rama que entró en la base por fast-forward o con un
  merge (antes salía `sin commits`, como si no hubiera empezado), y por eso `bond team clean`
  sin argumentos ya la quita. Lo distingue el reflog de la rama: si avanzó desde que se creó, ya
  trabajó. Una rama recién creada sigue saliendo `sin commits`.
- Nuevo vídeo en la web (https://josecorral.dev/bond/): Claude, solo en su panel, planifica una
  web, la reparte entre dos agentes pi con `bond team`, revisa, integra y limpia el equipo.

## 1.6.2

- La tool `repo_map` de pi (y el script `repo-map` de la skill `code-context`) ya no falla en
  repos con mucha historia: la lista de ficheros más tocados cortaba la tubería con `head` y,
  con `pipefail`, el script terminaba con error (SIGPIPE) aunque hubiera escrito el mapa.
- La web de la documentación (https://josecorral.dev/bond/) tiene vídeos de bond en acción sobre
  un proyecto real: `bond init`, el puesto de trabajo, un equipo de agentes y los catálogos.

## 1.6.1

- `bond init` interactivo vuelve a marcar de partida lo que el repo ya usa (o, en un repo nuevo,
  lo del catálogo por defecto). En la 1.6.0 la lista salía sin marcar y, si confirmabas sin
  tocarla, guardaba lo del catálogo de bond con prefijo (`"bond:context7"` en vez de
  `"context7"`): funcionaba, pero no era lo esperado. Un `bond.toml` con esos prefijos sigue
  valiendo; `bond init` lo deja otra vez con los nombres a secas.
- La documentación tiene web propia, en castellano e inglés: https://josecorral.dev/bond/
  (los mismos `docs/`, con buscador).

## 1.6.0

Catálogos del equipo: un equipo reúne en un repo sus skills, comandos y servidores MCP, y cada
proyecto lo usa con bond como usa el catálogo de bond.

- `bond catalog create`: prepara el repo actual como catálogo propio de un equipo. Pregunta el
  nombre (por defecto, el de la carpeta; `--name` para no preguntar) y crea `catalog.toml` y
  las carpetas `skills/`, `commands/` y `mcps/`, cada una con un `README.md` que explica cómo
  añadir lo suyo. No mete ejemplos instalables. Si ya hay `catalog.toml`, no lo toca y solo
  añade lo que falte.
- `bond catalog check [dir]`: comprueba un catálogo (skills con `SKILL.md` y `name` igual a su
  carpeta, comandos con `description`, servidores MCP con `command` o `url`, entradas de
  `catalog.toml` que existen) y sale con 1 si hay errores, para CI. Avisa de secretos escritos
  tal cual en `env` o `headers`.
- Catálogos del equipo en un repo: `[[catalog]]` con `path` en `.bond/bond.toml`. Sus skills,
  comandos y servidores MCP salen en `bond init` (y en `--list`, con el nombre del catálogo) y
  `bond sync` los genera para cada agente como los del catálogo de bond; en pi, sus comandos van
  a `.pi/prompts/`. Con el mismo nombre que una de bond, gana la del equipo (`bond:nombre` pide
  la de bond); en dos catálogos del equipo, se elige con `catalogo:nombre`. `sync`
  valida el catálogo como `bond catalog check` y no escribe nada si tiene errores; avisa si la
  carpeta está fuera del repo. Sin `[[catalog]]`, nada cambia.
- Catálogos del equipo por git: `bond catalog add <url> [--ref tag|rama|sha]` los declara en
  `.bond/bond.toml` (`[[catalog]]` con `name`, `git` y `ref`) y fija el commit en
  `.bond/lock.json`, que se commitea. `sync` usa ese commit (aunque la rama avance) y lo descarga
  a `~/.bond/catalogs/` si falta; con la caché llena funciona sin red. `bond catalog update`
  vuelve a resolver la ref y mueve el lock; `list`, `remove` (quita también lo elegido de él) y
  `clean` (poda la caché). `add` y `update` enseñan antes los servidores MCP que llegan o cambian
  y lo que pasa a venir de otro catálogo, y piden confirmación (`--yes`). `add` también acepta
  una carpeta (`[[catalog]] path`).
- `bond doctor` añade una fila por cada catálogo del equipo en `.bond/bond.toml`: el commit
  fijado en `.bond/lock.json`, si está descargado en `~/.bond/catalogs` y si la ref tiene un
  commit más nuevo (avisa con `bond catalog update <nombre>`; con `--quick` o sin acceso, «sin
  verificar» — no toca la red). Los catálogos locales salen con su carpeta, y falla si no
  existe.
- `bond doctor` ya no se corta cuando `.bond/bond.toml`, `.bond/lock.json` o un catálogo del
  equipo no valen (lock ilegible o que no cuadra, catálogo con errores, nombre desconocido): la
  fila «repo» falla con el motivo y el arreglo, y el resto de comprobaciones, incluida la fila
  de cada catálogo, sale igual.
- Skill nueva en el catálogo de bond: `catalog-maintain` (opcional, `default = false`). Ayuda a
  llenar y mantener un catálogo de equipo creado con `bond catalog create`: añadir skills,
  comandos y servidores MCP con el formato de los `README.md` que `create` deja en cada
  carpeta, mantener `catalog.toml` y pasar `bond catalog check` antes de publicar. No duplica
  la estructura que ya da `create`.
- Los servidores MCP del catálogo van ahora en un fichero por servidor (`catalog/mcps/<nombre>.json`
  en lugar de `catalog/mcp.json`), el mismo formato que los catálogos propios. Lo que genera
  `bond sync` no cambia.
- Documentado el ciclo de vida de los catálogos externos (crear, comprobar, publicar, añadir,
  sincronizar, actualizar y diagnosticar) con las notas de seguridad y de CI con repos privados
  en `docs/reference.md`; atajo para equipos en `docs/getting-started.md`.

## 1.5.1

- `bond doctor`: ejecutándose desde el repo de bond, si `~/.bond/pi` apunta a un runtime
  instalado (`~/.bond/runtime/<versión>` con su marca `.complete`) la fila «Bond Extensions»
  avisa en vez de fallar: pi está usando las extensiones de esa versión instalada y no las
  del repo en desarrollo. Sigue fallando si el destino no es ni el repo ni un runtime válido.

## 1.5.0

- `bond setup` instala y configura las sugerencias de prompt de pi: al terminar cada turno, con
  el editor vacío, pi muestra en *ghost text* el siguiente prompt sugerido, aceptable con `→` o
  `Tab`. Bond hace `pi install npm:@mrclrchtr/supi-prompt-suggestions@11.0.1` en el ámbito
  personal (no por proyecto), elige el modelo entre los de coste cero del registro de bond y pone
  `enabledModels: ["*"]` en pi si no lo tenía ya. El config de la suite supi se fusiona: las
  secciones de otros paquetes se conservan. `--no-suggestions` las deja apagadas.
- `[suggestions]` en `~/.bond/config.toml`: `enabled` y `model` (p. ej.
  `model = "halo/flash-halogen"`). Sin sección, bond aplica su heurística y, si el registro no
  tiene ningún modelo para pi, propone apagado.
- `bond doctor` añade la fila «sugerencias»: modelo, si el paquete está instalado,
  `enabledModels` y si el config de la extensión coincide con `config.toml`; avisa además de
  otras extensiones locales que reemplacen el editor (solo una puede estar activa). Nunca falla:
  es una comodidad, no una pieza de la instalación.

## 1.4.0

- Al abrir el puesto de trabajo (`bond`, `bond dev`, `bond team`), bond mira una vez al día si
  hay release nueva (tope de ~2 s; sin red, sigue sin más) y pregunta: 1) actualizar ahora,
  2) omitir esa versión hasta que salga otra o 3) no volver a preguntar (`[update] auto =
  false` en `~/.bond/config.toml`). Con «1» y el binario de `install.sh`/`install.ps1`,
  descarga, comprueba el SHA-256 y que arranca, sustituye el binario y sigue con la versión
  nueva; con Homebrew, npm o desde el código dice el comando. Sin terminal solo avisa.
  `BOND_NO_UPDATE=1` lo desactiva.
- Con «1» en una instalación de Homebrew, bond avisa de que `brew update` refresca todos los
  taps y corre `brew update && brew upgrade jmanuelcorral/tap/bond` con la salida de brew a la
  vista; si brew falla, se ve su error y sigues con la versión que tenías.
- En una instalación por npm, bond ya no propone `npm i -g @jmanuelcorral/bond@latest`: el
  paquete aún no está publicado en npm, así que remite al `.tgz` de la release.
- `bond update --skip vX.Y.Z` omite esa versión en el aviso de arranque (hasta que salga otra),
  sin tocar la red; `bond update --skip-reset` quita la omisión.
- `bond doctor` añade la fila «actualizaciones»: método de instalación, última comprobación,
  versión pendiente, versión omitida y si se pregunta al arrancar. Solo avisa si hay una versión
  pendiente sin omitir; no haber mirado nunca no cuenta como fallo.

## 1.3.0

- Quitado el pie `Prepared with bond skills` de las skills del catálogo: los agentes ya no cierran
  sus respuestas con esa marca. Se mantiene la prohibición de atribuirse a bond como agente o de
  meter branding en ficheros del proyecto sin aprobación.

- `bond` abre solo el agente, sin la shell de al lado; `bond --shell` la recupera (`-d` y `-r`
  ahora se aplican a ella). El agente del checkout principal se llama `gru` (`gru-2`... si ya
  hay otro en Herdr), en vez de `<agente>-<repo>`.
- `bond team` dentro de Herdr abre cada agente en un panel de tu pestaña, debajo del tuyo (en
  fila, hasta 4), con nombre de minion (`kevin`, `stuart`, `bob`...) y el panel titulado
  `minion · rama`, en vez de un workspace por rama. `--workspaces` mantiene el modo anterior,
  que sigue siendo el de fuera de Herdr. `bond team status` enseña el panel de cada agente y
  `bond team clean` lo cierra al quitar su worktree.
- `bond team` en paneles: si confías en el checkout principal en pi (`~/.pi/agent/trust.json`)
  o en Claude Code (`~/.claude.json`), cada worktree hereda esa confianza y su agente arranca
  sin preguntar. Sin ella, o con otros agentes, pregunta como antes; `--no-trust` lo desactiva.
- `bond team status --watch`: tabla en vivo, refrescada cada 2 s, con el minion, la rama, el
  estado, los commits y los ficheros de cada agente; sale con `q` o Ctrl+C. `bond team` dentro de Herdr la abre en un panel estrecho a la derecha del
  tuyo (`tabla · <repo>`), o reutiliza el que ya hay.
- `bond team` en paneles: tu pestaña admite 6 paneles (el tuyo, la tabla y 4 minions). Si los
  agentes no caben, pregunta antes de crear nada: 1) pestañas nuevas `equipo · <repo>`, 4 por
  pestaña (por defecto), 2) todo en tu pestaña, en filas de 4, o 3) un workspace por rama.
  `--tabs`, `--same-tab` y `--workspaces` eligen sin preguntar; sin terminal o con `--yes`,
  la 1. La tabla en vivo se abre también con `--workspaces` y muestra todas las ramas.
- `bond team clean`: si al acabar no queda ningún agente del equipo, cierra también el panel de
  la tabla en vivo (`--keep-table` lo deja). `bond team status --watch`, en su panel, cuando
  ninguna rama tiene trabajo pendiente avisa `sin trabajo pendiente` y cierra el panel; no si
  está enfocado ni con `--keep-open`.
- `bond team status --watch` agrupa las ramas por estado, primero lo que te espera: ⛔ necesita
  tu respuesta (con la pregunta debajo), 🔄 trabajando, ✏️ sin commitear, 📦 por revisar y
  ✅ integradas / sin empezar; los grupos vacíos no salen. El icono del estado va solo en el
  título del grupo, en su color; sin columna con la última línea del panel del agente.
- Skill `plan-team` en el catálogo (opcional): ejecuta en paralelo las fases independientes de
  un plan de `docs/plans/`, una rama, worktree y agente por fase con `bond team`. Cada agente
  implementa solo su fase con `plan-execute` y hace commit en su rama si la verificación pasa,
  sin push; al integrar cada rama, actualiza el plan. Antes de crear el equipo anuncia dónde
  se abre cada agente y cuáles arrancan con la confianza heredada, y remite a la tabla en vivo
  para seguirlo. Al confirmar que una rama está integrada, cierra su panel con
  `bond team clean <rama>` (la rama se queda), y al terminar el plan tu pestaña queda sin
  paneles del equipo. `plan-create` y `bond-team` la ofrecen cuando toca.

## 1.2.1

- `bond init`: antes de elegir herramientas enseña qué hace cada una (servidores MCP, skills y
  comandos), con las opcionales señaladas. Antes la explicación solo salía en las marcadas y en
  la del cursor. Las skills salen en el orden de `catalog/catalog.toml`.

## 1.2.0

- Catálogo: skills para llevar una tarea de la issue a la release, adaptadas de
  [fluzo-labs/common-skills](https://github.com/fluzo-labs/common-skills) (MIT), solo en modo
  guiado: `git-conventional-commit` (la usa `/commit`), `plan-create` (planes en `docs/plans/`;
  las fases independientes, en paralelo con `bond team`) y `plan-execute`. Opcionales:
  `issue-refine-github`, `delivery-review-github` (tras el merge sugiere `bond team clean`),
  `release-prepare-github` (si un workflow publica al empujar el tag, ese push es la
  publicación) y `convention-document`.
- `/commit` usa `git-conventional-commit` si el repo la tiene; si no, la forma de commitear del
  agente.
- `bond init`: las skills opcionales salen sin marcar y `--yes` instala solo las de por defecto.
- `bond team status`: por rama, estado (trabajando, bloqueado, sin commitear, lista, integrada,
  sin commits), agente, commits por delante de la base y ficheros. Reconoce las ramas
  integradas por fast-forward, rebase o squash.
- `bond team prompt <rama> "tarea"`: manda trabajo al agente de una rama sin saber su nombre.
- `bond team clean`: quita los worktrees de las ramas integradas (o los que nombres), con su
  workspace, su agente y la carpeta vacía de Herdr; las ramas se quedan salvo con
  `--delete-branch`. Nunca uno con el agente trabajando o esperando, o con cambios sin
  commitear, salvo con `--force`.
- pi en un worktree nuevo pregunta si confía en la carpeta y Herdr lo da por libre: el primer
  prompt contestaba "Trust" por ti y la tarea se perdía. Ahora bond lee el panel: la rama sale
  `bloqueado` (también en `bond`) y `bond team prompt` no manda nada hasta que contestes tú.
- El skill `bond-team` usa `bond team status` y `bond team prompt`.

## 1.1.0

- `bond update`: pone bond al día con la última release (o `--version vX.Y.Z`). Con el binario
  de los instaladores lo descarga, comprueba su SHA-256, prueba que arranca y lo sustituye; con
  Homebrew o npm dice el comando. `--check` solo mira.
- `~/.bond/runtime/` ya no crece con cada versión: la que arranca pasa a sus ficheros
  `~/.bond/pi` y los skills globales y borra las versiones viejas.
- `bond team`: usa el agente por defecto del repo (`bond.toml`) en vez del global; el repo es
  opcional (`bond team feat/a feat/b:claude`); avisa de agentes sin config en el repo y de
  cambios sin commitear; valida los nombres de rama antes de tocar Herdr.
- Windows: bond encuentra los agentes instalados (`claude.cmd`, `codex.exe`...): `which` prueba
  las extensiones de `PATHEXT`. Antes `bond init`, `bond` y `bond setup` no veían ninguno.
- Windows: `bond setup` copia los skills globales en vez de enlazarlos (los symlinks piden
  permisos especiales); `bond doctor` reconoce esas copias.
- Windows: `.bond/manifest.json` guarda las rutas con `/`, como en Linux y macOS (antes, con
  `\`, un repo sincronizado en otro sistema veía como ajenos los ficheros de bond). Se entienden
  los registros antiguos. `bond sync` ya quita las carpetas que deja vacías.
- Los errores de Herdr sin mensaje ya no salen vacíos.
- Pruebas (`bun test`) de `bond init`/`sync` y comprobación de tipos (`tsc`) en CI, en las tres
  plataformas.

## 1.0.1

- Licencia MIT (`LICENSE`), declarada en npm, Homebrew y AUR.

## 1.0.0

Primera versión instalable sin clonar el repo:

- Binarios autocontenidos para Linux (x64, arm64), macOS (Intel, Apple silicon) y Windows (x64)
  en cada release de GitHub, con `SHA256SUMS`.
- Instaladores: `curl -fsSL https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.sh | sh`
  y, en Windows, `irm https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.ps1 | iex`.
- Homebrew: `brew install jmanuelcorral/tap/bond`.
- `bond init --agents` puede preparar la config de agentes que no están instalados en la máquina.

## 0.11.0

- Migración a la 1.0: la config de pi ya no se enlaza desde el repo de bond. `bond migrate` (y
  `bond setup`, que la ejecuta) convierte los enlaces de una instalación anterior en ficheros
  propios con copia `.bak`, pasa tus instrucciones a `~/.bond/AGENTS.md` y quita el paquete
  global de pi: las Bond Extensions se cargan por repo.
- Se quitan `install.sh`, `pi/agent/` y el filtro de git de `settings.json`.

## 0.10.0

- `bond` a secas dentro de un repo abre su puesto de trabajo en Herdr con el agente por
  defecto: arranca el servidor si hace falta, ofrece `bond init` si el repo no tiene bond y
  regenera su config si está desfasada. `--agent`, `--worktree`, `--no-focus`, `--no-attach`.
- `bond dev`, `bond team`, `bond status` y `bond sessions` pasan a TypeScript (funcionan en
  Windows); se quitan los scripts bash `pidev`, `piteam`, `pistatus` y `pisessions`.
- Etiquetas de workspace `bond:<repo>` (se reconocen las antiguas `pi:<repo>`).

## 0.9.0

- `bond init` interactivo: agentes del repo, agente por defecto y herramientas del catálogo; en
  un repo ya inicializado cambia solo la selección. Bond Extensions de pi por repo vía
  `~/.bond/pi`.

## 0.8.0

- `bond setup` interactivo: Herdr, endpoints (detecta Ollama y LM Studio; OpenAI y compatibles),
  agentes elegidos y por defecto, instrucciones personales en cada agente. Config en `~/.bond/`,
  claves en `~/.bond/keys/` (600).
- bond se compila como binario autocontenido (Linux, macOS, Windows) y paquete de npm.

## 0.7.0

- El proyecto pasa a llamarse **bond** y se publica en GitHub.
- El paquete de pi se enlaza como `~/.pi/agent/bond`; `bond setup` quita el enlace antiguo
  `~/.pi/agent/pisetup`. La marca del bloque de Herdr es `>>> bond >>>` (la antigua
  `>>> piSetup >>>` se sigue reconociendo).
- `bond setup` sustituye los enlaces rotos (p. ej. tras mover el repo) sin dejar copias `.bak`.

## 0.6.0

- Skills globales `bond-delegate` y `bond-team`: cualquier agente delega en cualquier otro
  (`rol:kind`, `rama:kind`). En pi, `/delegate` y `/team` son atajos a ellos.
- `bond setup` instala la integración de Herdr de cada agente instalado.
- El servidor MCP de búsqueda pasa de `web` a `duckduckgo` (OpenAI reserva `web`); `web` sigue
  valiendo como alias en `bond.toml`.

## 0.5.0

- `bond init` y `bond sync` generan también la configuración de Copilot CLI, Codex, opencode,
  Crush y Gemini CLI.

## 0.4.0

- `bond init` y `bond sync`: configuración por repo (`.bond/bond.toml`) para pi y Claude Code,
  con registro de lo generado para no pisar ediciones a mano.
- Catálogo (`catalog/`): servidores MCP, skill `code-context`, comandos `review`, `commit`,
  `handoff`.

## 0.3.0

- Registro global de modelos (`~/.config/bond/config.toml`): `bond models init|list|probe|sync`
  para pi, opencode, Crush y Codex, y `bond run copilot`.

## 0.2.0

- CLI `bond`: `setup` (antes `install.sh`), `doctor`, `dev`, `team`, `status`, `sessions`, `logo`.

## 0.1.0

- Setup de pi y Herdr como paquete de pi: pie de estado, cabecera BOND, `repo_map`, MCP de
  documentación y búsqueda web, skill `code-context`, `pidev`, `piteam`, `/delegate`, `/team`.
