---
id: "2026-11-02-ci-workflow-dispatch-en-ci-yml-para-dar-senal-de-windows-a-una-rama-sin-abrir-pr"
title: "CI: workflow_dispatch en ci.yml para dar señal de Windows a una rama sin abrir PR"
status: "accepted"
date: "2026-11-02"
decided_by: "agent:pi/kevin"
accepted_by: "A"
accepted_via: "agent:pi/kevin"
supersedes: ""
superseded_by: ""
links:
  - "run: https://github.com/jmanuelcorral/bond/actions/runs/41507903830"
  - "branch: fix/hub-tests-windows"
  - "head: 130c07f"
---


## Context

Los tests del modo hub debían ejecutarse en Windows (issue #41) y su causa raíz solo se ve pasando la CI real. Hasta ahora `ci.yml` solo se disparaba con push a `main` o `pull_request`, y abrir un PR no estaba autorizado para este trabajo.

## Decision

Se añade `workflow_dispatch` al workflow `ci.yml` para poder lanzar la matriz completa (Linux, macOS, Windows) sobre cualquier rama con `gh workflow run ci.yml --ref <rama>`, sin necesidad de abrir un PR.

## Rejected alternatives

Abrir un draft PR desde la rama (más ruido en GitHub y fuera de lo autorizado); simular Windows en local (imposible).

## Consequences

Cualquier rama puede pedir la matriz de tres sistemas sin PR. El disparo manual es tan caro como el automático: se usa con criterio.
