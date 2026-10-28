# Run file template

A **run** is one delegation to an agent: the request sent and the report received. Stored
by the orchestrator in the main checkout at `<dir>/runs/YYYY-MM-DD-<agent>-<slug>.md`
(`<agent>` = the agent's Herdr name or kind, `<slug>` = short description of the task).
The branch agent never writes its own run; it reports in its answer and the orchestrator
saves that here.

```markdown
---
agent: "worker-2"          # Herdr pane name; kind if no name
kind: "pi"                 # pi | claude | codex | ...
branch: "feat/example"
base: "main@abc1234"       # branch and base commit the work started from
orchestrator: "claude/lead" # who sent the delegation (kind/name)
started_at: "2026-10-28T09:15:00Z"
finished_at: ""            # actual UTC timestamp when the report was collected
status: "sent"             # sent | reported | integrated | failed
commits: []                # commits the run produced on its branch
decisions: []              # decision ids the run brought or applied (proposed unless accepted)
---

## Request

The exact text sent to the agent, verbatim. No edits, no summarizing.

## Report

What the agent answered, trimmed to its final part: outcome, evidence (checks run,
results), and any decisions it raised. Cut secrets, logs dumps and private data before
saving. If the report is pending, leave this section empty and `status: "sent"`.
```

## Rules

- One file per delegation; a second request to the same agent on the same task appends to
  the same run's Request section (with a timestamp) instead of creating a new file.
- `commits` and `decisions` are filled when collecting the report; decisions the run
  brought are recorded as separate files in `<dir>/` with `links: run: ...` and listed
  here by id.
- `status: integrated` only when the branch was actually merged/fast-forwarded.
- Paths inside the file use `/` (they are committed and must work on Windows too).
- No secrets, no full logs, no private transcripts in either section.
