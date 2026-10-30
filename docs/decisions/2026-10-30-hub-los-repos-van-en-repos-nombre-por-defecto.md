---
id: "2026-10-30-hub-los-repos-van-en-repos-nombre-por-defecto"
title: "Hub: los repos van en repos/<nombre> por defecto"
status: "accepted"
date: "2026-10-30"
decided_by: "agent:claude"
accepted_by: "si, guárdalo y arranca P9"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-30-hub-ops.md"
  - "phase: P9"
  - "branch: plan/hub-session"
  - "head: 6ab11b0"
---


## Context

El hub es un repo de operaciones desde el que se trabaja sobre otros repos; con los repos en la raíz se mezclan con los ficheros del hub (hub.toml, AGENTS.md, docs/).

## Decision

bond hub init y bond hub add proponen repos/<nombre> como ruta de cada repo (asistente y --yes); --path o el asistente la cambian. Los submódulos existentes se importan con su ruta y los hubs que ya existen no se mueven: bond hub check solo avisa.

## Rejected alternatives

Seguir en la raíz: el hub queda desordenado. Mover los repos de hubs existentes automáticamente: toca submódulos y enlaces sin pedirlo.
