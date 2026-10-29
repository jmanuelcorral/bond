---
id: "2026-10-29-modo-hub-en-el-hub-la-rama-vertical-es-solo-una-rama-sin-worktree-ni-agente"
title: "Modo hub: en el hub la rama vertical es solo una rama, sin worktree ni agente"
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

bond team fix/x en un hub crea la rama fix/x en el hub (git branch desde su base) pero no abre worktree ni agente en él: los agentes trabajan en los submódulos.

## Rejected alternatives

Worktree y agente también en el hub: un agente más por rama para cambios que suelen ser pocos (planes, punteros).
