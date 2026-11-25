---
id: "2026-11-25-los-skills-del-catalogo-valen-para-herdr-y-hc-en-un-solo-fichero"
title: "Los skills del catálogo valen para Herdr y hc en un solo fichero"
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

Los skills del catálogo se copian a cada repo y el mismo fichero lo leen el agente en Herdr y el del contenedor de bond-app (BOND_APP=1, hc). Los skills globales tienen carpeta de variante (global/skills-hc) porque bond setup elige cuál instalar.

## Decision

Los skills del catálogo que dependen del transporte (plan-team) comprueban HERDR_ENV=1 o BOND_APP=1/hc y dan, donde difieren, el comando de Herdr y el de hc en el mismo SKILL.md. No se crean carpetas de variante en el catálogo.

## Rejected alternatives

Carpetas de variante en el catálogo: bond init/sync no sabe en qué entorno se leerá el repo, así que no puede elegir.
