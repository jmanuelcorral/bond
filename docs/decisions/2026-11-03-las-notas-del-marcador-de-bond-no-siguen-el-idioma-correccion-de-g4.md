---
id: "2026-11-03-las-notas-del-marcador-de-bond-no-siguen-el-idioma-correccion-de-g4"
title: "Las notas del marcador de bond no siguen el idioma (corrección de G4)"
status: "accepted"
date: "2026-11-03"
decided_by: "agent:pi/gru"
accepted_by: "Usa el mensaje en español: feat(i18n): el texto generado para agentes sigue el idioma configurado (corrección aplicada por el agente al ver fallar la CI de la PR #61; el usuario pidió empujar y abrir PR, y la corrección era necesaria para que la PR pase)"
accepted_via: "agent:pi/gru"
supersedes: ""
superseded_by: ""
links:
  - "branch: feat/generated-text-i18n"
  - "head: 2dc3122"
---


## Context

G4 decía que se traducen las cabeceras de tabla pero no los caminos ni los comandos. Al empujar la PR #61, el paso `bond sync --check` de la CI de bond falló en Linux con `~ CLAUDE.md bond block`: el bloque está commiteado con la nota en español y el runner, por locale, detecta inglés. Como las notas del marcador se habían hecho dependientes del idioma, el fichero commiteado dejaba de coincidir con lo que bond esperaba generar. El aviso de G2 ni siquiera saltaba porque los manifiestos de bond <= 1.11 no traen el campo lang.

## Decision

Las notas del marcador (BLOCK_NOTE en cli/instructions.mts y DEFAULT_NOTE en cli/repo.mts) quedan como constantes fijas en español, fuera del catálogo de mensajes. Son metadato del marcador, no prosa que lea el agente, y traducirlas acopla lo commiteado al locale que detecta cada máquina. Las claves gen.block_note y gen.default_note se eliminan del catálogo. Adicionalmente se fija BOND_LANG=es en el paso `sync --check` de la CI de bond, para que los artefactos commiteados del repo se comprueben de forma determinista. G4 queda ampliado: no se traducen caminos, comandos ni notas del marcador.

## Rejected alternatives

Fijar BOND_LANG en el CI de bond y dejar las notas traducidas: arregla el repo pero deja la trampa montada para cualquier usuario cuyo CI detecte un idioma distinto del que tenía su máquina al commitear, y con el aviso de G2 apagado por manifiesto antiguo. Hacer que blockCurrent() ignore la nota al comparar: oculta el problema en vez de quitarlo, y rompe la propiedad de que el bloque se regenera byte a byte.

## Consequences

La propiedad que importa, y que ahora tiene prueba propia, es que el resultado de withBlock() no depende del idioma. Un bloque generado por bond sigue siendo byte-estable entre máquinas salvo que cambie el contenido real (reglas, bloque del hub, nota de coordinación), que es lo que el usuario eligió traducir. Si algún día se quisieran notas traducidas haría falta una comparación de bloques que ignore la nota y una migración de los commiteados.
