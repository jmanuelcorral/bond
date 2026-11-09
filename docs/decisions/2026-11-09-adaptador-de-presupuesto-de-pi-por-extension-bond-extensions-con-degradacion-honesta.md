---
id: "2026-11-09-adaptador-de-presupuesto-de-pi-por-extension-bond-extensions-con-degradacion-honesta"
title: "Adaptador de presupuesto de pi por extensión Bond Extensions con degradación honesta"
status: "accepted"
date: "2026-11-09"
decided_by: "agent:agy/budget-pi"
accepted_by: "implementar el adaptador de PRESUPUESTO del agente pi para bond budget (issue #86)"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "issue: https://github.com/jmanuelcorral/bond/issues/86"
  - "issue: https://github.com/jmanuelcorral/bond/issues/84"
  - "branch: main"
  - "head: 842c608"
---


## Context

Para cerrar #86 (#84), pi requería un adaptador de presupuesto para bond budget. La API de extensiones de pi no expone cuotas de cuenta o plan en su SDK, pero expone el ciclo de vida de sesiones y respuestas HTTP del proveedor vía after_provider_response (status y headers).

## Decision

El adaptador de pi se implementa en extensions/budget.ts dentro del paquete de pi de bond (~/.bond/pi), escribiendo eventos en el mismo canal ~/.bond/events/ que los hooks. Escucha session_start, session_shutdown, agent_end, session_before_compact, session_compact y after_provider_response (status y headers). bond budget agrega estos eventos: si las cabeceras traen rate limits (p. ej. Anthropic) deriva ventanas y %; si hay 429 marca exhausted; y con actividad normal sin cabeceras de cuota degrada honestamente a ok sin ventanas, sin inventar datos. opencode queda formalmente excluido de HOOKED_AGENTS.

## Rejected alternatives

Consultar endpoints privados de pasarelas o cuentas (descartado por la política de no tocar endpoints ni credenciales ajenas); polling al proceso de pi (descartado por sobrecarga; la extensión es puramente reactiva e inmediata).

## Consequences

pi deja de salir como unknown en bond budget en cuanto hay eventos de sesión o respuestas del proveedor, manteniendo la tabla estable y fail-open sin llamadas de red obligatorias.
