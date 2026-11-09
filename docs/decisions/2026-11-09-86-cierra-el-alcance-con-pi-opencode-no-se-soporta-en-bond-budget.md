---
id: "2026-11-09-86-cierra-el-alcance-con-pi-opencode-no-se-soporta-en-bond-budget"
title: "#86 cierra el alcance con pi: opencode no se soporta en bond budget"
status: "accepted"
date: "2026-11-09"
decided_by: "agent:pi"
accepted_by: "\"no soportaria opencode, solo pi, para ello usemos un agy, tu orquesta\""
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "issue: https://github.com/jmanuelcorral/bond/issues/86"
  - "plan: docs/decisions/2026-11-06-rebanada-3-de-86-agy-se-integra-por-hooks-opencode-y-pi-quedan-como-paso-siguiente-explicito.md"
  - "branch: main"
  - "head: 842c608"
---


## Context

La rebanada 3 de #86 dejó opencode y pi como paso siguiente explícito (adaptadores de `bond budget`). Al planificar la siguiente rebanada el usuario decide recortar el alcance.

## Decision

`bond budget` NO soportará opencode; el único adaptador pendiente es el de pi (extensión de eventos de presupuesto vía Bond Extensions, escribiendo en `~/.bond/events/`). La implementación de pi se delega a un agente Antigravity (agy), orquestado por pi.

## Consequences

opencode deja de listedarse como agente con hook en budget (queda fuera de HOOKED_AGENTS o se documenta su exclusion), el CHANGELOG y docs/reference.md se ajustan, y #86 se podrá cerrar al entrar el adaptador de pi.
