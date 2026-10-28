---
id: "2026-10-28-agy-sin-instrucciones-globales-hasta-el-plugin-global"
title: "agy sin instrucciones globales hasta el plugin global"
status: "proposed"
date: "2026-10-28"
decided_by: "agent:claude/kevin"
accepted_by: ""
accepted_via: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-agy-support.md"
  - "phase: P1"
  - "branch: plan/agy-support-p1"
  - "head: 596d87e"
---


## Context

P1 añade agy al catálogo de agentes (cli/catalog-agents.mts), del que bond setup saca el fichero de instrucciones globales de cada agente para propagate. Las de agy, según A3, van en ~/.gemini/config/plugins/bond/rules/AGENTS.md, que solo carga si el plugin tiene plugin.json, y eso es de P2.

## Decision

AgentInfo.instructions pasa a ser opcional y la entrada agy no lo lleva: propagate se salta los agentes sin él. P2 lo añadirá junto con el plugin global completo.

## Rejected alternatives

Poner ya la ruta rules/AGENTS.md del plugin global: bond setup con agy dejaría una carpeta de plugin sin plugin.json que agy no carga, a medio hacer hasta P2. Crear ya el plugin global: es el alcance de P2.

## Consequences

Hasta P2, bond setup con agy no le lleva reglas globales ni lo dice en su salida; el resto de agentes no cambia.
