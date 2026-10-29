---
id: "2026-10-29-modo-hub-un-agente-por-repo-y-una-sola-rama-vertical-por-sesion"
title: "Modo hub: un agente por repo y una sola rama vertical por sesión"
status: "accepted"
date: "2026-10-29"
decided_by: "agent:claude"
accepted_by: "El usuario: \"Uno por repo y rama\" y \"si trabajas en modo hub, de momento no paralelizas varios worktrees por rama. Eso lo dejamos a una futura feature.\""
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

En modo hub la sesión lleva una sola rama vertical cada vez, con un agente por repo, cada uno en su worktree (el checkout principal del hub y de los submódulos no cambia de rama). Varias ramas verticales en paralelo en un hub queda para una feature futura.

## Rejected alternatives

Un agente por rama en un worktree del hub que contiene los worktrees de los submódulos: ve todo el stack, pero el usuario prefiere un agente por repo. Varias ramas a la vez (un agente por repo y rama): más agentes y complejidad; aplazado.
