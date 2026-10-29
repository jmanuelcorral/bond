---
id: "2026-10-29-modo-hub-bond-team-prompt-manda-la-tarea-a-todos-los-agentes-de-la-rama"
title: "Modo hub: bond team prompt manda la tarea a todos los agentes de la rama"
status: "accepted"
date: "2026-10-29"
decided_by: "agent:claude"
accepted_by: "El usuario aprobó el plan 2026-10-29-hub-session con D1–D10: \"si, guárdalo\" (2026-10-29)"
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

bond team prompt fix/x "tarea" en un hub manda la tarea a todos los agentes de esa rama, con una nota que dice quiénes son los otros y en qué repo está cada uno, para que se coordinen; --repo <sub> la manda solo a uno.

## Rejected alternatives

Exigir siempre --repo: obliga a repetir la tarea por repo en un cambio vertical.
