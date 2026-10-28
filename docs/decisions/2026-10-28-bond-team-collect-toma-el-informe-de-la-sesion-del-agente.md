---
id: "2026-10-28-bond-team-collect-toma-el-informe-de-la-sesion-del-agente"
title: "bond team collect toma el informe de la sesión del agente"
status: "accepted"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: "chat 2026-10-28: «intregra P6, acepto y acepta la 19»; aclarado en el selector: «Las 19 del plan»"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D17"
  - "branch: main"
  - "head: e359bfd"
---


## Context

Tomada por el usuario en sesión el 2026-10-28, al planificar la memoria de decisiones (plan docs/plans/2026-10-28-decision-memory.md, Revisión 3, tras la prueba real); la registra el orquestador (Claude) tras publicar bond 1.7.0.

## Decision

collect guarda la última respuesta del agente sacada de su fichero de sesión (en pi, el .jsonl que da Herdr) y, si no puede, el panel sin el banner de arranque. Se niega mientras el agente trabaja.

## Rejected alternatives

Volcar las últimas líneas del panel (incluía banner y avisos).
