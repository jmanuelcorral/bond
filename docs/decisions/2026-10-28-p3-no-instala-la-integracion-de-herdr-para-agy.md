---
id: "2026-10-28-p3-no-instala-la-integracion-de-herdr-para-agy"
title: "P3 no instala la integración de Herdr para agy"
status: "accepted"
date: "2026-10-28"
decided_by: "agent:claude/stuart"
accepted_by: "chat 2026-10-28: «acepta las tres, integra P2 y P3, arregla check y haz la prueba real»"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-agy-support.md#P3"
  - "branch: plan/agy-support-p3"
  - "head: 4293bca"
---


## Context

P3 del plan de agy. bond team collect solo puede leer el transcript de agy si Herdr reporta agent_session, y eso necesita su integración antigravity-cli. bond setup instala las integraciones cuyo nombre coincide con un binario; la de agy se llama antigravity-cli, no agy, así que hoy no se instala. Ese código está en cli/setup.mts, que toca P2 en paralelo.

## Decision

P3 lee el transcript de agy cuando Herdr lo reporta (por ruta o por id de conversación) y, si no, usa el panel recortado; documenta herdr integration install antigravity-cli y deja para P2 o una tarea aparte que bond setup y bond doctor traduzcan antigravity-cli a agy.

## Rejected alternatives

Cambiar herdrIntegrations y checkHerdr en P3 (fuera de sus contratos y en conflicto con P2).

## Consequences

Sin la integración, collect de agy usa siempre el panel recortado.
