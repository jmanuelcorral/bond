---
id: "2026-11-02-alcance-del-i18n-solo-la-consola-de-bond-no-lo-que-recibe-el-agente"
title: "Alcance del i18n: solo la consola de bond, no lo que recibe el agente"
status: "accepted"
date: "2026-11-02"
decided_by: "agent:pi/gru"
accepted_by: "creo que hemos de hacerlo mas simple, para el idioma solo quiero que \"traduzcas\" los comandos de la shell de bond. Si el usuario le habla en castellano al agente es problema del agente [...] P3 incluido en esta PR."
accepted_via: "agent:pi/gru"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-11-02-cli-i18n.md#p3"
  - "branch: feat/terminal-logo"
  - "head: 9a98bd4"
---


## Context

Al plantear el idioma es/en de bond había dos superficies posibles: el texto que bond imprime por consola y el texto que bond inyecta en los agentes (las reglas `BOND_RULES`, la plantilla `PERSONAL_TEMPLATE` y la nota `BLOCK_NOTE` de `cli/instructions.mts`, que acaban en `~/.claude/CLAUDE.md`, `~/.pi/AGENTS.md` y el plugin de agy). También estaba abierto si la migración del resto de comandos entraba en esta PR o en un plan aparte.

## Decision

El idioma de bond solo cubre lo que bond imprime por consola: el asistente de `bond setup`, las ayudas (`bond --help` y los 17 bloques `*_HELP`) y los mensajes de todos los comandos (P3 incluido en esta PR). Lo que consume el agente queda fuera: `BOND_RULES`, `PERSONAL_TEMPLATE` y `BLOCK_NOTE` siguen en español y no se tocan; el idioma en que el agente responde lo decide el `~/.bond/AGENTS.md` del usuario, no bond.

## Rejected alternatives

Traducir también el bloque de reglas inyectadas en cada agente: habría obligado a mantener `blockCurrent` (`cli/instructions.mts:64`) y `propagate` (`:71`) resolviendo el mismo idioma para que `bond doctor` no reportase drift permanente, y a reescribir el fichero de instrucciones de todos los agentes cada vez que se cambia de idioma. Se descarta por coste: el usuario ya controla el idioma del agente por su cuenta.

## Consequences

Un usuario con `lang = "en"` seguirá recibiendo el bloque de reglas de bond en español; se documenta como comportamiento esperado. El resto de la CLI (init, sync, team, hub, catalog, decisions, models, update, doctor, keys) se migra en esta misma PR, por grupos de ficheros.
