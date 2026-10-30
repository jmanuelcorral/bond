---
id: "2026-10-30-el-nivel-de-aviso-de-bond-hub-check-se-modela-con-warn-true-por-comprobacion-y-warnings-en-el-informe"
title: "El nivel de aviso de bond hub check se modela con warn:true por comprobación y warnings en el informe"
status: "rejected"
date: "2026-10-30"
decided_by: "agent:pi/kevin"
accepted_by: "nadie esta usando la herramienta aun, por lo que podemos cambiar el aviso; si, hazlo y prepara la PR"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "branch: plan/hub-ops-p9"
  - "head: 51e72bf"
---


## Context

P9 de 2026-10-30-hub-ops necesita un nivel de aviso (D17) en `bond hub check` sin romper el `--json` existente. P11 añadirá otro aviso (base atrasada), así que convenía fijar la forma del contrato.

## Decision

En el informe de `bond hub check`, cada aviso es una comprobación con `ok: true` y `warn: true`, y el informe añade un contador `warnings` aparte de `problems`; `ok` y el código de salida siguen dependiendo solo de `problems`. `bond doctor` refleja los avisos con una fila `warn` solo cuando no hay fallos.

## Rejected alternatives

Cambiar `ok` a un enum de nivel (rompería el `--json` existente, que el plan vetaba) o una lista separada de avisos por repo (más duplicación y menos uniforme con las comprobaciones).

## Consequences

P11 debe reutilizar el mismo patrón (`warn: true` + suma en `warnings`) para el aviso de base atrasada.
