---
id: "2026-11-03-la-tabla-de-bond-team-pinta-solo-el-estado-la-linea-de-pregunta-se-quita"
title: "La tabla de bond team pinta solo el estado; la linea de pregunta se quita"
status: "accepted"
date: "2026-11-03"
decided_by: "agent:pi/gru"
accepted_by: "No renderizamos preguntas / solo el estado"
accepted_via: "agent:pi/gru"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-11-03-team-status-table.md#p1"
  - "issue: https://github.com/jmanuelcorral/bond/issues/33"
  - "branch: feat/team-status-table"
  - "head: 2b80463"
---


## Context

El usuario revisando la tabla nueva de #33 senalo que «no renderizamos preguntas, solo el estado».
Al comprobarlo en el codigo: `questionIn` (cli/herdr.mts) solo casa dos patrones fijos del aviso de
confianza de la carpeta del proyecto y devuelve siempre la misma cadena, nunca lo que un agente ha
escrito. La linea `└ pregunta:` de la tabla no podia llevar contenido real. Ademas `teamRows` y
`hubRows` hacian `agent_status !== "blocked" ? questionIn(screen) : undefined`, de modo que cuando
Herdr si marcaba el agente como blocked se descartaba el aviso, justo el caso en que importa.

## Decision

La tabla pinta el estado y nada mas. Se quita la linea `└ pregunta:` de `tableLines`. El icono ⛔ ya
dice que el agente espera algo tuyo, el aviso de como responder se sigue imprimiendo bajo la tabla,
y en `bond team status <rama>` sale la linea `espera:` con lo que se pudo detectar. Se corrige
aparte el descarte por `blocked`: `questionIn` se lee siempre, porque no casa el aviso de arranque de
agy (eso lo aparta `startupNoticeIn`), asi que el filtro no protegia de nada. El mensaje
`team.watch_question` se elimina en es y en.

## Rejected alternatives

Simular en la tabla una pregunta que bond no puede leer. Mantener la linea solo para el aviso de
confianza: es una cadena fija que se confunde con una pregunta escrita por el agente, y en el ancho
de un panel se recorta a algo aun mas enganoso.

## Consequences

El `Row.agent.question` sigue existiendo y alimentando `detailLines` y los avisos bajo la tabla; lo que
ya no tiene uso es la banda dentro de la tabla. Ningun ancho debe volver a imprimir texto de pregunta:
la prueba lo fija. Si algun dia bond leyera preguntas reales de los paneles, eso es una capacidad nueva
que hay que decidir aparte (ver D7: no anadir un segundo libro mayor de lo que bond no puede saber).
Verificado: `npx tsc -p .` limpio, `bun test` 604 pass / 0 fail (3812 `expect()`, 32 ficheros),
`test/team.test.mts` 95 pass. Demo `tmp-demo-tabla.mts` borrada: ensenaba preguntas inventadas que
bond es incapaz de producir.
