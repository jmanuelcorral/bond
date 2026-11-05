---
id: "2026-11-05-el-tap-jmanuelcorral-homebrew-tap-tiene-ci-propia-brew-yml-instala-comprueba-version-y-corre-el-test-de-la-formula"
title: "El tap jmanuelcorral/homebrew-tap tiene CI propia: brew.yml instala, comprueba versión y corre el test de la fórmula"
status: "accepted"
date: "2026-11-05"
decided_by: "agent:pi"
accepted_by: "Orden: 1 crear brew.yml en el tap, 2 voltear mensajes de update y cerrar #66, 3 abrir issue de idempotencia."
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "run: https://github.com/jmanuelcorral/homebrew-tap/actions/runs/42052398646"
  - "pr: https://github.com/jmanuelcorral/homebrew-tap/commit/adb274c"
  - "branch: main"
  - "head: 73216f3"
---


## Context

Al sacar la 1.13.0 se cumplió el paso 4 del proceso de release («lanzar brew.yml») y el workflow no existía: el tap solo tenía Formula/ y README.md tras catorce releases. La fórmula se empujaba sin ninguna comprobación automatizada de que `brew install jmanuelcorral/tap/bond` resolviera, de que el binario arrancara o de que su versión coincidiera con la fórmula. AGENTS.md y la skill release-bond mandaban un paso inexistente.

## Decision

Crear .github/workflows/brew.yml en el tap con tres plataformas (macos-14 arm64, macos-13 x86_64, ubuntu-latest x86_64): tap + install + `bond --version` + comparación de la versión instalada contra `brew info --json` + `brew test`. Se dispara con push que toque Formula/** o el propio workflow, workflow_dispatch y un cron semanal (captura releases re-cortadas o assets re-subidos). La acción se pinnea a una tag inmutable de Homebrew/actions, no a una rama.

## Rejected alternatives

Dejar el tap sin CI y quitar la referencia a brew.yml de AGENTS.md y de la skill: se descartó porque el riesgo real (fórmula apuntando a bytes que ya no existen tras un re-cut) es justo el que una comprobación automática evita. `brew audit --strict` no se incluyó: es frágil para fórmulas de binarios de un tap personal y daría falsos fallos. `@main` en vez de tag fija: resolvería pero deja la cadena de suministro moviéndose.

## Consequences

Cada bump de fórmula en el tap ejecuta ~3 instalaciones reales. La tag pinneada de Homebrew/actions envejece y hay que actualizarla de vez en cuando. El proceso de release de bond (skill release-bond, paso 4) vuelve a ser exacto: ahora sí existe lo que manda lanzar.
