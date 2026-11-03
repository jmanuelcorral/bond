---
id: "2026-11-03-hub-bump-comando-nuevo-bond-hub-bump-en-cli-hub-bump-mts"
title: "hub bump: comando nuevo `bond hub bump` en cli/hub-bump.mts"
status: "proposed"
date: "2026-11-03"
decided_by: "agent:pi/kevin"
accepted_by: ""
accepted_via: ""
supersedes: ""
superseded_by: ""
links:
  - "branch: feat/hub-bump-base"
  - "head: 390c2f7"
---


## Context

Issue #43: al integrar el trabajo de un repo en su base, el hub sigue apuntando al commit viejo del submódulo y hay que poder mover el gitlink al commit actual de la base, commiteado en el hub pero sin push. Se barajó también una opción --bump en hub sync o en hub pull.

## Decision

Acción nueva como subcomando propio: `bond hub bump` (nuevo fichero cli/hub-bump.mts, misma forma que hub-pull: resultado por repo, informe, --dry-run, --json). Para cada repo de la sesión con link="submodule": objetivo = el commit de la rama base local del submódulo (refs/heads/<base>), que es justo lo que `bond hub pull` (b3a740e/c23f375) ya se encarga de avanzar; bump consume ese estado local y mueve el gitlink del hub con `git update-index --cacheinfo 160000` a ese commit, en un único commit en la rama actual del hub, sin push nunca. Si el submódulo estaba en HEAD separado y limpio, tras el commit se le hace checkout del nuevo puntero para que el hub quede limpio. Los repos por symlink se listan explícitamente como "no aplica" (no hay gitlink).

## Rejected alternatives

--bump en `hub pull`: rechazado porque pull tiene contrato explícito de "nunca commitea" (solo avanza refs con fetch/fast-forward) y añadirle un commit en el hub mezclaría dos efectos distintos. --bump en `hub sync`: rechazado porque sync es "dejar el disco como dice hub.toml" (montar enlaces, bond init, registro); mover punteros de submódulo no es sincronizar la declaración y sync tampoco commitea.

## Consequences

Flujo documentado: `bond hub pull` (avanza las bases) → `bond hub bump` (mueve los punteros y commitea en el hub) → el usuario revisa y empuja. bump no hace fetch: si la base local está atrasada, hay que pasar pull antes. bump aborta si el hub tiene cambios ya staged (no commitea cosas ajenas).
