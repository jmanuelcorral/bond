---
id: "2026-11-09-83-release-yml-idempotente-el-reintento-es-rerun-no-borrar-tag"
title: "#83: release.yml idempotente; el reintento es rerun, no borrar tag"
status: "accepted"
date: "2026-11-09"
decided_by: "agent:pi"
accepted_by: "Issue #83 escrito y aprobado por el usuario con el arreglo propuesto tal cual; «Haz commit con la opción 1»."
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "plan: .github/workflows/release.yml"
  - "issue: https://github.com/jmanuelcorral/bond/issues/83"
  - "branch: main"
  - "head: 56c51e4"
---


## Context

En la 1.13.0 un fallo de npm (EOTP) tras crear la release hacía imposible reintentar: el paso «Crear la release» moría con «already exists» y la única vía era borrar release y tag, recompilar (cambiando SHA256SUMS) y dejar la URL pública caída ~10 min.

## Decision

El paso de creación de release en release.yml es idempotente: si la release existe, gh release edit + gh release upload --clobber; si no, gh release create. Un fallo aguas abajo se reintenta con gh run rerun --failed sin tocar el tag.

## Rejected alternatives

Mover el publish de npm antes de crear la release (se descarta: un fallo de npm dejaría la release sin crear); --verify-tag (no resuelve el «ya existe»); documentar el workaround (es lo que hacía la skill release-bond, no evita el coste).

## Consequences

La skill release-bond actualiza su árbol de fallos a «rerun» en vez de «borrar con --cleanup-tag». Sigue vigente que un rerun recompila binarios: el packaging y el tap se generan solo tras la run definitiva.
