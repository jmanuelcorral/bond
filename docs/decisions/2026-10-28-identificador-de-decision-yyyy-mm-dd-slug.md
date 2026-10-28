---
id: "2026-10-28-identificador-de-decision-yyyy-mm-dd-slug"
title: "Identificador de decisión YYYY-MM-DD-slug"
status: "proposed"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D5"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 1); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

El id es el nombre del fichero sin extensión, YYYY-MM-DD-slug, con sufijo -2 si el mismo slug se repite el mismo día: varios agentes en ramas paralelas no chocan.

## Rejected alternatives

Número correlativo NNNN (colisiona entre ramas paralelas).
