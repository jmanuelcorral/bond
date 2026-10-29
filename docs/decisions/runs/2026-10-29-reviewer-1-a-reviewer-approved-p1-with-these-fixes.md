---
agent: "reviewer-1"
kind: "pi"
branch: "plan/hub-session-p1"
base: "plan/hub-session@4ffbb62"
orchestrator: "claude"
started_at: "2026-10-29T18:40:20Z"
finished_at: ""
status: "sent"
commits: []
decisions: []
---

## Request

**2026-10-29T18:40:20Z**

A reviewer approved P1 with these fixes. Apply them on this branch (same rules: plan file read-only, no push, no PR, no other phase):
1. should-fix: hasHub/hubRoot/repoHub print the "[hub] inválida" warning on every call (cli/hub.mts:53, cli/repo.mts:443-447); in P2 the --watch table will call them every 2 s and spam stderr. Make hasHub detect [hub] without warning (e.g. catchDie(() => parseHub(...))); keep the warning for config readers and bond hub itself.
2. should-fix: add a test for --dry-run (no write, shows the block).
3. should-fix: add an explicit no-regression test: in the fixture without [hub], bond team status gives the same rows as before.
4. nit: trim the path in --base <path>=<ref> (cli/hub.mts:179).
5. nit: "sin base para A, B: está en HEAD separado" -> "están" when plural (cli/hub.mts:244).
6. nit: document in docs/reference.md that with nested [hub] sections the outermost hub wins.
Run npm run typecheck && bun test. If they pass, I authorize one more commit (git-conventional-commit, e.g. "fix(hub): ..."). Report what changed, checks and the SHA.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report


