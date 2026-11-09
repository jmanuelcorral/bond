---
id: "2026-11-06-rebanada-3-de-86-agy-se-integra-por-hooks-opencode-y-pi-quedan-como-paso-siguiente-explicito"
title: "Rebanada 3 de #86: agy se integra por hooks; opencode y pi quedan como paso siguiente explícito"
status: "accepted"
date: "2026-11-06"
decided_by: "agent:pi"
accepted_by: "A: commitea agy ahora y deja opencode + pi como siguiente paso explícito (que lo haga otro agente agy)."
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "issue: https://github.com/jmanuelcorral/bond/issues/86"
  - "issue: https://github.com/jmanuelcorral/bond/issues/84"
  - "branch: main"
  - "head: 4616e8b"
---


## Context

La rebanada 3 de la #86 (bond budget) cubría agy, opencode y pi. La parte de agy está implementada y en verde (typecheck y 692 tests), pero la integración de opencode y pi no se terminó: la sesión anterior entró en bucle investigando los eventos de la API de extensiones de pi. Hace falta fijar qué se commitea ahora y quién termina lo demás.

## Decision

Se commitea solo la parte de agy: destino ~/.gemini/config/hooks.json indexado por fuente, con bond escribiendo su propio grupo "bond" (eventos PostInvocation, Notification, SessionEnd) sin tocar las fuentes ajenas, merge idempotente como los instaladores de codex y claude. opencode (plugin con session.idle/session.error) y pi (extensión de eventos de presupuesto) quedan fuera de este commit como paso siguiente explícito, a cargo de otro agente (agy), no de esta sesión.

## Rejected alternatives

Terminar las tres integraciones antes de commitear nada: deja trabajo ya verificado sin commitear y obliga a repetir la investigación de la API de extensiones de pi que ya produjo el bucle. Dejar agy en unknown como el resto: descartado porque su formato de hooks está comprobado y es barato de sostener.

## Consequences

Hasta que entren los adaptadores de opencode y pi, bond budget los muestra como unknown. El siguiente agente parte del contrato ya fijado (event log en ~/.bond/events/ y hook fail-open) y solo añade sus fuentes de eventos.
