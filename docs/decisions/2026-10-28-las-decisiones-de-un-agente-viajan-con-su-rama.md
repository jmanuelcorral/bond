---
id: "2026-10-28-las-decisiones-de-un-agente-viajan-con-su-rama"
title: "Las decisiones de un agente viajan con su rama"
status: "proposed"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D18"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 3, tras la prueba real); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

Lo que un agente registra en su worktree se commitea en su rama y se revisa con el código en el PR; bond team prompt se lo pide en el encargo.

## Rejected alternatives

Escribirlas en el checkout principal (quedan fuera de la revisión del PR).
