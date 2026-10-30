# The workstation: `bond`, `bond team` and `bond status`

This is the everyday page. You already have bond set up on your machine (`bond setup`) and the
repo is ready (`bond init`), so now comes the fun part: sitting down to work with your agents.
Here you'll see how the workstation opens in Herdr, how to split work between several agents at
once and how to know at any moment who is doing what.

The idea behind it is simple. You talk to `gru`, the agent that orchestrates, and when there's
work that can happen in parallel, you hand it out to the minions, each one on its own branch and
in its own worktree. They wrestle with the code; you review and integrate. Licence to code, but
supervised.

Here's the quick summary, in case you only came for the cheat sheet:

```bash
cd ~/gitrepos/mi-proyecto
bond                              # default agent (default_agent from .bond/bond.toml)
bond --agent claude               # another of the repo's agents
bond --worktree feat/login        # in a git worktree for that branch
bond dev ~/gitrepos/otro          # the same for another directory
bond team . feat/a feat/b:claude  # one agent per branch, each in its own worktree
bond status                       # running agents
```

`bond status` is the shortest of them all and lists the agents that are still running. The rest
deserve a relaxed stroll.

## Opening the workstation with `bond`

<figure class="bond-video">
<video src="/videos/puesto.mp4" controls muted playsinline preload="metadata"></video>
<figcaption>bond opens fluzo in Herdr with gru (pi), we ask what the repo is about and check bond status in a shell next to it.</figcaption>
</figure>

Picture yourself in `~/gitrepos/mi-proyecto` typing `bond`, nothing else. What you get is the
repo's workstation in Herdr: the default agent, called `gru`, alone in its pane and ready for you
to talk to it. If you like having a terminal at hand, add `--shell` and you'll get a shell next
to it.

Under the hood, bond runs a few checks so you don't have to think about them.

First it looks at whether the repo is ready. If it has no `.bond/bond.toml`, it asks whether you
want to initialize it with `bond init`. And if you aren't even inside a git repo, `bond` shows you
the help, which is the most useful thing it can do at that point.

Then it makes sure the configuration is up to date. If `bond.toml` changed since last time and
some agent's config has fallen behind, it runs `bond sync` before opening anything. Conflicts,
meaning files you've edited by hand, are left alone.

Next it picks the agent. It uses the one you pass with `--agent`; if you don't pass one, the
repo's `default_agent`; if the repo doesn't have one, the one you chose in `bond setup`; and if
that's missing too, the first one it finds installed. Either way, the agent has to be installed
and Herdr has to support it (you can check with `herdr agent start --help`).

With the agent settled, it takes care of Herdr. If you're outside Herdr and its server isn't
running, it starts it in the background. If you're already inside, it doesn't nest another Herdr
inside yours, because nobody enjoys that.

Now it looks for the workspace, which carries the label `bond:<repo>` (or `bond:<repo>/<rama>` if
you use `--worktree`). If it already exists, it just focuses it and stops, so you can type `bond`
as many times as you like without ending up with ten copies of the same workstation. It also
recognizes the old labels, the `pi:<repo>` kind.

If it has to create it, it sets up the panes. The agent goes alone in the root pane. With
`--shell`, the shell opens on the right and the split is 60 % for the agent and 40 % for the
shell. The agent in the main checkout is called `gru`, because it's the one that orchestrates; if
there's already another `gru` in Herdr, this one will be `gru-2`, `gru-3` and so on. With
`--worktree`, the name follows the pattern `<agente>-<repo>-<rama>`.

Finally, if you launched `bond` from outside Herdr, it attaches its interface when it's done so
you land straight in the workstation. If you don't want that, `--no-attach` prevents it, and
`--no-focus` goes one step further and leaves everything in the background without switching your
workspace.

One important detail. Some agents stop to ask a question when they start; Claude Code, for
example, asks you to confirm whether you trust a new folder, and that happens a lot in a worktree.
When it does, bond tells you and doesn't answer for you. That decision is yours.

## Options

This table does deserve to stay a table, because it's what you'll want to check at a glance:

