---
id: "2026-11-03-tabla-de-bond-team-siete-decisiones-de-diseno-d1-d6"
title: "Tabla de bond team: siete decisiones de diseño (D1-D6)"
status: "accepted"
date: "2026-11-03"
decided_by: "agent:pi/gru"
accepted_by: "Sí, cierra las siete y escribe el plan."
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-11-03-team-status-table.md"
  - "issue: https://github.com/jmanuelcorral/bond/issues/33"
  - "branch: main"
  - "head: 2b80463"
---


## Context

La vista en vivo de `bond team` gasta 10 líneas en cabeceras de grupo y blancos para 5 ramas, y en un hub agrupa por estado, lo que parte una misma vertical en varios grupos y la hace invisible (issue #33). Además `printStatus` y `renderWatch` son código paralelo que hace lo mismo. Se cierra el diseño con la lente de la skill tui-design.

## Decision

D1: el estado va como icono en la columna MINION, sin columna propia redundante. D2: una cabecera de grupo ocupa exactamente una línea, sin blancos; en hub el grupo es la vertical (rama base común), no el estado. D3: orden de sacrificio de columnas fijo y documentado, MINION > RAMA > ESTADO(icono) > COMMITS > FICHEROS > DÓNDE, se quita desde el final y los roles no se reordenan entre refrescos. D4: `bond team status <rama>` imprime esa fila en `clave: valor` sin truncar, como ruta al valor completo cuando la tabla no cabe. D5: pie con totales calculados en el momento de renderizar a partir de las Row ya recogidas, sin guardar ningún contador. D6: color solo en el icono de estado y en el estado; el resto en color por defecto, conservando el icono como redundancia no cromática.

## Rejected alternatives

Cabecera de grupo por estado con líneas en blanco (el estado actual): descartado por el coste vertical. Agrupar siempre por estado y marcar la vertical con un prefijo en la rama: descartado porque no resuelve que las ramas de una misma vertical queden separadas. Añadir una columna de vertical: descartado por coste de ancho en paneles de 60 columnas. Guardar los totales en el modelo para el pie: descartado porque introduce un segundo ledger autoritativo solo para la UI, que la lente de diseño prohíbe expresamente. Pintar celdas enteras por estado: descartado porque satura y porque el color debe reforzar, no portar solo el significado.

## Consequences

`printStatus` y `renderWatch` pasan a compartir un único renderer de tabla, así que la tabla de una sola pasada gana título, iconos y pie. El orden de columnas pasa a ser contrato visual. Hay que añadir claves de i18n en `cli/messages/team.mts` para cabeceras de vertical, aviso de columnas caídas y pie de totales, más pruebas de render por ancho (80x24, 60, 12 y el mínimo declarado) y de truncado con clusters de emoji y CJK. El esquema de `--json` no cambia.
