---
id: "2026-11-16-bond-app-se-integra-como-dependencia-directa-de-bond-se-distribuye-en-npm-y-se-configuran-los-modos-app-y-tui"
title: "bond-app se integra como dependencia directa de bond, se distribuye en npm y se configuran los modos app y tui"
status: "accepted"
date: "2026-11-16"
decided_by: "agent:agy/kevin"
accepted_by: "aprobado"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "branch: chore/bond-1-15"
  - "head: d34e5f7"
---


## Context

Se requiere una distribucion unificada donde bond y bond-app se instalen y actualicen juntos via npm, facilitando la eleccion de trabajar en interfaz visual (app) o consola (tui)

## Decision

Incluir @jmanuelcorral/bond-app como dependencia de bond en package.json y dist/npm, exportar el binario bond-app en bin, anadir comando bond tui con dev como alias, y simplificar bond setup con seleccion interactiva entre app y tui sin pedir rutas locales
