---
id: "2026-10-28-herramienta-record-decision-en-pi"
title: "Herramienta record_decision en pi"
status: "proposed"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D14"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 2); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

pi tiene la herramienta record_decision (Bond Extensions) que llama a bond decisions add; los demás agentes usan el CLI. Un servidor MCP queda fuera por ahora.

## Rejected alternatives

Servidor MCP para todos los agentes (aplazado).
