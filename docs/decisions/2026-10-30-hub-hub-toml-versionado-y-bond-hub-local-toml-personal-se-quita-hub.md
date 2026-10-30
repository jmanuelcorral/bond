---
id: "2026-10-30-hub-hub-toml-versionado-y-bond-hub-local-toml-personal-se-quita-hub"
title: "Hub: hub.toml versionado y .bond/hub.local.toml personal; se quita [hub]"
status: "accepted"
date: "2026-10-30"
decided_by: "agent:claude"
accepted_by: "El usuario aprobó el plan 2026-10-30-hub-guided con D11–D15: \\\"si, quita [hub] y guárdalo\\\" (2026-10-30)"
accepted_via: "agent:claude"
supersedes: "2026-10-29-bond-hub-configura-la-sesion-en-hub-de-bond-bond-toml"
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-30-hub-guided.md"
  - "branch: plan/hub-session"
  - "head: 420eb68"
---


## Context

bond hub (P1 de 2026-10-29-hub-session) solo detecta un hub que ya existe con submódulos y guarda la sesión en [hub] de .bond/bond.toml. El usuario quiere que bond cree el hub e importe los repos de forma guiada, con un fichero de config que sea la fuente de la sesión y una revisión que asegure que todo funciona.

## Decision

La sesión de un hub se declara en hub.toml en la raíz del hub (nombre y, por repo: url, path, base, agent opcional y link), versionado. Lo propio de cada máquina (la ruta del clon local de cada repo con link = symlink) va en .bond/hub.local.toml, en el .gitignore; si falta, bond hub sync la pregunta u ofrece clonar. La sección [hub] de .bond/bond.toml desaparece: hub.toml es el único formato, y los submódulos que ya existan se importan a él.

## Rejected alternatives

Mantener [hub] en bond.toml como atajo para hubs con submódulos: dos formatos para lo mismo, sin usuarios todavía que lo necesiten. Rutas locales en hub.toml: no se puede compartir.
