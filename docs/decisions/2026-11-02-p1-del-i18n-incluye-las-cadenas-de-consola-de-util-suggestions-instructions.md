---
id: "2026-11-02-p1-del-i18n-incluye-las-cadenas-de-consola-de-util-suggestions-instructions"
title: "P1 del i18n incluye las cadenas de consola de util/suggestions/instructions"
status: "accepted"
date: "2026-11-02"
decided_by: "agent:pi/gru"
accepted_by: "venga, confirmamos! (aceptar la decision proposed del P1)"
accepted_via: "agent:pi/gru"
supersedes: ""
superseded_by: ""
links:
  - "branch: feat/terminal-logo"
  - "head: ac8ba74"
---


## Context

Al ejecutar P1 del plan de i18n (docs/plans/2026-11-02-cli-i18n.md) su criterio «con en no queda ninguna cadena en español en la salida del asistente» no se cumplía traduciendo solo cli/setup.mts y cli/wizard.mts: el asistente imprime a través de otros módulos y quedaban restos (prefijo aviso: de warn(), falló: de runAct(), ya enlazado:/enlazado: de linkPath(), las trazas de act() de suggestions.mts, escribir ... y bloque de bond en ... de instructions.mts y el aviso de migración de config.mts).

## Decision

Traer a P1 esas cadenas concretas (unas 15 claves en cli/messages.mts: util.warn, util.failed, util.write, util.bond_block, util.already_linked, util.linked, util.exists_backed_up, suggestions.enabled_models, suggestions.em_not_set, suggestions.em_already, suggestions.note_em_already, suggestions.note_declared, config.migrated) en lugar de dejarlas para P3, para que el criterio de aceptación sea verificable tal como está escrito.

## Rejected alternatives

Dejarlas en P3 y relajar el criterio de P1 a «solo setup.mts y wizard.mts»: se aceptó peor porque el criterio dejaría de significar lo que dice y quedaría un asistente medio en inglés y medio en español en la misma ejecución. Traducir también el resto de util.mts/instructions.mts en P1: se descartó por mantener P1 acotado; ese trabajo sigue en P3.

## Consequences

cli/util.mts, cli/suggestions.mts, cli/instructions.mts y cli/config.mts importan ahora t() de cli/messages.mts (sin ciclo: messages.mts solo depende de lib/lang.mts). P3 mantiene esos ficheros en su lista, pero solo para las cadenas que aún no pasaron por catálogo.
