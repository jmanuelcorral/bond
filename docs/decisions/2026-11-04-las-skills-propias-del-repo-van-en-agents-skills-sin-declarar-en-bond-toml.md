---
id: "2026-11-04-las-skills-propias-del-repo-van-en-agents-skills-sin-declarar-en-bond-toml"
title: "Las skills propias del repo van en .agents/skills/ sin declarar en bond.toml"
status: "accepted"
date: "2026-11-04"
decided_by: "agent:pi/gru"
accepted_by: "no, cualquiera que se baje el repo, no cualquiera que use bond"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "run: .agents/skills/ci-status/"
  - "run: .agents/skills/merge-and-clean/"
  - "run: .agents/skills/tui-design/"
  - "branch: main"
  - "head: 89b16f6"
---


## Context

Hace falta que ciertas skills (ci-status, merge-and-clean, tui-design) las tenga cualquiera que se baje el repo de bond, pero NO quien use bond en otro proyecto. `bond init` exporta las skills del catálogo, y la config global (~/.agents/skills/) no viaja con el repo. Ninguna de las dos sirve.

## Decision

Una skill es "propia del repo" cuando es una carpeta con SKILL.md dentro de `<repo>/.agents/skills/` que NO está declarada en el array `skills` de `.bond/bond.toml`. Verificado empíricamente: sobrevive a `bond sync`, `bond sync` la enlaza además a `.claude/skills/`, está versionada y se comparte con el repo, y `bond init --list` en un repo limpio NO la menciona.

## Rejected alternatives

Ponerlas en `catalog/skills/` y declararlas: las exportaría `bond init` a todos los repos, que es justo lo que no se quiere. Dejarlas en `~/.agents/skills/` (global): no viajan con el repo, cada persona tendría que instalarlas a mano.

## Consequences

`ci-status`, `merge-and-clean` y `tui-design` (esta última movida desde la config global) viven en `.agents/skills/` y no aparecen en `catalog/catalog.toml`. Al añadir una skill propia nueva, no tocar el catálogo ni el array `skills`; solo crear la carpeta y pasar `bond sync`.
