---
id: "2026-10-29-modo-hub-los-worktrees-van-en-herdr-worktrees-hub-sub-rama"
title: "Modo hub: los worktrees van en ~/.herdr/worktrees/<hub>/<sub>/<rama>"
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

Los worktrees de los submódulos de un hub van en ~/.herdr/worktrees/<hub>/<sub>/<rama>, para que dos hubs con un submódulo del mismo nombre no choquen. Fuera de un hub la ruta no cambia.

## Rejected alternatives

La ruta de hoy (~/.herdr/worktrees/<repo>/<rama>): dos hubs con un frontend comparten carpeta.
