# Getting started

From zero to working with bond on a new machine.

## What you get

- A CLI, `bond`, that configures your coding agents (pi, Claude Code, Codex, Copilot CLI,
  opencode, Crush, Gemini CLI: whichever you have, one is enough) and opens them in **Herdr**.
- Herdr: panes survive closing the terminal, and the sidebar tells you which agent
  is `working`, `blocked` or `done` in each project.
- Your own models (Ollama, LM Studio, an OpenAI-compatible gateway) available in the
  agents that can use them, declared only once.

## 1. Requirements

| Tool | What for | Check |
|---|---|---|
| At least one agent | pi, Claude Code, Codex, Copilot CLI, opencode, Crush or Gemini CLI | `bond setup` tells you how to install each one |
| `herdr` | open the workstation | `herdr --version` |

Herdr: https://herdr.dev/docs/install/

## 2. Install

```sh
curl -fsSL https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.sh | sh   # Linux, macOS
brew install jmanuelcorral/tap/bond                                                    # or Homebrew
```

On Windows: `powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.ps1 | iex"`.

Then:

```bash
bond setup
```

## 3. `bond setup` (once per machine)

It asks you about:

1. **Herdr**: if it is missing, how to install it.
2. **Model endpoints**: it detects Ollama and LM Studio; you can add OpenAI or a compatible
   endpoint (URL, key if it requires one). It checks what each one serves and lets you pick models.
3. **Agents**: which ones to work with and which one is the default.

Then it brings the models to every agent that can use them, installs the Herdr integrations and
the delegation skills, and copies your instructions (`~/.bond/AGENTS.md`: language, style…) to
each agent's global file. Everything lives in `~/.bond/`; keys go in `~/.bond/keys/` with
permissions 600. You can rerun it whenever you like; `bond doctor` checks that everything is fine.

The first time you open each agent, log in to it as usual (`/login` in pi and
Claude Code, etc.). Models from your endpoints need no login.

## 4. `bond init` (once per repo)

```bash
cd ~/gitrepos/mi-proyecto
bond init
```

It asks which agents to integrate the repo with, which one `bond` opens by default and which tools
from the catalog to use (documentation and search MCP servers, skills such as `code-context` or
`plan-create`, the `review`, `commit` and `handoff` commands). It creates `.bond/bond.toml`, an `AGENTS.md` for you to
fill in and each agent's config. Commit all of it. The first time you open each agent in
the repo, it will ask you to trust it.

Does your team share skills, commands or MCP servers? The team sets up a catalog in its
own repo (`bond catalog create`), checks it with `bond catalog check` (for its CI) and each
project declares it with `bond catalog add <url> [--ref tag|branch]`: the commit is pinned in
`.bond/lock.json` and `bond doctor` shows one row per catalog — pinned, cached and whether a
newer version exists. Details and security in the [reference](reference.md#your-own-catalog-bond-catalog).

## 5. `bond` and the daily work loop

Inside the repo:

```bash
bond
```

It opens Herdr with the default agent, named `gru`, in its pane (if it already exists, it focuses it;
`bond --shell` adds a shell next to it).
`bond --agent claude` opens another of the repo's agents; `bond --worktree feat/x`, in a worktree.
Details in [workstation.md](workstation.md).


**Working in the pane.** Focus the pi pane and work as usual. With the prefix
`ctrl+b` you control Herdr: `prefix+v` splits to the right, `prefix+minus` splits down,
`prefix+c` new tab, `prefix+h/j/k/l` moves between panes, `prefix+?` shows
all active shortcuts.

**Without stealing focus.** For long-running things (tests, builds, a server), split a pane and
run them there:

```bash
herdr pane split --current --direction down --cwd "$PWD" --no-focus
herdr pane run <panel-nuevo> "npm test"
herdr pane wait-output <panel-nuevo> --match "test result" --timeout 120000
```

**Driving an agent from another terminal.** From any shell on the machine, without touching its
pane:

```bash
herdr agent prompt gru "revisa el diff actual" --wait --timeout 300000
herdr agent read gru --source recent-unwrapped --lines 200
```

**Seeing the global status.**

```bash
bond status
```

Table with agent, kind, status, cwd and pane. `bond status --json` for scripts.

**Resuming a session.**

```bash
bond sessions
```

Sessions from every project, which ones are open in Herdr right now and the exact command
to resume each one. Inside pi, the status footer tells you which agent you are, on which branch
and worktree, and how much context you have left.

**Plugging in another project.** `bond` inside that other repo: another workspace. The Herdr sidebar
shows you every agent from every project at once: you see which one is working, which one is
waiting and which one has finished without opening anything.

## 6. Detaching and coming back

`ctrl+b` followed by `q` detaches you. Everything keeps running: the panes, pi, the tests.

```bash
herdr                    # reattach
pi --continue            # inside a pane, resume the last pi session for that folder
```

To really stop everything: `herdr server stop` (closes all panes; don't do it with
work in progress).

## 7. Commands that come with bond

In every initialized repo (Claude Code, opencode, Gemini; Copilot reads them as skills) and in pi
with the Bond Extensions:

| Command | Use |
|---|---|
| `/review [foco]` | Reviews uncommitted changes, actionable findings only |
| `/commit [contexto]` | Drafts the message in English and waits for your OK before committing |
| `/handoff [ruta]` | Writes the state down in `.handoff.md` to pick it up later |

And in any agent, the global skills: `bond-delegate` (in pi, `/delegate rol[:agente]
tarea`) to delegate to another agent in a sibling pane, and `bond-team` (in pi, `/team tarea`)
to split a task among several agents in worktrees.

## Minimal glossary

| Term | What it is |
|---|---|
| **Session** | Herdr server space. Plain `herdr` uses the default one. |
| **Workspace** | Project-level container. One per repo or task. |
| **Tab** | A layout inside the workspace. |
| **Pane** | A real terminal. Can be split to the right or down. Survives detach. |
| **Agent** | Process that Herdr recognizes inside a pane, with a status. |
| **idle / done** | The agent is ready to receive input. |
| **blocked** | An approval or question is waiting. Look at it before answering. |
| **working** | It is running. |
| **unknown** | There is an agent but Herdr cannot classify it reliably. Read it yourself. |

Next stop: [reference.md](reference.md) for the full reference.
