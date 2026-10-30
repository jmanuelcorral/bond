---
id: "2026-10-30-bond-hub-check-da-un-level-ok-warn-o-fail-por-comprobacion-repo-e-informe"
title: "bond hub check da un level ok, warn o fail por comprobación, repo e informe"
status: "accepted"
date: "2026-10-30"
decided_by: "agent:claude"
accepted_by: "si, hazlo y prepara la PR"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-30-hub-ops.md"
  - "branch: feat/hub-check-level"
  - "head: 0836255"
---


## Context

El --json de bond hub check modelaba los avisos con ok: true y warn: true y un contador problems, lo que admite combinaciones sin sentido y no coincide con bond doctor (ok/warn/fail). Nadie usa todavía la herramienta, así que el formato se puede cambiar.

## Decision

En el informe de bond hub check cada comprobación lleva level: "ok" | "warn" | "fail" en lugar de ok y warn; cada repo y el informe llevan su level (el peor de lo que contienen) y el informe cuenta failures y warnings en lugar de problems. El código de salida es 1 solo con level fail. bond doctor usa el level del informe en su fila del hub.

## Rejected alternatives

ok: true + warn: true y warnings aparte de problems (propuesta de kevin): estados imposibles y otro vocabulario que bond doctor. Una lista de avisos separada por repo: duplica estructura.
