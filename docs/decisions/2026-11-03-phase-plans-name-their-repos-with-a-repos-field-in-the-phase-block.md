---
id: "2026-11-03-phase-plans-name-their-repos-with-a-repos-field-in-the-phase-block"
title: "Phase plans name their repos with a `- Repos:` field in the phase block"
status: "accepted"
date: "2026-11-03"
decided_by: "agent:pi/kevin"
accepted_by: "Approve both proposed decisions: phase-plans-name-their-repos-with-a-repos-field-in-the-phase-block and a-phase-without-a-repos-field-means-ask-never-all-session-repos"
accepted_via: "agent:pi/gru"
supersedes: ""
superseded_by: ""
links:
  - "branch: feat/plan-phase-repos"
  - "head: d491926"
---


## Context

`bond team --repos front,back` already worked in a hub and the `plan-team` skill already said it would open "the repos the plan says the phase touches", but the plan template had no field for it (issue #44). Each agent wrote the repo list wherever it felt like and readers guessed.

## Decision

A phase block in the local plan template carries `- Repos: front, back` right next to `Affected contracts`, using the paths or folder names declared in `hub.toml`. `plan-create` writes it and validates every name against the session at planning time (`bond hub --json`); `plan-team` reads it and passes it to `bond team --repos`; `plan-execute` names it in its hub report. Outside a hub (no `hub.toml`) the field does not apply and is ignored with a notice.

## Rejected alternatives

A column in the Progress table: rejected, that table is state (implemented/verified/reviewed), not design, and it is rewritten during execution. A separate top-level section per phase: rejected, heavier than a line and it separates the repos from the contracts they belong to.

## Consequences

The field is a contract between three catalog skills; `test/plan-phase-repos.test.mts` pins its shape, its position in the template and the wording of the skills that consume it, plus `bond sync` propagation. Docs: `docs/reference.md` and `docs/en/reference.md` under `bond team` in a hub.
