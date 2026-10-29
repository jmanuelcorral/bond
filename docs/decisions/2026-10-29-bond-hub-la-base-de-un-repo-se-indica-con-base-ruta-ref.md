---
id: "2026-10-29-bond-hub-la-base-de-un-repo-se-indica-con-base-ruta-ref"
title: "bond hub: la base de un repo se indica con --base <ruta>=<ref>"
status: "proposed"
date: "2026-10-29"
decided_by: "agent:claude/kevin"
accepted_by: ""
accepted_via: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-29-hub-session.md"
  - "branch: plan/hub-session-p1"
  - "head: 4ffbb62"
---


## Context

El plan pide que, con --yes, un repo en HEAD separado falle con un mensaje que diga cómo indicar su base, pero no fija la opción.

## Decision

bond hub acepta --base <ruta>=<ref>, repetible, con '.' para el hub; vale para repos nuevos y para cambiar la base de uno que ya estaba. Las refs se validan con git rev-parse antes de escribir.

## Rejected alternatives

Una --base común para todos: no sirve si cada repo tiene una base distinta (D6). Obligar a editar [hub] a mano: el error no tendría un comando que copiar.
