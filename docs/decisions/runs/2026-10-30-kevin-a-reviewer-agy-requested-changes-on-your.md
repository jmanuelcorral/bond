---
agent: "kevin"
kind: "pi"
branch: "plan/hub-ops-p10"
base: "plan/hub-session@337df84"
orchestrator: "claude"
started_at: "2026-10-30T13:39:13Z"
finished_at: ""
status: "sent"
commits: []
decisions: []
---

## Request

**2026-10-30T13:39:13Z**

A reviewer (agy) requested changes on your P10 branch. Fix these:
1 (blocker) cli/hub-init.mts hubAdd on an existing repo: re-running `bond hub add <target>` without --description drops the existing description and rebuilds the entry, losing agent and overwriting base with the clone's current branch (and calls resolve(target) even for URLs). Make an existing repo with the same config a no-op; with --description different from the current one, update only description, save hub.toml, refresh the AGENTS.md block and return, keeping agent, base and everything else. Test both cases.
2 (change) cli/repo.mts (~673-678 with ~841): when hub.toml exists but does not parse, the AGENTS.md block is treated as retired and emptied, contradicting the comment that says it is kept as is. Keep it (do not prune AGENTS.md from prev.blocks in that case). Test it.
3 (change) test/hub-init.test.mts:386-394: the test overwrites AGENTS.md (removing the block) and renames the repo key, so --check fails for the wrong reason. Prepend the manual text to the existing AGENTS.md and change only the description line, so --check fails because the block is stale; then sync and assert the block is updated and the manual text kept.
4 (nit) cli/hub.mts HUB_HELP: mention the description, as docs/reference.md does.
Same constraints as before (BOND_HOME=$(mktemp -d) for any manual bin/bond hub run; JSON.stringify for paths in test TOML; Spanish messages/docs, English commits). Plan file stays read-only. Run npm run typecheck, bun test and bin/bond sync --check; if all pass, I authorize one more commit on this branch (git-conventional-commit). No push, no PR. End with a report: each finding, what you changed (file:line) and the test that covers it, checks and results, commit SHA.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report


