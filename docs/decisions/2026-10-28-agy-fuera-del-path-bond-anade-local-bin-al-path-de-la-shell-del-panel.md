---
id: "2026-10-28-agy-fuera-del-path-bond-anade-local-bin-al-path-de-la-shell-del-panel"
title: "agy fuera del PATH: bond añade ~/.local/bin al PATH de la shell del panel"
status: "accepted"
date: "2026-10-28"
decided_by: "agent:claude/kevin"
accepted_by: "usuario en sesión el 2026-10-28: «integra P4, acepto, acepta las dos»"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "docs/plans/2026-10-28-agy-support.md"
  - "branch: plan/agy-support-p4"
  - "head: c0c7e24"
---


## Context

herdr agent start --kind agy teclea 'agy' sin ruta en la shell del panel y no admite otro ejecutable; herdr worktree create no acepta --env, así que fijar el PATH al crear el panel no sirve en todos los caminos de bond team. Con ~/.local/bin fuera del PATH del panel, agy no arrancaba (command not found).

## Decision

Si agy no está en el PATH de bond pero sí en ~/.local/bin, bond (bond team y bond) manda antes de herdr agent start un 'export PATH=<dir>:"$PATH"' a la shell del panel con herdr pane run (sh, bash, zsh; en Windows no). La skill bond-delegate indica lo mismo. chooseAgent acepta agy en ~/.local/bin.

## Rejected alternatives

--env PATH al crear el panel (no existe en herdr worktree create y las rc de la shell pueden pisarlo); lanzar agy con herdr pane run y la ruta completa (se pierde la espera de herdr agent start y su detección); pedir al usuario que arregle su PATH (era el fallo de la prueba real).

## Consequences

En el panel se ve la línea del export antes de agy. Con shells no POSIX (fish con PATH como lista, PowerShell) puede no aplicarse; bond doctor sigue avisando de que agy está fuera del PATH.
