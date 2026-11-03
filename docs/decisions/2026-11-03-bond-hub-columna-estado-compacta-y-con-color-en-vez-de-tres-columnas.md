---
id: "2026-11-03-bond-hub-columna-estado-compacta-y-con-color-en-vez-de-tres-columnas"
title: "bond hub: columna ESTADO compacta y con color en vez de tres columnas"
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

La tabla de `bond hub` (REPO · RUTA · BASE · ENLACE · RAMA · DESCRIPCIÓN) debía añadir cambios sin commitear, ahead y behind. Tres columnas más la harían ilegible en paneles de Herdr de 60 a 130 columnas.

## Decision

Una sola columna ESTADO, compacta y con color, reutilizando la paleta existente de bond (ok/caution/dim de cli/util.mts, que ya respetan NO_COLOR): `·N` cambios sin commitear (ámbar), `N↑` por delante (verde), `N↓` por detrás (ámbar), separadas por espacios para que `·2 1↑` no se lea pegado; punto verde a secas = limpio y al día; `·`/`·N` sin flechas si el repo no tiene upstream; `-` si el repo no está en disco. HEAD separado y (no está) se conservan en la columna RAMA como estaban.

## Rejected alternatives

Tres columnas separadas (SUCIO/ADELANTE/DETRÁS: demasiado ancha para paneles estrechos); una columna por métrica solo bajo flag (duplicaba variantes de la tabla); inventar paleta nueva (fuera del estilo de bond).

## Consequences

El ancho de la tabla se mide sin códigos ANSI (visibleWidth en cli/hub.mts). El formato de celda es estable para parsear en pruebas y scripts; cambiar un glifo es un cambio visible que debe ir al changelog.
