---
id: "2026-10-28-agy-hereda-confianza-por-la-ruta-exacta-del-worktree"
title: "agy hereda confianza por la ruta exacta del worktree"
status: "proposed"
date: "2026-10-28"
decided_by: "agent:claude/stuart"
accepted_by: ""
accepted_via: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-agy-support.md#P3"
  - "decision: 2026-10-28-confianza-heredada-para-agy-en-bond-team"
  - "branch: plan/agy-support-p3"
  - "head: 4293bca"
---


## Context

P3 del plan de agy (A4). trustedWorkspaces de ~/.gemini/antigravity-cli/settings.json es una lista de rutas y no está comprobado si agy confía en las subcarpetas de una ruta de la lista (la prueba en una subcarpeta de un repo confiado no se pudo hacer).

## Decision

El checkout principal cuenta como confiado si él o una carpeta superior está en trustedWorkspaces, como en pi y Claude; el worktree se añade siempre con su ruta exacta y solo una entrada exacta cuenta como 'ya la tenía'. Se escribe releyendo y de forma atómica, conservando el resto de settings.json.

## Rejected alternatives

Exigir la ruta exacta también para el checkout principal (no heredaría quien confió en una carpeta superior); dar por confiado el worktree si hay una carpeta superior en la lista (podría preguntar igualmente si agy no lo aplica).

## Consequences

Puede quedar en trustedWorkspaces una entrada por worktree; bond team clean no las quita, como en pi y Claude.
