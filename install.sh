#!/usr/bin/env bash
# Instalador del setup pi + Herdr.
#
# Deja la configuración versionada en este repo activa en ~/.pi/agent mediante symlinks,
# registra el repo como paquete de pi (extensiones, skills y prompts), instala el CLI de pi
# si falta y activa la integración de Herdr para pi.
#
# Es idempotente: se puede relanzar tras cada cambio en el repo.
set -euo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
HERDR_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/herdr/config.toml"
STAMP="$(date +%Y%m%d-%H%M%S)"
MARKER=">>> piSetup >>>"

DRY_RUN=0
WITH_PI=1
WITH_HERDR_CONFIG=0

log() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33maviso:\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

run() {
  if [ "$DRY_RUN" = 1 ]; then
    printf '    [dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

usage() {
  cat <<'EOF'
Uso: ./install.sh [opciones]

  --no-pi           No instala el CLI de pi (solo configuración e integración)
  --herdr-config    Añade el snippet de Herdr a ~/.config/herdr/config.toml
  --dry-run         Muestra lo que haría sin tocar nada
  -h, --help        Esta ayuda

Sin flags: instala pi si falta, enlaza settings.json / models.json / AGENTS.md / mcp.json,
enlaza el repo como paquete de pi (~/.pi/agent/pisetup), deja un único skill de Herdr
visible para pi, avisa de las herramientas de contexto que falten e instala la integración
de Herdr para pi.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --no-pi) WITH_PI=0 ;;
    --herdr-config) WITH_HERDR_CONFIG=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    *) die "opción desconocida: $1 (--help para ver las opciones)" ;;
  esac
  shift
done

# --- Requisitos -------------------------------------------------------------

command -v herdr >/dev/null 2>&1 ||
  die "herdr no está en el PATH. Instálalo en https://herdr.dev/docs/install/"

log "herdr $(herdr --version 2>/dev/null | awk '{print $NF}' | head -1)"

# --- CLI de pi --------------------------------------------------------------

if [ "$WITH_PI" = 1 ]; then
  if command -v pi >/dev/null 2>&1; then
    log "pi ya instalado: $(command -v pi)"
  elif command -v bun >/dev/null 2>&1; then
    log "Instalando pi con bun (a nivel de usuario, sin sudo)..."
    run bun add -g @earendil-works/pi-coding-agent
  elif command -v npm >/dev/null 2>&1; then
    npm_prefix="${NPM_GLOBAL_PREFIX:-$HOME/.npm-global}"
    log "Instalando pi con npm en $npm_prefix (sin sudo)..."
    run npm install -g --ignore-scripts --prefix "$npm_prefix" @earendil-works/pi-coding-agent
    warn "Añade $npm_prefix/bin al PATH si no lo está ya."
  else
    die "No encuentro ni bun ni npm para instalar pi."
  fi
fi

if [ "$DRY_RUN" = 0 ] && ! command -v pi >/dev/null 2>&1; then
  die "pi sigue sin estar en el PATH tras la instalación; revisa PATH y reintenta."
fi

# --- Estructura de la config de pi -----------------------------------------

log "Config de pi en $AGENT_DIR"
run mkdir -p "$AGENT_DIR/extensions"

link_path() {
  local src="$1" dest="$2"
  if [ -L "$dest" ] && [ "$(readlink -f "$dest")" = "$(readlink -f "$src")" ]; then
    log "ya enlazado: $dest"
    return 0
  fi
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    warn "$dest ya existe; lo guardo como $(basename "$dest").bak.$STAMP"
    run mv "$dest" "$dest.bak.$STAMP"
  fi
  run ln -s "$src" "$dest"
  log "enlazado: $dest -> $src"
}

