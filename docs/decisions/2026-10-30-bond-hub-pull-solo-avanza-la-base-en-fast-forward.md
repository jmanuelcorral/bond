---
id: "2026-10-30-bond-hub-pull-solo-avanza-la-base-en-fast-forward"
title: "bond hub pull solo avanza la base en fast-forward"
status: "accepted"
date: "2026-10-30"
decided_by: "agent:claude"
accepted_by: "si, guárdalo y arranca P9"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-30-hub-ops.md"
  - "phase: P11"
  - "branch: plan/hub-session"
  - "head: 6ab11b0"
---


## Context

bond team saca los worktrees de la base de cada repo; si el clon está atrasado, los agentes trabajan sobre código viejo.

## Decision

bond hub pull hace git fetch y avanza la base en fast-forward en el hub y en cada repo de la sesión, solo si el repo está en su base y sin cambios; si no, lo salta y dice por qué. Nunca hace merge, rebase ni push. Con --dry-run y --json. bond hub check avisa si una base va por detrás de su remoto (según el último fetch) y propone bond hub pull.

## Rejected alternatives

Pull con merge o rebase: puede mezclar o reescribir trabajo del usuario. Cambiar de rama para actualizar la base: toca el estado del repo.
