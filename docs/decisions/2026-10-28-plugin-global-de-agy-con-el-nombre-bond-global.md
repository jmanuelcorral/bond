---
id: "2026-10-28-plugin-global-de-agy-con-el-nombre-bond-global"
title: "Plugin global de agy con el nombre bond-global"
status: "proposed"
date: "2026-10-28"
decided_by: "agent:claude/kevin"
accepted_by: ""
accepted_via: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-agy-support.md#P2"
  - "decision: docs/decisions/2026-10-28-plugin-global-de-bond-para-agy.md"
  - "branch: plan/agy-support-p2"
  - "head: 4293bca"
---


## Context

A3 deja el plugin global de agy en ~/.gemini/config/plugins/bond/. En la prueba real de P2 (agy 1.4.9, HOME temporal), en un repo con el plugin del repo .agents/plugins/bond/ (name bond, de P1), agy solo cargaba el del repo: desaparecían las reglas globales y las skills bond-delegate, bond-team y herdr. Probado: lo que choca es el name de plugin.json, no la carpeta.

## Decision

El plugin global sigue en ~/.gemini/config/plugins/bond/ (A3), pero su plugin.json lleva name bond-global. Así agy carga los dos y el plugin del repo conserva su nombre y el prefijo de sus servidores MCP (bond_context7).

## Rejected alternatives

Renombrar la carpeta global a bond-global con name bond: probado, sigue chocando. Renombrar el plugin del repo: cambia lo aceptado en P1 y el prefijo bond_ de los MCP que nombran las skills.

## Consequences

Activar o desactivar el plugin en config.json de agy va por nombre de carpeta, que coincide para los dos (bond). Si agy cambia cómo resuelve nombres, la prueba real de P2 lo detecta.
