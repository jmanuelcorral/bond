---
id: "2026-11-25-reglas-globales-con-variante-hc-segun-bond-app"
title: "Reglas globales con variante hc según BOND_APP"
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

bond setup escribe en las instrucciones globales de cada agente el bloque gen.rules («Bond: Herdr y otros agentes»), que dentro de un run de bond-app habla de Herdr, que no existe allí.

## Decision

gen.rules tiene una variante hc que bond setup elige con BOND_APP=1, como los skills globales; sin BOND_APP, el bloque de siempre.

## Rejected alternatives

Un solo bloque que cubra los dos entornos: más largo y confuso para el agente, que solo vive en uno.
