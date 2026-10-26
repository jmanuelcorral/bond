#!/usr/bin/env bash
# Graba los vídeos de la documentación con VHS sobre un clon limpio de fluzo, y los deja en
# docs/public/videos/. Necesita vhs, ttyd, herdr, pi y bond en el PATH.
#
# Uso: site/videos/record.sh [init|puesto|equipo|catalogos ...]   (sin argumentos: todos)
#
# Todo pasa en /tmp/bond-demo y en una sesión de Herdr aparte (bond-demo): tu sesión de Herdr y
# tus repos no se tocan. pi apunta /tmp/bond-demo en su confianza (~/.pi/agent/trust.json) la
# primera vez que se acepta; bórralo de ahí cuando acabes si no lo quieres.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
out="$here/../../docs/public/videos"
demo=/tmp/bond-demo
videos=("$@")
[ ${#videos[@]} -eq 0 ] && videos=(init puesto equipo catalogos)

for t in vhs ttyd herdr pi bond git; do command -v "$t" >/dev/null || { echo "falta $t" >&2; exit 1; }; done

mkdir -p "$demo/tapes"
[ -d "$demo/fluzo" ] || git clone -q https://github.com/fluzo-labs/fluzo "$demo/fluzo"
git -C "$demo/fluzo" fetch -q origin
cp "$here"/*.tape "$here/reset-fluzo.sh" "$here/bond-fn.zsh" "$demo/tapes/"
chmod +x "$demo/tapes/reset-fluzo.sh"

# La grabación no debe ver la sesión de Herdr desde la que la lanzas.
clean_env=(env -u HERDR_ENV -u HERDR_SOCKET_PATH -u HERDR_PANE_ID -u HERDR_TAB_ID -u HERDR_WORKSPACE_ID -u HERDR_BIN_PATH)
stop_session() { herdr session stop bond-demo >/dev/null 2>&1 || true; herdr session delete bond-demo >/dev/null 2>&1 || true; }

for v in "${videos[@]}"; do
	echo "==> $v"
	stop_session
	case "$v" in
		puesto|equipo) "$demo/tapes/reset-fluzo.sh" init ;;
		*) "$demo/tapes/reset-fluzo.sh" ;;
	esac
	(cd "$demo/tapes" && "${clean_env[@]}" vhs "$v.tape")
	cp "$demo/tapes/$v.mp4" "$out/$v.mp4"
done

stop_session
"$demo/tapes/reset-fluzo.sh"
echo "listo: $out"
