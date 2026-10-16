---
description: Delega una tarea en otro agente (pi, claude, codex...) en un panel hermano de Herdr
argument-hint: "[rol[:kind]] [tarea...]"
---
Te pido expresamente que uses Herdr para delegar una tarea en otro agente, en un panel hermano
de esta pestaña y en este mismo directorio. Carga el skill `bond-delegate` y sigue su
procedimiento.

Rol y agente: ${1:-reviewer}
Tarea: ${@:2}
