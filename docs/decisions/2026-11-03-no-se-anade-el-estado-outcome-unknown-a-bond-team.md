---
id: "2026-11-03-no-se-anade-el-estado-outcome-unknown-a-bond-team"
title: "D7: ni estado outcome-unknown ni lectura de preguntas reales en bond team"
status: "accepted"
date: "2026-11-03"
decided_by: "agent:pi/gru"
accepted_by: "Sí, cierra las siete y escribe el plan."
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-11-03-team-status-table.md#d7"
  - "issue: https://github.com/jmanuelcorral/bond/issues/33"
  - "branch: main"
  - "head: 2b80463"
  - "decision: docs/decisions/2026-11-03-la-tabla-de-bond-team-pinta-solo-el-estado-la-linea-de-pregunta-se-quita.md"
---


## Context

La lente de diseño (skill tui-design, agent-sessions.md) lista los estados que una interfaz de sesiones de agentes debe distinguir, entre ellos `cancelling` y `outcome-unknown`, y parecía un hueco en los seis estados de bond. Al comprobar `classify()` en el código resultó ser menor de lo aparente.

Al revisar despues la tabla ya rediseñada (#33) salio el mismo principio en otro sitio: la fila bloqueada llevaba debajo una linea `└ pregunta:`. Comprobado el codigo, bond no lee preguntas de los agentes. `questionIn` (`cli/herdr.mts`) casa unicamente dos patrones del aviso de confianza de la carpeta del proyecto y devuelve siempre una cadena fija, nunca lo que el agente ha escrito. La linea existia dando a entender una capacidad que no tenemos.

## Decision

No se añade `outcome-unknown` al modelo de estados de `bond team`. Los estados de bond describen git más vivacidad del agente, no terminación de la tarea: un agente muerto con ficheros sucios da `sin commitear`, que es honesto porque efectivamente hay cambios sin commitear, y una rama con commits delante sin agente da `lista`, que afirma «revisable», no «tarea completa». Añadir `outcome-unknown` obligaría a llevar un registro de «tarea en vuelo», que es un segundo ledger autoritativo introducido solo para la UI. En su lugar queda propuesto, como issue aparte y fuera del plan de #33, mostrar la vivacidad del agente (activo / ocioso / ido) en la celda de agente, derivable del estado del panel de Herdr sin ledger nuevo.

Tampoco se añade lectura de preguntas reales de los paneles. Se documenta aqui porque es la misma decision con otra piel: una pregunta leida del panel seria informacion de la tarea que bond no puede saber de forma fiable, y parsear texto arbitrario de un panel para reconstruirla seria un segundo libro mayor de lo que la interfaz afirma. Lo que bond si sabe, lo dice: el icono ⛔ de que el agente espera algo tuyo, el aviso de como responder bajo la tabla, y en `bond team status <rama>` la linea `espera:` con lo unico detectable (el aviso de confianza). La linea `└ pregunta:` se quita de la tabla; ver la decision de cambio concreto enlazada abajo.

## Rejected alternatives

Añadir `outcome-unknown` como séptimo estado: descartado porque exige saber si una tarea estaba en vuelo y se perdió su señal, información que bond no tiene y que solo se obtendría duplicando el estado del agente en un sitio nuevo. Tratar «agente muerto con ficheros sucios» como fallo: descartado porque confunde una interrupción con un resultado, y el usuario sí puede querer esos cambios.
Añadir ahora lectura de preguntas reales (parsear el panel del agente para extraer lo que pregunta): descartado por pedido explícito del usuario y porque no hay contrato estable que parsear — cada agente formatea sus preguntas a su manera, el texto cambia entre versiones y entre idiomas, y un falso positivo en una fila ⛔ es peor que no decir nada. Quedaría como trabajo propio con su contrato de detección, su tasa de falsos positivos medida y su forma de degradar, no como añadido de esta tabla.

## Consequences

El modelo de estados de #33 no crece, lo que mantiene el plan en una sola fase. Si más adelante se quiere la vivacidad del agente, se abre como issue propio con su propio contrato de celda, no como parche dentro de esta tabla. Lo mismo con las preguntas: la tabla no vuelve a imprimir texto de pregunta en ningún ancho (la prueba lo fija); si algún día bond leyera preguntas reales, entra como capacidad nueva con su contrato de detección y su degradación acordados, no como línea suelta en la fila bloqueada. La decisión del cambio concreto de esta fase está en «La tabla de bond team pinta solo el estado; la línea de pregunta se quita», que depende de esta.
