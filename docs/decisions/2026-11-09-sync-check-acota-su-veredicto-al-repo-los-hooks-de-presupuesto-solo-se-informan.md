---
id: "2026-11-09-sync-check-acota-su-veredicto-al-repo-los-hooks-de-presupuesto-solo-se-informan"
title: "sync --check acota su veredicto al repo: los hooks de presupuesto solo se informan"
status: "accepted"
date: "2026-11-09"
decided_by: "agent:pi"
accepted_by: "«Hazlo todo» (approbation de deixar la pipeline verde i tancar #86; el disseny del fix és del agente)"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "issue: https://github.com/jmanuelcorral/bond/issues/86"
  - "run: https://github.com/jmanuelcorral/bond/actions/runs/42649640404"
  - "branch: main"
  - "head: 7feb32a"
---


## Context

La pipeline de main fallaba en el paso `bond sync --check` porque el instalador de hooks de presupuesto (rebanadas de #86) reportaba como pendiente la existencia de ~/.claude/settings.json en el runner, un fichero de máquina que en CI nunca existe.

## Decision

`bond sync --check` no cuenta los hooks de presupuesto (Claude/Codex/agy en el home del usuario) para el veredicto: `sync` los instala y el `--check` solo los informa. El veredicto de check queda acotado a los ficheros del repo; los hooks viven en la máquina y un runner limpio sin `bond sync` previo fallaba siempre (rompió el CI propio tras la rebanada de budget).
