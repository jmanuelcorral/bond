---
name: decision-record
description: "Record non-trivial decisions (the user's or an agent's) in the repo's decision memory when .bond/bond.toml has a [decisions] section, using the record_decision tool (pi) or `bond decisions add` — never by hand-writing files — plus git trailers (\"Agent:\" and \"Decision:\") and linked runs. Use when a contract, dependency, scope, or design alternative is settled, or when asked to record a decision. Do not use in repos without the [decisions] section."
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
its final form. Only the user's approval makes a decision `accepted`; an agent never
accepts its own decision on its own, and never rewrites the user's records except to link them.

**Never write decision files by hand.** Local models do not follow file formats reliably;
bond's tooling does the writing (id computation, frontmatter, authorship). You pass
the content; bond writes the record.

## When to record — and when not to

Record when a choice is non-trivial, i.e. it changes or fixes any of:

- a contract (API, file format, CLI surface, plan structure);
- a dependency (adding, dropping, pinning, or choosing between alternatives);
- the scope or acceptance criteria of ongoing work;
- a design alternative that was considered and rejected with real cost.

Do **not** record: routine implementation details, obvious refactors, preferences already
documented in `AGENTS.md`, anything reversible without a trace, or one-off observations. If
in doubt, leave it out; noise is worse than a gap, and `bond decisions check` (and
`bond doctor`) count how many `proposed` records await review.

## Procedure

1. Confirm the repo has `[decisions]` in `.bond/bond.toml` and read its `dir`. Create
   nothing outside it. If the directory or its `README.md` is missing, run `bond sync`.
2. Decide whether the fact meets the criteria above. If it does not, say so briefly and stop.
3. Record it with the tool, passing only the content — never by writing the file yourself:
   - in pi: the `record_decision` tool (`title`, `context`, `decision`, `alternatives`, `links`);
   - anywhere else (or from a script): `bond decisions add --title "..." --context "..."
     --decision "..." --alternatives "..." --link "kind: value"` (repeat `--link` per
     reference), or the same object as JSON on stdin with `--stdin`.
   bond computes the id (`YYYY-MM-DD-slug`, suffix `-2` on same-day collision), the
   authorship (`decided_by` from your Herdr pane — you do not need to know your own name;
   outside Herdr it is `user`), links the current branch and HEAD, and writes
   `<dir>/<id>.md` in the format documented in the
   [decision template](references/decision-template.md). There is no shared index file:
   `bond decisions` lists the records, so parallel branches never conflict over a README.
   A decision enters as `proposed` unless the user already approved it.
4. Accept on approval: when the user has explicitly approved the decision in the
   conversation — for example by approving the plan that contains it — record it already
   accepted, quoting their words: `confirmed_by` in `record_decision`, or
   `bond decisions add ... --confirmed-by "<what the user said>"`. It keeps `accepted_by`
   with that quote and `accepted_via` with your authorship; do not ask the user to accept
   it again. Decisions you take on your own while working (not approved by the user) stay
   `proposed` for review. To accept those later from the conversation, the
   `/accept` command lists the `proposed` records, asks which ones the user wants, and
   runs `bond decisions accept <id>... --confirmed-by "<what the user said>"` — the
   record then keeps `accepted_by` with that reference and `accepted_via` with whoever
   executed it (`agent:<kind>[/<name>]` from a Herdr pane, `user` outside). `reject`
   and `supersede <id> --by <new>` take the same options. You may run accept/reject/
   supersede with `--confirmed-by` only on an explicit, unambiguous user request in the
   conversation, quoting their words; never on your own initiative. Without a terminal
   and without `--confirmed-by`, the commands refuse. Never fabricate `accepted_by`,
   and never invent a model name in any field.
5. Fill the content well: context in two or three factual sentences, the decision stated so
   it can be applied without rereading the conversation, only real rejected alternatives
   with their cost. Write in the language established by the project. `links` entries are
   `kind: value` strings (plan, phase, commit, pr, run); omit what does not exist yet
   rather than leaving dangling references.
6. When the decision is implemented in the same work, add the git trailers to the commit
   (see the `git-conventional-commit` skill, which honors trailers the project asks for):
   - `Agent: <kind>[/<name>]` — who made the commit;
   - `Decision: <id>` — the decision the commit applies.
   Only add trailers in repos with decision memory enabled.
7. Check the record if in doubt: `bond decisions show <id>` and `bond decisions check`
   report broken files, duplicate ids and dangling references (non-zero exit on errors).
   Do not fight concurrent edits by hand; re-run the tool instead.
8. Decisions travel with the branch. In a worktree or feature branch, the files you record
   under `<dir>/` belong to that branch: commit them together with the work they belong to
   so they integrate and get reviewed in the PR. Never write in the plan or in `<dir>/runs/`
   from a branch agent.
9. Report the created id, its status, and any links. If the decision awaits user
   acceptance, say so ("proposed, awaiting your acceptance"). Do not present a `proposed`
   decision as agreed.

## Runs (delegation records)

Runs are the requests sent to agents by `bond team` / `bond-delegate` and their reports,
stored under `<dir>/runs/`. The **orchestrator** writes them in the main checkout; the
branch agent never writes its own run (it reports in its answer instead). `bond team
collect` takes the report from the agent's session file (for pi, the `.jsonl` Herdr
reports in `agent_session`) and keeps only its last answer; when no session file is
readable it falls back to the agent's pane, trimmed of the startup banner and notices.
When collecting a report by hand in a repo with decision memory, save it with the
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
