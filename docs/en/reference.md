# bond reference

This is the page for when you already know what you want to do and need the details: every
command, what it writes and where, and why it works that way. If you are just starting, go
through [getting started](getting-started.md) and [the workstation](workstation.md) first;
you will come back here to look things up. Missing something, or something does not match what
you see? Open an [issue on GitHub](https://github.com/jmanuelcorral/bond/issues).

## Commands

| Command | What it does |
|---|---|
| `bond setup` | Once per machine: Herdr, model endpoints, agents; applies models, integrations, skills and instructions ([below](#bond-setup)) |
| `bond init` | Once per repo: agents, default agent and tools; generates each agent's config ([below](#per-repo-configuration-bond-init-and-bond-sync)) |
| `bond` | Inside a repo: opens its workstation in Herdr ([workstation.md](workstation.md)) |
| `bond dev <dir>` | The same for another directory |
| `bond team` | One agent per branch, each in its own worktree (in Herdr, 4 in your tab and the rest in new tabs, or whatever you choose); `status` (`--watch`: live table grouped by status, which closes on its own when no work is pending), `prompt` (with `[decisions]` it records the request in a run; `--no-record` skips it), `collect` (stores the agent's last answer into the run: from its session file, or from the trimmed pane), `clean` (removing the last one also closes the table) ([workstation.md](workstation.md#bond-team)) |
| `bond status` | Live agents in Herdr |
| `bond sessions` | pi sessions and how to resume them |
| `bond sync` | Regenerates the repo's agent config from `.bond/bond.toml` |
| `bond decisions` | The repo's decision memory: list, `add`, `accept`, `show`, `runs`, `check` ([below](#bond-decisions)) |
| `bond catalog create\|check` | Sets up a repo as your own catalog of skills, commands and MCP, and checks it ([below](#your-own-catalog-bond-catalog)) |
| `bond catalog add\|list\|update\|remove\|clean` | Uses your team's catalog in the repo, via git (with the commit pinned) or via a folder ([below](#git-catalogs-bond-catalog-add)) |
| `bond models list\|probe\|sync` | Global endpoints and models, and their config in each agent |
| `bond run copilot` | Copilot CLI against your own model (environment variables) |
| `bond key <endpoint>` | Prints a stored key (used by the agents) |
| `bond doctor` | Checks the installation (and the repo, if you are in one) |
| `bond update` | Brings bond up to date with the latest release ([below](#updating)) |
| `bond migrate` | Converts a 0.7 installation (pi config linked to the repo); `setup` does it on its own |
| `bond logo` | The logo |

## Where everything lives

**Global, in `~/.bond/`** (never in a project):

| Path | What |
|---|---|
| `config.toml` | Chosen agents, default agent, endpoints and models; `[update] auto` |
| `keys/<endpoint>` | Keys, one per file, permissions 600 |
| `AGENTS.md` | Your instructions for all agents |
| `state.json` | What the probe detected, what bond manages in each agent and the last version check |
| `runtime/<versión>/` | Files bundled inside the binary, extracted; only the version in use is kept |
| `catalogs/<host>/<repo>/<commit>/` | Team catalogs via git, one per commit; `bond catalog clean` prunes them |
| `pi` | Link to the Bond Extensions of the installed version |

**In each agent's config** (always only bond's part; the rest of the file is left untouched):

| What | Where |
|---|---|
| Models from your endpoints | `~/.pi/agent/models.json`, `~/.config/opencode/opencode.jsonc`, `~/.config/crush/crushrc` (block), `~/.codex/config.toml` (block) |
| Your instructions + bond's rules | A block in each agent's global instructions file |
| Skills `bond-delegate`, `bond-team` | `~/.agents/skills/` and `~/.claude/skills/` |
| Herdr integration | Installed by `herdr integration install <agente>` |

**In each repo**: `.bond/bond.toml` (what you ask for), `.bond/lock.json` (the commit of each git catalog), `.bond/manifest.json` (what bond generated),
`AGENTS.md` (yours) and each agent's config ([below](#per-repo-configuration-bond-init-and-bond-sync)).

## Bond Extensions (pi)

The bond repo is also a pi package (`package.json` → `"pi"`): the extensions
`status-line.ts` (status footer), `bond-header.ts` (header), `repo-map.ts` (tool `repo_map`)
and `record-decision.ts` (tool `record_decision`), and the commands `/delegate`, `/team`
(`prompts/`) and `/review`, `/commit`, `/handoff`, `/accept` (`catalog/commands/`). They are loaded
**per repo**: `bond init` adds `"packages": ["~/.bond/pi"]` to `.pi/settings.json` when the
repo uses pi. In repos without bond, pi works without them.

## Per-repo configuration (`bond init` and `bond sync`)

What belongs to the project (instructions, MCP servers, skills, commands) is declared in
`.bond/bond.toml` and `bond sync` generates what each agent reads: pi, Claude Code, Copilot CLI,
Codex, opencode, Crush and Gemini CLI.

```bash
cd ~/gitrepos/mi-proyecto
bond init                        # interactive: agents, default agent, tools
bond init --yes                  # no questions: what you chose in bond setup and the default catalog
bond init --agents claude,codex --default claude --skills "" --commands review,commit
bond init --list                 # catalog: MCP, skills, commands
bond sync                        # after editing .bond/bond.toml
bond sync --check                # in CI: fails if anything is out of date
```

`bond init` asks which agents to integrate the repo with (among the installed ones; those you
chose in `bond setup` are preselected), which one `bond` opens by default and which catalog tools
to use (defaults are checked; optional skills appear unchecked). In an already initialized repo it lets you change the selection: it only rewrites
the `agents`, `default_agent`, `mcp`, `skills` and `commands` lines of `bond.toml`, so your
comments and your `[mcp_servers]` are kept, and `sync` removes what is no longer requested.

**Bond Extensions (pi).** If the repo uses pi, `.pi/settings.json` declares
`"packages": ["~/.bond/pi"]`: the status footer, the BOND header, the `repo_map` tool,
`/delegate`, `/team` and the catalog commands. `~/.bond/pi` is a stable link to the installed
version of bond (on Windows, a *junction*), so the same path works on any machine with
bond and does not change when you update it. Anyone who clones the repo without bond doesn't get them, but the rest of
the pi config works.

```toml
# .bond/bond.toml
agents = ["pi", "claude", "copilot", "opencode", "crush"]
default_agent = "claude"
mcp = ["context7", "duckduckgo"]
skills = ["code-context"]
commands = ["commit", "handoff", "review"]

[decisions]                     # the agents' decision memory; remove the section to not use it
dir = "docs/decisions"          # folder inside the repo (relative), adjustable

[mcp_servers.postgres]           # the repo's own servers; secrets with ${VAR}
command = "npx"
args = ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"]
```

The repo's own commands: Markdown files in `.bond/commands/` (common syntax: `$ARGUMENTS`,
`$1`…). Its own skills: folders with `SKILL.md` in `.agents/skills/`.

**Decision memory.** With a `[decisions]` section in `bond.toml`, every non-trivial
decision —the user's or an agent's— lands in `docs/decisions/` (one file per decision,
`YYYY-MM-DD-slug.md`) and commits may carry the optional `Agent:` and `Decision:` trailers. `bond sync`
creates the `README.md` with the record format if missing; after that it belongs to the repo,
like `AGENTS.md`
(it is not registered in the manifest: sync neither overwrites it nor flags it as outdated).
The `decision-record` skill explains when and how to record decisions and runs. Without the
section, nothing changes. A `dir` that escapes the repo (absolute path or with `..`) is
rejected with an error. `bond init` only proposes the section when `decision-record` is among
the selected skills; on re-init, a `[decisions]` section you already have is kept even if the
skill is deselected (remove it by hand).

**Instructions and skills.** `AGENTS.md` (`init` creates it if missing; it is yours) and `.agents/skills/`
are read directly by pi, Copilot, Codex, opencode, Crush and Gemini. The exceptions:

- Claude Code: `CLAUDE.md` with an `@AGENTS.md` block and one symlink per skill in
  `.claude/skills/`.
- Gemini: `context.fileName = ["AGENTS.md", "GEMINI.md"]` in `.gemini/settings.json`.

**MCP and commands:**

| Agent | Repo MCP | Commands | Tested |
|---|---|---|---|
| pi | `.pi/mcp.json` (`exposure: "direct"`) | catalog: Bond Extensions; own: `.pi/prompts/` | yes |
| Claude Code | `.mcp.json` | `.claude/commands/` | yes |
| Copilot CLI | the same `.mcp.json` | reads `.claude/commands/` as skills | yes |
| opencode v2 | `opencode.json` → `mcp.servers` | `.opencode/commands/` | yes (MCP) |
| Crush | `.crush.json` → `mcp` | not generated (see below) | yes (MCP) |
| Codex | block in `.codex/config.toml` (`[mcp_servers.x]`) | has no project commands | not installed |
| Gemini CLI | `.gemini/settings.json` → `mcpServers` (`httpUrl` for HTTP) | `.gemini/commands/*.toml` (`{{args}}`) | not installed |

Verified with the installed agents: pi loads the skill and the repo's own command and connects the
MCP servers; Claude Code reads `AGENTS.md` through `CLAUDE.md`, sees the linked skills and runs
commands; Copilot lists the servers in `.mcp.json` and the commands in `.claude/commands`;
opencode and Crush connect their servers. Codex and Gemini: files generated according to their
documentation and validated (TOML), but not tested with the agent.

Per-agent details:

- **Copilot** only loads the repo's MCP servers if you trust the folder (it asks the first time;
  this is stored in `trustedFolders` in `~/.copilot/config.json`).
- **opencode** recognizes the project once the repo has at least one commit, and the first
  query after that commit may not see the servers yet. It uses a background service:
  if you change `XDG_CONFIG_HOME` to test something, that service keeps that configuration
  until you stop it.
- **Crush**: its project commands go in `.crush/commands/`, inside its data
  directory, which it ignores in git itself; that is why bond does not generate them. Crush offers skills as
  commands.
- **Codex** only loads `.codex/config.toml` in trusted projects, and has no project
  commands (only user commands, deprecated in favor of skills).

### What it touches and what it doesn't

`.bond/manifest.json` records everything bond wrote:

- **bond's files** (copied skills, commands): with their hash. If someone edits one by hand,
  `sync` doesn't overwrite it and marks it with `!`; `--force` overwrites it, keeping a `.bak` copy.
- **Shared JSON files** (`.mcp.json`, `.pi/mcp.json`, `.pi/settings.json`): bond only rewrites
  its own keys; a server of yours in `.mcp.json` stays.
- **`CLAUDE.md`**: a block between `<!-- >>> bond >>> -->` markers; the rest is yours.
- **Removing something** from `bond.toml` (a skill, an agent) deletes what bond generated, except what was
  edited by hand, and the directories that end up empty.

Everything is committed: `.bond/`, `AGENTS.md` and the generated files. That way anyone who clones the repo without bond
still has their agent's configuration.

**Trust.** The first time, pi asks whether you trust the project (without that it doesn't load `.pi/`)
and Claude Code asks you to approve the servers in `.mcp.json`. bond approves nothing on your behalf.
`bond doctor` inside a repo with `.bond/` also checks that it is up to date.

## Your own catalog (`bond catalog`)

<figure class="bond-video">
<video src="/videos/catalogos.mp4" controls muted playsinline preload="metadata"></video>
<figcaption>A team catalog from start to finish: create, one skill, check, then in fluzo add with the commit pinned, init --list and doctor.</figcaption>
</figure>

A team gathers in a repo the skills, commands and MCP servers it shares, with the same
structure as bond's catalog (`catalog/`):

```text
catalog.toml               name and, per skill, summary/default for bond init
skills/<nombre>/SKILL.md   frontmatter name (same as the folder) and description
commands/<nombre>.md       frontmatter description; $ARGUMENTS, $1…
mcps/<nombre>.json         command/args/env or url/headers, and description; secrets with ${VAR}
```

```bash
cd ~/gitrepos/skills-equipo
bond catalog create              # asks for the name (default: the folder's name)
bond catalog create --name equipo
bond catalog check               # exits with 1 on errors: for the catalog's CI
bond catalog check ruta/al/catalogo
```

- **`create`** writes `catalog.toml` and the `skills/`, `commands/` and `mcps/` folders, each
  with a `README.md` that explains the format with an example. It adds no skills, commands or
  servers. If `catalog.toml` already exists, it leaves it alone and only adds what is missing; running it again
  changes nothing. It does not run `git init` or commit (outside git, it warns).
- **`check`** reports one error per problem: a skill without `SKILL.md` or with a `name` different from its
  folder, without `description`, a command without `description`, invalid JSON, a server with neither `command`
  nor `url`, `[skills.x]` in `catalog.toml` for a skill that doesn't exist. An `env` or
  `headers` value that looks like a secret written in plain text is a warning. `README.md` files don't count.
- The catalog repo is a normal repo: you can work in it with bond (`bond init`,
  `.bond/`, `.agents/skills/`), which doesn't touch the catalog folders.

### Using a catalog in a repo

It is declared in `.bond/bond.toml` with its folder, relative to the repo. Its contents appear in
`bond init` (with its name at the end) and are chosen just like those of bond's catalog:

```toml
skills = ["code-context", "revisar-migraciones"]
mcp = ["context7", "postgres"]
commands = ["review", "notas"]

[[catalog]]
name = "equipo"                  # optional: defaults to the name in its catalog.toml
path = "../skills-equipo"
```

- **Same name as one of bond's**: the team catalog's wins and replaces it (in
  `bond init` bond's one appears as `bond:nombre` «(la sustituye equipo)» (replaced by equipo)). To keep
  bond's: `"bond:nombre"`.
- **Same name in two team catalogs**: `sync` fails and asks you to choose with
  `catalogo:nombre` (`"equipo:revisar"` or `"plataforma:revisar"`). Only one fits in the repo.
- **Validation**: `sync` checks the catalog just like `bond catalog check` and writes nothing
  if it has errors.
- **Commands in pi**: those from bond's catalog reach it through the Bond Extensions; those from a
  team catalog are written to `.pi/prompts/`.
- **Path outside the repo**: works, with a warning: it only helps the rest of the team if they have that
  same folder. To share it, use git (below).

### Git catalogs (`bond catalog add`)

The usual setup in a team: the catalog lives in its own repo and each project declares it by its URL, with
the commit pinned in `.bond/lock.json` (committed, like a lockfile).

```bash
bond catalog add https://github.com/acme/skills-equipo --ref v1   # tag, branch or sha
bond catalog add git@github.com:acme/skills-equipo.git           # without --ref: default branch
bond catalog add ../skills-equipo                                 # a folder: [[catalog]] path
bond catalog list                # bond's and the repo's, with ref and commit
bond catalog update [equipo]     # resolves the ref again and moves the lock (--ref to change it)
bond catalog remove equipo       # removes it from bond.toml, the lock and what was chosen from it
bond catalog clean               # empties ~/.bond/catalogs except this repo's commits
```

```toml
[[catalog]]
name = "equipo"                  # required via git: it is its key in the lock
git = "https://github.com/acme/skills-equipo"
ref = "v1"
```

- **What gets reviewed**: `add` and `update` show the MCP servers that arrive or change (what they
  run or where they connect) and what the repo uses that now comes from another catalog (a bond
  skill that the team replaces), and ask for confirmation; `--yes` gives it (without a terminal and without
  `--yes`, they write nothing). A catalog that doesn't pass `bond catalog check` is not added.
- **Pinning**: only `add` and `update` change the commit. `sync` (and `sync --check` in CI) uses the
  one in the lock even if the branch has moved on, and downloads it to `~/.bond/catalogs/` if it isn't there; with the
  cache populated it works offline. If `bond.toml` and the lock don't match (another URL or ref), `sync`
  asks for `bond catalog update`.
- **Same repo, different URL**: `git@github.com:acme/x.git` and `https://github.com/acme/x` are the
  same catalog: it can't be added twice.
- **Private repos**: bond uses your `git` and its credentials, without asking (if it asks for a password,
  it fails). In CI, the job needs read access to the catalog repo.

### Lifecycle of an external catalog

1. **Create** — `bond catalog create` in the catalog repo: `catalog.toml` and the folders
   with their READMEs (above). No installable examples: nothing reaches the team's `bond init` unless
   someone writes it.
2. **Check** — `bond catalog check` locally and in the catalog's own CI: it exits with 1 if
   anything is invalid, so nothing broken reaches the team.
3. **Publish** — it is a normal git repo of the team: it is versioned and reviewed like any
   code (tags for stable versions, branches to stay ahead).
4. **Add** — `bond catalog add <url> [--ref]` in each project that consumes it: declares the
   `[[catalog]]` in `bond.toml` and pins the commit in `.bond/lock.json` (committed).
5. **Sync** — `bond sync` installs what was chosen from the lock's commit, not from the tip
   of the branch; the generated files travel committed with the repo, so cloning downloads nothing.
6. **Update** — `bond catalog update [nombre]` is the only thing that moves the commit, and it first shows
   the MCP servers that arrive or change.
7. **Diagnose** — `bond doctor` shows one row per catalog: the pinned commit, whether it is
   downloaded in `~/.bond/catalogs` and whether the ref has a newer commit (online; with
   `--quick` or without access, «sin verificar» (unverified)). It fails if the lock doesn't match `bond.toml`.

**Security**: pinning by SHA ensures that what was reviewed when adding or updating is
exactly what gets installed; MCP servers are always reviewed on `add`/`update` because they
run programs on your machine or open connections; secrets are not written in the
catalog, they are referenced with `${VARIABLE}` (`bond catalog check` warns if one looks written
in plain text); the catalog repo is audited like any team repo: its skills instruct
the agents, so whoever writes them must be trusted.

**CI with private catalogs**: the job needs read credentials for the catalog repo
(a token with `repo` deployed as a secret variable and used in the runner's `git`, or an SSH key)
before `bond sync --check`; if the URL fails, the error says which one. With the cache populated
(`~/.bond/catalogs` cached between runs) no network is needed for the pinned commit.

## Global models (`bond models`)

Models are declared **once** in `~/.bond/config.toml` (outside the repo: they belong to
your machine) and `bond models sync` generates the configuration of each agent that can use them.

```toml
[providers.halo]
name = "Halo (local)"
base_url = "http://halo.example/v1"
free = true                       # zero cost: pi's footer doesn't simulate spending
# api_key_env = "HALO_API_KEY"    # if the gateway requires a key: the NAME of the variable

[[providers.halo.models]]
id = "flash-halogen"
context = 131072
max_output = 8192
reasoning = true
# agents = ["pi", "opencode"]     # optional: only for those agents
# enabled = false                 # disabled but documented

[providers.halo.pi]               # settings used only by pi, copied as is
api = "openai-completions"
[providers.halo.pi.compat]
maxTokensField = "max_tokens"
# ...
```

| Command | What it does |
|---|---|
| `bond models init` | Creates `config.toml`. If there is a pi `models.json`, imports its providers (and the models commented out with `//`, as `enabled = false`) |
| `bond models list` | Providers, models, APIs and which agents can use each one |
| `bond models probe [id]` | Asks the gateway what it serves: list of models and the `chat`, `responses` and `messages` APIs (one request after another; local gateways don't handle several at once). Saves it to `~/.bond/state.json` |
| `bond models sync` | Writes the model config of each installed agent. `--agent x`, `--dry-run` (shows the diff), `--check` (exits with 1 if anything is out of date) |
| `bond run copilot` | Launches Copilot CLI against a model from the registry (see below) |

`bond setup` creates `config.toml` if missing and syncs pi; the remaining agents, with
`bond models sync`. `bond doctor` warns if any agent is out of date.

### What it writes in each agent

| Agent | File | How | Needs from the gateway |
|---|---|---|---|
| pi | `~/.pi/agent/models.json` | Its providers inside `providers`; the rest of the file, unchanged | Chat API |
| opencode v2 | `~/.config/opencode/opencode.json(c)` | Same in `providers` (`settings.baseURL`, `limit.context/output`) | Chat API |
| Crush | `~/.config/crush/crushrc` | `# >>> bond >>>` block at the end, with `provider add` / `model add` | Chat API |
| Codex | `~/.codex/config.toml` | Block at the end: `[model_providers.x]` with `wire_api = "responses"` and one profile per model (`codex -p halo-flash-halogen`) | Responses API |
| Copilot CLI | (nothing) | `bond run copilot` sets `COPILOT_PROVIDER_BASE_URL`, `COPILOT_MODEL`, limits and API | chat or Responses |
| Claude Code | — | Can't: it only speaks the Anthropic API (`/v1/messages`) | — |
| Gemini CLI | — | Can't: it only speaks the Gemini API | — |

Rules to avoid overwriting others' settings:

- In JSON files, bond only rewrites the providers it manages (the current ones and those it
  wrote the previous time, recorded in `state.json`). If you remove a provider from the registry,
  it disappears from the agents; what you added by hand stays.
- In Crush and Codex, everything from bond goes between markers; nothing outside them is touched. If in
  `crushrc` you define by hand a provider with the same id, bond doesn't duplicate it and warns: yours
  wins. (Today this happens with `halo`, which your `crushrc` defines with the local IP `<IP-local>:18080`:
  delete it from there if you want bond to manage it.)
- The first time bond touches a file, it saves a `.bak.<fecha>` copy.
- JSON files with comments lose them when rewritten; bond warns beforehand.

Verified end to end with `flash-halogen`: pi (`pi -p`), opencode (`opencode run`),
Crush (`crush models`) and Copilot (`bond run copilot -p`) respond through `halo`. Codex
is not installed: its block is generated but has not been tested with a real Codex.

### `bond run copilot`

```bash
bond run copilot                                  # first usable model
bond run copilot --model halo/flash-halogen -p "explica este repo"
```

Copilot CLI supports a custom provider (BYOK) only through environment variables, so there is no
file to generate: `bond run` sets them and launches `copilot` with the remaining arguments. It doesn't
need a GitHub account.

### The `halo` gateway

`http://halo.example/v1` (llama-swap; the IP `<IP-local>:18080` is the same
service behind the proxy). Plain HTTP: the host's certificate doesn't cover this name and with
HTTPS it fails with `tls: unrecognized name`. It serves `/v1/chat/completions` and `/v1/responses`, not
`/v1/messages`.

pi settings (`[providers.halo.pi.compat]`), set by hand because pi autodetects these things
by URL and doesn't know this host:

| Key | Value | Verified on the gateway |
|---|---|---|
| `maxTokensField` | `max_tokens` | Also accepts `max_completion_tokens`; `max_tokens` is pinned to avoid depending on autodetection |
| `thinkingFormat` | `openai` | Reasoning comes back in `reasoning_content` (also when streaming) |
| `supportsReasoningEffort` | `true` | Accepts `reasoning_effort` |
| `supportsUsageInStreaming` | `true` | Accepts `stream_options.include_usage` and returns `usage` at the end |
| `supportsFinishReason` | `true` | Chunks include `finish_reason` |
| `supportsDeveloperRole` | `true` | Accepts the `developer` role |
| `supportsStore` | `false` | `store` is accepted but means nothing here |

| Model | Status | Context | Max output | Reasons | Tools |
|---|---|---|---|---|---|
| `flash-halogen` | active | 131072 | 8192 | yes (`reasoning_content`) | yes, also when streaming |
| `gufo-qwen38-27b` | `enabled = false` | 131072 | 2048 | no | yes (`auto` and `required`; doesn't accept a named `tool_choice`) |

`laya` and `winnow-12b-cpu` appear in `GET /v1/models` but returned 404 when asked for a chat, so
they are not declared. `bond models probe` shows what the gateway lists at any given moment.

### Local model gotchas

- **On-demand loading.** The gateway has the models downloaded and loads them into RAM on first
  use: the first `prompt` after a while idle can take much longer than the rest.
- **`gufo` cuts off at 2048 output tokens.** For a coding agent that's tight: long diffs or
  files get truncated. If you re-enable it, keep that in mind.
- **`settings.json` reserves 16384 response tokens** (`compaction.reserveTokens`), above
  `gufo`'s `maxTokens`; the real limit is set by the model, not by that setting.
- **No TLS.** Traffic, including the prompt, travels in clear text over the network. Fine on a trusted
  LAN; don't take it outside.
- **Don't use the `llama.cpp` provider that ships with pi** (`/login llama.cpp`, `LLAMA_BASE_URL`) for
  this: it is meant for the local llama.cpp router, requires interactive login and load
  management with `/llama`. With bond's registry it works headless in Herdr panes.
- **Several agents at once** against the same local gateway produce 429 errors: it doesn't handle several
  requests in parallel.

## Global instructions

`~/.bond/AGENTS.md` holds your instructions (language, style, how you work, git…). `bond setup`
writes them, together with bond's rules, into a block of the global instructions file of
each chosen agent. To change them: edit `~/.bond/AGENTS.md` and run `bond setup` again. The
first time they are seeded with those of a previous installation, if any.

bond's rules (the same for all): Herdr only when you ask for it or a command such as
`/delegate` or `/team` asks for it; `bond-delegate` and `bond-team` to work with other agents; don't close
what you didn't create or run `herdr` without a subcommand; nothing private in web searches;
and if the repo has a `[decisions]` section in `bond.toml`, record decisions with
`decision-record` and carry the `Agent:` and `Decision:` trailers in commits.

**Project** instructions go in the repo's `AGENTS.md` (created by `bond init`).

## Catalog skills

Folders in `catalog/skills/`; `catalog/catalog.toml` provides the summary that `bond init` shows and whether
they are checked. Together they take a task from issue to release: refine → plan →
execute a phase → commit → PR → release. Each skill ends with a recommended next step,
and nothing that writes outside the repo or publishes (push, PR, comment, tag, release) happens without
your explicit OK. A missing skill only cuts that step; it is not downloaded.

| Skill | What for | In `bond init` |
|---|---|---|
| `code-context` | Gather just the right context from the repo and libraries before editing | checked |
| `git-conventional-commit` | A reviewed commit with Conventional Commits, in English unless the project says otherwise; used by `/commit` | checked |
| `plan-create` | Plan in verifiable phases in `docs/plans/`; independent phases can run in parallel with `bond team` | checked |
| `decision-record` | Record non-trivial decisions and agent runs in `docs/decisions/` (id, status, `Agent:`/`Decision:` git trailers); only in repos with `[decisions]` in `bond.toml` | checked |
| `plan-execute` | Implement an approved phase, with evidence, and propose its commit | checked |
| `issue-refine-github` | Review an issue before starting: keep it, expand it or split it | optional |
| `delivery-review-github` | Review the phase, push and open its PR; after the merge, recommend what's next (and `bond team clean` if it came from a worktree) | optional |
| `release-prepare-github` | Changelog, version with evidence and approved release; if a workflow publishes on tag push, that push is the publication | optional |
| `convention-document` | Turn a confirmed agreement into a documented convention indexed in `AGENTS.md` | optional |
| `plan-team` | Run a plan's independent phases in parallel: one branch, worktree and agent per phase with `bond team`, each with `plan-execute` and its commit; as each branch is integrated, it updates the plan | optional |
| `catalog-maintain` | Fill and maintain a team catalog (created with `bond catalog create`): skills, commands and MCP servers in the right format and `bond catalog check` green before publishing | optional |

All except `code-context`, `plan-team` and `catalog-maintain` are adapted from
[fluzo-labs/common-skills](https://github.com/fluzo-labs/common-skills) (MIT, with its `LICENSE`
in each folder): guided mode only (without the autonomous one), with bond branding and adjusted to its
commands.

## Catalog commands

Markdown files in `catalog/commands/`, with the syntax common to all agents
(`$ARGUMENTS`, `$1`…): bond converts them to each one's format.

| Command | Arguments | Result |
|---|---|---|
| `/review [foco]` | optional focus | Prioritized review (bugs, security, errors, performance, style) with `fichero:línea`. Doesn't edit. |
| `/commit [contexto]` | extra context | Commit with the `git-conventional-commit` skill (without it, with whatever the agent has): shows scope and message and waits for OK. Never pushes. |
| `/handoff [ruta]` | path, `.handoff.md` by default | Written status: goal, status, files, verification, next steps. |
| `/accept [ids]` | ids or "all" | Accept/reject proposed decisions from the conversation: lists the `proposed` ones, asks which, and runs `bond decisions accept/reject/supersede --confirmed-by "<what the user said>"`. Only on an explicit answer. |

In pi, also `/delegate` and `/team`, shortcuts to the `bond-delegate` and `bond-team` skills
([below](#herdr-skill-and-prompts)).

## Herdr integration for pi

```bash
herdr integration status | grep '^pi:'
# pi: current (v9) (~/.pi/agent/extensions/herdr-agent-state.ts)
```

Without it, Herdr classifies pi by looking at the screen. With it, pi itself reports its
lifecycle, so `working` / `blocked` / `done` become reliable and notifications
arrive properly. It is installed with `herdr integration install pi` and removed with
`herdr integration uninstall pi`.

## Herdr skill

pi reads skills from `~/.pi/agent/skills/` and also from `~/.agents/skills/`, the location
shared with other agents (Claude Code, opencode…), which is where `npx skills add` puts it.
Two skills with the same name collide, so `bond setup` keeps only one:

- If `~/.agents/skills/herdr/SKILL.md` exists, it uses that one and deletes the copy in
  `~/.pi/agent/skills/herdr/` if it is the one it generated (if you edited it, it warns and leaves it alone).
  If the shared one doesn't match `herdr --skill`, it warns that it is outdated.
- If it doesn't exist, it runs `herdr --skill` and saves it to `~/.pi/agent/skills/herdr/SKILL.md`,
  so that it describes the CLI **of the installed version**.

It is not versioned in the repo.

With the skill loaded, a pi running inside a Herdr pane knows how to split panes, launch
commands without stealing focus, read output from other panes and wait for other agents. That is
what makes `/delegate` possible.

## Herdr: skill and prompts

### Multi-agent across different agents

Delegation and teams are **global skills** (`global/skills/`), because they depend on
Herdr, a machine-level tool, just like the `herdr` skill. `bond setup` links them in
`~/.agents/skills/` (read by pi, Codex, Copilot, opencode, Crush and Gemini) and in
`~/.claude/skills/` (Claude Code), so any agent can orchestrate any other:

| Skill | What it does | How to ask for it |
|---|---|---|
| `bond-delegate` | Launches another agent in a sibling pane, hands it the task, waits and summarizes | pi: `/delegate rol:kind tarea`; Claude/Copilot: `/bond-delegate …` or by asking |
| `bond-team` | Splits a task across 2-3 branches with `bond team` (`rama:kind`), waits for OK, collects and summarizes | pi: `/team tarea`; others: `/bond-team …` or by asking |

The kind is any from `herdr agent start --help` whose executable is installed; without a kind,
`pi`. A specific model for the delegate goes after `--` (`--model haiku` in Claude). In pi,
`/delegate` and `/team` are shortcuts that load these skills.

The skills only activate if you ask for them (their description says so, as the `herdr` skill requires).
When the delegate stops at a question (trusting the folder, approving something), the
orchestrator shows it to you and waits for your answer: it doesn't answer for you.

**Herdr integrations.** `bond setup` runs `herdr integration install <agente>` for
each installed agent that Herdr supports (today: pi, Claude Code, Copilot, opencode; Crush has no
integration and Herdr detects it by screen). With the integration, the `working`,
`blocked` or `done` state is reported by the agent itself. `bond doctor` checks them.

**Tested** in a test workspace: a Claude Code (Haiku) orchestrator used `bond-delegate`
to delegate to Copilot; Copilot stopped at the trust question, Claude showed it and
waited, and with the answer Copilot did the task (`wc -l`, correct result). The test
found the clash of the `web` server with OpenAI's reserved namespace, now
resolved (now `duckduckgo`). Pending: pi orchestrating another kind with `halo` (the gateway
was saturated during the test).

### Rules of the `herdr` skill

The `herdr` skill (written by Herdr, not this repo) sets some rules that everything in this setup
respects, so that the agent doesn't receive contradictory instructions:

| Skill rule | How it is followed here |
|---|---|
| Only used if the user asks for it, not because something takes long or could be parallelized | `AGENTS.md` repeats it. The `bond-delegate`/`bond-team` skills only activate on request, and the `/delegate` and `/team` prompts start with "Te pido expresamente que uses Herdr…" ("I explicitly ask you to use Herdr…"): invoking them is the explicit request. |
| No workspaces, tabs, worktrees or other directory without a request | `/delegate` works in a sibling pane and in `$PWD`. Worktrees are created by `bond`/`bond team` (which you launch) or `/team`, which asks for it explicitly and also waits for your OK on the split before creating anything. |
| Worktrees with `herdr worktree`, not `git worktree` by hand | `bond --worktree` uses `worktree create`/`open` attached to the `bond:<repo>` workspace, so Herdr groups them and knows how to remove them. |
| `--trust-repository` only after reviewing the repo | `bond`/`bond team` only pass it if you set `--trust-repository`. In panes, `bond team` gives each worktree the pi or Claude Code trust that the main checkout already had, never any other (`--no-trust` disables it). |
| The installed CLI takes precedence over memory | The prompts refer to the skill and to `herdr <grupo>`; they only fix the procedure. |
| Unique agent names | `/delegate` uses `<rol>-<n>` with the first free `n` in `herdr agent list`. |
| Split according to the pane's shape | `/delegate` reads its `rect` in `herdr pane layout`: `right` if `width >= 120` and `width >= 2*height`, otherwise `down`. |
| `agent_not_ready`, `blocked`, `timeout`, `agent_prompt_stalled` | Covered: look at the pane before acting, ask you when there is an approval, never resend blindly. |
| Incomplete response when reading | Plan B: the delegate writes it to a file under `mktemp -d` and it is read from there. |
| Don't close what you didn't create; don't run `herdr` without a subcommand | In `AGENTS.md` and in `/delegate` (the pane and the agent stay open). |

**Tested** with `halo/flash-halogen` as orchestrator in a test workspace: three
consecutive delegations produced `reviewer-1`, `tester-1` and `reviewer-2` (unique names), split
to the right in a 263×50 and a 132×50 pane and downward in a 66×50 one, a self-contained
message to the delegate, and reading and verification of the result by the orchestrator.

`/team` also tested: in a test repo it split "función con test" (function with test) and "README" into
`team/discount` and `team/readme`, waited for OK, set up the team with `bond team`, each agent
committed on its branch, and the orchestrator reviewed both branches and proposed the integration order.

**Parallelism with the local model.** In that test one agent got a 429 from the `halo`
gateway: two agents requesting the same local model at once. The orchestrator checked that there
were no commits and resent the task when the other finished. With local models, real parallelism
is limited by the gateway; with cloud providers, by the quota.

**Arguments.** They are split as in a shell: `/delegate reviewer revisa el diff` gives role
`reviewer` and task `revisa el diff` (`${@:2}`). If the first argument doesn't look like a role
(`/delegate revisa el diff`), the prompt tells the agent to use `reviewer`.

## `bond setup`

`cli/setup.mts` and `cli/wizard.mts`. Interactive and repeatable (each time it shows what is already there);
`--yes` uses what was detected without asking.

**Questions:**

1. **Herdr.** If it isn't there, it shows how to install it for your system (`curl … | sh`, `brew`,
   PowerShell on Windows) and the link https://herdr.dev/docs/install/. You can continue without it.
2. **Model endpoints.** It auto-detects only Ollama (`localhost:11434`) and LM Studio
   (`localhost:1234`). It offers to add OpenAI or any OpenAI-compatible endpoint
   (such as `halo`): URL, key if required, and name. It reads its models (with context and max output
   if the gateway publishes them), lets you choose which ones to register and tests which APIs it serves (chat,
   responses) and whether the model reasons.
3. **Agents.** It detects the installed ones (pi, Claude Code, Codex, Copilot CLI, opencode, Crush,
   Gemini CLI). None is mandatory, but at least one is needed: if there are none, it shows
   how to install each one and stops. You choose which ones to work with and which is the default.
4. **Prompt suggestions (pi).** They are proposed enabled if bond's registry has a
   cheap model for pi; if there is none, they come out disabled with a warning. The proposed model is shown in
   the question and can be set by hand in `[suggestions] model`.

**Then it applies**, only for the chosen agents:

- the models in the agents that can use custom endpoints (pi, opencode, Crush, Codex);
- pi's prompt suggestions: the package, its config and `enabledModels` (see
  [pi prompt suggestions](#pi-prompt-suggestions));
- each one's Herdr integration (if an agent hasn't created its config folder yet, it warns and
  installs it on the next `setup`);
- the global skills `bond-delegate` and `bond-team`;
- your instructions (`~/.bond/AGENTS.md`) and bond's rules, in a block of each agent's global
  instructions file (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`,
  `~/.copilot/copilot-instructions.md`, `~/.config/opencode/AGENTS.md`, `~/.config/crush/CRUSH.md`,
  `~/.gemini/GEMINI.md`, `~/.pi/agent/AGENTS.md`). Anything outside the block is left untouched. To
  change them: edit `~/.bond/AGENTS.md` and run `bond setup` again.

**Where it stores everything: `~/.bond/`** (never in a project):

| File | What |
|---|---|
| `config.toml` | Agents, default agent, endpoints and models (written by `setup`; can be edited) |
| `keys/<endpoint>` | One key per file, permissions 600 (folder 700) |
| `AGENTS.md` | Your instructions for all agents |
| `state.json` | What the probe detected and what bond manages in each agent |
| `runtime/<versión>/` | The files bundled inside the binary, extracted |

Keys are never copied into the agents' configuration: pi reads them with
`!bond key <endpoint>`, opencode with `{file:~/.bond/keys/<endpoint>}`, Crush with
`$(bond key <endpoint>)`, and Codex and Copilot via environment variable with `bond run`.
`bond key <endpoint>` prints a key.

The configuration of bond 0.3–0.7 (`~/.bond/`) is moved automatically to `~/.bond/` the first time.

| Flag | Effect |
|---|---|
| `--yes` | No questions: what was detected and what is already configured |
| `--dry-run` | Asks, but only shows what it would do when applying |
| `--no-suggestions` | Don't enable pi's prompt suggestions |
| `--herdr-config` | Applies the Herdr snippet (opt-in: your Herdr `config.toml` is yours) |

From source code, it also installs the CLI's dependencies (`npm ci`) and puts `bond`
on the PATH. Before applying, it converts a previous installation (`bond migrate`).

### pi prompt suggestions

`cli/suggestions.mts`. At the end of a turn, with the editor empty, pi shows the next suggested
prompt as *ghost text*; it is accepted with `→` or `Tab` and can be edited before sending it. It is
provided by `@mrclrchtr/supi-prompt-suggestions` (MIT), which bond installs in pi's personal scope
(`pi install npm:…`), not per project. It only suggests after the agent's turn: it doesn't complete
while you type.

**What bond writes**, all under `~/.pi/agent/` and never in the repo:

| File | What | Notes |
|---|---|---|
| `supi/config.json` | `promptSuggestions.model = "proveedor/modelo"` | It is **merged**: the sections of other packages of the supi suite are kept. `"disabled"` = off |
| `settings.json` | `enabledModels: ["*"]` | Only if it was missing or empty; a list of yours is left untouched |

Before touching a file that already existed, a `.prev` copy is saved.

**How it picks the model.** `[suggestions] model` takes precedence. If it isn't set, a heuristic in this order:

1. providers with `free = true` in bond's registry (custom models with no cost);
2. among them, those with the cheapest and fastest-sounding names (`haiku`, `mini`, `flash`, `nano`, `lite`,
   `small`, sizes `…b`);
3. if there are no free ones, the same criterion over the rest of the registry;
4. if nothing applies, it is proposed disabled.

Models with `agents = [...]` that don't include `pi` are left out, as are disabled
providers.

**The `enabledModels` pitfall.** The extension takes its candidates from pi's `enabledModels`.
If that key is missing, or empty, the list comes out empty and it suggests nothing — even though pi's
*default* is «all models». That is why bond writes `["*"]`. If you later set a
restrictive list and the suggestions model is left out, `bond doctor` warns about it.

**Disabling and removing.** `bond setup --no-suggestions` (or `enabled = false` in `config.toml`) leaves
`"disabled"` in the extension's config and installs nothing. To remove the package entirely:
`pi remove npm:@mrclrchtr/supi-prompt-suggestions`.

**Editor conflict.** The extension replaces pi's editor component
(`setEditorComponent`), so only one of that kind can be active at a time: the one loaded
last wins. `bond doctor` lists the others that use that API from pi's extensions directory
(`~/.pi/agent/extensions`); third-party npm packages are not inspected.

**Network and failures.** If `pi install` fails (no network, package down) `bond setup` warns and continues: the
configs remain written and you can run `bond setup` again later.

## `bond doctor`

`cli/doctor.mts`. Checks in a few seconds what `bond setup` leaves in place and what depends on
external things, and exits with 1 if something fails:

| Check | Typical failure and fix |
|---|---|
| Node ≥ 22.18 | update Node |
| Herdr: binary, server, pi integration | `herdr`; `bond setup` |
| pi: binary, `~/.pi/agent` links, `./bond` package in `pi list` | `bond setup` |
| Leftovers from bond 0.7: pi config linked to the repo (warning) | `bond migrate` |
| Herdr skill: only one and up to date with `herdr --skill` | `bond setup`; `npx skills update herdr` |
| `pi-settings` git filter | `bond setup` |
| `rg`, `fd`, `ast-grep`, `uvx`, `jq` (warning) | install the missing one |
| Connected MCP servers (`pi mcp list`) | see troubleshooting; `--quick` skips it |
| Dependencies (`node_modules`), `config.toml`, pi up to date with the registry (other agents: warning) | `bond setup`; `bond models sync` |
| Each registry provider's gateway serves the declared models | check the gateway |
| `bond` is on the PATH and is this repo's | `bond setup` |
| Updates: installation method, last check, pending version, skipped version and whether it asks at startup (informational; warning if there is a pending one not skipped; never having checked doesn't fail) | `bond update`; `bond update --skip vX.Y.Z` |
| pi prompt suggestions: model, installed package, `enabledModels` and whether the extension's config matches `config.toml`; other extensions that replace the editor (warning, never failure) | `bond setup` |
| Repo catalogs (`[[catalog]]` in `bond.toml`): for each one, the commit pinned in `.bond/lock.json`, whether it is downloaded in `~/.bond/catalogs` and whether the ref has a newer commit (the network is queried; with `--quick`, «sin verificar»); a local catalog shows its folder | `bond catalog update <nombre>` |
| Decision memory (only when the repo has `[decisions]`): file errors and proposals awaiting acceptance; warns when the folder is missing | `bond decisions check`; `bond decisions accept <id>`; `bond sync` |

## `bond decisions`

`cli/decisions.mts`. The repo's decision memory: what was decided, by whom and why, in
versioned Markdown files. It is enabled by the `[decisions]` section in `.bond/bond.toml`
(`bond init` proposes it together with the `decision-record` skill; `bond sync` creates the
`<dir>/README.md` with the record format). There is no shared index: `bond decisions` is the
listing, so two parallel branches recording decisions merge without conflicts. In a repo
without `[decisions]`, `add` fails explaining how to
enable it and everything else exits 0 saying the memory is not in use.

| Command | What it does |
|---|---|
| `bond decisions` | Lists the repo's decisions, newest first; `--status <status>`, `--agent <substring>`, `--json` |
| `bond decisions add` | Records a decision: `--title`, `--context`, `--decision`, `--alternatives`, `--consequences`, `--link "kind: value"` (repeatable); or with `--stdin`, the same object as JSON (including `consequences`). bond computes the id (`YYYY-MM-DD-slug`, `-2` on collision), the authorship and the branch/HEAD links, writes `<dir>/<id>.md` with English sections (*Context*, *Decision*, *Rejected alternatives*, *Consequences* — the last only when consequences are provided). It touches no index: this command is the listing. It always enters as `proposed` |
| `bond decisions accept <id>...` | Moves it to `accepted`. From the terminal with interactive confirmation (`--ref <acceptance>`), or from the conversation with `--confirmed-by "<what the user said>"`: no terminal needed, and the record also stores `accepted_via` (who executed it: `agent:<kind>/<name>` from a Herdr pane, `user` outside). Takes several ids and `--all-proposed`; an unknown or non-`proposed` id is reported without aborting the rest (exit != 0 if any failed). A blank `--confirmed-by` is rejected; without a terminal and without `--confirmed-by`, refused |
| `bond decisions reject <id>...` | Moves it to `rejected`; same confirmation and options |
| `bond decisions supersede <id>... --by <new>` | The old ones become `superseded` and the new one references them in `supersedes` (it stays `proposed` until the user accepts it); same confirmation and options |
| `bond decisions show <id>` | The decision's whole file (or the run's, if the id is one in `<dir>/runs/`) |
| `bond decisions runs` | The runs (delegated tasks) in `<dir>/runs/`, with their branch commits and that agent's decisions; `--agent <substring>`, `--json` |
| `bond decisions check` | Audits the memory: frontmatter, id vs filename, duplicates, broken supersession references and `Decision:` trailers. The README is not audited: there is no index to keep current. Exits 1 on errors |

Authorship (`decided_by`): inside a Herdr pane it is `agent:<kind>/<name>` —bond looks up the
pane's agent, so an agent never needs to know its own name—; outside Herdr, or with no agent
in the pane, `user`. Acceptance belongs to the user alone, but they can do it from the
conversation: `accept`, `reject` and `supersede` ask for interactive confirmation with a
terminal, or take `--confirmed-by "<what the user said>"` without one; in that case
`accepted_by` keeps the quote and `accepted_via` who executed it (`check` validates its
format). Without one or the other they refuse: an agent cannot accept on its own; what it
can do is run the command quoting the user, with the `/accept` command as its guide. The
barrier prevents accidental acceptances; it is not a security measure — git provides the
records' integrity, and a wrong acceptance shows up in the diff and can be reverted with
`supersede` or `git revert`. In Claude Code, with `[decisions]` active, `bond sync` also
leaves `ask` rules for `accept`, `reject` and `supersede` in `.claude/settings.json`
(`Bash(bond decisions accept:*)`…): every run goes through its permission prompt. The `ask`
key bond manages is the union of whatever the repo already has plus its own: other keys and
rules are preserved, and deleting a bond rule brings it back on the next sync.

pi has the `record_decision` tool (`extensions/record-decision.ts`), which calls this same
`bond decisions add --stdin`: the model passes only the content and bond writes the record
with its computed id. `bond doctor` adds a decisions row: errors (failure), proposals awaiting
acceptance (warning) or a clean memory.

With the memory enabled, the catalog skills `plan-create`, `plan-execute`,
`git-conventional-commit`, `delivery-review-github` and `convention-document` record and
link decisions with this tool (`record_decision` or `bond decisions add`) while planning,
executing a phase, committing, preparing a PR or documenting a convention. None of them
marks a decision `accepted`: that stays with `bond decisions accept`. Without the memory,
or if the tool or command is unavailable, the skills behave as they always did.

Runs (requests and reports) are written by bond, not by the model: `bond team prompt <branch>`
stores the exact request in the main checkout's `<dir>/runs/<date>-<agent>-<slug>.md` before
sending it (`--no-record` skips it; if saving fails it warns and sends the prompt anyway); with
the memory enabled, the text the agent receives also carries a note: whatever it records under
`<dir>/` gets committed on its branch, and it writes nothing in the plan or in `<dir>/runs/`.
`bond team collect <branch>` takes only the agent's last answer from its session file (for pi,
the `.jsonl` Herdr reports in `agent_session`) and, when that is not readable, the trimmed pane
dump —no startup banner or notices— (`--lines <n>`, 200 by default); it stores
the report, the status, the branch's commits and the decisions whose `decided_by` is that
agent; collecting again replaces the report and recomputes the lists without duplicating. It
refuses while the agent is working or waiting for an answer, so it never stores a half-done report.
Without a run created by `prompt`, `collect` creates one with `--request "<task>"` and
`--agent <name>` (delegations without a team, like `bond-delegate`). The branch agent never
writes its own run.

The file format is documented in the `decision-record` skill
(`catalog/skills/decision-record/`).

## Herdr snippet

`herdr/config.snippet.toml`, only with keys verified against `herdr --default-config`:

| Key | Effect |
|---|---|
| `terminal.new_cwd = "follow"` | New panes, tabs and workspaces start in the source pane's directory |
| `ui.show_agent_labels_on_pane_borders = true` | In split panes you can see which agent occupies each one |

To see all of Herdr's options: `herdr --default-config`. To reload after editing:
`herdr server reload-config`.

## Environment variables

| Variable | Who sets it | What for |
|---|---|---|
| `HERDR_ENV` | Herdr in each pane | `1` means "I am inside a Herdr pane" |
| `HERDR_WORKSPACE_ID` | Herdr | Id of the pane's workspace (`w3`) |
| `HERDR_TAB_ID` | Herdr | Id of the tab (`w3:t1`) |
| `HERDR_PANE_ID` | Herdr | Id of the pane (`w3:p5`) |
| `PI_CODING_AGENT_DIR` | You, if you want | Move `~/.pi/agent` elsewhere |

## Context layer

What the agent has to understand a repo while reading as little as possible. All tested end to end
with `halo/flash-halogen`.

| Piece | Where | What for |
|---|---|---|
| Tools `grep`, `find`, `ls` | `settings.json` → `defaultTools` | Search with bounded output. They need `rg` and `fd`. |
| Tool `repo_map` | `extensions/repo-map.ts` | Repo map in ~40 lines: manifests and commands, tree with number of files, languages, most-touched files. |
| MCP `context7` | `catalog/mcps/context7.json` (per repo) | Library documentation by version (`resolve-library-id`, `query-docs`). Remote, no key. |
| MCP `duckduckgo` | `catalog/mcps/duckduckgo.json` (per repo) | DuckDuckGo search and page reading (`search`, `fetch_content`). `uvx duckduckgo-mcp-server==0.7.0`, no key. |
| `ast-grep` | `bun add -g @ast-grep/cli@0.45.3` | Structural search by syntax. |
| Skill `code-context` | `catalog/skills/code-context/` (per repo, with `bond init`) | When to use each thing, `ast-grep` recipes per language. |

**Why `repo_map` is a tool and not just a script in the skill.** In the test, the local model
didn't load the skill on its own initiative and oriented itself with `git log` by hand (and miscounted). With the
tool declared it calls it first and the result is right. Small models use a tool much better
than a skill they have to decide to open.

**Why the search server is called `duckduckgo` and not `web`.** The OpenAI API reserves
the `web` namespace for its tools: Copilot (with OpenAI models) failed with
`Function 'web.web-expand_link' is not allowed in reserved namespace 'web'`, and Codex uses the same
API. In `bond.toml`, `"web"` is still accepted as an alias (with a warning).

**Why the MCP servers use `exposure: "direct"`.** By default pi exposes MCP tools only
through `codemode` (the model writes JavaScript that calls them). For a local model that is
one more step where it can fail, and with 5 tools in total there's no need to save declarations. If
large servers are added, `"exposure": "deferred"` and `tool_search` are advisable.

**Pinned versions.** The `duckduckgo` server and `ast-grep` use an exact version at least two
weeks old, so as not to run what was published yesterday. To update: change the version
in `catalog/mcps/duckduckgo.json` (or reinstall `ast-grep`) and verify with `pi mcp list`.

**Privacy.** `context7` and `duckduckgo` are external services: they receive the queries, not the code.
`AGENTS.md` asks not to send code or private data to the web.

Checking and debugging:

```bash
pi mcp list                       # connects each server and lists its tools
scripts/pi-resources              # tools and skills that pi loads from the package
tail ~/.pi/agent/mcp.log          # server logs
```

Inside pi, `/mcp` shows status, tools and exposure, and lets you disable a server.

To use a Context7 key (more quota), add to its entry
`"headers": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}" }` and export the variable; don't put the
key in the file.

## BOND header (`extensions/bond-header.ts`)

Replaces pi's header with the BOND logo: the word in 3 rows of half blocks
(`▀ ▄ █`) with a gradient from magenta (`#FF3EC9`) to dark blue (`#1F2FA8`), a data row
above (`007` on the left, pi version on the right) and a field of `╱` diagonals. The
style is inspired by the Crush logo (charmbracelet); the letters and the code are original,
because Crush's is under the FSL license.

```
╱╱╱╱╱╱ 007                        ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
╱╱╱╱╱╱ █▀▀▄ ▄▀▀▀▄ █▄  █ █▀▀▀▀▀▀▀▄ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
╱╱╱╱╱╱ █▀▀▄ █   █ █ ▀▄█ █       █ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
╱╱╱╱╱╱ █▄▄▀ ▀▄▄▄▀ █   █ █▄▄▄▄▄▄▄▀ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
```

- It adapts to the width: with room, diagonals on the sides and stepped on the right (capped
  at 32); in medium panes, diagonals above and below; in very narrow ones, a single line
  `007 BOND ╱╱╱`.
- As in Crush, one letter (B, O or D) is stretched at random, once per session.
- `/header` switches back to pi's header, with its keyboard shortcuts.

The logo lives in `lib/bond-logo.mts`, with no dependencies. It is used by the header, `bin/bond-logo`
(for the terminal) and `bond`/`bond team`, which print the one-line version:

```bash
bond-logo                       # at the terminal's width
bond-logo --width 40            # force a width
bond-logo --small "texto"       # one line: 007 BOND texto ╱╱╱
```

It is `.mts` so that Node 22+ runs it as an ES module without marking the whole package as
`"type": "module"`.

## Status footer (`extensions/status-line.ts`)

Replaces pi's footer with one designed for several agents in narrow panes:

```
w1-hardening@w6:p5 · fluzo · main [wt] · flash-halogen (medium) → otro-modelo
████░░░░░░░░ 34% · $0.12 ↑48k ↓3.1k · sess 12:04 api 3:10 · +120/-14 · req ✓31 ✗1
<estados de otras extensiones, si hay>
```

| Piece | Where it comes from |
|---|---|
| `nombre@panel` | `HERDR_PANE_ID` and `herdr agent list` (refreshed every 30 s). Outside Herdr it doesn't appear. |
| `[wt]` | The directory is a git worktree (`--git-dir` different from `--git-common-dir`). |
| `→ modelo` | The last message was answered by a model other than the selected one (virtual models or routers). |
| Bar | `ctx.getContextUsage()`: green < 50 %, yellow < 80 %, red from there on. |
| Cost | Only if greater than 0; with the local `halo` models only tokens are shown. |
| `req ✓ ✗` | Successful and failed requests to the model in this session. |
| Rate limit | Countdown with the wait the provider asks for (`retry-after` header or error text). |

The third line shows the statuses that other extensions set with `ctx.ui.setStatus()`, which
a custom footer would otherwise hide. `/statusline` toggles between this footer and pi's.

Adapted from `status-line.ts` in [Jeyapaul/pi](https://github.com/Jeyapaul/pi) (MIT).

## `bond sessions`

```bash
bond sessions                 # the 20 most recent across all projects
bond sessions fluzo           # filter by name, directory or id
bond sessions --here          # only those in the current directory
bond sessions --live          # only those currently open in a Herdr agent
bond sessions -n 0 --json     # all of them, for scripts
```

Reads `~/.pi/agent/sessions/` (or `PI_CODING_AGENT_SESSION_DIR`). For each session it shows
directory, name (`/name` in pi), messages, cost, the Herdr agent that has it open
(matching `agent_session` from `herdr agent list`) and the command to resume it:

```bash
cd ~/gitrepos/fluzo && pi --session 01a13acd
```

The `cd` comes first because pi looks for a partial id first among the sessions of the current
directory; if it finds it in another project, it asks before opening it. The id is the shortest
prefix (minimum 8) not shared by any other session: UUIDv7s start with the time and two
sessions from the same minute share the first characters.

Sessions whose directory no longer exists (a deleted worktree) appear dimmed and marked
`(no existe)` (does not exist).

## Frequently used Herdr CLI

```bash
# CLI responses are JSON with the data under .result
# (e.g. .result.agents, .result.workspaces).
herdr status                      # client, server, compatibility, socket
herdr workspace list              # workspaces with ids and states
herdr workspace focus w3
herdr tab list --workspace w3
herdr pane list --workspace w3
herdr pane split --current --direction right --cwd "$PWD" --no-focus
herdr pane run w3:p6 "npm test"
herdr pane wait-output w3:p6 --match "test result" --timeout 120000
herdr pane read w3:p6 --source recent-unwrapped --lines 200
herdr agent list
herdr agent prompt pi-mi "tarea" --wait
herdr agent wait pi-mi --until blocked
herdr agent explain pi-mi         # why it classified it that way
herdr integration status
```

`pane read` sources: `visible` (what is drawn), `recent` (with soft line breaks),
`recent-unwrapped` (ideal for logs and transcripts), `detection` (snapshot used by the
detector).

## Updating

```bash
bond update                                     # bond (--check: only look)
herdr update                                    # Herdr
bun add -g @earendil-works/pi-coding-agent@latest   # pi (if installed with bun)
bond setup && bond doctor                       # revalidates everything after updating
```

`bond update` replaces the binary if you installed it with `install.sh` or `install.ps1`: it downloads
the release's binary, checks its SHA-256 against `SHA256SUMS` and tests that it starts before
swapping it. With Homebrew it tells you the command (`brew update && brew upgrade
jmanuelcorral/tap/bond`). `@jmanuelcorral/bond` is not yet published on npm: on an npm
installation it points you to the release package (`npm i -g
https://github.com/jmanuelcorral/bond/releases/download/vX.Y.Z/jmanuelcorral-bond-X.Y.Z.tgz`).
`--version vX.Y.Z` installs a specific one, including an older one. Wherever it comes from, the new
version moves `~/.bond/pi` and the global skills that pointed to another version's files over to its own, and
deletes old versions from `~/.bond/runtime/`.

When opening the workstation (`bond`, `bond dev`, `bond team`; not their subcommands or the
help), bond checks for a new release once every 24 h (the timestamp goes in `~/.bond/state.json`).
The query has a cap of ~2 s: with no network or no response, startup continues silently.
If there is a new version, it asks:

1. **Update now**: with the `install.sh`/`install.ps1` binary it does the same as
   `bond update` and continues with the new version; if the downloaded binary doesn't start, the
   current one stays and it warns. With Homebrew it warns that `brew update` refreshes the index of all
   taps on the machine (bond can't undo it), runs `brew update && brew upgrade
   jmanuelcorral/tap/bond` with brew's output visible and continues with
   `$(brew --prefix bond)/bin/bond`. If brew fails (lock, no network, tap down) or doesn't yet have that
   version, you see the error, nothing changes and startup continues with the version you had. With
   npm or from source it tells you the command.
2. **Skip that version**: it won't mention it again; the next release is offered. The same
   by hand: `bond update --skip vX.Y.Z` (without touching the network); `bond update --skip-reset` removes the
   skip and the version is offered again.
3. **Don't ask again**: writes `[update] auto = false` in `~/.bond/config.toml` (without
   touching the rest of the file). To restore it, `auto = true` or delete the table.

Enter, or any other answer, leaves the question for the next check. Without a terminal
(input or output redirected) it doesn't ask: it only warns on stderr. `BOND_NO_UPDATE=1` disables
the check entirely; `BOND_RELEASES_URL` changes where releases are read from.

`bond doctor` shows the status: installation method, last check, pending version,
skipped version and whether it asks at startup.

`pi update` only applies to installations done with the official installer
(`curl -fsSL https://pi.dev/install.sh | sh`); with bun or npm it is updated from the
package manager.

## Uninstalling

```bash
rm -r ~/.bond                     # global config, keys, instructions and runtime
rm -r ~/.agents/skills/bond-delegate ~/.agents/skills/bond-team ~/.claude/skills/bond-*
```

What bond wrote in each agent (models, instructions block) stays: it is yours. In
each repo, `.bond/` and the generated files are part of the repo. To remove the Herdr
integrations: `herdr integration uninstall <agente>`.
