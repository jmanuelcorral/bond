# Cambios

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
