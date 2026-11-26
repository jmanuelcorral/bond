---
id: "2026-11-26-bond-deja-de-incluir-bond-app-paquete-aparte-que-instala-y-actualiza-su-instalador"
title: "bond deja de incluir bond-app: paquete aparte que instala y actualiza su instalador"
status: "accepted"
date: "2026-11-26"
decided_by: "agent:claude"
accepted_by: "arregla bond y bond-app (aprobando la propuesta: quitar el comando bond-app y la dependencia de @jmanuelcorral/bond-app en bond 1.16.9)"
accepted_via: "user"
supersedes: "2026-11-16-bond-app-se-integra-como-dependencia-directa-de-bond-se-distribuye-en-npm-y-se-configuran-los-modos-app-y-tui"
superseded_by: ""
links:
  - "branch: main"
  - "head: 314b4e3"
---


## Context

bond 1.16.8 dependía de @jmanuelcorral/bond-app ^0.1.1 y publicaba su propio bin bond-app. Con 0.x el caret excluye la 0.2.0, así que tras 'npx @jmanuelcorral/bond-app setup' quedaba bond-app 0.1.6 en el PATH (sin doctor, service, update) y 'npm i -g @jmanuelcorral/bond-app' fallaba con EEXIST por el bin duplicado. Visto en contenedores limpios de Debian y Arch el 2026-11-26.

## Decision

bond no depende de @jmanuelcorral/bond-app ni publica el bin bond-app. bond-app es un paquete global aparte: lo instala 'npx -y @jmanuelcorral/bond-app@latest setup' y lo actualiza 'bond-app update', que pone al día bond y bond-app. 'bond app' sigue buscando bond-app en el PATH y, si falta, explica cómo instalarlo.

## Rejected alternatives

Ampliar el rango de la dependencia (^0.2.0) y mantener el shim: acopla cada versión menor de bond-app a una release de bond y deja el conflicto EEXIST en 'bond-app update'. Instalar bond-app con --force: pisa el bin de otro paquete.
