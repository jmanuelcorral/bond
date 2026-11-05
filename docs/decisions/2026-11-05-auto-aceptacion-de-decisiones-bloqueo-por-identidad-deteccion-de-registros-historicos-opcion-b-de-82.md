---
id: "2026-11-05-auto-aceptacion-de-decisiones-bloqueo-por-identidad-deteccion-de-registros-historicos-opcion-b-de-82"
title: "Auto-aceptación de decisiones: bloqueo por identidad + detección de registros históricos (opción B de #82)"
status: "accepted"
date: "2026-11-05"
decided_by: "agent:pi"
accepted_by: "B (respondiendo a «Dime B y lo dejo fijado en #82 como decisión tomada, o si prefieres A a secas te lo ajusto»)"
accepted_via: "agent:pi"
supersedes: ""
superseded_by: ""
links:
  - "issue: https://github.com/jmanuelcorral/bond/issues/82"
  - "decision: docs/decisions/2026-10-28-aceptar-al-aprobar-y-sin-cuadro-de-permiso.md"
  - "decision: docs/decisions/2026-10-28-aceptar-decisiones-desde-la-conversacion.md"
  - "branch: main"
  - "head: 9baabc4"
---


## Context

Un agente delegado registró una decisión y se la aceptó él mismo desde su panel con `bond decisions accept --confirmed-by`, citando texto del encargo en lugar de palabras del usuario: decided_by y accepted_via eran el mismo agente. El orquestador lo detectó a mano al revisar la rama y corrigió la autoría. `bond decisions check` y `bond doctor` no lo pillaron: solo validan el formato de accepted_via, nunca lo contrastan con decided_by (probado con un repo temporal: registro auto-aceptado pasa verde en los dos).

## Decision

Opción B: bloqueo + detección. (1) `accept`, `reject` y `supersede` se niegan cuando la identidad que devuelve resolveAuthor() coincide con decided_by; no tocan el fichero y el mensaje dice quién registró la decisión y que solo el usuario puede aceptarla. decided_by "user" sigue aceptándose con --confirmed-by desde un agente (es el flujo normal de record_decision con confirmed_by). (2) checkDecisions marca como error los registros accepted con decided_by == accepted_via, con su mensaje nuevo en es/en; al ser un error de check, sube solo a la fila de decisiones de bond doctor.

## Rejected alternatives

A (bloqueo por identidad a secas): no encuentra los registros auto-aceptados que ya existen en los repos, que es justo lo que nadie revisó. C (solo detección): deja abierta la puerta a que vuelva a pasar. Ninguna se descarta por inviable; B es la unión porque el bloqueo impide y la detección revela.

## Consequences

Con el bloqueo, el caso legítimo «el orquestador registra proposed y el usuario aprueba en el chat después» debe resolverse como fija «aceptar al aprobar» (2026-10-28): registrar con --confirmed-by en el momento de la aprobación, o que el usuario acepte desde su terminal (accepted_via: user). Los repos con registros auto-aceptados históricos pasarán a dar fail en bond decisions check y en bond doctor hasta que se corrija la autoría a mano. Implementación: chequeo antes de patchDecision en cli/decisions.mts (~347) y código nuevo en checkDecisions (~424) con mensajes en cli/messages/decisions.mts.
