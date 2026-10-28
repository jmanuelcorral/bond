---
id: "2026-10-28-frontmatter-de-skills-validado-como-yaml-estricto"
title: "Frontmatter de skills validado como YAML estricto"
status: "proposed"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D16"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 3, tras la prueba real); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

bond catalog check falla si el frontmatter de una skill no es YAML válido (por ejemplo, : sin comillas en description), porque pi no la carga aunque Claude Code la tolere.
