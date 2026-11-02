---
id: "2026-11-02-idioma-por-defecto-de-la-cli-deteccion-del-locale"
title: "Idioma por defecto de la CLI: detección del locale"
status: "accepted"
date: "2026-11-02"
decided_by: "agent:pi/gru"
accepted_by: "D1(a) y D2(a); P3 incluido en esta PR."
accepted_via: "agent:pi/gru"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-11-02-cli-i18n.md#p1"
  - "branch: feat/terminal-logo"
  - "head: 9a98bd4"
---


## Context

bond imprime toda su salida en español hardcodeado y no hay ninguna resolución de idioma. Al introducir el idioma configurable es necesario decidir qué se usa cuando no existe ni `[ui] lang` en `~/.bond/config.toml` ni la variable `BOND_LANG` (primera ejecución, comandos sueltos antes de pasar por `bond setup`).

## Decision

Sin `[ui] lang` ni `BOND_LANG`, bond detecta el idioma del entorno (`LC_ALL`, `LC_MESSAGES`, `LANG`, `LANGUAGE`): `es` si empieza por `es`, `en` en cualquier otro caso, y `es` si no se puede detectar. La prioridad completa es `BOND_LANG` > `[ui] lang` > detección, calcando el patrón ya existente de `BOND_ICONS` / `[ui] icons` en `lib/status-bar.mts:113`.

## Rejected alternatives

Fijar `es` por defecto hasta que el usuario lo eligiera en `bond setup`: evita el cambio de comportamiento, pero deja en español a un usuario inglés que ejecute cualquier comando antes de pasar por el asistente. Con detección, quien tenga `LANG=en_US` pasará a inglés hasta que repita `bond setup`, que fija el valor explícito; se asume ese coste.

## Consequences

Cambio visible para usuarios existentes con locale no española hasta que repiten `bond setup`. Hay que fijar los tests que comprueban cadenas en español a `BOND_LANG=es` para que no dependan del entorno de quien los ejecuta.
