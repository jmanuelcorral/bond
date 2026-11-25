---
id: "2026-11-25-los-prompts-delegate-y-team-no-nombran-el-transporte"
title: "Los prompts /delegate y /team no nombran el transporte"
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

prompts/delegate.md y prompts/team.md piden usar Herdr y paneles hermanos, lo contrario de la variante hc de bond-delegate y bond-team.

## Decision

Los dos prompts remiten a los skills bond-delegate y bond-team sin nombrar Herdr, hc ni paneles; el skill instalado ya trae la variante del entorno.

## Rejected alternatives

Variante hc de los prompts: duplica texto que ya resuelven los skills.
