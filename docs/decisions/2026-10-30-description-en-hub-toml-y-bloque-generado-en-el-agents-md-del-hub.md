---
id: "2026-10-30-description-en-hub-toml-y-bloque-generado-en-el-agents-md-del-hub"
title: "description en hub.toml y bloque generado en el AGENTS.md del hub"
status: "accepted"
date: "2026-10-30"
decided_by: "agent:claude"
accepted_by: "si, guárdalo y arranca P9"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-30-hub-ops.md"
  - "phase: P10"
  - "branch: plan/hub-session"
  - "head: 6ab11b0"
---


## Context

El orquestador del hub solo ve carpetas: no sabe qué es cada repo ni las reglas de trabajo del hub.

## Decision

Cada repo de hub.toml admite description (opcional; la pregunta el asistente y bond hub add --description). bond sync en un hub genera en su AGENTS.md un bloque entre marcadores con la tabla de repos (ruta, base, enlace, agente, descripción), las reglas del hub (no editar repos/ desde el hub, el trabajo en un repo va por bond team, aquí planes, decisiones y coordinación) y dónde están docs/plans y docs/decisions; lo de fuera del bloque se conserva y bond sync --check lo comprueba.

## Rejected alternatives

Escribirlo a mano en AGENTS.md: se desactualiza al cambiar hub.toml.
