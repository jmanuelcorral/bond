---
id: "2026-10-28-regla-global-de-bond-setup-para-usar-la-memoria"
title: "Regla global de bond setup para usar la memoria"
status: "accepted"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: "chat 2026-10-28: «intregra P6, acepto y acepta la 19»; aclarado en el selector: «Las 19 del plan»"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D10"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 1); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

BOND_RULES incluye una regla: si el repo tiene [decisions], registrar las decisiones con decision-record. Así llega también a agentes que no cargan las skills por sí solos.
