---
id: "2026-11-02-el-i18n-de-la-cli-se-reparte-en-un-equipo-por-areas-de-ficheros-disjuntos-con-catalogos-separados"
title: "El i18n de la CLI se reparte en un equipo por áreas de ficheros disjuntos con catálogos separados"
status: "accepted"
date: "2026-11-02"
decided_by: "agent:pi/gru"
accepted_by: "venga, confirmamos!"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-11-02-cli-i18n.md#reparto-del-equipo-p2--p3-en-paralelo"
  - "branch: feat/terminal-logo"
  - "head: fa2c8ea"
---


## Context

P2 (ayudas) y P3 (mensajes, ~520 cadenas) del plan de i18n tocan los mismos ficheros de comando, así que repartirlos por fase garantiza conflictos al integrar. Además todo pasaba por un único cli/messages.mts, que sería el punto de choque de todas las ramas.

## Decision

El reparto se hace por área de ficheros disjuntos: cada rama del equipo es dueña en exclusiva de sus ficheros de comando y de sus ficheros de catálogo bajo cli/messages/*.mts. El esqueleto (10 catálogos de área con es/en vacíos y su lista importada en cli/messages.mts) se commitea antes de abrir el equipo, de modo que ninguna rama edita cli/messages.mts. Cada rama hace a la vez la ayuda y los mensajes de sus ficheros (P2 + P3 de su área). El orquestador (pi) se queda cli/main.mts y su messages/main.mts, más la P4 de documentación tras la integración.

## Rejected alternatives

Ramas por fase (P2 en una rama, P3 en otra): rechazado porque ambas editan los mismos cli/*.mts. Un único agente secuencial sobre una rama: sin conflictos, pero concentra ~5.000 líneas en una sola sesión de agente.

## Consequences

Las claves nuevas de cada área viven en su fichero; añadir un área nueva exige editar cli/messages.mts desde el checkout principal, no desde una rama. La completitud es-EN la sigue forzando el typecheck (en está tipado contra es). Al integrar hay que verificar que ninguna rama tocó cli/messages.mts ni el fichero de plan.
