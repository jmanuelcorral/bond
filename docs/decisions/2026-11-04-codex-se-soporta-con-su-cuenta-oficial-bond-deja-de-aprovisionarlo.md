---
id: "2026-11-04-codex-se-soporta-con-su-cuenta-oficial-bond-deja-de-aprovisionarlo"
title: "Codex se soporta con su cuenta oficial; bond deja de aprovisionarlo"
status: "accepted"
date: "2026-11-04"
decided_by: "agent:pi/gru"
accepted_by: "1. Cerrar #74 y #79 como NOT_PLANNED y abrir issue https://github.com/jmanuelcorral/bond/issues/80 (alcance). 2. Limpiar automáticamente el bloque huérfano con backup. 3. Aprobado el alcance en https://github.com/jmanuelcorral/bond/issues/80 (#74 y #79 cerrados como NOT_PLANNED)."
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "issue: https://github.com/jmanuelcorral/bond/issues/80"
  - "issue: https://github.com/jmanuelcorral/bond/issues/74"
  - "issue: https://github.com/jmanuelcorral/bond/issues/79"
  - "branch: main"
  - "head: d8d55f6"
---


## Context

bond tenía a Codex en TARGETS, es decir, le escribía proveedores de modelos en ~/.codex/config.toml con env_key. Al investigar #74 se vio que la clave de un proveedor custom solo puede venir de una variable de entorno (no hay campo inline en el schema de Codex) y que nadie exporta esa variable. Arreglarlo bien exigía extender bond run a Codex para una ruta que no aporta nada frente a pi/opencode/crush.

## Decision

Codex se soporta como agente con su cuenta oficial de Codex, igual que agy: seleccionable, lanzado por bond, recibe instrucciones e integración de Herdr, pero bond no le aprovisiona modelos. Se quita codex de TARGETS (cli/agents.mts:245), del filtro de aprovisionables de setup.mts:101 y de withModels en doctor.mts:193. El bloque huérfano que bond dejó en ~/.codex/config.toml se limpia automáticamente con backup previo del fichero, preservando la configuración manual del usuario y de forma idempotente.

## Rejected alternatives

Exportar BOND_KEY_<ID> desde preparePane: descartado porque la clave se teclea a la vista en el panel y queda en el histórico de la shell. Extender bond run a Codex con spawnSync y env sin eco: descartado porque es trabajo en una ruta que no se quiere soportar cuando ya existen pi, opencode y crush para proveedores aprovisionados. Dejarlo como limitación conocida con aviso en doctor: descartado porque deja el feature a medias.

## Consequences

#74 y #79 se cierran como NOT_PLANNED: ambos existían solo porque bond aprovisiona Codex. El cambio de alcance va en #80. En bond models list Codex deja de aparecer como aprovisionable y pasa a explicarse su situación, en vez de desaparecer en silencio como agy. El bloque MCP que bond escribe en .codex/config.toml a nivel de repo no se ve afectado: no es aprovisionamiento de modelos.

Dos cabos sueltos de la primera versión (651a1a6) quedaron cerrados en 13c13e0: `bond doctor` pasaba su propia lista de agentes a `syncAgents` y por eso no veía el huérfano — ahora la limpieza corre en cada `syncAgents` y `doctor` tiene fila propia (`codexOrphanCheck`) mientras el bloque esté en disco; y `bond models sync --agent codex` moría con «agente sin generador de modelos» — `codex` se acepta de nuevo en `--agent` como limpieza exclusiva, y avisa si no hay nada que limpiar.

Ajuste de forma en 6b81cd2: la nota de Codex en `bond models list` sale solo si `codex` está en `cfg.agents` o instalado en la máquina. Tal como estaba, se imprimía con solo haber proveedores registrados, así que quien nunca eligió Codex leía sobre un agente que no usa.
