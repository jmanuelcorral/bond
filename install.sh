#!/usr/bin/env bash
# Compatibilidad: el instalador es ahora `bond setup` (cli/setup.mts).
# Mismas opciones: --no-pi, --herdr-config, --dry-run.
set -euo pipefail
command -v node >/dev/null 2>&1 || { echo "error: hace falta Node 22.18 o más para bond" >&2; exit 1; }
exec "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/bin/bond" setup "$@"
