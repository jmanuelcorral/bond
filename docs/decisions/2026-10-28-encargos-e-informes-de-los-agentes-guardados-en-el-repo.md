---
id: "2026-10-28-encargos-e-informes-de-los-agentes-guardados-en-el-repo"
title: "Encargos e informes de los agentes guardados en el repo"
status: "proposed"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D3"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 1); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

Los encargos a agentes de bond team y bond-delegate y sus informes se guardan en docs/decisions/runs/ y se commitean.

## Rejected alternatives

Fuera de git en .bond/runs/ (no queda en el historial); no guardarlos.
