#!/bin/sh
# Instalador de bond para Linux y macOS:
#   curl -fsSL https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.sh | sh
#
# Descarga el binario de la release de GitHub para tu sistema, comprueba su SHA-256 y lo deja
# en ~/.local/bin (o en BOND_INSTALL_DIR). Sin sudo.
#   BOND_VERSION=v1.0.0   versión concreta (defecto: la última)
#   BOND_INSTALL_DIR=...  dónde dejar el binario
set -eu

REPO="jmanuelcorral/bond"
DIR="${BOND_INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${BOND_VERSION:-latest}"

say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=darwin ;;
  *) die "sistema no soportado: $(uname -s) (en Windows usa install.ps1)" ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) arch=x64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *) die "arquitectura no soportada: $(uname -m)" ;;
esac
asset="bond-$os-$arch"

if [ "$VERSION" = latest ]; then
  base="https://github.com/$REPO/releases/latest/download"
else
  base="https://github.com/$REPO/releases/download/$VERSION"
fi

command -v curl >/dev/null 2>&1 || die "hace falta curl"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

say "Descargando $asset ($VERSION)"
curl -fsSL "$base/$asset" -o "$tmp/$asset" || die "no pude descargar $base/$asset"
curl -fsSL "$base/SHA256SUMS" -o "$tmp/SHA256SUMS" || die "no pude descargar las sumas SHA-256"

expected="$(grep " $asset\$" "$tmp/SHA256SUMS" | cut -d' ' -f1)"
[ -n "$expected" ] || die "$asset no aparece en SHA256SUMS"
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$tmp/$asset" | cut -d' ' -f1)"
else
  actual="$(shasum -a 256 "$tmp/$asset" | cut -d' ' -f1)"
fi
[ "$expected" = "$actual" ] || die "la suma SHA-256 no coincide: descarga corrupta o alterada"

mkdir -p "$DIR"
install -m 755 "$tmp/$asset" "$DIR/bond" 2>/dev/null || { cp "$tmp/$asset" "$DIR/bond" && chmod 755 "$DIR/bond"; }
say "bond instalado en $DIR/bond ($("$DIR/bond" --version))"

case ":$PATH:" in
  *":$DIR:"*) ;;
  *) printf '\nAñade %s al PATH, por ejemplo:\n  echo '\''export PATH="%s:$PATH"'\'' >> ~/.profile\n' "$DIR" "$DIR" ;;
esac
printf '\nSiguiente: bond setup\n'
