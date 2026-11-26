---
name: loop-member
description: Work as a team member of a bond-app loop - carry out the phase gru, the loop's leader, sends you with plan-execute, commit it on your branch when its checks pass, ask gru (not the person) when something is unclear with bond-app ask, record decisions as proposed, and report back to gru. Use only inside a bond-app run where BOND_LOOP=1 and your role is member (BOND_LOOP_ROLE=member); never push, open PRs or accept decisions.
user-invocable: true
disable-model-invocation: false
---

# Work in a bond-app loop (team member)

## When this applies

bond-app runs a **loop** on this run: `printenv BOND_LOOP` prints `1` and `printenv BOND_LOOP_ROLE` prints `member`. gru, the hub's leader, assigns you phases of an approved plan and reviews your work. The person is not watching. Outside a loop, this skill does not apply.

## How you work

1. **Do the phase you were given**, and only that one, with `plan-execute`. In a loop:
   - its review gate is gru, not the person;
   - you are authorized to make **one commit per phase** on your branch, with `git-conventional-commit`, once the phase's checks pass;
   - treat the plan file as read-only (gru keeps its progress).
2. **When something is unclear, ask gru**, never the person and never as a question in your chat that waits for an answer:

   ```
   bond-app ask "<one self-contained question, with the options you see>"
   ```

   It waits until gru answers and prints the answer: go on with it. If `bond-app ask` is missing, end your answer with a last line `PREGUNTA: <question>` and stop. gru will read it.
3. **Decisions**: record the non-trivial ones with `decision-record`. They stay `proposed`. gru endorses them and the person accepts them at the end. Never run `bond decisions accept|reject|supersede`.
4. **Checks**: run the phase's verification commands yourself and report their real output. Never mark a check you did not run as passed.

## Never, even in a loop

- push (gru pushes the run's branches once it has reviewed them), open or update PRs, merge, rebase or delete branches;
- touch other repos, other agents' worktrees, or the plan's decisions and scope;
- wait for the person: if gru cannot answer, it asks the person itself.

## When you finish

End with a short report for gru, as your final answer:

- the phase;
- the commit(s) with their hashes;
- the checks you ran and their results;
- the decisions you recorded (ids);
- anything left open or that gru should look at.

Then stop. gru collects it (`bond team collect`) and decides what comes next.
