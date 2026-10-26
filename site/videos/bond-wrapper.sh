#!/usr/bin/env bash
# Solo para las grabaciones: los minions que crea bond team arrancan sin mostrar su razonamiento.
# record.sh lo instala en /tmp/bond-demo/bin/bond con @BOND@ cambiado por la ruta real de bond.
if [ "${1:-}" = team ] && [ -n "${2:-}" ] && [[ ! "$2" =~ ^(status|prompt|clean|-h|--help)$ ]] && [[ " $* " != *" -- "* ]]; then
  exec @BOND@ "$@" -- --thinking off
fi
exec @BOND@ "$@"
