---
id: "2026-10-28-formato-de-los-runs-de-encargos"
title: "Formato de los runs de encargos"
status: "accepted"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: "chat 2026-10-28: «intregra P6, acepto y acepta la 19»; aclarado en el selector: «Las 19 del plan»"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D9"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 1); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

Un fichero por run en runs/YYYY-MM-DD-<agente>-<slug>.md con agent, kind, branch, base, orchestrator, started_at, finished_at, status, commits y decisions, y las secciones Request y Report. Lo escribe bond desde el checkout principal, nunca el agente de la rama.
