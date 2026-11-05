---
id: "2026-11-05-release-bond-la-skill-de-release-de-bond-va-en-el-catalogo-con-default-false"
title: "release-bond: la skill de release de bond va en el catálogo con default = false"
status: "proposed"
date: "2026-11-05"
decided_by: "agent:pi/stuart"
accepted_by: ""
accepted_via: ""
supersedes: ""
superseded_by: ""
links:
  - "branch: team/issue-66-release-skill"
  - "head: 06092eb"
---


## Context

El procedimiento de publicar bond (versión y tag, release.yml, scripts/packaging.mts y el tap de Homebrew en otro repo) estaba solo en prosa en AGENTS.md. El issue #66 pide convertirlo en una skill del catálogo que un agente pueda seguir sin equivocarse.

## Decision

Skill nueva en catalog/skills/release-bond/SKILL.md, nombre `release-bond`, registrada en catalog/catalog.toml con `default = false`. Va en inglés como el resto del catálogo. Cubre las cuatro operaciones con su puerta de verificación previa (release no draft y con los 7 assets antes de correr packaging.mts; tag = package.json antes de empujar; SHA256SUMS verificado contra lo descargado; hashes del .rb del tap contra la release) y una tabla de recuperación cuando algo se rompe a mitad.

## Rejected alternatives

Ampliar release-prepare-github: rechazado, es una skill genérica adaptada de fluzo-labs que no conoce el tap ni packaging.mts y no debe mezclarse con detalles de este repo. Nombre `bond-release`/`release-bond-pipeline`: rechazado por no seguir la convención verbo-objeto-hospedador del catálogo (release-prepare-github, delivery-review-github). default = true rechazado: es una skill de mantenedor que solo aplica al repo bond; instalarla en cualquier repo que haga bond init sería ruido y un riesgo (dispara releases).

## Consequences

`bond init` la lista como opcional. Si más adelante bond se publica por otro método (AUR propio, otro tap), la skill hay que actualizarla: es la fuente de verdad del procedimiento. No se añadió a `skills` en .bond/bond.toml de este repo para no generar churn con bond sync; cada mantenedor puede añadirla si la quiere instalada aquí.
