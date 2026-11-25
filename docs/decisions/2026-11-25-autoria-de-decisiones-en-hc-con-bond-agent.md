---
id: "2026-11-25-autoria-de-decisiones-en-hc-con-bond-agent"
title: "Autoría de decisiones en hc con BOND_AGENT"
status: "accepted"
date: "2026-11-25"
decided_by: "agent:claude/dev-claude-2"
accepted_by: "aprueba y guarda (usuario, 2026-11-25, sobre el plan 2026-11-25-skills-en-bond-app con D1-D4)"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-11-25-skills-en-bond-app.md"
  - "branch: main"
  - "head: 8ee167f"
---


## Context

resolveAuthor() solo mira HERDR_PANE_ID; dentro de un run de bond-app una decisión de un agente queda como decided_by user. hc 0.1.22 no documenta cómo sabe un proceso en qué terminal corre.

## Decision

bond exporta BOND_AGENT=<kind>/<nombre> al lanzar un agente (bond tui en sitio y delegados con hcRun) y resolveAuthor() lo usa cuando no hay Herdr; el override manual va primero y Herdr manda si está. Si hc ya expone la terminal propia, P3 lo comprueba antes y puede usarlo. Sin ninguno, user.

## Rejected alternatives

Preguntar a hc por la terminal propia: no documentado en hc 0.1.22.
