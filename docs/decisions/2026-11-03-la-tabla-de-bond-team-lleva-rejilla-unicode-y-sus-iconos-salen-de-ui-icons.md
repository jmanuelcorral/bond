---
id: "2026-11-03-la-tabla-de-bond-team-lleva-rejilla-unicode-y-sus-iconos-salen-de-ui-icons"
title: "La tabla de bond team lleva rejilla Unicode y sus iconos salen de [ui] icons"
status: "accepted"
date: "2026-11-03"
decided_by: "agent:pi/gru"
accepted_by: "la tabla se ve muy mal, no parece una tabla, añade lineas y si tenemos en la config la nerdfont utilizala"
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

Tras implementar la tabla unificada de #33 el usuario la revisó en un panel de Herdr y dijo que «se ve muy mal, no parece una tabla»: iba sin líneas y hardcodeaba emojis aunque su ~/.bond/config.toml ya ponía [ui] icons = "nerd". Había que añadir rejilla sin tocar dependencias y respetar el estilo de iconos que bond setup ya elige para el pie de pi.

## Decision

La tabla se dibuja con trazos Unicode U+2500..U+257F (están en cualquier fuente, Nerd o no): línea superior, cabecera separada, una banda de título a todo el ancho por grupo (├─┴─┤ arriba, ├─┬─┤ abajo) y cierre inferior. El ancho total pasa a ser sum(celdas) + 3·n + 1. Los iconos de estado salen del estilo que ya rige el pie — BOND_ICONS o [ui] icons — con tres juegos (nerd / emoji / unicode) en STATE_ICONS y stateIcon(); tableIconStyle() lo resuelve una vez por proceso. integrada y sin commits comparten icono en los tres juegos, como fijaba D5, para que el pie los sume como una sola cosa. MIN_TABLE_WIDTH sube de 20 a 24 porque la rejilla cuesta unas 16 columnas; a 60 (el ancho por el que se diseñó) caben las cinco columnas. Las pruebas fijan BOND_ICONS=emoji en un preload nuevo (test/icons-pinned.mts) para no depender de la fuente de quien las ejecuta.

## Rejected alternatives

Solo líneas horizontales (estilo psql): no cuesta columnas pero sigue sin parecer una tabla con rejilla; descartado por la petición explícita. Iconos fijos en la tabla ignorando [ui] icons: incoherente con el pie de pi y con lo que bond setup pregunta. Dejar MIN_TABLE_WIDTH en 20: a ese ancho no caben ni dos columnas con rejilla, así que la tabla solo diría «no cabe».

## Consequences

El coste de la rejilla (≈16 columnas) adelanta la escalera de sacrificio de columnas: FICHEROS cae por debajo de 55 y COMMITS por debajo de 40. Cualquier futuro cambio de columnas debe contar gridWidth(), no la suma de celdas. Los glifos nerd van en plano de uso privado: sin la fuente instalada se ven vacíos, no se confunden con texto, y para eso existe el juego unicode. test/icons-pinned.mts se añade al preload de bunfig.toml junto a lang-pinned.mts.