| Option | Effect |
|---|---|
| `-a`, `--agent <agente>` | Another agent instead of the default one |
| `-w`, `--worktree <rama>` | Worktree for that branch with `herdr worktree` (creates it, or opens it if it exists), under the `bond:<repo>` workspace |
| `-b`, `--base <ref>` | With `--worktree`: where a new branch starts from |
| `--shell` | A shell in another pane, next to the agent |
| `-d`, `--direction <right\|down>` | With `--shell`: where the shell goes (default: `right`) |
| `-r`, `--ratio <0.1-0.9>` | With `--shell`: fraction of the agent's pane (default: 0.6) |
| `-l`, `--label <texto>` | Workspace label |
| `--no-agent` | A shell instead of the agent |
| `--no-attach` | Don't attach the Herdr interface |
| `--no-focus` | In the background: neither focuses nor attaches |
| `--trust-repository` | Passed to `herdr worktree` (only in repos you have reviewed) |
| `-- args…` | Arguments for the agent, e.g. `-- --model halo/flash-halogen` |

## `bond team`

<figure class="bond-video">
<video src="/videos/orquestador.mp4" controls muted playsinline preload="metadata"></video>
<figcaption>What it looks like from inside: Claude, alone in its pane, sets up a team of two pi minions with bond team, hands them a website, reviews, asks for fixes, merges and cleans up. One instruction, no cuts.</figcaption>
</figure>

This is where bond gets interesting. With `bond team` you open one worktree and one agent for
each branch you ask for, and you can see how each one is doing. These are its four modes:

```bash
bond team [repo] <rama[:agente]>... [--agent <a>] [--base <ref>] [--tabs | --same-tab | --workspaces] [--yes] [--no-trust] [-- args de los agentes]
bond team status [repo] [--base <ref>] [--json | --watch [--keep-open]]
bond team prompt <rama> "la tarea" [--wait] [--timeout <ms>]
bond team clean [repo] [rama...] [--force] [--delete-branch] [--keep-table] [--dry-run]
```

