---
id: "2026-10-30-el-hub-hace-bond-init-en-los-repos-de-la-sesion-que-no-tienen-bond"
title: "El hub hace bond init en los repos de la sesión que no tienen bond"
status: "accepted"
date: "2026-10-30"
decided_by: "agent:claude"
accepted_by: "Creo que deberia detectarlo y hacer un init para que el hub funcione correctamente"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-30-hub-guided.md"
  - "branch: plan/hub-session"
  - "head: e89bfc1"
---


## Context

Un repo de la sesión sin bond deja a su agente sin las skills del catálogo ni las instrucciones de bond, y bond hub check lo marca en rojo. El usuario quiere que montar un hub propague la configuración a sus repos.

## Decision

bond hub init, bond hub add y bond hub sync detectan los repos de la sesión sin .bond/bond.toml y les hacen bond init con la config del hub: los agentes del bond.toml del hub (con el agent del repo en hub.toml como el de por defecto) y las skills por defecto del catálogo. Con terminal y sin --yes preguntan antes. Los repos que ya tienen bond conservan su config.

## Rejected alternatives

Config heredada sin tocar los repos, generada en cada worktree y oculta a git: nada versionado y un agente fuera del hub no la tiene. Fusionar la config del hub en los repos que ya tienen bond: pisa decisiones de cada repo.
