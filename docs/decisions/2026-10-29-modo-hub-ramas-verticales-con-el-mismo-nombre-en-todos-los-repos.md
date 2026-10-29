---
id: "2026-10-29-modo-hub-ramas-verticales-con-el-mismo-nombre-en-todos-los-repos"
title: "Modo hub: ramas verticales con el mismo nombre en todos los repos"
status: "accepted"
date: "2026-10-29"
decided_by: "agent:claude"
accepted_by: "El usuario: \"trabajas en los repos de forma vertical, si hago un fix, la rama se llama igual en los 2 repos\""
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

Un cambio en un hub se trabaja en vertical: la rama (fix/x) se llama igual en el hub y en cada submódulo que toca. La unidad del equipo en modo hub es la rama, no el repo.

## Rejected alternatives

Sintaxis multi-repo en una llamada (frontend=rama backend=rama): más sintaxis sin ganancia si las ramas se llaman igual.
