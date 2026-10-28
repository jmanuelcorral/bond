---
id: "2026-10-28-autoria-automatica-desde-el-panel-de-herdr"
title: "Autoría automática desde el panel de Herdr"
status: "proposed"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D12"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 2); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

decided_by lo rellena bond: en un panel de Herdr, el agente de ese panel (agent:<kind>/<nombre>); fuera, user. El modelo no tiene que saber su nombre.

## Rejected alternatives

Pedir al agente que se identifique.
