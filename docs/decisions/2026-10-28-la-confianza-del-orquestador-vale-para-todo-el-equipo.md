---
id: "2026-10-28-la-confianza-del-orquestador-vale-para-todo-el-equipo"
title: "La confianza del orquestador vale para todo el equipo"
status: "accepted"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: "usuario en sesión el 2026-10-28: «a partir de ahora si el orquestador confia en el repo, hagamos que el resto de agentes confien» y «si funcona con trustedWorkspaces perfecto»"
accepted_via: "agent:claude"
supersedes: "2026-10-28-confianza-heredada-para-agy-en-bond-team"
superseded_by: ""
links:
  - "docs/plans/2026-10-28-agy-support.md"
  - "branch: main"
  - "head: 13fe3a7"
---


## Context

En bond team cada agente (pi, Claude Code, agy) solo heredaba la confianza que él mismo daba al checkout principal: un agy que nunca había abierto el repo preguntaba en su panel aunque el orquestador sí confiara en él. agy 1.4.9 no tiene --disable-workspace-trust.

## Decision

Si el agente del panel que lanza bond team (pi, Claude Code o agy) confía en el checkout principal, bond escribe la confianza del worktree para cada agente pi, Claude Code y agy del equipo (trust.json, ~/.claude.json, trustedWorkspaces de agy). Sin esa confianza, cada agente hereda la suya como antes. Un no explícito de pi en el worktree se respeta y --no-trust lo desactiva.

## Rejected alternatives

--disable-workspace-trust en agy: no existe en 1.4.9. Mantener solo la confianza de cada agente: obliga a contestar la pregunta de confianza por cada agente nuevo.