link_path "$REPO_DIR/pi/agent/settings.json" "$AGENT_DIR/settings.json"
link_path "$REPO_DIR/pi/agent/models.json" "$AGENT_DIR/models.json"
link_path "$REPO_DIR/pi/agent/AGENTS.md" "$AGENT_DIR/AGENTS.md"
link_path "$REPO_DIR/pi/agent/mcp.json" "$AGENT_DIR/mcp.json"

# --- Paquete de pi -------------------------------------------------------------

# El repo es un paquete de pi (package.json -> "pi"): extensions/, skills/ y prompts/ se
# cargan como una unidad. settings.json lo declara como "./pisetup", relativo a $AGENT_DIR,
# así que el repo puede vivir en cualquier ruta: solo cambia este symlink.
link_path "$REPO_DIR" "$AGENT_DIR/pisetup"

# Migración: antes prompts/ se enlazaba suelto desde pi/agent/prompts. Con el paquete,
# ese symlink duplicaría los comandos (o quedaría roto), así que se quita si es nuestro.
old_prompts="$AGENT_DIR/prompts"
if [ -L "$old_prompts" ]; then
  case "$(readlink "$old_prompts")" in
    "$REPO_DIR"/pi/agent/prompts | "$REPO_DIR"/prompts)
      log "quitando el symlink antiguo $old_prompts (ahora llega por el paquete)"
      run rm "$old_prompts"
      ;;
  esac
fi

# --- Skill de Herdr ------------------------------------------------------------

# pi lee skills de ~/.pi/agent/skills y de ~/.agents/skills (ubicación compartida con otros
# agentes). Con el mismo nombre en las dos hay colisión: solo debe existir uno.
SHARED_HERDR_SKILL="$HOME/.agents/skills/herdr/SKILL.md"
PI_HERDR_SKILL="$AGENT_DIR/skills/herdr/SKILL.md"
fresh_skill="$(herdr --skill)"

if [ -f "$SHARED_HERDR_SKILL" ]; then
  log "skill de Herdr: uso el compartido $SHARED_HERDR_SKILL"
  if [ "$(cat "$SHARED_HERDR_SKILL")" != "$fresh_skill" ]; then
    warn "el skill compartido no coincide con 'herdr --skill' de la versión instalada;"
    warn "actualízalo con: npx skills update herdr (o herdr --skill > $SHARED_HERDR_SKILL)"
  fi
  # Solo se borra la copia de pi si es la que generaba este instalador (contenido de
  # herdr --skill o idéntica a la compartida); si la editaste a mano, se queda y se avisa.
  if [ -f "$PI_HERDR_SKILL" ]; then
    pi_skill="$(cat "$PI_HERDR_SKILL")"
    if [ "$pi_skill" = "$fresh_skill" ] || [ "$pi_skill" = "$(cat "$SHARED_HERDR_SKILL")" ]; then
      log "quitando la copia duplicada $(dirname "$PI_HERDR_SKILL")"
      run rm -r "$(dirname "$PI_HERDR_SKILL")"
    else
      warn "$PI_HERDR_SKILL tiene cambios locales y colisiona con el compartido; revísalo a mano"
    fi
  fi
else
  # Sin skill compartido, se genera desde el binario para que coincida con su versión.
  log "Instalando el skill de Herdr en pi"
  if [ "$DRY_RUN" = 1 ]; then
    printf '    [dry-run] herdr --skill > %s\n' "$PI_HERDR_SKILL"
  else
    mkdir -p "$(dirname "$PI_HERDR_SKILL")"
    printf '%s\n' "$fresh_skill" >"$PI_HERDR_SKILL"
    log "skill de Herdr actualizado ($(wc -l <"$PI_HERDR_SKILL") líneas)"
  fi
fi

# --- Filtro de git para settings.json -------------------------------------------

