---
id: "2026-10-29-bond-hub-configura-la-sesion-en-hub-de-bond-bond-toml"
title: "bond hub configura la sesión en [hub] de .bond/bond.toml"
status: "accepted"
date: "2026-10-29"
decided_by: "agent:claude"
accepted_by: "El usuario: \"Es algo que tal vez preguntemos al configurar un hub, tal vez tiene sentido que exista el comando hub\""
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-29-hub-session.md"
  - "branch: main"
  - "head: 4562ea5"
---


## Context

En un repo hub con submódulos de git (p. ej. frontend y backend), bond team trata cada repo por separado: una tabla en vivo por repo y prompt/collect/clean atados al repo del directorio actual.

## Decision

Un comando nuevo, bond hub, prepara el hub: detecta los submódulos, pregunta la base de cada repo (por defecto su rama actual) y lo guarda en una sección [hub] de .bond/bond.toml (repos con su base, exclude opcional). bond hub sin argumentos enseña la sesión; bond hub sync la actualiza. Sin [hub], bond team funciona como hoy.

## Rejected alternatives

Una base común para todos los repos: no vale si cada repo usa una rama base distinta. Deducir la base en cada llamada: la tabla no tendría una referencia estable.
