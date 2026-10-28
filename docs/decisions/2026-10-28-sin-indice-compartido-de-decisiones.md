---
id: "2026-10-28-sin-indice-compartido-de-decisiones"
title: "Sin índice compartido de decisiones"
status: "proposed"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D19"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 3, tras la prueba real); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

add, accept, reject y supersede no reescriben el README; el listado lo da bond decisions. Dos ramas que registran decisiones se fusionan sin conflictos.

## Rejected alternatives

Tabla índice en el README (conflicto seguro entre ramas paralelas).
