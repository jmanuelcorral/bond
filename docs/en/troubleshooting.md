# Troubleshooting

Something isn't working the way you expected. Don't worry, it happens more often than you'd
think, and there's almost always a quick fix. Before anything else, run `bond doctor`: it goes
over your whole install and, when it finds a problem, it usually tells you how to fix it. If
that doesn't do the trick, look below for the symptom that looks most like yours.

## First, a quick checkup

Always start here:

```bash
bond doctor            # everything at once; --quick skips the MCP servers
```

`bond doctor` checks Node, Herdr (the server and the integration), pi, the `~/.pi/agent`
links, the package, the Herdr skill, the Bond Extensions, the context tools, the MCP servers,
and that the model gateway serves what you've declared. Every problem comes with its fix, and
most of the time that fix is `bond setup`.

If you want to dig a little deeper, these three commands tell you how Herdr is doing and which
agents it can see:

```bash
herdr status                        # client, server, socket, compatibility
herdr integration status | grep pi  # the pi integration, current or not
bond status                            # which agents Herdr sees and in what state
```

## "pi doesn't show up as an agent" or it's stuck on `unknown`

Seeing `unknown` means Herdr can see something in the pane but doesn't dare to classify it.
pi is fine; the one having doubts is Herdr's detector. To see what's going on:

```bash
herdr agent list                       # what is there
herdr agent explain <panel-o-agente>   # why it was classified that way
herdr agent read <panel> --source detection
```

Usually it's one of three things. The first is that the integration is missing:
`herdr integration status` should say `pi: current`, and if it doesn't, run
`herdr integration install pi` and restart the pi pane. The second is that pi started before
you installed the integration; in that case, just quit pi and start it again in the pane. The
third is that the pane wasn't sitting at its prompt when `agent start` launched it. `bond`
needs a free interactive shell, so if the pane was busy, start `pi` by hand in it.

And here's a reassuring detail: an `unknown` doesn't mean the work hasn't finished. Take a
look at the pane and you'll see.

## `bond` fails when opening the workstation

Here bond is usually pretty clear about what it's missing. Find your message in this table:

| Message | Cause | Fix |
|---|---|---|
| `Herdr no está instalado` (Herdr is not installed) | Herdr is missing | https://herdr.dev/docs/install/ (or `bond setup`) |
| `no hay ningún agente instalado` (no agent is installed) | No agent on the PATH | `bond setup` tells you how to install one |
| `Herdr no admite el agente 'x'` (Herdr does not support agent 'x') | It isn't in `herdr agent start --help` | Use one from the list |
| `el servidor de Herdr no arrancó` (the Herdr server did not start) | `herdr server` didn't respond | `herdr status`; start it with `herdr` |
| `--direction debe ser right o down` (--direction must be right or down) | Invalid value | Herdr only splits in those two directions |

Sometimes the agent sits there waiting for you to answer something, like Claude Code asking
whether you trust the folder. bond lets you know and leaves everything open so you can answer
in the pane yourself. Keep in mind that bond doesn't undo anything if something fails halfway.
If you want to clean up whatever was left behind, close the workspace with
`herdr workspace close <id>`.

## I've got two workspaces for the same project

This one throws people off the first time. `bond` recognizes a workspace by its label
(`bond:<repo>`) and doesn't look at the path. If one day you launched it with a different
`--label`, or you renamed the folder, you end up with two. Check which one is extra and close
it:

```bash
herdr workspace list                 # see ids and labels
herdr workspace close <el-sobrante>
```

To keep it from happening again, always pass the same label, for example
`bond dev ~/otraruta/miapp -l bond:miapp`.

## `/review`, `/commit` and friends don't show up

If you already had the pi session open, try `/reload` in pi first. Quite often that's all it
takes.

If they still don't show up, it helps to know where they come from. These commands reach pi
through the Bond Extensions, and only in repos where you've run `bond init` and that have pi
among their agents. For that to work, `.pi/settings.json` has to declare `~/.bond/pi`, and
`~/.bond/pi` has to exist (`bond doctor` checks this). If you want to see what pi actually
loads, with its origin and path, run `scripts/pi-resources`.

