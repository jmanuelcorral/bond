---
name: decision-record
description: Record non-trivial decisions (the user's or an agent's) as dated Markdown files in the repo's decision memory when .bond/bond.toml has a [decisions] section, with the id/status/frontmatter format, git trailers (Agent: and Decision:), and linked delegation runs. Use when a contract, dependency, scope, or design alternative is settled, or when asked to record a decision. Do not use in repos without the [decisions] section.
user-invocable: true
disable-model-invocation: false
---

# Record a decision

## Requirements and boundaries

This skill applies only when the repo enables decision memory: a `[decisions]` section in
`.bond/bond.toml` (its `dir`, by default `docs/decisions`, is where records live). Check
first; without the section, behave as usual and record nothing. The directory and its
`README.md` are created by `bond sync`; after that they belong to the project.

Record decisions as data, not as conversation. Do not store secrets, private transcripts,
or the agent's internal reasoning: a record states what was decided, by whom, and why, in
its final form. Only the user can set a decision's status to `accepted`; an agent never
marks its own decision accepted, and never rewrites the user's records except to link them.

## When to record — and when not to

Record when a choice is non-trivial, i.e. it changes or fixes any of:

- a contract (API, file format, CLI surface, plan structure);
- a dependency (adding, dropping, pinning, or choosing between alternatives);
- the scope or acceptance criteria of ongoing work;
- a design alternative that was considered and rejected with real cost.

Do **not** record: routine implementation details, obvious refactors, preferences already
documented in `AGENTS.md`, anything reversible without a trace, or one-off observations. If
in doubt, leave it out; noise is worse than a gap, and `bond decisions` counts how many
`proposed` records await review.

## Procedure

1. Confirm the repo has `[decisions]` in `.bond/bond.toml` and read its `dir`. Create
   nothing outside it. If the directory or its `README.md` is missing, run `bond sync`.
2. Decide whether the fact meets the criteria above. If it does not, say so briefly and stop.
3. Read the [decision template](references/decision-template.md). Create one file per
   decision: `<dir>/YYYY-MM-DD-<slug>.md` (today's actual UTC date, short kebab slug).
   The **id** is the filename without extension. If a file with the same id already exists,
   append `-2`, `-3`, … If the decision supersedes an existing one, set `supersedes` here
   and `superseded_by` in the old file (and update its `status`).
4. Set the frontmatter honestly:
   - `status`: `proposed` when an agent decided it and the user has not confirmed it yet;
     `accepted` only with a real, referenced acceptance from the user (session, PR review,
     issue comment). `rejected` and `superseded` when applicable.
   - `decided_by`: `user`, or `agent:<kind>` (e.g. `agent:pi`, `agent:claude`) adding
     `/<name>` when the agent's Herdr pane name is known. Never invent a model name.
   - `links`: the plan and phase, the commit(s) implementing it, the PR, and the run file
     when it came from a delegation. Use what exists; leave the rest empty rather than
     fabric references.
5. Fill the body: Context, Decision, Rejected alternatives, Consequences. Keep it short and
   durable; write in the language established by the project.
6. When the decision is implemented in the same work, add the git trailers to the commit
   (see the `git-conventional-commit` skill, which honors trailers the project asks for):
   - `Agent: <kind>[/<name>]` — who made the commit;
   - `Decision: <id>` — the decision the commit applies.
   Only add trailers in repos with decision memory enabled.
7. Update the index table in `<dir>/README.md` with the new row (newest first). If the
   README has no table, leave it; do not fight concurrent edits — re-read before writing.
8. Report the created file, its status, and any links. If the decision awaits user
   acceptance, say so ("proposed, awaiting your acceptance"). Do not present a `proposed`
   decision as agreed.

## Runs (delegation records)

Runs are the requests sent to agents by `bond team` / `bond-delegate` and their reports,
stored under `<dir>/runs/`. The **orchestrator** writes them in the main checkout; the
branch agent never writes its own run (it reports in its answer instead). When collecting a
report in a repo with decision memory, save it with the
[run template](references/run-template.md): `<dir>/runs/YYYY-MM-DD-<agent>-<slug>.md`,
with the exact request text, the report trimmed to its final part and free of secrets, and
`decisions:` linking any decisions the report brought (as `proposed`).

## Guided handoff

End with the result, one recommended next step, and a short reply in the consumer's
language. After recording, recommend reviewing the file and continuing the current task; if
the decision awaits acceptance, recommend accepting or rejecting it. When the record
accompanies implementation, return to that workflow's commit step, which carries the
trailers. Never claim the actual agent is bond or invent model metadata, and do not add
branding, attribution footers, or promotional text to consumer files.
