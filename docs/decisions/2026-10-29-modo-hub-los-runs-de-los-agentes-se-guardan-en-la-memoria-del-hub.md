---
id: "2026-10-29-modo-hub-los-runs-de-los-agentes-se-guardan-en-la-memoria-del-hub"
title: "Modo hub: los runs de los agentes se guardan en la memoria del hub"
status: "accepted"
date: "2026-10-29"
decided_by: "agent:claude"
accepted_by: "El usuario eligió \"En el hub\""
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

Los encargos e informes (runs) de los agentes que trabajan en submódulos van a la memoria de decisiones del hub, junto al plan; si el hub no tiene [decisions], a la del submódulo. Las decisiones que registra cada agente siguen viajando en su rama.

## Rejected alternatives

Runs en cada submódulo, como hoy: el plan y sus runs quedarían en repos distintos.
