# Getting started

Let's take you from a brand-new machine to working with bond without any surprises. There are
only a few steps, and you do almost all of them just once: first you prepare the machine, then
each repo, and from there on you're left with the day-to-day, which is the fun part. Licence to
code in hand, let's begin.

## What you get

The first thing you get is a CLI, `bond`, which takes care of configuring your coding agents and
opening them in **Herdr**. Any of these will do: pi, Claude Code, Codex, Copilot CLI, opencode,
Crush or Gemini CLI. You don't need all of them; one is enough, and bond works with whichever
ones you have.

The second is Herdr, the terminal multiplexer where your agents live. The nice thing about Herdr
is that panes survive even if you close the terminal, and its sidebar tells you at a glance which
agent is `working`, `blocked` or `done` in each project. So you don't have to go pane by pane
asking "are you done yet?".

And the third: if you use your own models (Ollama, LM Studio or an OpenAI-compatible gateway),
you declare them once and bond makes them available in every agent that can use them. No more
copying the same URL into five different config files.

## 1. Requirements

You don't need much. This table helps you check that you have everything:

| Tool | What for | Check |
|---|---|---|
| At least one agent | pi, Claude Code, Codex, Copilot CLI, opencode, Crush or Gemini CLI | `bond setup` tells you how to install each one |
| `herdr` | open the workstation | `herdr --version` |

If you don't have any agent installed yet, relax: `bond setup` explains how to install each one
when you get to that step. Herdr, on the other hand, is worth having at hand; the installation
instructions are here: https://herdr.dev/docs/install/

## 2. Install

On Linux and macOS, the quickest route is the install script. If you prefer Homebrew, that works
too:

```sh
curl -fsSL https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.sh | sh   # Linux, macOS
brew install jmanuelcorral/tap/bond                                                    # or Homebrew
```

If you're on Windows, open a terminal and run this:
`powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.ps1 | iex"`.

With bond installed, the next step is to configure the machine:

```bash
bond setup
```

## 3. `bond setup` (once per machine)

`bond setup` is a short conversation in which bond asks you three questions.

First it checks whether you have **Herdr**. If it's missing, it tells you how to install it.

Then it moves on to the **model endpoints**. It detects Ollama and LM Studio on its own if
they're running, and you can add OpenAI or any compatible endpoint by giving it the URL and the
key, if one is required. bond checks which models each endpoint serves and lets you pick the ones
you want to use. If you have, say, Ollama with a couple of models downloaded, you'll see them in
the list and tick the ones you care about.

Finally it asks you about the **agents**: which ones you want to work with and which one will be
the default.

With those answers, bond gets down to work. It brings the models to every agent that can use
them, installs the Herdr integrations and the delegation skills, and copies your personal
instructions (`~/.bond/AGENTS.md`, where you put things like your language or the style you
like) to each agent's global file. That way you write your preferences once and every agent
knows them.

Everything it configures is saved in `~/.bond/`. Keys go separately, in `~/.bond/keys/`, with
permissions 600 so that only you can read them. You can rerun `bond setup` whenever you like, for
example when you install a new agent or add another endpoint. And if at some point something
doesn't add up, `bond doctor` checks that everything is in its place.

One more detail: the first time you open each agent, log in to it as you normally would
(`/login` in pi and Claude Code, etc.). Models from your endpoints don't need a login; those
just work.

## 4. `bond init` (once per repo)

<figure class="bond-video">
<video src="/videos/init.mp4" controls muted playsinline preload="metadata"></video>
<figcaption>bond init in fluzo, a Rust repo: we pick pi and Claude Code, drop the skills fluzo already has and add plan-team.</figcaption>
</figure>

With the machine ready, it's time to prepare the repo you're going to work in. Let's say it's
called `mi-proyecto`:

```bash
cd ~/gitrepos/mi-proyecto
bond init
```

`bond init` asks which agents you want to integrate the repo with, which one `bond` opens by
default and which tools from the catalog you want to use. In the catalog you'll find
documentation and search MCP servers, skills such as `code-context` or `plan-create`, and the
`review`, `commit` and `handoff` commands. Pick whatever suits you; you can always come back
later.

When it finishes, you'll see several new files in the repo: `.bond/bond.toml` with bond's
configuration, an `AGENTS.md` for you to fill in with what your agents should know about the
project, and each agent's config. Commit all of it, so the rest of the team gets the same setup
when they clone. The first time you open each agent in the repo it will ask you to trust it;
that's normal. If the repo is yours or you've already reviewed it, say yes (bond doesn't do that
for you).

