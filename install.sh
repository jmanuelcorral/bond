#!/usr/bin/env bash
# Instalador del setup pi + Herdr.
#
# Deja la configuración versionada en este repo activa en ~/.pi/agent mediante symlinks,
# instala el CLI de pi si falta y activa la integración de Herdr para pi.
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

Sin flags: instala pi si falta, enlaza settings.json / models.json / AGENTS.md / prompts,
instala el skill de Herdr dentro de pi e instala la integración de Herdr para pi.
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
run mkdir -p "$AGENT_DIR/skills" "$AGENT_DIR/extensions"

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
link_path "$REPO_DIR/pi/agent/prompts" "$AGENT_DIR/prompts"

# Skills versionados en el repo (subcarpetas de pi/agent/skills).
if [ -d "$REPO_DIR/pi/agent/skills" ]; then
  for skill_dir in "$REPO_DIR"/pi/agent/skills/*/; do
    [ -d "$skill_dir" ] || continue
    link_path "${skill_dir%/}" "$AGENT_DIR/skills/$(basename "$skill_dir")"
  done
fi

# --- Skill de Herdr para pi -------------------------------------------------

# Se genera desde el binario instalado para que siempre coincida con su versión.
log "Instalando el skill de Herdr en pi"
if [ "$DRY_RUN" = 1 ]; then
  printf '    [dry-run] herdr --skill > %s\n' "$AGENT_DIR/skills/herdr/SKILL.md"
else
  mkdir -p "$AGENT_DIR/skills/herdr"
  herdr --skill >"$AGENT_DIR/skills/herdr/SKILL.md"
  log "skill de Herdr actualizado ($(wc -l <"$AGENT_DIR/skills/herdr/SKILL.md") líneas)"
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
  Modelos:        halo -> http://halo.example/v1  (elige con /model)
  Prompts:        /review  /commit  /handoff  /delegate
  Skill Herdr:    $AGENT_DIR/skills/herdr/SKILL.md
  Lanzador:       $REPO_DIR/bin/pidev <directorio>
  Estado agentes: $REPO_DIR/bin/pistatus

  Primer paso: arranca pi (pi o pidev) y ejecuta /login para configurar proveedor y modelo.
  Tras tocar esta config en caliente, usa /reload dentro de pi.
EOF
