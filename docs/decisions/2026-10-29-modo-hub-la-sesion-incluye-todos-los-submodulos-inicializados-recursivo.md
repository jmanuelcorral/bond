---
id: "2026-10-29-modo-hub-la-sesion-incluye-todos-los-submodulos-inicializados-recursivo"
title: "Modo hub: la sesión incluye todos los submódulos inicializados, recursivo"
status: "accepted"
date: "2026-10-29"
decided_by: "agent:claude"
accepted_by: "El usuario eligió \"Todos, recursivo\""
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-29-hub-session.md"
  - "branch: main"
  - "head: 4562ea5"
---


## Context

En un repo hub con submódulos de git (p. ej. frontend y backend), bond team trata cada repo por separado: una tabla en vivo por repo y prompt/collect/clean atados al repo del directorio actual.

## Decision

La sesión de un hub la forman el hub y todos sus submódulos inicializados, también los anidados; los no inicializados se avisan y se ignoran.

## Rejected alternatives

Solo el primer nivel de submódulos: deja fuera hubs con submódulos anidados.
