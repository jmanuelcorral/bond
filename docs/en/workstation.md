# The workstation: `bond`, `bond team`, `bond status`

Inside a repo, plain `bond` opens its workstation in Herdr: the repo's default agent, named
`gru`, alone in its pane. With `--shell`, a shell next to it.

```bash
cd ~/gitrepos/mi-proyecto
bond                              # default agent (default_agent from .bond/bond.toml)
bond --agent claude               # another of the repo's agents
bond --worktree feat/login        # in a git worktree for that branch
bond dev ~/gitrepos/otro          # the same for another directory
bond team . feat/a feat/b:claude  # one agent per branch, each in its own worktree
bond status                       # running agents
```

## What `bond` does

1. **Repo without bond** (no `.bond/bond.toml`): asks whether to initialize it (`bond init`).
   Outside a git repo, `bond` shows the help.
2. **Config up to date:** if `bond.toml` changed and some agent's config is out of date, it runs
   `bond sync` before opening (conflicts, files edited by hand, are left untouched).
3. **Agent:** the one from `--agent`; otherwise the repo's `default_agent`; otherwise the one from
   `bond setup`; otherwise the first one installed. Herdr must support it
   (`herdr agent start --help`) and it must be installed.
4. **Herdr:** outside Herdr it starts its server in the background if it isn't running; inside,
   it doesn't nest another one.
5. **Workspace** labeled `bond:<repo>` (or `bond:<repo>/<rama>` with `--worktree`). If it already
   exists, it focuses it and exits (it also recognizes the old `pi:<repo>` labels).
6. **Panes:** the agent alone, in the root pane; with `--shell`, a shell next to it (60 % / 40 %,
   on the right). The agent in the main checkout is named `gru`, the orchestrator (`gru-2`,
   `gru-3`… if there is already one in Herdr); with `--worktree`, `<agente>-<repo>-<rama>`.
7. **Outside Herdr**, it attaches its interface when done. Not with `--no-attach`; with
   `--no-focus` it leaves it in the background without switching workspace.

If the agent stops at a question on startup (Claude Code asks you to trust a new folder, for
example in a worktree), bond tells you and doesn't answer for you.

## Options

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

```bash
bond team [repo] <rama[:agente]>... [--agent <a>] [--base <ref>] [--tabs | --same-tab | --workspaces] [--yes] [--no-trust] [-- args de los agentes]
bond team status [repo] [--base <ref>] [--json | --watch [--keep-open]]
bond team prompt <rama> "la tarea" [--wait] [--timeout <ms>]
bond team clean [repo] [rama...] [--force] [--delete-branch] [--keep-table] [--dry-run]
```

Opens one worktree and one agent per branch and shows how each branch is doing (`status`). Inside
Herdr, each agent goes in a pane of your tab, below yours: in a row, all the same width. Each one
is named after a minion, the first free one (`kevin`, `stuart`, `bob`, `dave`...), and its pane is
titled `kevin · <rama>`. The worktree goes in `~/.herdr/worktrees/<repo>/<rama>`. To the right of
yours a narrow pane opens, `tabla · <repo>` (`table · <repo>`), with the live table (`bond team
status --watch`) of all branches, wherever they are; if it is already there, it is reused instead
of opening another.

Your tab holds 6 panes: yours, the table and 4 minions (it counts the ones it already has). If the
new agents don't fit, `bond team` asks before creating anything:

1. `Pestañas nuevas` (New tabs) (default): the ones that fit in yours and the rest in new tabs
   `equipo · <repo>` (`team · <repo>`) (`equipo · <repo> · 2`...), 4 per tab and in a row.
2. `Todo en mi pestaña` (Everything in my tab): rows of 4 (from the fifth on, below the one in its
   column), even if it gets cramped.
3. `Workspaces aparte` (Separate workspaces): one workspace per branch, as with `--workspaces`.

`--tabs`, `--same-tab` and `--workspaces` choose without asking. Without a terminal (input or
output redirected) or with `--yes`, it doesn't ask and applies option 1. When they fit, it never
asks. `status` and `clean` see and close the panes whatever tab they are in; when the last one in
a new tab is closed, Herdr removes the tab. Outside Herdr, one workspace per branch with `herdr
worktree`, as before. Without `[repo]`, the one in the current directory. Each branch gets the agent
from `rama:agente`; otherwise the one from `--agent`; otherwise the repo's default agent
(`default_agent` in `.bond/bond.toml`) and, if there is none, the one from `bond setup`. It warns
if an agent is not among the repo's agents (it won't have its config) and if there are uncommitted
changes, which the worktrees won't see. The work is then handed out with `bond team prompt`, or from
any agent with the `bond-team` skill (in pi, `/team`), which also proposes the split, waits for
your OK and collects the results. For the phases of a plan (`docs/plans/`), the catalog skill
`plan-team` does the same by phase: it checks which ones can run at the same time, sends each one
with `plan-execute` (with a commit on its branch, no push) and updates the plan as each branch is
integrated.

