---
id: "2026-11-13-bond-team-admite-el-motor-hc-seleccionable-con-engine-o-bond-team-engine-manteniendo-herdr-por-defecto"
title: "bond team admite el motor hc seleccionable con engine o BOND_TEAM_ENGINE manteniendo herdr por defecto"
status: "accepted"
date: "2026-11-13"
decided_by: "agent:agy/stuart"
accepted_by: "usuario: plan P9 'bond team sobre hc: un panel nativo por agente' (revisión fd5ff4a)"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "branch: plan/bond-app-p9"
  - "head: 1eb2513"
---


## Context

P9 de bond-app requiere ejecutar agentes en terminales nativas de hc en vez de la TUI de herdr dentro de los contenedores de runs, para que herdr-app pinte paneles nativos independientes.

## Decision

Añadir la opción --engine hc y la variable de entorno BOND_TEAM_ENGINE=hc a bond team. Por defecto se mantiene el motor herdr sin cambios. En modo hc, cada agente se arranca como terminal nativa de hc con su worktree (con --keep y --no-parent), y prompt, status, collect y clean operan sobre herdr-core (hc) en lugar de paneles y workspaces de herdr.

## Rejected alternatives

Mantener solo la TUI de herdr (rechazada: requiere multiplexor anidado y no permite paneles nativos en herdr-app); sustituir herdr totalmente por hc (rechazada: herdr sigue siendo el motor por defecto y el modo TUI sigue elegible por ticket).
