---
id: "2026-10-29-modo-hub-prompt-no-manda-nada-si-algun-agente-de-la-rama-espera-una-respuesta"
title: "Modo hub: prompt no manda nada si algún agente de la rama espera una respuesta"
status: "accepted"
date: "2026-10-29"
decided_by: "agent:claude/stuart"
accepted_by: "todas, y la de H4 dala por buena"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-29-hub-session.md"
  - "phase: P3"
  - "branch: plan/hub-session-p3"
  - "head: 214a0c5"
---


## Context

En un hub, bond team prompt fix/x manda la tarea a todos los agentes de la rama (D8). Si uno tiene una pregunta en pantalla, el Enter del prompt la contestaría por el usuario.

## Decision

Si algún agente de la rama está bloqueado, prompt falla sin mandar nada a ninguno y dice quién espera; los repos sin agente en marcha se avisan y se saltan. collect en un hub pide --repo cuando la rama está en varios repos, y --base no vale en un hub (las bases son las de [hub]).

## Rejected alternatives

Mandar a los que no están bloqueados: la tarea vertical llegaría a medias y la nota de coordinación nombraría a un agente que no la recibió.
