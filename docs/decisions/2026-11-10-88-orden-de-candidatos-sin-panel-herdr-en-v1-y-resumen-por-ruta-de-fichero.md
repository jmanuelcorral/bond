---
id: "2026-11-10-88-orden-de-candidatos-sin-panel-herdr-en-v1-y-resumen-por-ruta-de-fichero"
title: "#88: orden de candidatos, sin panel Herdr en v1 y resumen por ruta de fichero"
status: "accepted"
date: "2026-11-10"
decided_by: "agent:pi"
accepted_by: "«Sí, aprueba plan tal cual (D1 ok→low→unknown→exhausted; D2 sin panel en v1; D3 ruta de fichero) y guárdalo.»"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "plan: docs/plans/2026-11-10-bond-handoff.md"
  - "issue: https://github.com/jmanuelcorral/bond/issues/88"
  - "branch: main"
  - "head: 63f6c71"
---


## Context

bond handoff debe proponer el traspaso sin ejecutarlo nunca; quedaban tres decisiones de diseño antes de implementar (orden de candidatos, apertura de panel destino, forma de entregar el resumen al agente destino).

## Decision

D1: candidatos ordenados por state ok→low→unknown→exhausted. D2: en v1 no se abre el panel destino con el comando preparado (auto-lanzaría al pulsar enter y erosiona el «nunca ejecuta»); bond imprime el comando y el usuario lo lanza. D3: el resumen viaja escrito a ~/.bond/handoff/&lt;utc&gt;-&lt;agente&gt;.md y el comando lo referencia por ruta («Lee <ruta> y continúa esta sesión»), no pegado en la línea de shell.

## Rejected alternatives

D1 alternativa: unknown al final (descartada: un unknown puede valer, un exhaustido no). D2 alternativa: --open explícito ya (aplazada tras #88 si se pide). D3 alternativa: resumen inline comillado (descartada: frágil por shell y sin rastro trazable).
