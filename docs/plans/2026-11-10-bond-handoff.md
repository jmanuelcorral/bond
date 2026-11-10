---
name: "2026-11-10-bond-handoff"
description: "bond handoff: propuesta de traspaso con presupuesto + resumen; el usuario decide siempre (#88)"
created_at: "2026-11-10T06:44:21Z"
has_completed_all_phases: false
---

# `bond handoff`: traspaso propuesto con presupuesto + resumen (#88)

## Fuente y revisión

- Identificador del plan: `2026-11-10-bond-handoff`.
- Fuente: issue https://github.com/jmanuelcorral/bond/issues/88 (epic #84).
- Revisión revisada: `main` en `63f6c71` (CI verde; #86 y #87 cerradas).
- Repositorio y rama de referencia: `jmanuelcorral/bond`, rama `main`.
- Base del diseño: contrato `BudgetStatus` de #86 (`cli/budget.mts`) y `summarizeSession`/`renderSessionSummary` de #87 (`cli/summary.mts`).
- Aprobación: aprobado por el usuario el 2026-11-10 tal cual, con D1 (orden `ok→low→unknown→exhausted`), D2 (sin panel Herdr en v1) y D3 (el resumen viaja como ruta de fichero).

## Objetivo

`bond handoff`: cuando el agente del panel actual se queda sin presupuesto, bond presenta la situación (origen + candidatos ordenados por `state`) con el resumen determinista de la sesión y el comando exacto para continuar en cada candidato. **Bond nunca ejecuta el traspaso** (decisión 1 del epic): imprime y prepara; el usuario lanza.

## Alcance y exclusiones

- En: detección del agente origen (`HERDR_PANE_ID` → `herdr agents()`), candidatos desde la config global con `statusFor(agent)`, propuesta renderizada (tabla + resumen + comandos), escritura del resumen a `~/.bond/handoff/<utc>-<agente>.md`, CLI `bond handoff [--from ag] [--tail N]`, docs y CHANGELOG.
- Fuera (D2): abrir el panel destino con el comando preparado — abrir un panel con el comando ya escrito auto-lanza al pulsar enter y erosiona el "nunca ejecuta"; si se quiere, tras #88 con `--open` explícito. Fuera: cualquier ejecución del agente destino; cambios en los hooks de #86; opencode (misma decisión de alcance que #86/#87).

## Contexto verificado

- `cli/budget.mts`: `budget()` (línea ~466) hace el dispatch `codexStatus`/`claudeStatus`/`piStatus`/unknown inline; se extrae a `statusFor(agent, now)` exportado sin cambio de comportamiento. `HOOKED_AGENTS = ["codex","claude","agy","pi"]`; `BudgetStatus { agent, state, windows, source, checkedAt }`.
- `cli/herdr.mts`: `insideHerdr()`, `herdr(["agents"])` → `HerdrAgent { pane_id, agent?, ... }`; `defaultAgentArgs("agy")` da `--dangerously-skip-permissions`.
- `cli/summary.mts`: `summarizeSession`, `renderSessionSummary`, `detectSessionAgent`, `SUMMARY_AGENTS`. El origen del resumen es el agente origen detectado; si no tiene sesión legible, la propuesta sigue siendo útil sin resumen (igual que el criterio de todos-`unknown`).
- Convenciones: mensajes bilingües en `cli/messages/`, `bun test`, verificación `npm run typecheck && bun test`.

## Decisiones, dependencias y riesgos

- Dependencias: #86 y #87, ambas cerradas y estables. Nada de #88 entra en ellas.
- **D1 (aceptada, 2026-11-10)**: orden de candidatos `ok → low → unknown → exhausted`: exhaustido al final (es lo que motiva el traspaso) y `unknown` antes que él porque puede valer.
- **D2 (aceptada, 2026-11-10)**: sin apertura de panel en v1 (ver exclusiones).
- **D3 (aceptada, 2026-11-10)**: el resumen viaja como ruta de fichero (`~/.bond/handoff/<utc>-<agente>.md`), no pegado en el comando: una línea por shell sin comillas multi-línea, y el fichero queda como rastro trazable (misma filosofía que el event log).
- Riesgo: `claudeStatus` hace red (headers de Anthropic). La propuesta debe degradar a `unknown` si falla, nunca morir (fail-open como en budget).
- Riesgo: confusión entre "agente del panel" y "agente con sesión" fuera de Herdr: `--from` lo resuelve; sin Herdr y sin `--from`, error claro.

## Fases

### P1: Librería de propuesta (`cli/handoff.mts`)

- Resultado: módulo puro y verificable que produce la propuesta completa; `bun test` la cubre sin tocar red ni Herdr real.
- Dependencias: #86, #87 (cerradas).
- Contratos afectados:
  ```ts
  // cli/budget.mts (refactor sin cambio de comportamiento):
  export async function statusFor(agent: string, now?: Date): Promise<BudgetStatus>;
  // cli/handoff.mts:
  export interface HandoffCandidate { agent: string; status: BudgetStatus; command: string }
  export interface HandoffProposal {
    from: string; fromStatus: BudgetStatus; summaryFile?: string; summaryMd?: string;
    candidates: HandoffCandidate[]; generatedAt: string; // ISO inyectable
  }
  export function currentPaneAgent(panes?: HerdrAgent[], paneId?: string): string | undefined;
  export function handoffCandidates(all: string[], from: string, now?: Date): Promise<HandoffCandidate[]>;
  export function buildHandoff(opts: { from: string; tail?: number; now?: Date; home?: string; cwd?: string }): Promise<HandoffProposal>;
  export function renderHandoff(p: HandoffProposal): string; // Markdown
  ```
- Acciones:
  - [ ] Extraer `statusFor` de `budget()` (misma salida de `bond budget`, refactor verificado por sus pruebas).
  - [ ] `cli/handoff.mts`: detección de origen por pane, orden D1, comandos por agente (ruta del resumen, D3), escritura del resumen con mkdir, render Markdown con tabla `agente · state · ventanas · fuente`.
  - [ ] Claves bilingües en `cli/messages/handoff.mts` (título, tabla, sin-herdr, sin-candidatos, todos-unknown).
  - [ ] Pruebas en `test/handoff.test.mts` con fixtures de `summary` y `BOND_EVENTS_DIR` sintéticos: orden por `state`, todos-`unknown` sigue útil (resumen + comandos), **ningún camino de código invoca al agente destino** (stub en PATH que dejaría una marca; asserting marca ausente), `currentPaneAgent` con panes ficticios.
  - [ ] Ejecutar typecheck + bun test y registrar evidencia; presentar para revisión.
- Criterios de aceptación: los del issue verificables a nivel librería (detección de origen, orden por `state`, nunca ejecuta, todos-`unknown` útil).

### P2: CLI `bond handoff`

- Resultado: `bond handoff [--from ag] [--tail N]` en la CLI con ayuda bilingüe, docs y CHANGELOG.
- Dependencias: P1 aceptada.
- Contratos afectados: alta en `cli/main.mts`, `HANDOFF_HELP`, claves de ayuda/error, tabla y sección en `docs/reference.md`, `CHANGELOG.md`.
- Acciones:
  - [ ] Subcomando y opciones con ayuda bilingüe; sin Herdr ni `--from`, mensaje claro.
  - [ ] `docs/reference.md` (tabla + sección) y CHANGELOG; `handoff` en la ayuda principal.
  - [ ] Pruebas CLI con spawn (fixtures de sesión y eventos, `PATH` con stubs que dejarían marca) en `test/handoff.test.mts`.
  - [ ] Ejecutar typecheck + bun test y registrar evidencia; presentar para revisión.
- Criterios de aceptación: `bond handoff` sin argumentos imprime la propuesta (o error claro pidiendo `--from`); `--tail` se pasa al resumen; salida verificada en prueba.

## Progreso

| Fase | Implementación | Verificación | Revisión | Evidencia |
| --- | --- | --- | --- | --- |
| P1 | pending | not_run | pending | none yet |
| P2 | pending | not_run | pending | none yet |

## Próximo paso

Ejecutar P1 en el checkout actual: P2 depende de la librería de P1 para poder ni compilarse, así que el plan no es paralelizable entre worktrees.
