---
name: catalog-maintain
description: Fill and maintain a team catalog of skills, slash commands and MCP servers created with `bond catalog create` - add or change entries in the correct format, keep `catalog.toml` in sync, and pass `bond catalog check` before publishing. Use when working in a catalog repo (one with `catalog.toml` at its root) or when a teammate's `bond sync` fails with catalog validation errors.
user-invocable: true
---

# Maintaining a team catalog

A catalog repo is any git repo with `catalog.toml` at the root plus `skills/`, `commands/` and
`mcps/` - the skeleton `bond catalog create` leaves behind. The `README.md` inside each of those
folders is the format contract: read the one you are about to touch and follow it; do not
restate it here or invent a different layout.

## Adding a skill

1. Create `skills/<name>/SKILL.md`. The folder name is the skill's name: lowercase letters,
   digits, `-` and `_`.
2. Frontmatter: `name` exactly equal to the folder name, and a `description` that says what the
   skill does **and when to use it** - it is the only thing an agent reads to decide whether to
   load it, so name the situations.
3. Optional `scripts/` (things the skill runs) and `references/` (long detail the agent reads
   only when needed). Keep the body short.
4. Add an entry in `catalog.toml`:

   ```toml
   [skills.my-skill]
   summary = "One line shown by bond init"
   default = false   # optional: listed but not pre-selected
   ```

   Without an entry the skill still appears in `bond init`, pre-selected, with the first part of
   its `description`. Add the entry when you want a shorter summary or a different default.

## Adding a command

One file per command: `commands/<name>.md`, with frontmatter `description` (required) and
`argument-hint` (optional). In the body, `$ARGUMENTS` is everything typed after the command and
`$1`, `$2`… are the individual arguments. The same file works across all agents; bond converts it.

## Adding an MCP server

One file per server: `mcps/<name>.json` with `command` (plus optional `args` and `env`) **or**
`url` (plus optional `headers`) - never both - and a `description` for `bond init`.

- Never write a literal secret: use `${VARIABLE}` placeholders in `env`/`headers` and let each
  person set it in their environment. The catalog is read by the whole team and lives in git
  history. `bond catalog check` warns when a value looks like a key, token or password.
- Pin exact versions of anything downloaded at startup (`npx pkg@1.2.3`, `pkg==1.2.3`) so nobody
  runs an unreviewed release.

## Before publishing

1. Run `bond catalog check` at the catalog root. Fix every error (it exits non-zero for CI);
   resolve secret warnings instead of ignoring them.
2. Do not add demo or example entries: everything in the catalog shows up in `bond init` for the
   whole team and gets installed where it is selected.
3. Commit and push. Teammates consume it with `bond catalog add <url> --ref <tag>`, then pick
   entries in `bond init` or by name in `.bond/bond.toml` and run `bond sync`.

## Maintaining

- Renaming a skill, command or MCP server is a breaking change for consumers: after they update,
  their `bond.toml` still names the old one and `sync` fails. Rename, check, and tell consumers
  to update the name in `bond.toml` (or re-run `bond init`).
- A consumer whose `bond sync` dies with catalog errors sees the same messages
  `bond catalog check` produces: fix the catalog repo, never the consumer's generated files.
- Consumers move the pinned commit only with `bond catalog update`, which shows new or changed MCP
  servers before writing the lock; that review is the team's gate against a malicious or careless
  server. Do not hand-edit `.bond/lock.json`.
- The catalog repo is a normal bond repo (`bond init`, `AGENTS.md`, `.agents/skills/`): work in
  it with the same skills as anywhere else; the catalog folders do not collide with them.
