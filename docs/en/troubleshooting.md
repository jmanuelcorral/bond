# Troubleshooting

## Quick diagnosis

First:

```bash
bond doctor            # everything at once; --quick skips the MCP servers
```

It checks Node, Herdr (server and integration), pi, the `~/.pi/agent` links, the package,
the Herdr skill, the Bond Extensions, the context tools, the MCP servers and that the model
gateway serves what is declared. Each failure says how to fix it (almost always
`bond setup`). If you need more detail:

```bash
herdr status                        # client, server, socket, compatibility
herdr integration status | grep pi  # the pi integration, current or not
bond status                            # which agents Herdr sees and in what state
```

## pi does not show up as an agent, or stays `unknown`

`unknown` means Herdr sees something but cannot classify it with confidence. It is not a pi
failure: it is the detector hesitating.

```bash
herdr agent list                       # what is there
herdr agent explain <panel-o-agente>   # why it was classified that way
herdr agent read <panel> --source detection
```

Common causes:

- **The integration is missing.** `herdr integration status` must say `pi: current`. If not:
  `herdr integration install pi` and restart the pi pane.
- **pi started before the integration.** Exit pi and start it again in the pane.
- **The pane was not at its prompt** when `agent start` launched it. `bond` needs a free
  interactive shell; otherwise, start `pi` by hand in that pane.

An `unknown` does not mean the work has not finished: read the pane.

## `bond` fails to open the workstation

| Message | Cause | Fix |
|---|---|---|
| `Herdr no está instalado` (Herdr is not installed) | Herdr is missing | https://herdr.dev/docs/install/ (or `bond setup`) |
| `no hay ningún agente instalado` (no agent is installed) | No agent on the PATH | `bond setup` tells you how to install one |
| `Herdr no admite el agente 'x'` (Herdr does not support agent 'x') | It is not in `herdr agent start --help` | Use one from the list |
| `el servidor de Herdr no arrancó` (the Herdr server did not start) | `herdr server` did not respond | `herdr status`; start it with `herdr` |
| `--direction debe ser right o down` (--direction must be right or down) | Invalid value | Herdr only splits in those two directions |

If the agent is left waiting for an answer (for example, Claude Code asking whether to trust the
folder), bond says so and leaves everything open: answer in the pane. bond does not undo anything if
something fails; to clean up, `herdr workspace close <id>`.

## I have two workspaces for the same project

`bond` reuses by **label** (`bond:<repo>`), not by path. If you launched with a different `--label`,
or renamed the folder, there are two.

```bash
herdr workspace list                 # see ids and labels
herdr workspace close <el-sobrante>
```

From now on, pass the same label: `bond dev ~/otraruta/miapp -l bond:miapp`.

## The `/review` `/commit` etc. commands do not show up

- Session already open: run `/reload` in pi.
- The commands reach pi through the Bond Extensions, only in repos with `bond init` and pi among
  their agents: `.pi/settings.json` must declare `~/.bond/pi`, and `~/.bond/pi` must exist
  (`bond doctor`).
- `scripts/pi-resources` lists what pi actually loads, with its origin and path.
- Broken symlink (you moved the repo): run `bond setup` again.

## A skill shows up twice or is not the version you expect

pi reads skills from `~/.pi/agent/skills/`, from `~/.agents/skills/` (shared with other agents)
and from packages. If two have the same name, pi keeps the first one and warns at startup.

```bash
scripts/pi-resources        # which skill wins and from which path
```

`bond setup` already handles the `herdr` case: if `~/.agents/skills/herdr` exists, it uses that one
and deletes the copy it used to generate itself in `~/.pi/agent/skills/herdr`.

## An MCP server does not connect

```bash
pi mcp list                  # status and error of each server
tail -50 ~/.pi/agent/mcp.log
```

- `duckduckgo` is launched with `uvx`: the first time it downloads the package and takes a while. If it fails, check
  `uvx duckduckgo-mcp-server==0.7.0 --help` by hand.
- `context7` is remote: without a network, it fails. Inside pi, `/mcp reconnect context7`.
- DuckDuckGo rate-limits requests if you search a lot in a row: wait and retry.
- To turn one off without deleting it: `"enabled": false` in its entry, or from `/mcp`.

## Several agents at once and 429 errors

With several agents on the same local model (`halo`), the gateway may answer 429 to
some of them: it cannot serve that many requests in parallel. The status footer counts them in `req ✗`. pi
retries on its own; if an agent gives up, send it the task again when another one finishes. For
real parallelism, spread across different models or providers (`bond --agent`, or
`-- --model …` in `bond team`).

## An agent launched with `bond` stays `blocked`

