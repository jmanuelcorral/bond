---
description: Delega una tarea en otro agente (pi, claude, codex...)
argument-hint: "[rol[:kind]] [tarea...]"
---
Te pido expresamente que delegues una tarea en otro agente en este mismo directorio.
Carga el skill `bond-delegate` y sigue su procedimiento.

Rol y agente: ${1:-reviewer}
Tarea: ${@:2}
