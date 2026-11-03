---
id: "2026-11-03-el-texto-que-bond-genera-para-el-agente-sigue-el-idioma-g1-g4"
title: "El texto que bond genera para el agente sigue el idioma: G1-G4"
status: "accepted"
date: "2026-11-03"
decided_by: "agent:pi/gru"
accepted_by: "Adelante con las cuatro: G1, G2 con aviso explícito y `bond sync --check` distingue cambio de idioma, G3 sin migrar, G4 traducir cabeceras pero no rutas/comandos"
accepted_via: "agent:pi/gru"
supersedes: ""
superseded_by: ""
links:
  - "branch: main"
  - "head: a25c9f9"
---


## Context

#49 pide que bond setup elija el idioma y que ese idioma afecte también a lo que bond genera para el agente. La parte de consola se publicó en 1.11.0, pero cli/messages.mts:7 documenta explícitamente que los textos que reciben los agentes no están: BOND_RULES, PERSONAL_TEMPLATE, BLOCK_NOTE, hubAgentsBlock, DEFAULT_NOTE y verticalNote son español hardcodeado (~25 cadenas). Comprobado que withBlock casa el marcador por su prefijo sin la nota, y que ensurePersonal solo escribe si el fichero no existe, así que no hay riesgo de pisar trabajo del usuario.

## Decision

G1: las cadenas de contenido generado van a un área nueva cli/messages/gen.mts con claves gen.*, y se actualiza el comentario de cabecera de messages.mts para reflejar que ahí hay dos categorías (consola y fichero). G2: el idioma se fija al generar; al cambiarlo, blockCurrent() da falso y el siguiente bond sync reescribe los bloques, con aviso explícito de cuántos se reescriben y en qué idioma, y bond sync --check distingue «bloque desactualizado» de «cambio de idioma». G3: ~/.bond/AGENTS.md no se migra; tras el seed es del usuario y cambiar de idioma no lo toca. G4: se traducen las cabeceras de tabla del hub (RUTA->PATH, ENLACE->LINK, DESCRIPCION->DESCRIPTION...) pero nunca los caminos (docs/plans/, docs/decisions/, hub.toml) ni los comandos de bond.

## Rejected alternatives

Meter las cadenas en las áreas existentes de messages.mts: rompería la invariant declarada de que ahí solo va consola. Guardar el idioma dentro del marcador del bloque: estado redundante, blockCurrent() ya lo detecta comparando contenido. Migrar ~/.bond/AGENTS.md al cambiar de idioma: sería sobrescribir instrucciones personales del usuario. Dejar las cabeceras de tabla en español dentro de un bloque inglés: incoherencia a mitad de página.

## Consequences

Cambiar de idioma produce un diff grande en el AGENTS.md de cada repo; por eso G2 exige el aviso. Tres ficheros de test fijan texto generado exacto (hub-init, repo, team-hub, 4 aserciones) y hay que adaptarlos. Los runs y los encargos ya enviados conservan el idioma con que se escribieron. El texto generado en en es una traducción nueva de prosa larga, no una reutilización de claves de consola.
