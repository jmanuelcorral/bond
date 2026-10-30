---
agent: "kevin"
kind: "pi"
branch: "plan/hub-guided-p8"
base: "plan/hub-session@aa7ead4"
orchestrator: "claude"
started_at: "2026-10-30T08:52:43Z"
finished_at: ""
status: "sent"
commits: []
decisions: []
---

## Request

**2026-10-30T08:52:43Z**

The orchestrator ran P8's manual end-to-end test (bond hub init with a submodule and a symlink -> check -> bond team fix/x -> prompt -> collect --repo -> clean) and found these bugs. Fix them on this branch, each with its own test (plan files read-only, no push, no PR):
H1: `bond hub init` leaves the hub without any commit, so `bond hub check` reports that the hub's base "main" does not exist; it also leaves the hub's new .bond/bond.toml with pending agent config (check: "1 cambio(s) de config de agente pendientes"). After creating the hub, init must run the equivalent of `bond sync` for the hub and make an initial commit of the hub files (hub.toml, .gitmodules, .gitignore, AGENTS.md, .bond/ and the generated agent config) when the hub repo has no commits yet; with --dry-run, only say it. Never commit in a pre-existing hub with commits without asking.
H2: `bond hub check --fix --yes` fails with "opción desconocida: --yes", but the plan says --fix asks before each change unless --yes. Add --yes (and make --fix interactive without it when there is a TTY).
H4: the first `bond team prompt` to freshly started pi agents is lost: Herdr returns agent_prompt_stalled ("no observed working or blocked state within 5000 ms; current status is idle") and the pane shows nothing received; bond only warns. In promptAgent (cli/team.mts), when the result is agent_prompt_stalled and the pane shows no sign the prompt arrived, wait briefly and retry ONCE; if it still stalls, fail with a clear message instead of a warning. This applies to hub and non-hub prompts.
H5: `bond hub init` does not add [decisions] to the hub's .bond/bond.toml, so runs fall back to each submodule (one of them is the user's real clone behind the symlink). Make init propose decision memory for the hub like `bond init` does (on by default with --yes), so runs land in the hub (D5).
Any manual run of bin/bond must use a temporary BOND_HOME (export BOND_HOME=$(mktemp -d)). Run npm run typecheck && bun test and bin/bond sync --check. If they pass, I authorize one more commit with git-conventional-commit. Report what changed, checks and the SHA.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report