**`status`**: one row per worktree of the repo with its status, its agent, the commits ahead of
the base (by default, the branch of the main checkout) and the files it touches:

| Status | What it means |
|---|---|
| `trabajando` (working) | The agent is on it |
| `bloqueado` (blocked) | The agent is waiting for an answer from you (e.g. trusting the folder) |
| `sin commitear` (uncommitted) | There are changes in the worktree outside a commit |
| `lista` (ready) | It has unintegrated commits: time to review |
| `integrada` (integrated) | Already in the base, also if it went in via rebase or squash |
| `sin commits` (no commits) | Nothing yet (or it was integrated via fast-forward) |

pi and Claude Code ask whether you trust each new folder, and every worktree is one. In panes, if
you already trust the main checkout (in pi, its closest entry in `~/.pi/agent/trust.json` is
`true`; in Claude, it or a parent folder has `hasTrustDialogAccepted` in `~/.claude.json`), bond
gives the worktree the same trust before launching its agent, and it starts without asking
(`confianza heredada` (inherited trust)). It touches nothing else in those files, respects pi's
lock and writes atomically; a folder you said you don't trust stays that way. `--no-trust`
disables it. Without that trust, with other agents or with `--workspaces`, it asks as usual. Herdr
doesn't always see it as a question, so bond reads the pane: the branch shows as `bloqueado`
(blocked), and `prompt` sends nothing, because its Enter would choose "Trust" for you and the task
would be lost. Answer it yourself in its pane; in pi, "Trust parent folder" once is enough for all
the worktrees of that repo.

With `--watch`, the live table: it fills the screen, refreshes every 2 s and exits with `q` or
Ctrl+C, leaving the terminal as it was. Branches are grouped by status, what is waiting for you
first, and empty groups are not shown:

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

The icon goes only in each group's title, in its status color (red if it is waiting for you,
yellow if it is moving, green if it needs review, dim if there is nothing); the rows carry the
minion, the branch, the commits and the files, and under a blocked branch the question it is
waiting on. Each group's title states the status in words, so it is readable even if the terminal
doesn't render emoji well, and the columns are aligned counting each emoji as two. In the table
pane (`tabla · <repo>` (`table · <repo>`)), when no branch has pending work (no `trabajando`,
`bloqueado`, `sin commitear` or `lista`, and no open agent that hasn't made commits yet; a branch
whose commits the table already saw and that goes back to `sin commits` has been integrated via
merge), it shows `sin trabajo pendiente` (no pending work), waits a few seconds so it can be seen
and closes the pane; if there is work again before that, it carries on. It doesn't close if it is
the focused pane, nor with `--keep-open`, nor when run by hand in another pane: there it only
notifies.

**`prompt`**: sends a task to a branch's agent, without needing to know its name.

**`clean`**: removes worktrees (folder, and its pane or workspace with the agent); the branches
stay. Without branches, only the integrated ones that Herdr opened; with branches, those. Never one
whose agent is working or waiting, that has uncommitted changes or that you are in, unless with
`--force`. `--delete-branch` also deletes the integrated branches. If no team agent is left at the
end, it also closes the live table pane, and your tab is left as it was; `--keep-table` leaves it
open (if the table has nothing pending, it then closes on its own unless `--keep-open` is set). It
doesn't close the repo's workspace: it tells you how.

## Driving the agents

```bash
herdr agent prompt gru "revisa el diff actual" --wait --timeout 300000
herdr agent read gru --source recent-unwrapped --lines 200
herdr agent wait gru --until blocked --timeout 120000
herdr agent send-keys gru ctrl+c
```

States: `idle` and `done` ready for input, `blocked` waiting for an answer from you, `working`
busy, `unknown` Herdr can't classify it reliably.

## Cleaning up

```bash
herdr worktree remove --workspace <id>   # removes the worktree and its workspace; the branch stays
herdr workspace close <id>               # closes a regular workspace
git branch -d <rama>                     # the branch, once you no longer want it
```

bond doesn't merge, rebase or push, doesn't delete branches or close workspaces, and doesn't
answer agent dialogs for you: the inherited trust of `bond team` only repeats the trust you
already gave the main checkout.
