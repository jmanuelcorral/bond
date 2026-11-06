---
id: "2026-11-06-contrato-de-estados-del-probe-de-bond-models-76-ok-empty-reasoning-fail"
title: "Contrato de estados del probe de bond models (#76): ok / empty_reasoning / fail"
status: "accepted"
date: "2026-11-06"
decided_by: "agent:pi"
accepted_by: "apruebo las 2 (refinamiento de #76: estados ✓/!/✗ inspeccionando el cuerpo, y no subir el max_tokens del probe para no castigar el arranque en frío)"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "issue: https://github.com/jmanuelcorral/bond/issues/76"
  - "issue: https://github.com/jmanuelcorral/bond/issues/84"
  - "branch: main"
  - "head: f6cde7d"
---


## Context

Al refinar #76 había que decidir cómo clasifica el probe las respuestas 200 de modelos razonadores que llegan vacías por presupuesto de tokens, y si el probe debía subir su max_tokens para forzar contenido.

## Decision

El probe inspecciona el cuerpo y clasifica cada API como ok (contenido utilizable), empty_reasoning (200 sin contenido util) o fail (HTTP != 2xx o cuerpo no parseable); empty_reasoning se muestra con ! y sugiere reasoning = true. El max_tokens del probe se mantiene pequeño (8/16) para no castigar el arranque en frío de pasarelas locales (#75). state.probes guarda el status por API como contrato para consumidores (#84).
