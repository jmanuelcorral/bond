---
id: "2026-10-28-registro-de-decisiones-en-docs-decisions-un-fichero-por-decision"
title: "Registro de decisiones en docs/decisions, un fichero por decisión"
status: "proposed"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D1"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 1); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

Las decisiones no triviales del usuario o de un agente se guardan en docs/decisions/ del repo, un fichero Markdown por decisión, que se commitea y se revisa en el PR.

## Rejected alternatives

Un único DECISIONS.md (crece sin límite y da conflictos con agentes en paralelo); solo en planes y commits (poco visible fuera de los planes).
