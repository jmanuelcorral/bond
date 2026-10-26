# Solo para las grabaciones: los agentes que abre bond arrancan sin mostrar su razonamiento.
bond() {
  if [ $# -eq 0 ]; then command bond -- --thinking off
  elif [ "$1" = team ] && [ -n "$2" ] && [ "$2" != status ] && [ "$2" != prompt ] && [ "$2" != clean ]; then command bond "$@" -- --thinking off
  else command bond "$@"; fi
}
