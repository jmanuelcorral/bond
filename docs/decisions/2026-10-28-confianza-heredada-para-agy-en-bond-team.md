---
id: "2026-10-28-confianza-heredada-para-agy-en-bond-team"
title: "Confianza heredada para agy en bond team"
status: "superseded"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: "usuario en sesión el 2026-10-28: «a partir de ahora si el orquestador confia en el repo, hagamos que el resto de agentes confien» y «si funcona con trustedWorkspaces perfecto»"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: "2026-10-28-la-confianza-del-orquestador-vale-para-todo-el-equipo"
links:
  - "plan: docs/plans/2026-10-28-agy-support.md#A4"
  - "branch: main"
  - "head: d2893a9"
---


## Context

Tomada por el usuario en sesión el 2026-10-28 al aprobar el plan de soporte de Antigravity (docs/plans/2026-10-28-agy-support.md, «aprueba y guarda»); la registra el orquestador (Claude).

## Decision

Un worktree de bond team con agy hereda la confianza si el checkout principal está en trustedWorkspaces de ~/.gemini/antigravity-cli/settings.json; --no-trust la desactiva, como con pi y Claude Code.

## Rejected alternatives

Dejar que agy pregunte en cada worktree (bloquea el equipo).
