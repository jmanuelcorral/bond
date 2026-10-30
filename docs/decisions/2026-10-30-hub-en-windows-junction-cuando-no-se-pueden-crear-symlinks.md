---
id: "2026-10-30-hub-en-windows-junction-cuando-no-se-pueden-crear-symlinks"
title: "Hub: en Windows, junction cuando no se pueden crear symlinks"
status: "accepted"
date: "2026-10-30"
decided_by: "agent:claude"
accepted_by: "El usuario aprobó el plan 2026-10-30-hub-guided con D11–D15: \"si, quita [hub] y guárdalo\" (2026-10-30)"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-30-hub-guided.md"
  - "branch: plan/hub-session"
  - "head: 420eb68"
---


## Context

bond hub (P1 de 2026-10-29-hub-session) solo detecta un hub que ya existe con submódulos y guarda la sesión en [hub] de .bond/bond.toml. El usuario quiere que bond cree el hub e importe los repos de forma guiada, con un fichero de config que sea la fuente de la sesión y una revisión que asegure que todo funciona.

## Decision

En Windows, si crear un symlink de directorio falla (sin modo desarrollador ni privilegios), bond hub sync crea una junction al clon local, que no necesita permisos especiales, y lo dice.

## Rejected alternatives

Exigir modo desarrollador: deja fuera a quien no lo tiene. Copiar el repo: deja de ser el mismo clon.