And if you moved the repo somewhere else, chances are a symlink broke. Run `bond setup` again
and you're done.

## A skill shows up twice or isn't the version I expected

pi looks for skills in three places: `~/.pi/agent/skills/`, `~/.agents/skills/` (the folder it
shares with other agents) and the packages. When two have the same name, pi keeps the first
one it finds and warns you at startup. To see which one wins and from which path:

```bash
scripts/pi-resources        # which skill wins and from which path
```

`bond setup` already sorts out the `herdr` case for you. If `~/.agents/skills/herdr` exists,
it uses that one and deletes the copy it used to generate itself in `~/.pi/agent/skills/herdr`.

## An MCP server won't connect

The first thing is to see what each server says and what ended up in the log:

```bash
pi mcp list                  # status and error of each server
tail -50 ~/.pi/agent/mcp.log
```

`duckduckgo` is launched with `uvx`, so the first time it downloads the package and takes a
little while. If it fails, try it by hand with `uvx duckduckgo-mcp-server==0.7.0 --help`.
Also, DuckDuckGo rate-limits you when you search a lot in a row; if that happens, wait a bit
and try again.

`context7` is remote, so without a network it simply won't work. Once you're back online, you
can run `/mcp reconnect context7` inside pi.

If what you want is to turn a server off without deleting it, set `"enabled": false` in its
entry or disable it from `/mcp`.

## I get 429 errors with several agents at once

If you have several agents pulling from the same local model (`halo`), the gateway may answer
429 to some of them because it can't keep up with that many requests in parallel. You'll see
them counted in the status footer, under `req ✗`. pi retries on its own, so a lot of the time
you won't even notice. If an agent gives up, send it the task again once another one finishes.
For real parallelism, spread the work across different models or providers (`bond --agent`,
or `-- --model …` in `bond team`).

## I launched an agent with `bond` and it's stuck on `blocked`

This happens a lot with Claude Code (and others) when it starts in a new folder, like a
freshly created worktree: it asks whether you trust it. `bond` doesn't answer for you, on
purpose. To see what it's asking:

```bash
herdr agent read <agente> --source visible   # what it is asking
```

Answer in the pane. If it's your own repo, it won't ask you again for that folder next time.

## I changed the config and nothing happened

pi reads its configuration at startup, so anything you change afterwards doesn't reach it on
its own. After editing `settings.json` or `AGENTS.md`, reload inside pi:

```
/reload
```

If you edited the repo but the symlink points somewhere else (or it broke on you), `bond setup`
repairs it. And if you're worried about what was there before, relax: the `.bak.<fecha>`
backups stay in `~/.pi/agent`.

## An agent doesn't see the registry models

Start by checking which agents can use each provider and what bond would write to each one:

```bash
bond models list           # which agents can use each provider
bond models sync --dry-run # what it would write to each agent
```

Each agent speaks a different dialect. Codex needs the gateway to serve the Responses API,
while pi, opencode and Crush use the chat one. `bond models probe` tells you what your gateway
serves. Claude Code and Gemini, for their part, can't use OpenAI-compatible gateways, so
there's nothing to be done with them here.

There's one specific case with Crush. If you've defined a provider by hand in your `crushrc`
with the same id, bond leaves it alone and warns you about it in `sync`. Remove it from your
`crushrc` so bond can take over managing it.

## The `halo` models don't show up in `/model`

First check that `bond models list` shows `halo` and its model. Then
`bond models sync --check` tells you whether pi has fallen out of date with
`~/.bond/config.toml`; if it has, `bond models sync` fixes it.

To confirm pi sees them without starting the TUI, use `pi --list-models | grep halo`. Keep in
mind that `/model` reloads `models.json` when it opens, but in a session that was already
running you need `/reload`.

## A `halo` model answers with a 404

The gateway advertises more models than it can serve at any given moment. `GET /v1/models`
lists them all, but when you ask for a chat from one that isn't loaded right now, it gives you
back `{"error": "Route not available"}` or `{"detail": "Not Found"}`.

