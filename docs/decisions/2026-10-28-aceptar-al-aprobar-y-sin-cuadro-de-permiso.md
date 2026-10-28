---
id: "2026-10-28-aceptar-al-aprobar-y-sin-cuadro-de-permiso"
title: "Aceptar al aprobar y sin cuadro de permiso"
status: "accepted"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: "chat 2026-10-28: «quita el cuadro y acepta al aprobar»"
accepted_via: "agent:claude"
supersedes: "2026-10-28-cuadro-de-permiso-de-claude-code-para-aceptar-decisiones"
superseded_by: ""
links:
  - "commit: 9280ebb"
  - "branch: main"
  - "head: 9280ebb"
---


## Context

El usuario, al saltarle el cuadro de permiso de Claude Code para aceptar A1–A4: «lo de la aceptacion es horrible, no quiero estar validando un comando cuando te he dicho por chat que lo valides». Validaba tres veces lo mismo: aprobar el plan, pedir aceptar y confirmar el comando.

## Decision

Las decisiones que el usuario aprueba en la conversación (por ejemplo, con el plan) se registran ya accepted con su cita (bond decisions add --confirmed-by, confirmed_by en record_decision). Solo quedan proposed las que un agente toma por su cuenta, que se aceptan desde la conversación con /accept. bond sync no añade reglas ask y quita las de la 1.8.0.

## Rejected alternatives

Mantener el cuadro de permiso (validación doble); hacerlo configurable con [decisions] confirm (más código para algo que nadie pidió); quitar solo el cuadro y seguir pidiendo aceptar tras aprobar.

## Consequences

La garantía es la cita del usuario en accepted_by, accepted_via y git; una aceptación indebida se ve en el diff y se corrige con supersede.
