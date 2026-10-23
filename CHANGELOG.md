# Cambios

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
