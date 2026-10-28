---
id: "2026-10-28-plugin-global-de-bond-para-agy"
title: "Plugin global de bond para agy"
status: "accepted"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: "chat 2026-10-28: «aprueba y guarda» (plan de agy) y «acepta A1–A4, commitea y manda P1 a claude»"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-agy-support.md#A3"
  - "branch: main"
  - "head: d2893a9"
---


## Context

Tomada por el usuario en sesión el 2026-10-28 al aprobar el plan de soporte de Antigravity (docs/plans/2026-10-28-agy-support.md, «aprueba y guarda»); la registra el orquestador (Claude).

## Decision

bond setup deja en ~/.gemini/config/plugins/bond/ las reglas globales (rules/AGENTS.md con ~/.bond/AGENTS.md y BOND_RULES) y las skills globales bond-delegate, bond-team y herdr, sin tocar nada más de ~/.gemini/config/.

## Rejected alternatives

Escribir sueltos en ~/.gemini/config/ (se mezcla con lo del usuario).
