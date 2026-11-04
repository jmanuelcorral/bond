---
id: "2026-11-04-models-sync-check-y-doctor-respetan-cfg-agents-la-migracion-del-bloque-huerfano-de-codex-corre-en-models-sync"
title: "models sync, --check y doctor respetan cfg.agents; la migración del bloque huérfano de Codex corre en models sync"
status: "proposed"
date: "2026-11-04"
decided_by: "agent:pi"
accepted_by: ""
accepted_via: ""
supersedes: ""
superseded_by: ""
links:
  - "issue: https://github.com/jmanuelcorral/bond/issues/73"
  - "issue: https://github.com/jmanuelcorral/bond/issues/80"
  - "run: docs/decisions/runs/2026-11-04-dev-1-trabajas-en-home-jose-gitrepos-bond-rama.md"
  - "branch: main"
  - "head: 651a1a6"
---


## Context

El issue #73 dejaba abierta si `bond doctor` y `--check`, que comparten el camino de `syncAgents`, debían ajustarse también al filtro de agentes seleccionados. El issue #80 dejaba sin decidir en qué comando corre la limpieza del bloque `# >>> bond >>>` que bond dejó en `~/.codex/config.toml` al dejar de aprovisionar Codex.

## Decision

Ambos, adoptados por el delegado antigravity en el commit 651a1a6: (1) `syncAgents` filtra por `cfg.agents` también en `--check` y `bond doctor`, de modo que ni sincronizan ni auditan agentes que el usuario no seleccionó en `bond setup`; `--agent <a>` sigue forzando uno concreto. (2) La limpieza del bloque huérfano de Codex corre en `bond models sync` (y de paso en `bond setup`, que lo invoca), con backup `.bak.<STAMP>`, preservando la config manual y siendo idempotente; en `--check` solo la anuncia sin tocar el fichero.

## Rejected alternatives

Que `--check`/`doctor` siguieran auditando todos los agentes instalados: genera alertas falsas sobre agentes que el usuario marcó como no usados y contradice la selección de `bond setup`. Poner la migración en `bond update` o `bond doctor --fix`: descentraliza el aprovisionamiento de modelos, que es responsabilidad de `models sync`.

## Consequences

Efecto colateral sin resolver: `bond doctor` pasa `agents` explícitos a `syncAgents`, así que la ruta de limpieza/comprobación del huérfano no se dispara desde doctor; solo `bond models sync --check` la reporta. Y `bond models sync --agent codex` muere con «agente sin generador de modelos» en vez de limpiar el bloque. Ambos se pueden cerrar después si molestan.
