---
agent: "kevin"
kind: "agy"
branch: "plan/hub-session-p2"
base: "plan/hub-session@214a0c5"
orchestrator: "claude"
started_at: "2026-10-29T19:25:01Z"
finished_at: ""
status: "sent"
commits: []
decisions: []
---

## Request

**2026-10-29T19:25:01Z**

A reviewer requested changes on your P2 commit e5d2147. Fix them on this branch (plan file read-only, no push, no PR, no other phase):
1. BLOCKER: teamRows resolves hubRoot internally and returns the whole session to every caller (prompt, collect, clean, create), so in a hub `prompt fix/x` can pick the wrong repo's agent and `clean` can remove worktrees in every repo. Keep teamRows per repo, exactly as before P2 (same signature, no hubRoot inside). Add a new exported `sessionRows(root: string, base?: string): Row[]` that, when root or a superproject has [hub], returns the rows of every repo of the session (each with `repo` and `base` set, using each repo's base from [hub]) and otherwise returns teamRows(root, base). Use sessionRows ONLY in status, --watch (watch/renderWatch/printStatus), watchIdle and the table auto-close. P3 (another branch) will reuse this exact sessionRows for prompt/collect/clean, so keep it small, pure and documented.
2. In hub mode, reject --base for status and --watch with a clear message (each repo uses its base from [hub]); keep watchCommand consistent.
3. A repo whose [hub] base does not exist must not kill the whole table: warn once per repo (not every 2 s tick) and skip that repo.
4. Tests: watchIdle with multi-repo rows (one repo busy -> busy; all integrated -> close); no-regression test that rows without hub have no repo/base keys in --json and the header has no REPO column; openWatch/findWatchPane reuse of `tabla · <hub>` from a submodule.
5. nit: callerTab/create look up the table with basename(root); in a hub use the hub's name.
Run npm run typecheck && bun test. If they pass, I authorize one more commit with git-conventional-commit. Report what changed, checks and the SHA.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report