Typical of Claude Code (and others) in a new folder, such as a freshly created worktree:
it asks whether you trust it. `bond` does not answer for you.

```bash
herdr agent read <agente> --source visible   # what it is asking
```

Answer in the pane. If it is your own repo, next time it will not ask again for that folder.

## Config changes have no effect

pi reads the config at startup. After editing `settings.json` or `AGENTS.md`:

```
/reload
```

If you edited the repo but the symlink points somewhere else (or you broke it), `bond setup`
repairs it. The `.bak.<fecha>` backups of what was there before are kept in `~/.pi/agent`.

## An agent does not see the registry models

```bash
bond models list           # which agents can use each provider
bond models sync --dry-run # what it would write to each agent
```

- Codex needs the gateway to serve the Responses API; pi, opencode and Crush, the chat API.
  `bond models probe` checks it.
- Crush: if you define by hand in `crushrc` a provider with the same id, bond does not touch it (it
  warns about it in `sync`). Remove it from your `crushrc` so that bond manages it.
- Claude Code and Gemini cannot use OpenAI-compatible gateways.

## The `halo` models do not show up in `/model`

- `bond models list` must show `halo` and its model; `bond models sync --check` says whether pi
  is out of date with respect to `~/.bond/config.toml` (fix: `bond models sync`).
- `pi --list-models | grep halo` confirms that pi sees them without starting the TUI.
- `/model` reloads `models.json` when opened; in a session already started, `/reload`.

## A `halo` model responds 404

The gateway lists more models than it can serve. `GET /v1/models` shows them all, but
when asked for a chat it may return `{"error": "Route not available"}` or `{"detail": "Not Found"}`:
that model is not loaded right now.

`bond models probe` shows what the gateway serves. Set `enabled = false` on the model in
`~/.bond/config.toml`, run `bond models sync` and reload. Declaring a model that does not respond
only produces confusing failures from `/model`.

## The first `prompt` to a local model takes very long

On-demand loading: the gateway loads the model into RAM on the first request and the following ones run
at normal speed. If `herdr agent prompt --wait` hits the timeout on that first load, check
`herdr agent get <agente>` before resending anything.

## The response is cut off halfway

Look at the model's `max_output` in `~/.bond/config.toml`: `flash-halogen` is at 8192, and the
commented-out block for `gufo-qwen38-27b` only at 2048. If you re-enable that model and diffs get truncated, the
limit is there, not in `compaction.reserveTokens` in `settings.json`.

## `tls: unrecognized name` when talking to the gateway

The host's certificate does not cover `halo.example`, so `baseUrl` uses
`http://` on purpose. If you change it to `https://`, the TLS handshake fails before the request.

## `pi` is missing after installing it with bun

The binary goes to `~/.bun/bin`. Check:

```bash
ls ~/.bun/bin/pi
echo "$PATH" | tr ':' '\n' | grep bun
```

If it is not there, add `export PATH="$HOME/.bun/bin:$PATH"` to your shell profile.

## No reachable Herdr server

```bash
herdr status server
ls -l ~/.config/herdr/herdr.sock
tail -50 ~/.config/herdr/herdr-server.log
```

To bring it up: `herdr` (attaches and starts it if needed) or `herdr server` for headless mode.
For named sessions, the logs live under `sessions/<nombre>/` in that same directory.

## `--attach` does nothing

Expected if you were already inside Herdr (`HERDR_ENV=1`): Herdr blocks nested launches
by design. `--attach` only applies from a terminal outside Herdr.

## The agent is `blocked`

There is an approval or question waiting. **Look at it before answering**: `blocked` may be
a dialog that Herdr does not fully recognize.

```bash
herdr agent read <agente> --source recent-unwrapped --lines 80
herdr agent send-keys <agente> esc     # if you want to cancel it
```

A `prompt` sent to a blocked agent is rejected with `agent_blocked` before writing
anything, so no input is lost.

## A `prompt` returns nothing or gives `timeout`

A timeout **does not prove** that the prompt was not delivered. Before resending:

```bash
herdr agent get <agente>
herdr agent read <agente> --source recent-unwrapped --lines 200
```

If it returns `agent_prompt_stalled`, no activity was observed after sending: check the
pane, the agent may have been waiting for an answer.

## I lost track of a pi session

pi stores sessions per working folder:

```bash
pi --continue      # last session in this folder
/resume            # choose from inside pi
/session           # status of the current session
```

And with Herdr, the pane's session stays alive whether or not a client is attached: run `herdr` and come back.

## The pane looks odd after a resize

`ctrl+b` `z` zooms/normalizes the pane. If the flickering or corruption persists,
`herdr --default-config` shows related `[ui]` keys
(`redraw_on_focus_gained`, `host_cursor`, `pane_scrollbars`).
