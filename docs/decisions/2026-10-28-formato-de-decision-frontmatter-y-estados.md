---
id: "2026-10-28-formato-de-decision-frontmatter-y-estados"
title: "Formato de decisión: frontmatter y estados"
status: "proposed"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D6"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 1); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

Frontmatter con id, title, status (proposed, accepted, rejected, superseded), date, decided_by (user o agent:<kind>[/<nombre>]), accepted_by, supersedes, superseded_by y links; cuerpo Context, Decision, Rejected alternatives, Consequences. Lo que decide un agente entra como proposed y solo el usuario lo acepta.
