---
id: "2026-11-04-strata-se-soporta-como-proveedor-en-el-registro-con-la-clave-en-bond-keys"
title: "Strata se soporta como proveedor en el registro, con la clave en ~/.bond/keys"
status: "accepted"
date: "2026-11-04"
decided_by: "agent:pi/gru"
accepted_by: "1a 3a"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "issue: https://github.com/jmanuelcorral/bond/issues/63"
  - "branch: main"
  - "head: eee039e"
---


## Context

El enunciado «soportar Strata» (issue #63) era ambiguo: bond no invoca modelos por sí mismo, configura agentes que lo hacen. Comprobado empíricamente que los cuatro targets (pi, opencode, crush, codex) ya generan config válida para un endpoint OpenAI-compatible local y que Strata sirve las tres formas de API (chat, responses, messages).

## Decision

Strata entra como proveedor del registro de bond para los agentes (opción 1a), no como algo que bond consuma directamente. La API key la pide `bond setup` y se guarda en `~/.bond/keys/<id>` con permisos 600 vía `key_stored` (opción 3a). Cero código de integración nuevo: es config. El modelo debe declararse con `reasoning = true`, `input = ["text", "image"]` y `context = 131072` porque bond pone `input: ["text"]` por defecto y con eso no anuncia la visión que Strata sí tiene.

## Rejected alternatives

Que bond consuma Strata directamente para sugerencias o clasificadores: descartado porque bond no consume modelos hoy, sería una capacidad nueva sin pedido. La clave por `api_key_env` o que Strata la gestione y bond solo guarde la URL: descartadas porque `bond setup` ya pide claves y las guarda con 600, que es lo coherente con el resto de proveedores.

## Consequences

El issue #63 se resuelve con configuración y documentación, no con código.

Quedan fuera de esta decisión, pero salen de la misma investigación, **siete defectos** que van a issues propios. No son solo del probe: la ruta de proveedores tiene problemas en cuatro ámbitos distintos.

**Ámbito de `sync`**

- #73 — `bond models sync` ignora la selección de agentes (`cfg.agents`) y escribe la config de proveedores en todos los agentes instalados de la máquina. Prioritario.

**Ámbito del envío de la clave al agente**

- #74 — se escribe `env_key = "BOND_KEY_<ID>"` en el config de Codex pero nadie exporta esa variable: `key_stored` no funciona con Codex. Prioritario.

**Ámbito de la validación de nombres**

- #79 — el `env_key` derivado no es inyectivo: `foo-bar` y `foo_bar` colisionan en `BOND_KEY_FOO_BAR` y comparten clave para endpoints distintos. Distinto de #74: se arregla validando el nombre, no exportándolo.
- #77 — la forma TOML `[[providers]]` se acepta en silencio y crea proveedores con el índice como id (`"0"`), descartando el `id` escrito por el usuario.

**Ámbito del probe**

- #75 — timeout de 120 s que no cubre el arranque en frío de una pasarela local (808 s registrado en Strata): da fallo en un endpoint que está bien.
- #76 — el probe da `✓` en modelos razonadores cuya respuesta llega vacía por falta de presupuesto de tokens (`content: null`, `status: "incomplete"`, o solo bloque `thinking`).

**Ámbito de la visibilidad del selector**

- #78 — `bond models list` pinta el modelo como `• flash-halogen` en vez del selector `halo/flash-halogen` que consumen `bond run`, las sugerencias de pi y `crush`, así que hay que adivinar la concatenación.

Ninguno invalida esta decisión: para pi, opencode y crush el camino 1a + 3a está verificado funcionando de punta a punta.
