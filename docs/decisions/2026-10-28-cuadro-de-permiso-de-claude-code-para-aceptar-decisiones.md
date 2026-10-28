---
id: "2026-10-28-cuadro-de-permiso-de-claude-code-para-aceptar-decisiones"
title: "Cuadro de permiso de Claude Code para aceptar decisiones"
status: "proposed"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: ""
accepted_via: ""
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D21"
  - "branch: main"
  - "head: 769d604"
---


## Context

Tomada por el usuario en sesión el 2026-10-28 (plan docs/plans/2026-10-28-decision-memory.md, Revisión 4), junto con D20.

## Decision

Con [decisions] y Claude Code entre los agentes, bond sync añade a .claude/settings.json reglas ask para bond decisions accept, reject y supersede, fusionadas con las del repo; cada ejecución pasa por el cuadro de permiso de Claude Code, que el modelo no puede saltarse.

## Rejected alternatives

Solo la regla de la skill (depende del modelo); hooks propios (más frágiles).

## Consequences

En agentes sin sistema de permisos (pi) quedan la regla de la skill y el rastro en git. Invocar bond por otra ruta (bin/bond) no casa con la regla.
