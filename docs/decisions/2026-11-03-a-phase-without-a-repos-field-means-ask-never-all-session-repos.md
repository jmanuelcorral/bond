---
id: "2026-11-03-a-phase-without-a-repos-field-means-ask-never-all-session-repos"
title: "A phase without a Repos field means ask, never all session repos"
status: "proposed"
date: "2026-11-03"
decided_by: "agent:pi/kevin"
accepted_by: ""
accepted_via: ""
supersedes: ""
superseded_by: ""
links:
  - "branch: feat/plan-phase-repos"
  - "head: d491926"
---


## Context

Deciding the semantics of the new `Repos` field for the case where a plan leaves it out. Opening every repo of the session is the convenient default and the dangerous one.

## Decision

A phase with no `Repos` field never means "every repo of the session": `plan-team` must ask the user which repos the phase opens before creating any branch, worktree or agent. In a repo without `hub.toml` the field is meaningless and `plan-team` says so and ignores it instead of failing.

## Rejected alternatives

Defaulting to all session repos when the field is absent: rejected — an agent working in a repo that was never in scope is worse than one extra question, and it silently widens the vertical branch. Failing hard on a plan without the field: rejected, plans written before hubs existed (and plain repos) would stop working.

## Consequences

plan-team's step 3 reads the field and step 5 / Hub mode state the ask-or-ignore rule; both are pinned by test/plan-phase-repos.test.mts.
