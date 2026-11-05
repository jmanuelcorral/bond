---
id: "2026-11-04-el-nombre-npm-de-bond-es-jmanuelcorral-bond"
title: "El nombre npm de bond es @jmanuelcorral/bond"
status: "accepted"
date: "2026-11-04"
decided_by: "agent:pi/gru"
accepted_by: "para #66 usa @jmanuelcorral/bond como nombre npm"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "branch: main"
  - "head: 89b16f6"
---


## Context

bond no tiene paquete npm publicado. `bond` esta ocupado por bond@0.1.5 (una implementacion de Promises ajena) y `bond-cli` tambien esta ocupado. La documentacion del repo (docs/plan-v1.md:111) ya usa @jmanuelcorral/bond y `bond update` ya imprime `npm i -g @jmanuelcorral/bond@latest`, pero el paquete no existe: hoy eso es una promesa rota.

## Decision

El nombre npm de bond es @jmanuelcorral/bond. Coincide con lo que la documentacion y `bond update` ya dan por supuesto, y esta libre (verificado con npm view -> 404).

## Rejected alternatives

`bond` y `bond-cli`, ambos ocupados. Otros scoped (@bond-cli/bond, @bond/cli, bond-sh, bond-terminal) estan libres pero no coinciden con lo ya documentado y obligarian a cambiar docs, scripts de actualizacion y instaladores.

## Consequences

Hay que crear el paquete bajo el scope jmanuelcorral y publicar la primera version. La skill de release (#66) depende de esto. `package.json` tendra que cambiar de name: "bond" a "@jmanuelcorral/bond", lo que afecta a package-lock.json y a lo que `bond update` imprime.
