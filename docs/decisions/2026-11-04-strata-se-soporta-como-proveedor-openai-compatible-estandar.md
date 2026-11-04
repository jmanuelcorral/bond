---
id: "2026-11-04-strata-se-soporta-como-proveedor-openai-compatible-estandar"
title: "Strata se soporta como proveedor OpenAI-compatible estandar"
status: "accepted"
date: "2026-11-04"
decided_by: "agent:pi/gru"
accepted_by: "strata lee imagenes como input, por eso pone imagenes a true, y lo que digo de soportar strata es para configurarlo como proveedor tal y como hacemos con cualquier otra api compatible con openai"
accepted_via: "agent:pi/gru"
supersedes: ""
superseded_by: ""
links:
  - "branch: main"
  - "head: 89b16f6"
---


## Context

El enunciado original de #63 era ambiguo: bond no invoca modelos por si mismo, configura agentes que lo hacen, y no estaba claro que significaba «soportar Strata». Comprobado en la maquina: /health devuelve images:true pero image_generation:false.

## Decision

Soportar Strata significa anadirlo como proveedor en el registro de bond igual que cualquier otra API compatible con OpenAI (base_url + api_key + modelo), sin mecanismos especiales. `images: true` es entrada de imagen, que si esta soportada; `image_generation: false` es generacion de imagen, que no esta disponible y no se intenta soportar.

## Rejected alternatives

Que bond consuma un modelo directamente para sugerencias o clasificadores, o que haga una integracion especifica de Strata. Descartado por el usuario: es un proveedor OpenAI-compatible mas.

## Consequences

El trabajo se reduce a comprobar que el registro de proveedores de bond admite un endpoint local con key, y documentarlo. Si ya admite base_url arbitrario puede no hacer falta codigo. La generacion de imagen queda fuera.