# pi escribe estado (lastChangelogVersion) en settings.json, que es un symlink a este repo.
# .gitattributes le asocia el filtro pi-settings; aquí se registra en el repo local.
if git -C "$REPO_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  if [ "$(git -C "$REPO_DIR" config --get filter.pi-settings.clean || true)" != "scripts/git-clean-settings" ]; then
    log "registrando el filtro de git pi-settings"
    run git -C "$REPO_DIR" config filter.pi-settings.clean scripts/git-clean-settings
  fi
  command -v jq >/dev/null 2>&1 || warn "el filtro pi-settings necesita jq para 'git add'"
fi

# --- Herramientas de contexto ---------------------------------------------------

# Las tools grep/find de pi usan rg y fd; el skill code-context usa ast-grep; el servidor MCP
# "web" se lanza con uvx. No se instalan aquí (son paquetes de sistema o globales): se avisa.
missing=()
command -v rg >/dev/null 2>&1 || missing+=("rg (ripgrep: tool grep de pi)")
command -v fd >/dev/null 2>&1 || missing+=("fd (tool find de pi)")
command -v ast-grep >/dev/null 2>&1 || missing+=("ast-grep (bun add -g @ast-grep/cli@0.45.3)")
command -v uvx >/dev/null 2>&1 || missing+=("uvx (uv: servidor MCP web)")
command -v jq >/dev/null 2>&1 || missing+=("jq (pidev, pistatus, filtro de git)")
if [ ${#missing[@]} -eq 0 ]; then
  log "herramientas de contexto: rg fd ast-grep uvx jq"
else
  for m in "${missing[@]}"; do warn "falta $m"; done
fi

# --- Integración de Herdr para pi -------------------------------------------

log "Integración de Herdr para pi"
if herdr integration status 2>/dev/null | grep -q '^pi: current'; then
  log "integración pi: ya actual"
else
  run herdr integration install pi
fi

# --- Config de Herdr (opcional) ---------------------------------------------

if [ "$WITH_HERDR_CONFIG" = 1 ]; then
  if [ -f "$HERDR_CONFIG" ] && grep -qF "$MARKER" "$HERDR_CONFIG"; then
    warn "$HERDR_CONFIG ya tiene el bloque de piSetup; no lo duplico."
    warn "Para cambiarlo, edita herdr/config.snippet.toml y reemplaza el bloque a mano."
  else
    log "Añadiendo el snippet de Herdr a $HERDR_CONFIG"
    if [ "$DRY_RUN" = 1 ]; then
      printf '    [dry-run] cat herdr/config.snippet.toml >> %s\n' "$HERDR_CONFIG"
    else
      mkdir -p "$(dirname "$HERDR_CONFIG")"
      {
        echo ""
        echo "$MARKER"
        cat "$REPO_DIR/herdr/config.snippet.toml"
        echo "# <<< piSetup <<<"
      } >>"$HERDR_CONFIG"
      herdr server reload-config 2>/dev/null ||
        warn "Servidor de Herdr no recargó la config (¿no está en marcha?). Reinícialo tú."
    fi
  fi
fi

# --- Resumen ----------------------------------------------------------------

log "Listo"
cat <<EOF

  Config de pi:   $AGENT_DIR  (symlinks a $REPO_DIR/pi/agent)
  Paquete pi:     $AGENT_DIR/pisetup -> $REPO_DIR  (extensions/ skills/ prompts/)
  Modelos:        halo -> http://halo.example/v1  (elige con /model)
  MCP:            context7 (docs de librerías), web (DuckDuckGo)  -> pi mcp list
  Prompts:        /review  /commit  /handoff  /delegate  /team
  Lanzador:       $REPO_DIR/bin/pidev <directorio>
  Estado agentes: $REPO_DIR/bin/pistatus
  Equipos:        $REPO_DIR/bin/piteam <repo> <rama>...
  Sesiones:       $REPO_DIR/bin/pisessions

  Primer paso: arranca pi (pi o pidev) y ejecuta /login para configurar proveedor y modelo.
  Tras tocar esta config en caliente, usa /reload dentro de pi.
EOF
