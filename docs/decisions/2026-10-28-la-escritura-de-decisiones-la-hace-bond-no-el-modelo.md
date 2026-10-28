---
id: "2026-10-28-la-escritura-de-decisiones-la-hace-bond-no-el-modelo"
title: "La escritura de decisiones la hace bond, no el modelo"
status: "accepted"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: "chat 2026-10-28: «intregra P6, acepto y acepta la 19»; aclarado en el selector: «Las 19 del plan»"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D11"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 2); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

bond decisions add recibe título, contexto, decisión, alternativas y consecuencias (flags o JSON por stdin) y escribe el fichero, el id, la rama y el HEAD. Siempre entra como proposed. Motivo: los modelos locales no siguen instrucciones de formato.

## Rejected alternatives

Que el agente escriba el fichero a mano siguiendo la skill (falla con modelos locales).
