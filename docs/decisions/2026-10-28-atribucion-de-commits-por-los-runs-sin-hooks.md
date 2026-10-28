---
id: "2026-10-28-atribucion-de-commits-por-los-runs-sin-hooks"
title: "Atribución de commits por los runs, sin hooks"
status: "accepted"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: "chat 2026-10-28: «intregra P6, acepto y acepta la 19»; aclarado en el selector: «Las 19 del plan»"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D15"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 2); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

Los runs dicen qué agente trabajó en qué rama y bond atribuye por ahí sus commits; los trailers (D2) son opcionales. Sin hooks de git por defecto.

## Rejected alternatives

Hook commit-msg o prepare-commit-msg (choca con husky y core.hooksPath).