In a hub (a repo with a `hub.toml`), `bond team` works vertically: see
[A vertical branch in a hub](#a-vertical-branch-in-a-hub).

### An example from start to finish

<figure class="bond-video">
<video src="/videos/equipo.mp4" controls muted playsinline preload="metadata"></video>
<figcaption>Two branches, two pi minions: each one makes its change and commits, and the live table moves them to «Por revisar» (ready to review). The wait is trimmed.</figcaption>
</figure>

Let's stay in `mi-proyecto`, with `gru` open. You have two things to do that don't step on each
other, the login and the payments page, and you want them to happen at the same time. From the
repo's shell:

```bash
bond team . feat/login feat/pagos:claude
bond team prompt feat/login "implementa el login con email y contraseña"
bond team prompt feat/pagos "añade la página de pagos"
```

The first line brings up the team. `feat/login` keeps the default agent and `feat/pagos` goes
with Claude Code, because you asked for it with `:claude`. The other two send each branch its
task. While they work, you carry on with your own stuff and keep an eye on the table. When a
branch shows up as `lista` (ready), you review it, integrate it however you like and at the end
tidy up with `bond team clean`. Let's take it one piece at a time.

### What you'll see on screen

If you're inside Herdr, each agent shows up in a pane of your own tab, below yours, all in a row
and with the same width. Each one gets a minion's name, the first one that's free (`kevin`,
`stuart`, `bob`, `dave`...), and its pane is titled, for example, `kevin · <rama>`. That way you
can tell at a glance who's handling what. Its worktree lives in `~/.herdr/worktrees/<repo>/<rama>`.

To the right of your pane a narrow one opens, `tabla · <repo>` (the table pane), with the live
table (`bond team status --watch`) of all the repo's branches, wherever they are. If that table
was already open from before, bond reuses it instead of opening another one. In a hub (session
declared in `hub.toml`), the pane is called `tabla · <hub>` whether it is launched from the hub or
from one of its repos, it shows a single table with the rows of the whole session, and it only
closes when no repo has pending work.

If you run `bond team` outside Herdr, it behaves as it always has: one workspace per branch with
`herdr worktree`.

### When they don't all fit

Your tab holds 6 panes: yours, the table and 4 minions, and the ones it already has open count
too. If the new agents fit, `bond team` doesn't ask anything. If they don't, it asks before
creating anything and offers you three paths:

1. `Pestañas nuevas` (New tabs) (the default): the ones that fit go in your tab and the rest in
   new `equipo · <repo>` tabs (the team tabs: `equipo · <repo> · 2`...), 4 per tab and in a row.
2. `Todo en mi pestaña` (Everything in my tab): rows of 4 (from the fifth on, each one below the
   one in its column), even if it gets cramped.
3. `Workspaces aparte` (Separate workspaces): one workspace per branch, as with `--workspaces`.

If you already know what you want, `--tabs`, `--same-tab` and `--workspaces` choose without
asking. And if there's no terminal (because input or output is redirected) or you pass `--yes`,
it doesn't ask either and goes with the first option.

Don't worry about where each one ended up. `status` and `clean` find and close the panes
whatever tab they're in, and when the last pane of a new tab is closed, Herdr removes the tab.

### Which agent each branch gets

If you don't pass `[repo]`, bond uses the one in the current directory. For each branch, the agent
comes from `rama:agente` if you wrote it that way; otherwise from `--agent`; otherwise from the
repo's default agent (`default_agent` in `.bond/bond.toml`); and if the repo doesn't have one,
from the one you chose in `bond setup`.

bond warns you in two cases worth knowing about. One, if an agent isn't among the repo's agents,
because then it won't have its config. Two, if you have uncommitted changes, because the
worktrees come from what's committed and won't see them.

### Handing out the work

Once the team is up, the work is handed out with `bond team prompt`, which sends a task to a
branch's agent without you having to remember whether it was called `kevin` or `stuart`.

You can also let an agent do it. From any of them you have the `bond-team` skill (in pi,
`/team`), which also proposes how to split the task, waits for your OK and then collects the
results. That's gru being gru.

If you work with plans in `docs/plans/`, the catalog skill `plan-team` does the same but by
phase. It checks which phases can run at the same time, sends each one with `plan-execute` (with a
commit on its branch and no push) and updates the plan as you integrate each branch.

### `bond team status`: how each branch is doing

`status` gives you one row per worktree of the repo with its status, its agent, the commits it
has ahead of the base (by default, the branch of the main checkout) and the files it touches.
In a hub (session declared in `hub.toml`), it shows the worktrees of every repo of the session
preceded by a `REPO` column, comparing each one with its base in `hub.toml`.
These are the statuses:

| Status | What it means |
|---|---|
| `trabajando` (working) | The agent is on it |
| `bloqueado` (blocked) | The agent is waiting for an answer from you (e.g. trusting the folder) |
| `sin commitear` (uncommitted) | There are changes in the worktree outside a commit |
| `lista` (ready) | It has unintegrated commits and it's time to review |
| `integrada` (integrated) | Already in the base, whether it went in via merge, fast-forward, rebase or squash |
| `sin commits` (no commits) | Nothing yet: the branch has not moved since it was created |

### The live table

With `--watch` you get the live table, which is what you see in the `tabla · <repo>` pane. It
fills the screen, refreshes every 2 s and exits with `q` or Ctrl+C, leaving the terminal as it
was. Branches are grouped by status, starting with whatever is waiting on you, and empty groups
aren't shown. In a hub, the header carries the vertical branch (`bond team · <hub> · <branch>`)
and the column is `REPO` instead of `RAMA`. It looks like this:

```text
MINION  RAMA    COMMITS  FICHEROS

⛔ Necesita tu respuesta
stuart  feat/b  -        -
   └ pregunta: confiar en la carpeta del proyecto

🔄 Trabajando
kevin   feat/a  +2       3

✏️ Sin commitear
bob     feat/e  -        1

📦 Por revisar
-       feat/c  +1       1

✅ Integradas / sin empezar
-       feat/d  +1       -
```

The icon only goes in each group's title, painted in its status color: red if it's waiting for
you, yellow if it's moving, green if it needs review and dim if there's nothing going on. The rows
carry the minion, the branch, the commits and the files, and under a blocked branch you'll see the
question it's waiting on. Since each group's title spells out the status in words, it's readable
even if your terminal doesn't render emoji well, and the columns line up by counting each emoji as
two characters.

The table also knows when to bow out. In the `tabla · <repo>` pane, when no branch has pending
work, it shows `sin trabajo pendiente` (no pending work), waits a few seconds so you can see it
and closes the pane. If there's work again before it closes, it carries on. Pending work means a
branch in `trabajando`, `bloqueado`, `sin commitear` or `lista`, or an open agent that hasn't made
any commits yet. A branch whose commits the table already saw and that goes back to `sin commits`
has been integrated via merge, so it counts as finished. There are three cases where it doesn't
close and only lets you know: if it's the focused pane, if you launched it with `--keep-open` or
if you ran it by hand in another pane.

### When a minion asks whether you trust the folder

pi, Claude Code and Antigravity (`agy`) ask whether you trust each new folder, and every worktree is a new folder. With
four minions that would be four identical dialogs, so bond gives you a hand.

When the agents run in panes and the orchestrator trusts the main checkout, bond gives each
agent's worktree that trust before launching it, and the agent starts without asking. The
orchestrator is pi, Claude Code or `agy` in the pane you launch the team from: if you trust the
repo through it, the rest of the team does too, even if their agent never opened it. If you launch
it from a shell, or the orchestrator doesn't trust it, each agent inherits the trust it already
gives the main checkout. You'll see it marked as `confianza heredada` (inherited trust). In pi,
trusting means the checkout's closest entry
in `~/.pi/agent/trust.json` is `true`; in Claude, that the checkout or a parent folder has
`hasTrustDialogAccepted` in `~/.claude.json`; in `agy`, that the checkout or a parent folder is
in `trustedWorkspaces` in `~/.gemini/antigravity-cli/settings.json` (bond adds the worktree by
its exact path).

bond is careful with those files. It touches nothing but that, respects pi's lock and writes
atomically. And if at some point you said you don't trust a folder, it stays that way. If you'd
rather it didn't do any of this, `--no-trust` turns it off.

Without that prior trust, with other agents or with `--workspaces`, the agent asks as usual.
Herdr doesn't always recognize it as a question, so bond reads the pane. The branch shows as
`bloqueado` and `prompt` doesn't send anything, because its Enter would choose "Trust" for you
and on top of that the task would be lost. Answer it yourself in the agent's pane. A tip for pi:
choosing "Trust parent folder" once covers all the worktrees of that repo.

### Antigravity (`agy`) in a team

With `bond team <branch>:agy` (and with the `bond-delegate` skill), bond launches `agy` with
`--dangerously-skip-permissions`: without it, `agy` asks for permission for every command and the
minion doesn't move forward. It runs without asking inside its worktree; if you'd rather have
something else, pass your own arguments after `--` and those are used instead.

The `agy` installer puts it in `~/.local/bin`, which isn't always on the panes' PATH. If bond
doesn't find it on the PATH but does find it there, it adds that folder to the pane shell's PATH
before launching it, so you don't need to touch your configuration.

On startup, `agy` sometimes shows a what's-new notice ("esc to dismiss"). It isn't a question:
the branch doesn't show as `bloqueado` because of it, and `prompt` dismisses it before sending the
task if Herdr takes it for one. The trust-the-folder question, on the other hand, does block.

### `bond team clean`: tidying up

Once you've reviewed and integrated, `clean` removes the worktrees, meaning the folder and its
pane or workspace with the agent. The branches stay where they were.

If you don't tell it which branches, it only removes the integrated worktrees that Herdr opened;
if you give it branches, it removes those. It never removes one whose agent is working or
waiting, that has uncommitted changes or that you're in, unless you pass `--force`. With
`--delete-branch` it also deletes the integrated branches.

If no team agent is left when it's done, it also closes the live table pane and your tab goes
back to how it was. With `--keep-table` the table stays open (although, if it has nothing pending,
it then closes on its own, unless you launched it with `--keep-open`). It doesn't close the repo's
workspace; it tells you how to do it if you want.

### A vertical branch in a hub

A hub is a shared git repo that groups several repos (say, frontend and backend) declared in
`hub.toml`, each one as a submodule or as a link (symlink) to a local clone. It is created
guided with `bond hub init`, which first runs `bond init` in the hub itself (with `plan-team`), imports repos by URL (submodule) or from a local clone
(symlink) and runs `bond init` with the hub's config in those without bond; `bond hub check` then reviews that every repo of the session is ready to work with
agents, and `--fix` repairs the safe things. New repos go into `repos/<name>` by default (D16); a hub
that already keeps them at the root keeps working as before — `bond hub check` only warns about it,
without failing (D17). The flow, end to end (see
[reference](reference.md#bond-hub)):

```bash
bond hub init                    # creates the hub and imports the repos (submodule or symlink)
bond hub check                   # reviews the session: what's missing and how to fix it (--fix)
bond team fix/login              # the branch in the hub and one agent per repo of the session
bond team fix/login --repos backend  # or only in those repos (path or name, comma-separated)
bond team prompt fix/login "the login fails with uppercase emails"
bond team collect fix/login --repo backend
bond team clean fix/login
```

When you work from the hub, `bond team` changes shape: a branch is no longer one agent, it's a
change that crosses the repos:

- **Create**: `fix/login` is created in the hub as a branch, without a worktree or agent, from
  its base in `hub.toml`. In each repo of the session (or those in `--repos`) a worktree opens
  from its base with an agent: the one from `fix/login:agent` or `--agent` if you give them and,
  if not, the default agent of that repo's `bond.toml`. The worktrees go in
  `~/.herdr/worktrees/<hub>/<repo>/<branch>`, so two hubs with a `frontend` don't collide.
  `--base` doesn't apply here: the bases are the ones in `hub.toml`.
- **One vertical branch at a time**: with `fix/login` open, `bond team fix/payments` refuses
  without creating anything and tells you to close it first with `bond team clean fix/login`.
  Repeating `bond team fix/login` opens only what's missing.
- **Handing out**: `prompt` sends the task to every agent of the branch, adding to each one a
  note with its repo and who the others are (name, repo and folder), so that what crosses from
  one repo to another fits together. With `--repo` it goes to just one. If any is waiting for an
  answer from you, nothing is sent to anyone.
- **Collect**: `collect` needs `--repo` when the branch is in several repos: it collects repo
  by repo (or with `--agent <name>`, which also works when that agent is no longer running).
  Runs (requests and reports) go to the hub's decision memory, next to the plan; if the hub has
  no `[decisions]`, to the repo's. Each run's commits and decisions come from that repo.
- **Clean**: `clean fix/login` removes the worktrees of all repos (`--repo`, of one) and leaves
  the branches, including the hub's. With no branches, the integrated ones of all repos. With
  `--delete-branch` it also deletes the integrated ones, and the hub's if it is integrated into
  its base and no worktree of it is left in any repo.

Inside one repo of the session, `bond team` works on that repo only, as always. Integrating the
branches, bumping the submodule pointers on the hub's branch (if your repos came in as
submodules) and pushing remain your job.

## Driving the agents by hand

Sometimes you want to talk to an agent directly from the shell, without going through bond. For
that you have Herdr's commands:

```bash
herdr agent prompt gru "revisa el diff actual" --wait --timeout 300000
herdr agent read gru --source recent-unwrapped --lines 200
herdr agent wait gru --until blocked --timeout 120000
herdr agent send-keys gru ctrl+c
```

Herdr puts each agent in one of these states. `idle` and `done` mean it's ready to take
something. `blocked` means it's waiting for an answer from you. `working` means it's busy. And
`unknown` means Herdr can't classify it with confidence.

## Cleaning up by hand

If you'd rather tidy up without `bond team clean`, or you have something open with
`bond --worktree`, these are the commands:

```bash
herdr worktree remove --workspace <id>   # removes the worktree and its workspace; the branch stays
herdr workspace close <id>               # closes a regular workspace
git branch -d <rama>                     # the branch, once you no longer want it
```

To make it clear where the line is: bond doesn't merge, rebase or push, doesn't delete branches or
close workspaces on its own, and doesn't answer agent dialogs for you. The inherited trust of
`bond team` only repeats the trust you already gave the main checkout, through the orchestrator
or through each agent. The minions do the work,
but the decisions are still yours.

Something unclear, or not working the way it's described here? Open an issue at
[github.com/jmanuelcorral/bond/issues](https://github.com/jmanuelcorral/bond/issues) and we'll
take a look.
