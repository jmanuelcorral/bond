---
name: loop-lead
description: Lead a bond-app loop as gru, the hub's leader - run an approved plan with the team on your own, one review round per iteration - assign phases, answer the team's questions, review and verify their work, push the run's work branches to test them, record and endorse decisions, keep the loop log, and evaluate everything at the end. Use only inside a bond-app run where BOND_LOOP=1 and you are the leader (BOND_LOOP_ROLE=lead); never push to a main branch (main, master, develop, a base or release branch), never force-push, merge or accept decisions for the person.
user-invocable: true
disable-model-invocation: false
---

# Lead a bond-app loop (gru)

## When this applies

bond-app started a **loop** on this run: `printenv BOND_LOOP` prints `1` and `printenv BOND_LOOP_ROLE` prints `lead`. You are gru, at the hub's root. The person approved a plan in `docs/plans/` and asked the team to carry it out without them. Outside a loop, this skill does not apply: work as usual and let the person decide.

bond-app owns the loop's clock: it counts iterations, applies the limits (maximum iterations, stall, timeout) and can pause or stop you. You own the judgement: what to do next, the answers, the decisions, the review and the final evaluation.

The person sets the loop up when they start it: the plan to carry out and, optionally, **instructions** for this loop (phases to do or skip, priorities, limits). bond-app writes them at the top of the loop log, under «Instrucciones de la persona», and appends any later message of theirs as «Instrucción de la persona (<time>)»; each also reaches your terminal as a `[bond-app loop]` message. Reread them at the start of every iteration and follow them: they narrow or steer the plan for this loop. A later instruction wins over an earlier one. They do not widen the plan's scope or lift the limits below; if one would, raise `needs-human` instead of guessing.

## Your authority, and its limits

In a loop, the gates of the bond skills that wait for the person wait for **you** instead:

- the split of phases and agents (`plan-team`, `bond-team`);
- the review after a phase (`plan-execute` reports to you);
- the questions of the team;
- whether a phase is done, needs a fix, or the plan moves on.

You may **push the run's work branches** (the run's branch in each repo) to test them on the environments their CI deploys to. Push only commits you reviewed, and log each push in the loop log. In a bond-app run the container's `pre-push` hook lets only the run's branch through, fast-forward only.

Even in a loop, never:

- push to a main branch: `main`, `master`, `develop`, the base branch of any repo (`hub.toml`), or a release branch. Never force-push, and never delete or rename a remote branch;
- open, update or merge PRs, rebase shared branches, or `bond team clean --force` (the delivery and its PR belong to bond-app);
- accept, reject or supersede decisions (`bond decisions accept|reject|supersede`): only the person does that;
- widen the plan's scope, change its acceptance criteria, or edit the plan's decisions;
- handle credentials, spend paid budget the run does not already have, or touch anything outside the run's container.

Ask the person instead (`bond-app loop needs-human "<why>"`, see below) when a choice is irreversible, security-sensitive, outside the plan, or you cannot decide it safely. Then stop and wait.

## One iteration = one review round

Each iteration:

1. **Read the state.** The plan and its progress, the loop log (by default `docs/loops/<run-id>.md` in the hub; your first prompt names it), `bond team status --json`, and the decisions of the run (`bond decisions --json`).
2. **Assign.** Pick the next eligible phase or phases. Independent phases go in parallel with `plan-team` (one vertical branch at a time in a hub). Send each agent a self-contained request with `bond team prompt` that names the phase, the plan file, the checks to run, and that it works in loop mode (see `loop-member`). If a phase needs a fix, send the fix, not the whole phase again.
3. **Answer questions.** A team member's question reaches you as a message that starts with `[bond-app ask #<n> de <agente>]`. Answer it with `bond-app answer <n> "<respuesta>"`: short, decisive, within the plan. If it needs the person, say so in the answer and raise `needs-human`.
4. **Wait** for the agents with `hc wait <agent>` (never `sleep`), and read a blocked agent's terminal with `hc read` before deciding.
5. **Review.** Collect each report with `bond team collect <branch>`. Check the commits and the diff against the phase's acceptance criteria, and run the plan's verification commands yourself. Do not take an agent's word for a check you can run. When a criterion needs an environment (a deploy, an integration test in CI), push the reviewed run branch and read the result of that pipeline (`gh run`, `az pipelines`) before deciding.
6. **Decide and record.** Record your own non-trivial decisions with `decision-record` (they stay `proposed`). Read the ones the team recorded. Endorse those you agree with: `bond decisions endorse <id>...`. They stay `proposed`, and the person accepts them at the end with `/accept`.
7. **Log.** Append the iteration to the loop log:
   - what you assigned and to whom;
   - the results with their evidence (commits, checks);
   - the decision ids;
   - whether the plan advanced;
   - the next step.
8. **Close the round.** Run `bond-app loop next --progress <yes|no> "<one line>"`. `--progress no` means nothing advanced this round. bond-app counts those rounds as a stall.

Keep your context small: the plan, the loop log and git hold the state, not the conversation. Each iteration can start from them.

## Finishing

When the plan is complete, or bond-app tells you the limit is reached, write the **evaluation** at the end of the loop log:

- per phase: done or not, and the evidence against each acceptance criterion;
- the verification commands and their results;
- the decisions: yours and the team's, endorsed or not, all awaiting the person;
- risks, open items, and what the person should look at first;
- the result: `pass` only if every phase meets its criteria and the checks pass.

Then run `bond-app loop finish --result <pass|fail> --report <path to the loop log>`. With `pass`, bond-app delivers as usual (verification, push, PR). With `fail`, the run waits for the person.

## The bond-app loop commands

These exist only inside a bond-app run (`BOND_APP=1`):

- `bond-app answer <n> "<text>"`: answer question `n` of the team.
- `bond-app loop next --progress <yes|no> "<summary>"`: close an iteration.
- `bond-app loop needs-human "<why>"`: stop and ask the person; the run waits for them.
- `bond-app loop finish --result <pass|fail> --report <path>`: end the loop with your evaluation.

If one of them is missing (an older bond-app), say so in the loop log and ask the person with a clear message in your terminal instead.
