---
id: "2026-10-30-h4-prompt-estancado-de-bond-team-se-reintenta-una-vez-y-luego-falla"
title: "H4: prompt estancado de bond team se reintenta una vez y luego falla"
status: "accepted"
date: "2026-10-30"
decided_by: "agent:pi/kevin"
accepted_by: "\"wait briefly and retry ONCE; if still stalls, fail with a clear message instead of a warning. Applies to hub and non-hub prompts.\""
accepted_via: "agent:pi/kevin"
supersedes: ""
superseded_by: ""
links:
  - "run: commit 6c569f2 on plan/hub-guided-p8"
  - "branch: plan/hub-guided-p8"
  - "head: 6c569f2"
---


## Context

En el test manual de punta a punta del hub, el primer `bond team prompt` a agentes recién arrancados se perdía: Herdr devolvía `agent_prompt_stalled` (no observó actividad en 5 s) y el panel no mostraba nada, pero bond solo avisaba. Había que decidir cómo recuperarlo sin reenviar prompts duplicados.

## Decision

En promptAgent (cli/team.mts), si Herdr responde agent_prompt_stalled y el panel (herdr agent read --source recent-unwrapped) no muestra la tarea, se espera un momento y se reintenta UNA vez. Si vuelve a estancarse sin señales en el panel, se falla con un mensaje claro (die) en lugar de solo avisar. Si el panel ya muestra la tarea, se da por entregada pese al stall y no se reenvía. Aplica a prompts en hub y fuera de él.

## Rejected alternatives

Reintentar sin comprobar el panel: rechazado porque un stall no prueba que el prompt no llegara (SKILL de herdr) y se duplicaría la tarea. Solo avisar como antes: rechazado porque el prompt se perdía sin señal clara para el usuario.

## Consequences

bond team prompt puede tardar ~1,5 s extra en el caso de stall. En hub, los agentes que sí recibieron se imprimen y luego se muere con la lista de los que no llegaron.
