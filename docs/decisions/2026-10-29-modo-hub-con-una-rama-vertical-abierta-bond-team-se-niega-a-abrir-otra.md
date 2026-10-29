---
id: "2026-10-29-modo-hub-con-una-rama-vertical-abierta-bond-team-se-niega-a-abrir-otra"
title: "Modo hub: con una rama vertical abierta, bond team se niega a abrir otra"
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

Si la sesión del hub ya tiene una rama vertical abierta, bond team fix/y falla sin crear nada, dice cuál está abierta y cómo cerrarla (bond team clean fix/x).

## Rejected alternatives

Abrir la segunda igualmente: contradice una sola rama por sesión y deja la tabla ambigua.
