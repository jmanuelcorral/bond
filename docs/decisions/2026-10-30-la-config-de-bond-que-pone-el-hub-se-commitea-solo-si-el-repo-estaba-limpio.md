---
id: "2026-10-30-la-config-de-bond-que-pone-el-hub-se-commitea-solo-si-el-repo-estaba-limpio"
title: "La config de bond que pone el hub se commitea solo si el repo estaba limpio"
status: "proposed"
date: "2026-10-30"
decided_by: "agent:claude"
accepted_by: ""
accepted_via: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-30-hub-guided.md"
  - "branch: plan/hub-session"
  - "head: e89bfc1"
---


## Context

Los worktrees de bond team salen de lo commiteado, así que un bond init sin commit no lo ven los agentes. Pero commitear en el repo de otro mezcla cambios si tenía trabajo a medias, y en un submódulo el commit es local hasta que se sube.

## Decision

Tras el bond init que hace el hub, la config se commitea (chore: add bond config) en la rama actual del repo solo si el repo no tenía cambios sin commitear; si los tenía, se deja sin commitear y se avisa. Con terminal se pregunta antes. En un submódulo se avisa de hacer git push en él antes de subir el hub. bond nunca hace push.

## Rejected alternatives

No commitear nunca: los worktrees no ven la config y hay que hacerlo a mano en cada repo. Commitear siempre: el commit arrastra el trabajo a medias del usuario.
