---
id: "2026-11-03-bond-hub-estado-en-vivo-contra-refs-locales-con-fetch-opt-in"
title: "bond hub: estado en vivo contra refs locales, con --fetch opt-in"
status: "accepted"
date: "2026-11-03"
decided_by: "agent:pi/kevin"
accepted_by: "Aprobadas: bond-hub-estado-en-vivo-contra-refs-locales-con-fetch-opt-in y bond-hub-columna-estado-compacta-y-con-color-en-vez-de-tres-columnas"
accepted_via: "agent:pi/gru"
supersedes: ""
superseded_by: ""
links:
  - "plan: issue #42"
  - "branch: feat/hub-repo-status"
  - "head: 6c07b59"
---


## Context

Issue #42: bond hub debía enseñar por repo los cambios sin commitear y los commits por delante/detrás de su remoto. Calcular ahead/behind fresco implica red en cada pintado de la tabla, algo lento y que puede fallar en paneles o sin conectividad. El usuario decidió el modelo de red antes de implementar.

## Decision

El estado que muestra `bond hub` se calcula siempre contra las refs locales del remoto (origin/main tal como están en disco), sin tocar la red. `bond hub --fetch` hace un `git fetch` por repo antes de calcular para dar el dato fresco. La salida deja claro contra qué se habla: sin `--fetch`, un pie de tabla corto indica que es contra el último fetch conocido; con `--fetch`, que el dato viene de un fetch. En `--json` lo marca el campo `fetched` por repo.

## Rejected alternatives

Fetch automático en cada `bond hub` (siempre fresco pero lento y dependiente de la red en cada uso, inaceptable para una tabla que se mira a menudo); no ofrecer datos de remoto en `bond hub` y dejarlos solo en `bond hub check` (perdía el propósito de la vista de estado en vivo).

## Consequences

`bond hub` funciona offline y es rápido. Los datos pueden estar desactualizados hasta el próximo fetch; por eso el pie de tabla y `fetched` en JSON. El cálculo compartido (cli/hub-status.mts) asume refs locales; quien quiera frescura pasa fetch:true.
