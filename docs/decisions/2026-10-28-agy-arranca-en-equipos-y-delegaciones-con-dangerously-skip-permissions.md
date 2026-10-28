---
id: "2026-10-28-agy-arranca-en-equipos-y-delegaciones-con-dangerously-skip-permissions"
title: "agy arranca en equipos y delegaciones con --dangerously-skip-permissions"
status: "accepted"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: "chat 2026-10-28: «la proxima vez que ejecutes agy, hazlo con el flag --dangerously-skip-permissions por que si no pregunta mucho y no avanza» y «acepta P3, añade P4 y mándala a claude»"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-agy-support.md#A5"
  - "branch: main"
  - "head: e331af8"
---


## Context

Prueba real del 2026-10-28: sin el flag, agy pide permiso por cada comando (git status, git commit, bond decisions add) y en bond team se queda bloqueado. El usuario pidió lanzarlo siempre con el flag.

## Decision

bond team y bond-delegate lanzan agy con --dangerously-skip-permissions por defecto; quien no lo quiera lo cambia pasando sus propios argumentos tras --.

## Rejected alternatives

--mode auto (no comprobado que evite todas las preguntas); dejar que pregunte (el equipo no avanza).

## Consequences

agy ejecuta comandos sin pedir permiso en los worktrees del equipo; la revisión queda en el diff de cada rama.