Does your team share skills, commands or MCP servers? Then you'll want to set up your own
catalog. The team creates it in its own repo with `bond catalog create` and checks it with
`bond catalog check`, which is designed to go into its CI. After that, each project that wants
to use it declares it with `bond catalog add <url> [--ref tag|rama]`. The exact commit is pinned
in `.bond/lock.json`, so nobody gets caught out by a change that arrives unannounced.
`bond doctor` shows one row per catalog, with whether it's pinned, whether it's cached and
whether there's a newer version. The details and the security side of things are in the
[reference](reference.md#your-own-catalog-bond-catalog).

## 5. `bond` and the daily work loop

This is the part you'll repeat every day. You go into the repo and type:

```bash
bond
```

bond opens Herdr with the default agent in its pane, and it names that agent `gru` (it's the one
that orchestrates; if there's already another `gru`, it'll be `gru-2`). If the repo's workspace
already exists, it doesn't create another one; it simply takes you there. If you want a shell
next to the agent, use `bond --shell`. To open another of the repo's agents, `bond --agent claude`,
and to work in a worktree, `bond --worktree feat/x`. You'll find all the details in
[workstation.md](workstation.md).

**Working in the pane.** Put the focus on the agent's pane and work with it as always, asking it
for things and reviewing what it does. To drive Herdr you use the prefix `ctrl+b` followed by a
key. These are the shortcuts you'll use the most:

| Shortcut | What it does |
|---|---|
| `prefix+v` | splits the pane to the right |
| `prefix+minus` | splits the pane down |
| `prefix+c` | opens a new tab |
| `prefix+h/j/k/l` | moves you between panes |
| `prefix+?` | shows all active shortcuts |

**Without stealing focus.** Long-running things, like tests, a build or a server, are better off
in a separate pane so they don't end up blocking your conversation with the agent. You can split
a pane without leaving the one you're in, launch the command there and wait for what you're
looking for to show up in the output:

```bash
herdr pane split --current --direction down --cwd "$PWD" --no-focus
herdr pane run <panel-nuevo> "npm test"
herdr pane wait-output <panel-nuevo> --match "test result" --timeout 120000
```

**Driving an agent from another terminal.** You don't need to be inside its pane to talk to it.
From any shell on the machine you can send it a prompt, wait for it to finish and then read what
it answered:

```bash
herdr agent prompt gru "revisa el diff actual" --wait --timeout 300000
herdr agent read gru --source recent-unwrapped --lines 200
```

**Seeing the global status.** When you have several agents running and want to know how each one
is getting on:

```bash
bond status
```

You'll see a table with the agent, its kind, its status, the cwd and the pane it's in. If you
want it for a script, `bond status --json` gives you the same thing in JSON.

**Resuming a session.** Did you leave something half-finished yesterday and can't remember where?

```bash
bond sessions
```

It lists the sessions from every project, marks which ones are open in Herdr right now and gives
you the exact command to resume each one. And if you're inside pi, the status footer reminds you
which agent you are, which branch and worktree you're on, and how much context you have left.

**Plugging in another project.** Just run `bond` inside the other repo and you'll have another
workspace. The Herdr sidebar shows you every agent from every project at once, so you know which
one is working, which one is waiting and which one has finished without having to open anything.

**A hub: several repos, one workstation.** If your project lives in several repos (a frontend and
a backend, say) and you want to work them as one, `bond hub init` creates the hub: a shared git
repo that imports each repo as a submodule (by URL) or as a link to a local clone, all declared
in `hub.toml`. `bond hub check` reviews that every repo is ready to work with agents (`--fix`
repairs the safe things) and `bond team fix/x` opens a vertical branch: one agent per repo of the
session, on the same branch. The full flow is in the [reference](reference.md#bond-hub) and in
[workstation.md](workstation.md#a-vertical-branch-in-a-hub).

## 6. Detaching and coming back

Time to head off, and you've got tests running and an agent halfway through a task. No problem.
Press `ctrl+b` and then `q` to detach from Herdr. Everything keeps running in the background: the
panes, pi, the tests.

When you come back, you reattach and find everything just as you left it:

```bash
herdr                    # reattach
pi --continue            # inside a pane, resume the last pi session for that folder
```

If what you want is to really shut everything down, use `herdr server stop`. Careful, though: it
closes all panes, so don't do it if you have work in progress.

## 7. Commands that come with bond

bond comes with a handful of commands ready to use. You have them in every repo initialized with
Claude Code, opencode and Gemini (Copilot reads them as skills), and also in pi with the Bond
Extensions:

| Command | Use |
|---|---|
| `/review [foco]` | Reviews uncommitted changes, actionable findings only |
| `/commit [contexto]` | Drafts the message in English and waits for your OK before committing |
| `/handoff [ruta]` | Writes the state down in `.handoff.md` so you can pick it up later |

On top of that, in any agent you have two global skills for when a single agent isn't enough.
With `bond-delegate` you hand a task off to another agent working in a sibling pane; in pi you
call it with `/delegate rol[:agente] tarea`. With `bond-team` you split a task among several
agents, each in its own worktree; in pi, with `/team tarea`. Your very own team of agents, in the
style of a good spy film.

## Minimal glossary

Herdr uses a few terms that are worth having clear. Here they are, for whenever you need to look
one up:

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

If anything in this guide isn't clear or doesn't work the way it says, open an issue at
https://github.com/jmanuelcorral/bond/issues and we'll take a look.
