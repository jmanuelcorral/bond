---
id: "2026-11-12-desactivar-la-tabla-en-vivo-de-bond-team-con-bond-team-no-table-o-no-table"
title: "Desactivar la tabla en vivo de bond team con BOND_TEAM_NO_TABLE o --no-table"
status: "accepted"
date: "2026-11-12"
decided_by: "agent:agy/stuart"
accepted_by: "suministrando una variable de entorno que la desactive"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-11-10-bond-app.md"
  - "phase: P7"
  - "branch: plan/bond-app-p7"
  - "head: f55e85e"
---


## Context

En bond-app la información de los agentes y sus ramas se muestra en su propia interfaz (panel de Agentes), por lo que el panel con la tabla en vivo de bond team (bond team status --watch) resulta redundante y el foco debe quedar en el primer agente.

## Decision

bond team admite la variable de entorno BOND_TEAM_NO_TABLE=1 y la opción equivalente --no-table para omitir la apertura del panel de la tabla en vivo. Cuando la tabla está desactivada, el foco se coloca en el panel del primer agente en lugar de en la shell lanzadora. Sin la variable o la bandera, el comportamiento se mantiene idéntico.

## Rejected alternatives

Mantener la apertura de la tabla y cerrarla a posteriori desde bond-app tras el arranque (descartado por el usuario por fragilidad: 'dejemos el apaño que no acaba de ir fino. Hagamos lo de la bond-table').
