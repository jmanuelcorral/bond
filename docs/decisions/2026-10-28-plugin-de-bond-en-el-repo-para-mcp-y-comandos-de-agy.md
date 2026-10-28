---
id: "2026-10-28-plugin-de-bond-en-el-repo-para-mcp-y-comandos-de-agy"
title: "Plugin de bond en el repo para MCP y comandos de agy"
status: "accepted"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: "chat 2026-10-28: «aprueba y guarda» (plan de agy) y «acepta A1–A4, commitea y manda P1 a claude»"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-agy-support.md#A2"
  - "branch: main"
  - "head: d2893a9"
---


## Context

Tomada por el usuario en sesión el 2026-10-28 al aprobar el plan de soporte de Antigravity (docs/plans/2026-10-28-agy-support.md, «aprueba y guarda»); la registra el orquestador (Claude).

## Decision

bond sync genera .agents/plugins/bond/ (plugin.json, mcp_config.json con los MCP elegidos y propios, skills/<comando>/SKILL.md por cada comando del catálogo) cuando agy está entre los agentes. $ARGUMENTS se traduce a una instrucción para usar el texto tras el comando.

## Rejected alternatives

Configuración global ~/.gemini/config/mcp_config.json (no es por repo); meter los comandos en .agents/skills/ (los verían pi y los demás como skills).
