---
id: "2026-10-29-modo-hub-una-rama-vertical-esta-abierta-si-tiene-worktree-en-un-submodulo-y-existe-en-el-hub"
title: "Modo hub: una rama vertical está abierta si tiene worktree en un submódulo y existe en el hub"
status: "accepted"
date: "2026-10-29"
decided_by: "agent:claude/stuart"
accepted_by: "todas, y la de H4 dala por buena"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-29-hub-session.md"
  - "phase: P3"
  - "branch: plan/hub-session-p3"
  - "head: 214a0c5"
---


## Context

D10 pide que bond team se niegue a abrir una segunda rama vertical en un hub; hacía falta saber qué rama está abierta sin guardar estado aparte.

## Decision

Una rama es la vertical abierta de la sesión si algún submódulo tiene un worktree enlazado en ella y la rama existe también en el hub. Se calcula de git en cada bond team (openVerticals en cli/team.mts), sin mirar la carpeta del worktree, así vale también con --workspaces.

## Rejected alternatives

Mirar solo los worktrees en ~/.herdr/worktrees/<hub>/: no ve los abiertos con --workspaces. Guardar la rama abierta en [hub] o en un fichero de estado: se desincroniza si se quitan worktrees a mano.
