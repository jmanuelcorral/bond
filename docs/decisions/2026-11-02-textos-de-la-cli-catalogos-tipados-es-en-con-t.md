---
id: "2026-11-02-textos-de-la-cli-catalogos-tipados-es-en-con-t"
title: "Textos de la CLI: catálogos tipados es/en con t()"
status: "accepted"
date: "2026-11-02"
decided_by: "agent:pi/gru"
accepted_by: "D1(a) y D2(a); P3 incluido en esta PR."
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-11-02-cli-i18n.md#p1"
  - "branch: feat/terminal-logo"
  - "head: 9a98bd4"
---


## Context

La CLI de bond tiene ~546 sitios que emiten texto (`log`/`warn`/`die`/`console.log` en `cli/*.mts`) más 17 bloques `*_HELP` y el `bond --help` de `cli/main.mts:16`. Hay que elegir cómo se organizan los textos en dos idiomas para poder migrar por grupos sin perder cadenas.

## Decision

Los textos van en catálogos tipados en `cli/messages.mts`, con un objeto `es` y uno `en` por área y un helper `t(clave, params)`. Las claves se tipan contra `es`, de modo que una clave sin su traducción en `en` es un error de compilación (`npm run typecheck`). La resolución de idioma vive aparte, en `lib/lang.mts`, sin dependencias (parseo línea a línea del TOML, no `smol-toml`), igual que `iconStyleFromConfig`.

## Rejected alternatives

Objetos bilingües inline en cada llamada (`{ es, en }`): migración más rápida y sin registro de claves, pero imposible de auditar (no hay forma de saber qué cadenas faltan en inglés) y el texto de ambos idiomas mezclado en cada sitio de un código que ya es denso.

## Consequences

Hace falta una convención de claves por área (`setup.*`, `team.*`, `help.*`) y migrar cada comando tocando dos ficheros. A cambio, `typecheck` actúa de inventario de traducciones pendientes.
