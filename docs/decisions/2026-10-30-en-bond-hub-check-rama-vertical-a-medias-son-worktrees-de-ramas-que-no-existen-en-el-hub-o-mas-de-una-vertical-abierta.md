---
id: "2026-10-30-en-bond-hub-check-rama-vertical-a-medias-son-worktrees-de-ramas-que-no-existen-en-el-hub-o-mas-de-una-vertical-abierta"
title: "En bond hub check, \\\"rama vertical a medias\\\" son worktrees de ramas que no existen en el hub, o más de una vertical abierta"
status: "accepted"
date: "2026-10-30"
decided_by: "agent:pi/stuart"
accepted_by: "todas, y la de H4 dala por buena"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "branch: plan/hub-guided-p7"
  - "head: 03d9d20"
---


## Context

P7 de 2026-10-30-hub-guided pide que hub check detecte "una rama vertical a medias", pero el plan no fija la semántica: bond team permite abrir una vertical con un subconjunto de repos (--repos), así que "no está en todos los repos" no puede ser el criterio.

## Decision

hub check considera rama vertical a medias solo dos casos: (1) una rama con worktree en algún repo de la sesión que no existe como rama en el hub (bond team las crea en los dos, D3/D7), y (2) más de una rama vertical abierta a la vez (D10). Los subconjuntos de repos con la rama creada en el hub son legítimos y no se señalan. Las bases de la sesión nunca cuentan.

## Rejected alternatives

Exigir worktree en todos los repos de la sesión: falso positivo con --repos, que es un uso admitido por bond team. Omitir la comprobación: dejaría pasar worktrees huérfanos de rama del hub, que rompen clean y la tabla de sesión.

## Consequences

Si en el futuro el hub admitiera varias verticales simultáneas (cambio de D10), la comprobación (2) deberá quitarse de cli/hub-check.mts.
