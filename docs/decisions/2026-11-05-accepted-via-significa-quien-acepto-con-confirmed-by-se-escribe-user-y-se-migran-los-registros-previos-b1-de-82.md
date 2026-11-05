---
id: "2026-11-05-accepted-via-significa-quien-acepto-con-confirmed-by-se-escribe-user-y-se-migran-los-registros-previos-b1-de-82"
title: "accepted_via significa quién aceptó: con --confirmed-by se escribe \"user\" y se migran los registros previos (B1 de #82)"
status: "accepted"
date: "2026-11-05"
decided_by: "agent:pi"
accepted_by: "Confirmo B1: con `--confirmed-by`, `accepted_via` se escribe \"user\"; migrar los registros legítimos ya escritos a accepted_via: \"user\"."
accepted_via: "agent:pi"
supersedes: ""
superseded_by: ""
links:
  - "issue: https://github.com/jmanuelcorral/bond/issues/82"
  - "decision: 2026-11-05-auto-aceptacion-de-decisiones-bloqueo-por-identidad-deteccion-de-registros-historicos-opcion-b-de-82"
  - "decision: 2026-10-28-aceptar-al-aprobar-y-sin-cuadro-de-permiso"
  - "branch: main"
  - "head: 5d883d6"
---


## Context

En la opción B de #82 la detección es «registro accepted con decided_by == accepted_via». Al medirlo en este repo resulta que ese patrón es la norma histórica: 74 de las 91 decisiones accepted lo cumplen, porque desde 2026-10-28 («aceptar al aprobar») el flujo es que el agente registra con --confirmed-by y accepted_via queda en resolveAuthor(), o sea el propio agente. Detectar sin cambiar la semántica daría 74 falsos positivos.

## Decision

B1: accepted_via significa quién aceptó, no quién ejecutó el comando. Con `add --confirmed-by` (y con `accept --confirmed-by`) se escribe literalmente "user"; el agente que teclea queda en decided_by y en el trailer Agent: del commit. El bloqueo por identidad sigue solo en accept/reject/supersede tardíos. La detección en checkDecisions (accepted con decided_by == accepted_via) se queda tal cual, porque tras B1 solo salta para auto-aceptaciones reales. Los registros legítimos ya escritos se migran a accepted_via: "user".

## Rejected alternatives

B2 (campo nuevo confirmed_at: record|later): más expreso pero más esquema que mantener y migrar. B3 (detectar todo y asumir ruido): inaceptable con 74 falsos positivos en este repo. Dejar accepted_via como autoría del que ejecuta: es lo que hace indistinguibles los dos casos y origen del issue.

## Consequences

Migración de 91 registros accepted en este repo a accepted_via: "user" (74 por coincidir con decided_by y el resto por coherencia de semántica); conviene hacerla como comando (`bond decisions migrate` o un --fix del check) y no a mano, para que otros repos la apliquen igual. Se pierde en el front matter qué agente ejecutó la aceptación: queda en git y en los runs. El bloqueo por identidad no afecta a add. Hay que documentar el nuevo significado de accepted_via en docs/reference.md y en la skill decision-record.
