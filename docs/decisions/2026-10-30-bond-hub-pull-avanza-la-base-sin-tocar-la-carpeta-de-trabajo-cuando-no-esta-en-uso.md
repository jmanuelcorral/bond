---
id: "2026-10-30-bond-hub-pull-avanza-la-base-sin-tocar-la-carpeta-de-trabajo-cuando-no-esta-en-uso"
title: "bond hub pull avanza la base sin tocar la carpeta de trabajo cuando no está en uso"
status: "accepted"
date: "2026-10-30"
decided_by: "agent:claude"
accepted_by: "acéptalo y fusiona la PR"
accepted_via: "agent:claude"
supersedes: "2026-10-30-bond-hub-pull-solo-avanza-la-base-en-fast-forward"
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-30-hub-ops.md"
  - "phase: P11"
  - "commit: 7063af7"
  - "branch: plan/hub-session"
  - "head: a9fcadb"
---


## Context

D19 solo avanzaba la base de un repo si estaba en ella; los submódulos suelen estar en HEAD separado, así que pull los saltaba y bond hub check seguía avisando de la base atrasada sin forma de arreglarlo.

## Decision

bond hub pull hace git fetch y avanza la base solo en fast-forward, sin merge, rebase ni push. Si la base está en uso en este repo, con git merge --ff-only y solo sin cambios sin commitear. Si no está en uso en ningún worktree (submódulo con HEAD separado, o repo en otra rama), avanza la ref con git fetch <remoto> <base>:<base> (sin +, que git rechaza si no es fast-forward) sin tocar la carpeta de trabajo. Salta, con el motivo, una base en uso en otro worktree, divergida o sin remoto ni upstream. bond hub check avisa de las bases atrasadas y propone bond hub pull.

## Rejected alternatives

Saltar los repos que no están en su base (D19 original): la base de los submódulos se queda atrasada y el aviso de check no se va nunca.
