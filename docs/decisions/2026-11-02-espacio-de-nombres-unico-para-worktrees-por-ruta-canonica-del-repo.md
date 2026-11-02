---
id: "2026-11-02-espacio-de-nombres-unico-para-worktrees-por-ruta-canonica-del-repo"
title: "Espacio de nombres único para worktrees por ruta canónica del repo"
status: "accepted"
date: "2026-11-02"
decided_by: "agent:agy/kevin"
accepted_by: "Acepto la decision 2026-11-02-espacio-de-nombres-unico-para-worktrees-por-ruta-canonica-del-repo tal como esta; no la cambio."
accepted_via: "agent:pi/gru"
supersedes: ""
superseded_by: ""
links:
  - "branch: fix/worktree-namespace"
  - "head: add299c"
---


## Context

Dos hubs o repos con el mismo nombre base de carpeta (por ejemplo testapp/hub y demos/hub) compartían el directorio ~/.herdr/worktrees/<nombre>/, pudiendo colisionar y mezclar worktrees (#36).

## Decision

Añadir un sufijo hash corto (7 caracteres hex de SHA-256 de la ruta canónica del repo o hub) al directorio base de worktrees: ~/.herdr/worktrees/<nombre>-<hash>/<rama> (y ~/.herdr/worktrees/<hub>-<hash>/<sub>/<rama> en modo hub). Los worktrees del esquema previo se siguen reconociendo y limpiando con bond team clean.

## Rejected alternatives

Añadir un nivel de carpeta adicional (~/.herdr/worktrees/<nombre>/<hash>/<rama>), descartado por añadir profundidad y complejidad innecesaria en la navegación; o usar la jerarquía de rutas completa de disco, descartado por generar rutas excesivamente largas.

## Consequences

Las rutas de worktree son deterministas y estables para cada repositorio sin riesgo de colisión entre repos con el mismo nombre de carpeta. La compatibilidad con worktrees ya creados con el esquema anterior se mantiene intacta.
