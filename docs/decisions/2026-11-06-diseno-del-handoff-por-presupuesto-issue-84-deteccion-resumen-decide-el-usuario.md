---
id: "2026-11-06-diseno-del-handoff-por-presupuesto-issue-84-deteccion-resumen-decide-el-usuario"
title: "Diseño del handoff por presupuesto (issue #84): detección + resumen, decide el usuario"
status: "accepted"
date: "2026-11-06"
decided_by: "agent:pi"
accepted_by: "apruebo las 2, para la decision 2: 1. Todo es sin presupuesto (en el caso de claude o agy o codex hay que mirar los limites que tenemos por si vamos a llegar al limite de uso) 2. c y que el usuario decida 3. resumen"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "issue: https://github.com/jmanuelcorral/bond/issues/84"
  - "issue: https://github.com/jmanuelcorral/bond/issues/76"
  - "branch: main"
  - "head: f6cde7d"
---


## Context

Al refinar la issue #76 (el probe da ✓ en modelos razonadores con respuesta vacía por presupuesto), el usuario pidió cubrir el caso de quedarse sin presupuesto a mitad de sesión. Se resolvieron tres decisiones de diseño antes de crear la issue nueva #84.

## Decision

1) «Sin presupuesto» abarca tres casos detectados por separado: cuota/límites de uso (429; en Claude/Antigravity/Codex consultar los límites proactivamente antes de llegar a ellos), agotamiento de contextWindow y presupuesto de razonamiento (estado empty_reasoning del probe de #76). 2) Mecanismo: solo detección + propuesta; bond nunca ejecuta el handoff automáticamente, el usuario decide. 3) Lo que se transmite en el handoff es un resumen de la sesión (desde el session file), no un replay completo.

## Rejected alternatives

Handoff automático o relanzamiento por bond (rechazado: el usuario debe decidir); replay completo de la sesión (rechazado: no cabe en presupuesto y pierde el punto).

## Consequences

#84 depende parcialmente de #76 (detección empty_reasoning). El estado state.probes debe distinguir ok/empty_reasoning/fail por API como contrato entre ambas issues.
