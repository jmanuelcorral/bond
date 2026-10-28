---
id: "2026-10-28-activacion-por-repo-con-decisions-en-bond-toml"
title: "Activación por repo con [decisions] en bond.toml"
status: "proposed"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D7"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 1); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

La memoria se activa con la sección [decisions] de .bond/bond.toml (dir ajustable dentro del repo). bond init la propone solo si se elige la skill decision-record; bond sync crea el README con el formato si falta y luego es del repo. Sin la sección, nada cambia.

## Rejected alternatives

Activarla siempre (se descartó al revisar P1: un repo sin la skill quedaba con la regla y sin herramienta).
