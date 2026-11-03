---
id: "2026-11-03-bond-hub-exec-requires-before-the-command"
title: "bond hub exec requires `--` before the command"
status: "accepted"
date: "2026-11-03"
decided_by: "agent:pi/kevin"
accepted_by: "Apruebo ambas decisiones propuestas: bond-hub-exec-requires-before-the-command y bond-hub-exec-direct-argv-by-default-shell-opt-in-first-shell-use-in-bond"
accepted_via: "agent:pi/gru"
supersedes: ""
superseded_by: ""
links:
  - "issue: https://github.com/jmanuelcorral/bond/issues/46"
  - "branch: feat/hub-exec"
  - "head: cf642f8"
---


## Context

bond hub exec (#46) must run an arbitrary command in the hub and in every session repo, but bond's CLI parses options with a whitelist (args.includes + die on unknown). An arbitrary command line would clash with that whitelist (e.g. a command or flag named like a bond option).

## Decision

The `--` separator is mandatory: `bond hub exec [bond options] -- <cmd> [args...]`. Everything before `--` is parsed as bond options (--dry-run, --json, --yes/-y, --shell, -h/--help); everything after it is the command and its arguments and bond never interprets it. Without `--`, the command fails with a clear error and runs nothing.

## Rejected alternatives

Free-form parsing with heuristics to tell bond options from command tokens: rejected because it is ambiguous and any new bond option could silently break existing user commands. A dedicated config file for commands: overkill for a pass-through.

## Consequences

All hub exec invocations carry `--`; scripts and docs must use the separator. Bond options can never appear after `--`.
