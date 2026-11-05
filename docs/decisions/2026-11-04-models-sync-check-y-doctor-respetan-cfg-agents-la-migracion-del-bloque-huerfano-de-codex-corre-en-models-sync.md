---
id: "2026-11-04-models-sync-check-y-doctor-respetan-cfg-agents-la-migracion-del-bloque-huerfano-de-codex-corre-en-models-sync"
title: "models sync, --check y doctor respetan cfg.agents; la migración del bloque huérfano de Codex corre en models sync"
status: "accepted"
date: "2026-11-04"
decided_by: "agent:pi"
accepted_by: "paso la decisión de models-sync como aceptada"
accepted_via: "agent:pi"
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

Resuelto en 13c13e0 lo que esto dejaba sin cerrar: `bond doctor` pasaba `agents` explícitos a `syncAgents` y no veía el huérfano, y `bond models sync --agent codex` moría con «agente sin generador de modelos». Ahora la limpieza del huérfano corre en todo `syncAgents`, con o sin `--agent`, `doctor` saca su propia fila de aviso mientras el bloque exista, y `--agent codex` se acepta como limpieza exclusiva (avisa si no hay nada que limpiar).
