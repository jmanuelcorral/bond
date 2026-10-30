---
id: "2026-10-30-bond-hub-check-tiene-un-nivel-de-aviso-que-no-cambia-el-codigo-de-salida"
title: "bond hub check tiene un nivel de aviso que no cambia el código de salida"
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

Hay cosas del hub que conviene señalar pero no impiden trabajar, como un repo fuera de repos/ o una base atrasada respecto a su remoto.

## Decision

Las comprobaciones de bond hub check pueden ser avisos: se muestran con su arreglo pero no cuentan como problema ni cambian el código de salida (0 si no hay fallos).

## Rejected alternatives

Tratarlas como fallos: check en rojo por algo que no impide trabajar. No decir nada: el usuario no se entera.
