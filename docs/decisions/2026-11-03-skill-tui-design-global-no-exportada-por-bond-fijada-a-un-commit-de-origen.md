---
id: "2026-11-03-skill-tui-design-global-no-exportada-por-bond-fijada-a-un-commit-de-origen"
title: "Skill tui-design global, no exportada por bond, fijada a un commit de origen"
status: "accepted"
date: "2026-11-03"
decided_by: "agent:pi/gru"
accepted_by: "Global en ~/.agents/skills/tui-design/ y sí, con ORIGIN.md fijando URL, commit SHA, fecha y quién lo copió."
accepted_via: "agent:pi/gru"
supersedes: ""
superseded_by: ""
links:
  - "branch: main"
  - "head: 2b80463"
---


## Context

Hace falta una lente de diseño para el trabajo TUI de bond (tabla de estado de `bond team`, issue #33) sin convertirla en algo que `bond init` instale en todos los repos del catálogo. La skill `tui-design` de fluzo-labs/fluzo-skills cubre contrato de interacción, seguridad de terminal y sesiones de agentes, que es justo lo que la tabla en vivo necesita.

## Decision

Instalar `tui-design` en `~/.agents/skills/tui-design/` (global para el agente, no por repo) como copia íntegra de la carpeta `skills/tui-design/` de https://github.com/fluzo-labs/fluzo-skills en el commit `48a1ac36fc229ccbcb1fe671d5dbd9774a567d56` de `main`, conservando `LICENSE` (MIT) y `references/`, y añadiendo un `ORIGIN.md` con URL, SHA, fecha y quién la copió. No entra en `catalog/skills/`, así que `bond init` no la instala en ningún repo.

## Rejected alternatives

Repo local en `.agents/skills/` del repo bond: descartado porque el diseño TUI interesa más allá de este repo. Añadir al catálogo de bond: descartado porque el catálogo es de flujos de trabajo que necesitan quienes usan bond, no de diseño de interfaces, y exportarla obligaría a mantenerla para terceros. Usarla sin instalar (consultar la web cada vez): descartado por falta de trazabilidad y de reutilización.

## Consequences

La skill está disponible en todos los proyectos del agente. El origen no provee instalador ni auto-update, así que cualquier actualización es manual y se revisa contra el SHA fijado en ORIGIN.md. La trazabilidad va aparte de las skills adaptadas de fluzo-labs/common-skills. Para el trabajo de #33 se usa como lente de revisión y fuente de criterios de aceptación (tallas 80x24 y 60 columnas, truncado que preserva ANSI y clusters de emoji, estado legible sin color, stdout limpio para --json, y la pregunta por un estado outcome-unknown).
