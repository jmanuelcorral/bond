---
agent: "kevin"
kind: "claude"
branch: "plan/agy-support-p1"
base: "main@596d87e"
orchestrator: "claude"
started_at: "2026-10-28T15:03:55Z"
finished_at: "2026-10-28T15:26:12Z"
status: "reported"
commits:
  - "be7395d feat(agents): support Antigravity (agy) in bond init, sync and doctor"
decisions:
  - "2026-10-28-agy-sin-instrucciones-globales-hasta-el-plugin-global"
---

## Request

**2026-10-28T15:03:55Z**

Use the plan-execute skill to implement only P1 of docs/plans/2026-10-28-agy-support.md (revision 596d87e). This is a linked worktree: treat the plan file as read-only and report progress in your answer. Antigravity's CLI is installed at ~/.local/bin/agy (not on the PATH of non-interactive shells; call it by full path) and its bundled docs are in ~/.gemini/antigravity-cli/builtin/skills/agy-customizations/docs/. For the real check, run agy -p in a temporary repo, never in this one. Do not touch ~/.gemini/config/. When testing commands that read stdin from a child process, never use execFile with 'input'; always set a timeout. If all of the phase's verification passes, I explicitly authorize one commit on this branch with the git-conventional-commit skill, using the message you would recommend; do not push, open a PR or start another phase. If verification fails or is blocked, do not commit. End with a report: what changed, checks run and their results, acceptance criteria met, risks, and the commit SHA or why there is none.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report

# P1 report: `agy` as a repo agent (`docs/plans/2026-10-28-agy-support.md` @ 596d87e)

P1 is done. Every check passed, and I made the one authorized commit: **`be7395d`** on `plan/agy-support-p1`. I didn't push, open a PR or start P2. The plan file is unchanged because this is a linked worktree, so the progress is in this report.

## What changed
- **Agent entry** (`cli/catalog-agents.mts`, `cli/repo.mts`): `agy` ("Antigravity") is now a supported agent. It appears in the help, in the `bond.toml` agent list and in `bond setup`'s detection.
- **Plugin in the repo** (`plan()` in `cli/repo.mts`): with `agy` among the agents, `bond sync` writes `.agents/plugins/bond/` with three things:
  - `plugin.json`.
  - `mcp_config.json`, with the catalog servers and the repo's own `[mcp_servers]` entries. `${VAR}` values are copied as-is.
  - `skills/<command>/SKILL.md`, one per catalog or repo command. Each has a valid YAML frontmatter, and `$ARGUMENTS`, `$@` and `$1…` become an instruction to use the text typed after `/command`.
- **Doctor row** (`cli/doctor.mts`): it shows `agy` with its version when `agy` is one of your agents or the repo's. It warns in two cases, each with a fix:
  - `agy` isn't installed: it shows the install command.
  - `agy` is in `~/.local/bin` but not on the PATH: it says to add that folder to the PATH.
- **Change beyond the plan, recorded as a decision**: `AgentInfo.instructions` is now optional and `agy` doesn't set it. Otherwise `bond setup` would create a global plugin folder with no `plugin.json` before P2 exists.
  - Decision: `docs/decisions/2026-10-28-agy-sin-instrucciones-globales-hasta-el-plugin-global.md`, status **proposed, waiting for your acceptance**.
- **Two small extras**:
  - `bond init` no longer prints an empty "trust" step when none of the chosen agents asks for trust.
  - `code-context` now says that under agy the tools are named `bond_context7` and `resolve-library-id`. The plan asked for this naming check in P1. I synced the skill into this repo with `bond sync`.
- **Docs**: `docs/reference.md`, `docs/en/reference.md` and an entry under `## Sin publicar` in `CHANGELOG.md`. I left the README, getting-started pages and taglines for when P2 and P3 finish the support.
- **Tests**: 5 new ones in `test/repo.test.mts` and 3 in `test/doctor.test.mts`.

## Checks
| Check | Result |
|---|---|
| `npm run typecheck` | passed, no errors |
| `bun test` | 314 passed, 0 failed |
| `bin/bond sync --check` in this repo | up to date |
| `bin/bond decisions check` | 27 decisions, no errors |
| Temp repo (scratchpad): `bin/bond init --agents agy --yes`, then `sync --check` and a second `sync` | plugin with 2 MCP servers and 4 commands; both commands reported up to date |
| `agy -p` (1.4.9) in the temp repo, stdin closed, with a timeout | it sees `bond_context7` and `bond_duckduckgo` with their tools, and the plugin skills `accept`, `commit`, `handoff` and `review` |
| `agy -p "/review ortografía del saludo …"` | runs the plugin's `review` skill and quotes the focus text exactly |
| Remove `agy` from the temp repo, then `sync` | `.agents/plugins/bond/` is gone, another plugin `mio/` is untouched, `--check` up to date |
| `bond doctor --quick` in three states | `✓ agy 1.4.9` when on the PATH; a warning plus fix when only in `~/.local/bin`; "no está instalado" plus the install command when missing |

`~/.gemini/config/` was not touched, and I deleted the temporary repos.

## Acceptance criteria
All 6 are met:
- Init generates the plugin; `sync --check` is up to date and a second `sync` changes nothing.
- Removing `agy` deletes only bond's plugin.
- The repo's own MCP servers (stdio and URL) go into `mcp_config.json` with `${VAR}` unexpanded.
- Each command is a valid skill and the text after `/command` replaces `$ARGUMENTS`.
- Doctor shows the version, and warns with a fix when `agy` is off the PATH.
- The real `agy -p` check works.

## Risks
- **`headers` on URL servers**: I copy them into `mcp_config.json`, but agy's docs don't mention that key. Covered by a unit test, not tested against agy.
- **Install command** (`curl -fsSL https://antigravity.google/cli/install.sh | bash`): it comes from third-party guides, not from Google's own docs.
- **Shell commands from command-skills**: in `agy -p` (headless) mode, they're denied unless you add permission rules. That matters for P3 rather than here.
- **No global instructions for `agy` yet**: until P2, `bond setup` gives it no global rules.
- **Windows**: the `~/.local/bin/agy.exe` path is only covered by CI.

## Commit
`be7395d feat(agents): support Antigravity (agy) in bond init, sync and doctor`. It covers 13 files, including the decision file, with the trailers `Agent: claude/kevin` and `Decision: 2026-10-28-agy-sin-instrucciones-globales-hasta-el-plugin-global`.

**Next step:** review P1 and accept or reject the proposed decision. Once P1 is accepted, P2 and P3 can run in parallel. Short reply: «acepta la decisión y revisa P1», or «para».

Sources for the install command:
- [computingforgeeks – Antigravity CLI cheat sheet](https://computingforgeeks.com/antigravity-cli-cheat-sheet/)
- [pasqualepillitteri.it – Antigravity CLI install](https://pasqualepillitteri.it/en/news/3422/antigravity-cli-agy-install-migrate-gemini-cli)
- [DEV Community guide](https://dev.to/arindam_1729/antigravity-cli-a-hands-on-guide-to-googles-terminal-coding-agent-5bc7)
