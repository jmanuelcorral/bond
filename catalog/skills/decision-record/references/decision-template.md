# Decision file template

bond writes this file for you (`record_decision` or `bond decisions add`); this template
documents the format it produces and the section conventions, so you can review and link
records. One decision per file: `<dir>/YYYY-MM-DD-<slug>.md`. The **id** is the filename
without extension (e.g. `2026-10-28-decision-ids`). Same id taken on the same day: suffix
`-2`. Write the body content in the language established by the project; the section names
below are the convention (Context / Decision / Rejected alternatives / Consequences).

```markdown
---
id: "2026-10-28-example-slug"
title: "Short, searchable title of the decision"
status: "proposed"        # proposed | accepted | rejected | superseded
date: "2026-10-28"       # actual UTC date of the decision
decided_by: "agent:pi/worker-2"   # user | agent:<kind> | agent:<kind>/<herdr-name>
accepted_by: ""          # reference to the user's acceptance (session, PR review, issue)
accepted_via: ""         # who executed the acceptance from the conversation (D20): user | agent:<kind>[/<name>]
supersedes: ""           # id of the decision this one replaces
superseded_by: ""        # id of the decision that replaces this one
links:
  - "plan: docs/plans/2026-10-28-example.md#p2"
  - "commit: abc1234"
  - "pr: https://github.com/org/repo/pull/42"
  - "run: runs/2026-10-28-pi-worker-2-example.md"
---

## Context

What situation made this decision necessary, in two or three sentences. Facts, not narrative.

## Decision

The decision itself, stated so it can be applied without rereading the conversation.

## Rejected alternatives

Each alternative considered, and why it was rejected. Only real alternatives with real
cost; "we thought about X but it breaks Y" is worth recording, "we didn't consider Z" is not.

## Consequences

What this decision implies going forward: migrations, new constraints, follow-up work,
things that stop being allowed.
```

## Field rules

- `status` starts as `proposed` for agent-made decisions. Only the user's real approval
  makes it `accepted` — at record time (`--confirmed-by` on `add`, when the user already
  approved it) or later with `accept` — with `accepted_by` quoting it.
- `accepted_via` is optional: it appears when the acceptance ran from the conversation with
  `--confirmed-by` (D20) and records who executed it (`user` outside Herdr,
  `agent:<kind>[/<name>]` from a Herdr pane). Decisions accepted in an interactive
  terminal may have it empty; `bond decisions check` validates its format only when present.
  Audit trail: `accepted_by` says what the user asked, `accepted_via` says which agent ran
  it — a wrong acceptance is visible in git and can be reverted with `supersede` or
  `git revert`.
- `decided_by` never carries an invented model name or version. Known Herdr pane name goes
  after the slash: `agent:claude/lead`; unknown: `agent:claude`.
- `links` entries are `kind: value` strings (plan, phase, commit, pr, run). Omit what does
  not exist yet rather than leaving dangling references; add them when they appear.
- Superseding: set `supersedes` in the new file, `superseded_by` plus `status:
  "superseded"` in the old one. Never delete an old record.
- No secrets, tokens, private data or transcripts in any field or in the body.
