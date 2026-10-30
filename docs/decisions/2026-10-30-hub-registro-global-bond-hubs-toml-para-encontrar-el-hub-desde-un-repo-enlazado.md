---
id: "2026-10-30-hub-registro-global-bond-hubs-toml-para-encontrar-el-hub-desde-un-repo-enlazado"
title: "Hub: registro global ~/.bond/hubs.toml para encontrar el hub desde un repo enlazado"
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

bond hub sync anota en ~/.bond/hubs.toml la ruta real de cada repo de un hub y su hub. hubRoot usa primero git (--show-superproject-working-tree) y, si no da nada, ese registro; así un repo enlazado por symlink, que vive fuera del hub, encuentra su hub.

## Rejected alternatives

Solo funcionar desde la raíz del hub: dentro de un repo enlazado bond team, status o la tabla no sabrían que están en una sesión.
