# What's new

Notable changes and highlights across bond releases.

## bond 1.10.0: hub mode

Until now, bond helped you work with coding agents in standalone git repositories: `bond init` set up the configuration, `bond` opened your workstation in Herdr, and `bond team` distributed parallel branches among agents in their own worktrees.

In real-world projects, however, code is frequently split across multiple repositories: a frontend web app, a backend API service, and perhaps shared libraries. When a feature or bug fix requires touching both the frontend and backend at once (such as creating a new API endpoint and immediately consuming it in the UI), coordinating separate branches and agents by hand quickly becomes tedious.

That is why **hub mode** is here.

<div class="terminal-window">
  <div class="terminal-header">
    <div class="terminal-dots">
      <span class="terminal-dot dot-red"></span>
      <span class="terminal-dot dot-yellow"></span>
      <span class="terminal-dot dot-green"></span>
    </div>
    <div class="terminal-title">bond hub: demo-hub</div>
  </div>
  <video src="/videos/hub-en.mp4" poster="/videos/poster-hub-en.webp" controls muted loop playsinline preload="metadata"></video>
</div>
<p class="terminal-caption">A hub with a React frontend (submodule) and an Express backend (symlink): <code>bond hub init</code>, <code>bond hub check</code> and a pi orchestrator that splits the story into a vertical branch with <code>bond team</code>, one pi agent per repo, and checks it all at the end.</p>

### What is a hub?

A **hub** is an operations git repository that groups together your project repositories (declared in `hub.toml`). It does not replace your repositories or force them into an artificial monorepo: each repository preserves its own git history, remotes, and independence.

Repositories can be linked into a hub in two ways:
- **As a git submodule (`link = "submodule"`)**: ideal when sharing the hub repository across your team through a remote git forge.
- **As a local link (`link = "symlink"`)**: ideal for working with existing local clones already on your machine, without altering their structure. Machine-specific paths to local clones are saved in `.bond/hub.local.toml` (which remains local and is never committed to git).

### Vertical work with `bond team`

The real power of hub mode unlocks with `bond team`. In an individual repository, `bond team` delegates independent branches to separate agents. In a hub, `bond team` operates **vertically**:

1. **A branch with the same name across all repositories**: when you run `bond team fix/login`, bond creates the branch in the hub and checks out an isolated worktree with that same branch in each session repository (or in the subset specified via `--repos`).
2. **One agent per repository**: each repository gets its own agent in an isolated worktree (`~/.herdr/worktrees/<hub>/<repo>/<branch>`), equipped with that repository's own configuration and tools.
3. **One vertical branch at a time**: to maintain focus and prevent interdependency conflicts, bond ensures only one vertical branch is active in the hub at any given moment.
4. **A unified live table**: Herdr opens a single `tabla · <hub>` pane tracking all repositories of the session in real time.

### When to use a hub?

Use a hub when:
- Your system is split across several interdependent repositories (frontend, backend, microservices, libraries).
- You want an orchestrator agent (such as pi or Claude Code) to plan global milestones and coordinate specialized minion agents across repositories.
- You need to implement or verify features that cross repository boundaries with synchronized branches.

If you are only working on a single self-contained repository, you do not need a hub: `bond init` and `bond` continue to work just as they always have.

### Hub directory layout

At the root of a hub, session configuration, linked repositories, and operational documentation live together:

```text
my-hub/
├── hub.toml                  # Session declaration (name, base branch, repos)
├── AGENTS.md                 # Global agent instructions with generated bond:hub block
├── .bond/
│   ├── bond.toml             # Hub bond configuration (agents and skills)
│   └── hub.local.toml        # Local symlink paths on this machine (.gitignore)
├── repos/                    # Default folder for linked repositories
│   ├── frontend/             # Submodule or local symlink
│   └── backend/              # Submodule or local symlink
├── docs/
│   ├── plans/                # Multi-repo plans and milestone tracking
│   └── decisions/            # Hub decision memory (optional)
└── .gitignore
```

- **`hub.toml`**: declares the session name, the default base branch (e.g. `main`), and each repository with its path, base branch, link type (`submodule` or `symlink`), default agent, and an optional description.
- **`repos/`**: the standard folder where linked repositories live to keep the hub root organized and uncluttered.
- **`docs/plans/` and `docs/decisions/`**: the hub centralizes team plans and, if decision memory is enabled via `[decisions]`, agent task requests and completion reports (`runs`) are recorded here.
- **The `bond:hub` block in `AGENTS.md`**: `bond sync` automatically maintains a marked block containing a summary table of the session repositories, their descriptions, base branches, and operational rules (such as not editing `repos/` directly from the hub, but through `bond team`). Content outside the marker is left untouched.

### The end-to-end workflow

Working in a hub follows six straightforward steps:

```bash
# 1. Initialize or prepare the hub
bond hub init

# 2. Verify that the session is ready
bond hub check --fix

# 3. Fast-forward base branches
bond hub pull

# 4. Open the vertical branch and assign tasks
bond team feat/auth
bond team prompt feat/auth "Add JWT authentication: endpoint in backend and form in frontend"

# 5. Collect work from agents
bond team collect feat/auth --repo backend
bond team collect feat/auth --repo frontend

# 6. Clean up worktrees
bond team clean feat/auth
```

1. **`bond hub init`**: interactive wizard that initializes the hub, runs `bond init` if needed (including the `plan-team` skill), imports submodules or local symlinks, and sets up bond in member repositories that do not have it yet.
2. **`bond hub check`**: verifies every session repository. It checks that repositories exist, link types match, base branches exist, agent configurations are in sync, and worktrees are clean. With `--fix`, it safely repairs broken links and initializes submodules. In `--json` mode, it provides structured `level` details (`ok`, `warn`, `fail`) and issue tallies.
3. **`bond hub pull`**: updates the base branch of the hub and each repository using `git fetch` and fast-forward advance only. If a repository has uncommitted changes or divergent history, it is skipped safely without merging or rebasing.
4. **`bond team <branch>`**: opens the vertical branch in the hub and creates worktrees and agents in each repository. `bond team prompt` distributes instructions, automatically annotating the prompt with teammate names and folders so cross-repo work fits together cleanly.
5. **`bond team collect`**: retrieves the report and commits from each agent. If the hub has decision memory configured, the task and report are recorded into a centralized run.
6. **`bond team clean`**: removes worktrees across session repositories. With `--delete-branch`, it also deletes integrated branches once work is completed.

### What the hub does for you

- **Cascaded configuration**: when adding repositories with `bond hub init` or `bond hub add`, bond applies the agent configuration to repos that lacked bond, saving you from configuring each one manually.
- **Automatic agent context**: through the generated `bond:hub` block in `AGENTS.md`, any agent running in the hub immediately understands what repositories exist, what each is responsible for, and where plans are kept.
- **Guaranteed structure**: the `repos/` default location, outdated base warnings, and single-vertical-branch rule prevent cross-repo conflicts and common multi-repo mistakes.

For complete CLI options and details, see [bond hub in the Reference](reference.md#bond-hub) and the vertical branch guide in [The workstation](workstation.md#a-vertical-branch-in-a-hub).
