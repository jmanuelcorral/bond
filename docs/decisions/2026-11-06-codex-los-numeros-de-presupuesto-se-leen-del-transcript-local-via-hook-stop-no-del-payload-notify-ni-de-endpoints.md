---
id: "2026-11-06-codex-los-numeros-de-presupuesto-se-leen-del-transcript-local-via-hook-stop-no-del-payload-notify-ni-de-endpoints"
title: "Codex: los números de presupuesto se leen del transcript local vía hook Stop, no del payload notify ni de endpoints"
status: "accepted"
date: "2026-11-06"
decided_by: "agent:pi"
accepted_by: "Ejecuta la #86 primero, empezando por el spike del payload notify de Codex."
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "issue: https://github.com/jmanuelcorral/bond/issues/86"
  - "issue: https://github.com/jmanuelcorral/bond/issues/84"
  - "branch: main"
  - "head: cd126b0"
---


## Context

Spike para la #86 (bond budget) con codex-cli 0.166.0: había que determinar si el payload notify incluye el snapshot de rate limits para poder detectar presupuesto sin reverse-ingeniería de endpoints.

## Decision

El adaptador Codex usa el hook de ciclo de vida Stop (JSON por stdin con transcript_path) y lee el último evento token_count del rollout .jsonl (~/.codex/sessions/), que contiene rate_limits (used_percent, window_minutes, resets_at, credits), rate_limit_reached_type y model_context_window. El payload notify NO trae rate limits; no se toca ningún endpoint.

## Rejected alternatives

notify payload (sin rate limits, descartado); endpoint backend reverse-engineered de ChatGPT (frágil, descartado por la decisión 3 del epic: números solo donde estén documentados — aquí el formato lo escribe el propio agente en local).

## Consequences

El contrato BudgetStatus para Codex se alimenta source=hook con números completos. El lector del transcript debe tolerar cambios de formato del rollout (degradar a unknown). Encaja con #87, que ya prevé leer ~/.codex/sessions.
