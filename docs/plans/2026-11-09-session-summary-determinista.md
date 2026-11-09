---
name: "2026-11-09-session-summary-determinista"
description: "Generador de resumen de sesión determinista (sin LLM) por agente, apto para pegar como contexto en otro agente (#87)"
created_at: "2026-11-09T16:50:18Z"
has_completed_all_phases: true
---

# Resumen de sesión determinista desde los ficheros de sesión de cada agente (#87)

## Fuente y revisión

- Identificador del plan: `2026-11-09-session-summary-determinista`.
- Fuente: issue https://github.com/jmanuelcorral/bond/issues/87 (epic #84).
- Revisión revisada: `main` en `60ce9da` (CI verde, #86 cerrada).
- Repositorio y rama de referencia: `jmanuelcorral/bond`, rama `main`.
- Base del diseño: contrato `BudgetStatus` y event log de #86 (docs/decisions de 2026-11-06 y 2026-11-09); decisión del epic: resumen determinista, sin LLM, sin red.
- Aprobación: aprobado por el usuario el 2026-11-09 con D1 (opencode fuera) y D2 (`bond summary` dentro de #87).

## Objetivo

`summarizeSession(agent, opts)` produce, sin red ni LLM, un resumen de la sesión actual de un agente (últimos N intercambios user/assistant + estado del repo + metadatos de trazabilidad) listo para pegar como contexto en otro agente. #88 (`bond handoff`) lo consumirá.

## Alcance y exclusiones

- En: parsers de formatos de sesión de pi, Claude Code, Codex y agy; recorte por N; estado de repo (`git status` + `git diff --stat`); render Markdown del resumen; fixtures y pruebas.
- Fuera: cualquier llamada de red o LLM; `bond handoff` (#88); opencode (pendiente de confirmación — decisión D1).

## Contexto verificado

- Localización de sesiones ya resuelta en `cli/team.mts`: `sessionFile()` (~línea 1647) localiza pi (Herdr da la ruta), Claude (`<CLAUDE_CONFIG_DIR>/projects/<carpeta>/<id>.jsonl`) y agy (`~/.gemini/antigravity-cli/brain/<id>/.system_generated/logs/transcript[_full].jsonl`). `lastAssistantText` (~línea 1522) ya parsea el .jsonl de pi y el `PLANNER_RESPONSE` de agy.
- Codex: `cli/budget.mts` ya escanea rollouts `.jsonl` tolerantes a líneas corruptas (`parseCodexTranscript`); las sesiones viven en `~/.codex/sessions/`.
- Pi: `cli/sessions.mts` (`readSession`) extrae cabecera, modelo y nº de mensajes del .jsonl; el formato tiene filas de tipo `session_info`, mensajes con `role`/`content`.
- Convenciones: mensajes bilingües en `cli/messages/<area>.mts` (typecheck obliga a `en`), pruebas con `bun test` en `test/`, verificación local `npm run typecheck && bun test`.
- Opencode: excluido de budget por decisión de alcance de hoy (docs/decisions/2026-11-09-86-cierra-...). La issue #87 aún lo lista como fuente; ver decisiones.

## Decisiones, dependencias y riesgos

- Dependencia: #86 (cerrada; contrato de BudgetStatus estable). #88 consumirá este generador: la API pública debe quedar estable.
- **D1 (aceptada, 2026-11-09)**: opencode fuera de #87, en la línea de la decisión de #86 (pi, claude, codex y agy como fuentes; formato desconocido → error claro). Decisión: docs/decisions/2026-11-09-87-opencode-fuera-y-bond-summary-dentro-d1-y-d2.md.
- **D2 (aceptada, 2026-11-09)**: el comando `bond summary` se entrega en #87 (P2). Misma decisión.
- Riesgo: los formatos de sesión de cada agente cambian sin aviso. Mitigación: fixtures recortados de sesiones reales (sin datos personales) y error claro cuando un formato no se reconoce, sin adivinar.
- Riesgo: sesiones muy largas (varios MB). Mitigación: recorte por N intercambios y lectura lineal tolerante (patrón de `budget.mts`).

## Fases

### P1: Librería `summarizeSession` con parsers por agente

- Resultado: módulo interno utilizable por #88 y verificable por pruebas; `bun test` cubre los cuatro formatos con fixtures.
- Repositorio propietario: `jmanuelcorral/bond`.
- Dependencias: ninguna (además de #86, cerrada).
- Contratos afectados: nuevo `cli/summary.mts`:
  ```ts
  type SummaryAgent = "pi" | "claude" | "codex" | "agy";
  interface SessionExchange { role: "user" | "assistant"; text: string }
  interface RepoContext { status: string; diffStat: string }        // git status + git diff --stat
  interface SessionSummary {
    agent: SummaryAgent; sessionFile: string; model?: string;
    generatedAt: string;                                            // ISO, inyectable en tests
    exchanges: SessionExchange[];                                   // últimos N, orden cronológico
    repo?: RepoContext;
  }
  function summarizeSession(agent: string, opts?: { n?: number; cwd?: string; home?: string; sessionFile?: string; now?: Date }): SessionSummary;
  function renderSessionSummary(s: SessionSummary): string;         // Markdown pegable
  ```
  Formato desconocido o sesión ilegible → error claro (patrón `die`/`catchDie` del repo). `sessionFile` explícito en `opts` permite tests sin tocar el home real.
- Criterios de aceptación:
  - Fixtures de los cuatro formatos en `test/fixtures/summary/` (recortados de sesiones reales, sin secretos) → saldos esperados por tabla.
  - Determinista: mismo input → mismo output (con `now` fijo); sin `fetch` ni spawn de LLM.
  - Sesiones largas: solo los últimos N intercambios (N por defecto razonable, documentado).
  - Agente/formato desconocido y fichero ilegible: error claro, sin parcialmente-silencioso.
  - `npm run typecheck && bun test` en verde.
- Acciones:
  - [x] Crear `cli/summary.mts` con tipos, parsers (reutilizando lo aprovechable de `team.mts`/`sessions.mts`/`budget.mts` o extrayéndolo), estado de repo y render.
  - [x] Fixtures + `test/summary.test.mts` siguiendo el patrón de `test/budget.test.mts`.
  - [x] Ejecutar `npm run typecheck && bun test` y registrar resultados reales.
  - [x] Presentar evidencia y parar para revisión antes de otra fase.
- Verificación: `npm run typecheck && NO_COLOR=1 bun test` desde la raíz del repo; evidencia: resumen de pruebas (pass/fail).
- Riesgos y recuperación: si el formato de Claude o Codex difiere del esperado por versión, se ajusta el parser con fixture nuevo; nada que migrar.

### P2: Comando `bond summary` (preview del contexto del handoff)

- Resultado: `bond summary [agente] [--tail N]` imprime el resumen Markdown en la consola; ayuda y referencia actualizadas.
- Repositorio propietario: `jmanuelcorral/bond`.
- Dependencias: P1.
- Contratos afectados: subcomando nuevo en `cli/main.mts`; claves nuevas en `cli/messages/summary.mts` (es+en); tabla de comandos en `docs/reference.md`; CHANGELOG «Sin publicar».
- Criterios de aceptación: `bond summary` sin argumentos resume la sesión del agente vivo detectable (o error claro si no hay); `--tail` cambia N; agente concreto por argumento; formato desconocido → mensaje claro sin stack.
- Acciones:
  - [x] Alta del subcomando y opciones, con ayuda bilingüe.
  - [x] `docs/reference.md` y CHANGELOG.
  - [x] Pruebas de CLI en `test/summary.test.mts` (spawn con HOME/USERPROFILE temporales como en `repo.test.mts`).
  - [x] Ejecutar typecheck + bun test y registrar evidencia; presentar para revisión.
- Verificación: `bin/bond summary` real en esta sesión de pi (debe producir Markdown), además de `npm run typecheck && bun test`.
- Riesgos y recuperación: si la detección de "agente vivo" molesta, P2 admite degenerar a "agente obligatorio por argumento" sin romper P1.

## Progreso (plan local)

| Fase | Implementación | Verificación | Revisión | Evidencia |
| --- | --- | --- | --- | --- |
| P1 | implemented | passed | accepted | none yet |
| P2 | implemented | passed | accepted | none yet |

- `last_implementation_at`: 2026-11-09T17:25:00Z — P2 sobre el árbol de trabajo (P1 ya commiteada en `25d63a5`): subcomando `bond summary` (`cli/main.mts`, `cli/summary.mts`), ayuda bilingüe y claves nuevas, lista de `bond --help` (también se añadió `budget`, que faltaba desde #86), `docs/reference.md` (tabla + sección), CHANGELOG, 4 pruebas CLI con spawn (home y cwd temporales, reescritura segura de rutas en Windows). Pruebas reales: `npm run typecheck` limpio; `NO_COLOR=1 bun test` → 720 pass / 0 fail / 38 ficheros. Verificación manual: `bin/bond summary --tail 2` sobre la sesión real de pi (modelo y git en vivo); `bin/bond --help` lista budget y summary. Limitación: la detección sin argumento es por presencia de sesión en el cwd (orden pi→claude→codex→agy), no por agentes vivos de Herdr.
- Aceptación: el usuario delegó la vigilancia de CI («prefiero que la vigiles tú») con cierre de #87 al verde; CI verde en `c69d9ec` (run 42669093257) y #87 cerrada el 2026-11-09 con ese criterio.
- 2026-11-09T17:40:00Z — CI de `ad01abe`: ubuntu y windows verdes; macOS falló las dos pruebas CLI de detección porque `mkdtemp` cae bajo `/var` (symlink de `/private/var`) y el proceso hijo ve su cwd ya resuelto. Fix de test: `realpathSync` en el tmpdir del describe CLI.

## Próximo paso

Plan completado: P1 y P2 implementadas, verificadas y aceptadas; #87 cerrada. Lo que sigue en el epic #84 es **#88** (`bond handoff`, que consumirá `summarizeSession` + `bond budget`), o las sueltas #83/#78 que el usuario quiso mirar.

## Evidencia y seguimiento

- Issue: https://github.com/jmanuelcorral/bond/issues/87 (epic #84; #86 cerrada el 2026-11-09).
- Decisiones previas: `docs/decisions/2026-11-06-diseno-del-handoff-por-presupuesto-issue-84-deteccion-resumen-decide-el-usuario.md`, `docs/decisions/2026-11-09-86-cierra-el-alcance-con-pi-opencode-no-se-soporta-en-bond-budget.md`.