`bond models probe` shows you what the gateway is really serving. For the model that fails,
set `enabled = false` in `~/.bond/config.toml`, run `bond models sync` and reload. It's worth
doing, because having a model declared that doesn't respond only gets you confusing failures
from `/model`.

## The first `prompt` to a local model takes forever

That's normal. The gateway loads models on demand, so on the first request it pulls the model
into RAM, and from then on everything runs at normal speed. If `herdr agent prompt --wait`
times out during that first load, don't resend anything yet: first check how it's going with
`herdr agent get <agente>`.

## The response gets cut off halfway

Check the model's `max_output` in `~/.bond/config.toml`. `flash-halogen` has it at 8192, and
the commented-out block for `gufo-qwen38-27b` only at 2048. If you re-enable that model and
see your diffs coming out truncated, that limit is the culprit. Fiddling with
`compaction.reserveTokens` in `settings.json` won't fix it.

## I get `tls: unrecognized name` when talking to the gateway

The host's certificate doesn't cover `halo.example`, which is why `baseUrl` uses `http://` on
purpose. If you change it to `https://`, the TLS handshake fails before the request even gets
made. Leave it on `http://` and the problem goes away.

## I installed `pi` with bun and can't find it

bun puts the binary in `~/.bun/bin`, and it's very easy for that folder not to be on your
`PATH`. Check it like this:

```bash
ls ~/.bun/bin/pi
echo "$PATH" | tr ':' '\n' | grep bun
```

If the folder doesn't show up in your `PATH`, add `export PATH="$HOME/.bun/bin:$PATH"` to your
shell profile and open a new terminal.

## There's no reachable Herdr server

Time to check whether the server is alive, whether the socket exists and what its log says:

```bash
herdr status server
ls -l ~/.config/herdr/herdr.sock
tail -50 ~/.config/herdr/herdr-server.log
```

To bring it up, run `herdr`, which attaches and starts the server if needed, or
`herdr server` if you want it in headless mode. If you use named sessions, their logs live in
`sessions/<nombre>/` inside that same directory.

## `--attach` doesn't do anything

If you were already inside Herdr (`HERDR_ENV=1`), that's expected. Herdr blocks nested
launches by design, and `--attach` only has an effect when you use it from a terminal outside
Herdr.

## The agent is `blocked` and I don't know why

There's an approval or a question waiting for an answer. Before you answer anything, take a
good look, because `blocked` can also be a dialog that Herdr doesn't quite recognize:

```bash
herdr agent read <agente> --source recent-unwrapped --lines 80
herdr agent send-keys <agente> esc     # if you want to cancel it
```

The good news is you won't lose anything by trying. A `prompt` sent to a blocked agent is
rejected with `agent_blocked` before anything gets written.

## My `prompt` returns nothing or gives a `timeout`

Careful with this one, because a timeout doesn't prove the prompt never arrived. Before you
resend it and end up with the task duplicated, check what the agent is up to:

```bash
herdr agent get <agente>
herdr agent read <agente> --source recent-unwrapped --lines 200
```

If you get `agent_prompt_stalled` back, it means no activity was seen after sending. Take a
look at the pane, because the agent may have been waiting for you to answer something.

## I lost track of a pi session

It isn't lost. pi saves sessions per working folder, so you can get them back:

```bash
pi --continue      # last session in this folder
/resume            # choose from inside pi
/session           # status of the current session
```

And if you work with Herdr, the pane's session stays alive even with no client attached. Run
`herdr` and you're right back where you left off.

## The pane looks weird after resizing

Press `ctrl+b` `z` to zoom the pane or bring it back to its normal size. If the flickering or
the garbled display still sticks around, `herdr --default-config` shows you the `[ui]` keys
that have to do with this (`redraw_on_focus_gained`, `host_cursor`, `pane_scrollbars`).

---

Is your problem not listed here? Open an issue at https://github.com/jmanuelcorral/bond/issues
and paste the output of `bond doctor`. That makes it much easier to give you a hand.
