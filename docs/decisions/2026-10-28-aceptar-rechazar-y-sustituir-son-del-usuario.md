---
id: "2026-10-28-aceptar-rechazar-y-sustituir-son-del-usuario"
title: "Aceptar, rechazar y sustituir son del usuario"
status: "proposed"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D13"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 2); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

bond decisions accept, reject y supersede exigen terminal interactiva y confirmación; desde el shell de un agente se niegan. Evita aceptaciones por descuido; no es una medida de seguridad.
