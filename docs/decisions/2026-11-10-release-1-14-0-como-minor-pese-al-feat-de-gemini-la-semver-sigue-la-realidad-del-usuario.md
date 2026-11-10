---
id: "2026-11-10-release-1-14-0-como-minor-pese-al-feat-de-gemini-la-semver-sigue-la-realidad-del-usuario"
title: "Release 1.14.0 como minor pese al feat! de Gemini: la semver sigue la realidad del usuario"
status: "accepted"
date: "2026-11-10"
decided_by: "agent:pi"
accepted_by: "\"1.14.0, aplica A y B.\" (el usuario eligió 1.14.0 tras exponerle la alternativa 2.0.0 por el commit feat!)"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "release: https://github.com/jmanuelcorral/bond/releases/tag/v1.14.0"
  - "commit: 6ca51d2 Release 1.14.0"
  - "commit: 284b874 feat!: drop Gemini CLI agent support"
  - "branch: main"
  - "head: cdd44ac"
---


## Context

Al preparar la release tras el epic #84, el rango v1.13.1..2c3403a contenía el primer commit con «!» de todo el historial (retirada de Gemini CLI, #85). Semver estricta pediría 2.0.0, pero las dos decisiones aceptadas de #85 tratan la retirada como algo que nunca llegó a funcionar en bond («ni hemos probado que funcionara», retirada sin avisos de migración). Había que decidir entre 1.14.0 y 2.0.0 antes de tocar manifests.

## Decision

La release 1.14.0 se versiona como minor pese a incluir el único commit con marcador de breaking del historial (284b874 feat!: drop Gemini CLI agent support, #85). Criterio sentado: el marcador feat! del commit no manda por sí solo; la versión sigue la realidad del usuario. Como la decisión aceptada de #85 establece que Gemini CLI nunca llegó a probarse con bond y su retirada es «a secas», sin migración ni usuarios conocidos dependientes, no hay contrato público roto en la práctica y no corresponde major. Un feat! sobre funcionalidad que nunca estuvo operativa en manos de usuarios se versiona como minor; un major queda para roturas que afecten de verdad a flujos existentes.
