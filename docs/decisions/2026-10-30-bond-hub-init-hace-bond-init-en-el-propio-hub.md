---
id: "2026-10-30-bond-hub-init-hace-bond-init-en-el-propio-hub"
title: "bond hub init hace bond init en el propio hub"
status: "accepted"
date: "2026-10-30"
decided_by: "agent:claude"
accepted_by: "Podriamos detectar si hay init hecho o no, y si no lanzar el init antes?"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-30-hub-guided.md"
  - "branch: plan/hub-session"
  - "head: f9ffcbd"
---


## Context

bond hub init escribía en el hub un bond.toml mínimo (pi y decision-record), así que el orquestador no tenía en el hub las skills del catálogo, como plan-team. El usuario lo vio probando un hub.

## Decision

bond hub init hace primero bond init en el hub si no tiene .bond/bond.toml: con terminal, el de siempre con sus preguntas; con --yes, lo elegido en bond setup (pi si no hay ningún agente instalado). En los dos, las skills por defecto del catálogo más plan-team. bond hub sync hace lo mismo con un hub sin bond init, y bond hub check lo marca en la fila del hub.

## Rejected alternatives

Seguir con el bond.toml mínimo y pedir al usuario un bond init a mano: el hub queda sin skills y es fácil olvidarlo.
