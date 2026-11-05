---
id: "2026-11-03-bond-hub-exec-direct-argv-by-default-shell-opt-in-first-shell-use-in-bond"
title: "bond hub exec: direct argv by default, --shell opt-in (first shell use in bond)"
status: "accepted"
date: "2026-11-03"
decided_by: "agent:pi/kevin"
accepted_by: "Apruebo ambas decisiones propuestas: bond-hub-exec-requires-before-the-command y bond-hub-exec-direct-argv-by-default-shell-opt-in-first-shell-use-in-bond"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "issue: https://github.com/jmanuelcorral/bond/issues/46"
  - "branch: feat/hub-exec"
  - "head: cf642f8"
---


## Context

bond had never used a shell: there was no shell:true / shell invocation anywhere in cli/. hub exec propagates one command to N repos, so how the command string is interpreted matters across platforms.

## Decision

hub exec runs the command directly via argv (spawnSync with the exact tokens, no shell) by default: no pipes, `&&` or globs. `--shell` is opt-in and passes the command through the system shell (cmd.exe /d /s /c on Windows, /bin/sh -c elsewhere), quoted as a single argument. This is the single, explicit shell exception in bond and is marked as such in the code (shellInvocation in cli/hub-exec.mts).

## Rejected alternatives

Shell by default: rejected because on Windows the shell is cmd.exe with different semantics and silently propagating shell interpretation to N repos is a security and correctness risk. Never allowing a shell: rejected because some users genuinely need pipes/redirection and have an explicit, informed escape hatch in --shell.

## Consequences

Any future desire to run shell in bond must go through the same explicit opt-in pattern; hub exec's stdin is closed to /dev/null so commands never hang reading a TTY that isn't there.
