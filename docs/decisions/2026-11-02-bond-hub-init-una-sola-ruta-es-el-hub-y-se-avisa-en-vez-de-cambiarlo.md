---
id: "2026-11-02-bond-hub-init-una-sola-ruta-es-el-hub-y-se-avisa-en-vez-de-cambiarlo"
title: "bond hub init: una sola ruta es el hub, y se avisa en vez de cambiarlo"
status: "proposed"
date: "2026-11-02"
decided_by: "agent:pi/gru"
accepted_by: "ok, acepto la decision"
accepted_via: "agent:pi/gru"
supersedes: ""
superseded_by: ""
links:
  - "pr: https://github.com/jmanuelcorral/bond/pull/53"
  - "run: commits ed192c8,76f190c,459a08c on fix/hub-init-validation"
  - "branch: fix/hub-init-validation"
  - "head: 459a08c"
---


## Context

Issue #40: fuera de un repo, `bond hub init ../api` convertía ../api en el hub, aunque la ruta se lee como un repo a importar. Cambiar el significado de la ruta única habría roto los usos existentes de `bond hub init <dir>` para crear el hub en una ruta dada.

## Decision

Se mantiene el comportamiento (una sola ruta = directorio del HUB) pero deja de ser silencioso: fuera de un repo, si esa ruta única ya es un repo git que no es un hub, bond avisa antes de crear nada y, con terminal, pide confirmación. Las formas explícitas para importar son `bond hub init . <ruta>` y `bond hub init --repo <ruta>`, documentadas en la ayuda.

## Rejected alternatives

Hacer obligatorio `.` como primer argumento (rompe `bond hub init <dir>` para crear el hub en una ruta); cambiar el defecto para que la ruta única se importe (ambigüedad inversa, misma rotura); callar y solo documentar (no evita el error que motivó el issue).

## Consequences

Los scripts que usaban `bond hub init <ruta>` siguen funcionando; en el caso ambiguo aparece un aviso en stderr (y un prompt interactivo), así que en CI conviene `--yes` o la forma explícita `--repo`. Nuevas claves de mensajes: hub.init_ambiguous_prompt/warn/declined.
