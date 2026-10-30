---
id: "2026-10-30-hub-el-hub-es-un-repo-git-compartido-con-el-equipo"
title: "Hub: el hub es un repo git compartido con el equipo"
status: "accepted"
date: "2026-10-30"
decided_by: "agent:claude"
accepted_by: "El usuario eligió \"Sí, es un repo git\""
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

El hub es un repo git con hub.toml, AGENTS.md, planes y memoria de decisiones; otra persona lo clona y bond hub sync le monta los repos.

## Rejected alternatives

Una carpeta personal sin versionar: el hub no se podría compartir ni revisar.
