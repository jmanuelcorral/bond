---
id: "2026-11-17-packaging-nota-de-bond-app-en-homebrew-caveats-y-aur-optdepends-nota"
title: "packaging: nota de bond-app en Homebrew (caveats) y AUR (optdepends + nota)"
status: "proposed"
date: "2026-11-17"
decided_by: "agent:pi/kevin"
accepted_by: ""
accepted_via: ""
supersedes: ""
superseded_by: ""
links:
  - "commit: 88d1d96"
  - "commit: 067b291"
  - "branch: chore/packaging-1-16-3"
  - "head: 067b291"
---


## Context

Desde 1.16.0 `bond app` necesita el binario `bond-app`, que la instalación por npm trae como dependencia pero las de Homebrew y AUR no. Los usuarios de estas últimas no recibían ninguna pista cuando `bond app` fallaba con el mensaje app.missing.

## Decision

scripts/packaging.mts genera: en la fórmula Homebrew un bloque `def caveats`, y en el paquete AUR bond-bin una línea `optdepends` más dos `echo` en `package()`, todos remitiendo a `npm install -g @jmanuelcorral/bond-app`, con redacción coherente con el mensaje app.missing de cli/messages.mts.

## Rejected alternatives

Fichero .install con post_install en AUR (más complejo para un simple aviso); callar y depender solo del error en tiempo de ejecución (peor descubribilidad).
