---
id: "2026-10-28-trailers-agent-y-decision-en-los-commits-opcionales"
title: "Trailers Agent: y Decision: en los commits, opcionales"
status: "proposed"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D2"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 1, revisada en la 2); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

Los commits pueden llevar Agent: <kind>[/<nombre>] (nunca un modelo inventado) y Decision: <id> cuando aplican una decisión. Desde D15 son opcionales: se aprovechan cuando aparecen.

## Rejected alternatives

Solo Co-Authored-By (no identifica a pi, Codex ni al agente concreto del equipo).
