---
id: "2026-10-28-bond-setup-instala-la-integracion-de-herdr-para-agy"
title: "bond setup instala la integración de Herdr para agy"
status: "accepted"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: "chat 2026-10-28: «acepta P3, añade P4 y mándala a claude», aprobando los arreglos propuestos tras la prueba real"
accepted_via: "agent:claude"
supersedes: "2026-10-28-p3-no-instala-la-integracion-de-herdr-para-agy"
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-agy-support.md#A6"
  - "branch: main"
  - "head: e331af8"
---


## Context

Prueba real del 2026-10-28: sin la integración antigravity-cli de Herdr no hay agent_session para agy y bond team collect guarda el panel con el banner. La integración existe (herdr integration status: antigravity-cli, hook en ~/.gemini/config/hooks/).

## Decision

bond setup, con agy entre los agentes y Herdr presente, instala la integración antigravity-cli como hace con las de los demás agentes, y bond doctor la muestra; collect lee entonces la sesión de agy. Sustituye a la decisión de P3 de no instalarla.

## Rejected alternatives

Mantener solo el panel recortado (pierde el informe limpio).
