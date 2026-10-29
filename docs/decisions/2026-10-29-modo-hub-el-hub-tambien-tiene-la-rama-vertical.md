---
id: "2026-10-29-modo-hub-el-hub-tambien-tiene-la-rama-vertical"
title: "Modo hub: el hub también tiene la rama vertical"
status: "accepted"
date: "2026-10-29"
decided_by: "agent:claude"
accepted_by: "El usuario: \"Sí\" a que el hub tenga la rama fix/x"
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

bond team fix/x en un hub crea también la rama fix/x en el hub, para los cambios propios del hub y para el commit que sube los punteros de los submódulos al integrar.

## Rejected alternatives

Solo los submódulos tienen la rama: el bump de punteros no tendría dónde ir sin tocar la rama base del hub.
