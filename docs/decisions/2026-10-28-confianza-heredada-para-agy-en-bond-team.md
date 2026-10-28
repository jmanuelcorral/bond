---
id: "2026-10-28-confianza-heredada-para-agy-en-bond-team"
title: "Confianza heredada para agy en bond team"
status: "accepted"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: "chat 2026-10-28: «aprueba y guarda» (plan de agy) y «acepta A1–A4, commitea y manda P1 a claude»"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
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
