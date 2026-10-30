---
id: "2026-10-30-hub-cada-repo-entra-como-submodulo-o-como-symlink"
title: "Hub: cada repo entra como submódulo o como symlink"
status: "accepted"
date: "2026-10-30"
decided_by: "agent:claude"
accepted_by: "El usuario eligió \"Los dos modos\""
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

Cada repo de un hub declara su modo de enlace: submodule (clonado y versionado en el hub, reproducible para el equipo) o symlink (enlace a un clon local que ya existe). Los dos modos conviven en el mismo hub.

## Rejected alternatives

Solo symlinks: cada persona monta su hub y no es reproducible. Solo submódulos: obliga a reclonar repos que ya tienes y arrastra la fricción de los submódulos.
