---
name: "2026-11-25-skills-en-bond-app"
description: "Que plan-team, los prompts /delegate y /team, las reglas globales y la autoría de las decisiones funcionen dentro de un run de bond-app (BOND_APP=1, hc) igual que en Herdr"
created_at: "2026-11-25T07:40:19Z"
has_completed_all_phases: false
---

# Skills y reglas de bond que funcionan en bond-app (hc)

## Fuente y revisión

- Identificador del plan: `2026-11-25-skills-en-bond-app`.
- Fuente: petición del usuario (2026-11-25): «adaptamos la skill de delegate para que funcionara en bond-app; revisa el resto de skills, necesitaría que el resto funcionaran en bond-app».
- Revisión revisada: `jmanuelcorral/bond`, rama `main` en `8ee167f` (Release 1.16.7).
- Base del diseño: la variante hc de los skills globales (`global/skills-hc/`, elegida por `bond setup` con `BOND_APP=1`, `cli/setup.mts:209`), el transporte hc de `bond team`/delegados (`cli/hc.mts`, `cli/team.mts`, `cli/herdr.mts`) y la imagen del runner de bond-app (`runner/versions.env`: `BOND_VERSION=1.16.7`).
- Aprobación: «aprueba y guarda» (usuario, 2026-11-25), con D1-D4; pide ejecutarlo con un equipo de agentes codex.

## Objetivo

Dentro de un run de bond-app (contenedor con `BOND_APP=1` y `hc`, sin Herdr), un agente puede usar `plan-team`, `/delegate` y `/team` sin toparse con instrucciones de Herdr; sus instrucciones globales hablan de hc; y las decisiones que registra quedan firmadas por él (`agent:<kind>/<nombre>`), no por `user`. Fuera de bond-app todo sigue igual.

## Alcance y exclusiones

- En: `catalog/skills/plan-team`, `prompts/delegate.md`, `prompts/team.md`, el bloque `gen.rules` de `cli/messages/gen.mts` (y su traducción), `resolveAuthor()` de `cli/decisions.mts` con lo que bond exporta al lanzar agentes, y el texto de autoría de `decision-record` (SKILL y plantillas), `git-conventional-commit/references/commit-messages.md` y `delivery-review-github`. Pruebas, `CHANGELOG.md` y docs.
- Se conserva: el comportamiento en Herdr; `global/skills-hc/` (ya hecho); el formato de las decisiones.
- Fuera: skills sin dependencia de Herdr (`code-context`, `plan-execute`, `plan-create`, `git-conventional-commit` salvo una línea, `issue-refine-github`, `release-*`, `convention-document`, `catalog-maintain`, comandos `accept`/`commit`/`handoff`/`review`); cambios en hc; subir `BOND_VERSION` en bond-app (paso aparte en ese repo tras la release).

## Contexto verificado

- `bond setup` elige `global/skills-hc` con `BOND_APP=1` (`cli/setup.mts:211`); solo hay variante para `bond-delegate` y `bond-team`.
- Los skills del catálogo se copian a cada repo (`bond init`/`bond sync`): el mismo fichero lo leen el agente en Herdr y el del contenedor, así que una carpeta de variante no sirve para ellos.
- `catalog/skills/plan-team/SKILL.md` exige `HERDR_ENV=1` (paso 1), carga el skill `herdr`, espera con `herdr agent wait … --timeout 1800000` (ms) y habla de paneles, de la tabla en vivo como panel y de `~/.herdr/worktrees`. En un run se para en el paso 1.
- `prompts/delegate.md` y `prompts/team.md` (prompts de pi, `package.json` → `pi.prompts`) piden «usa Herdr… panel hermano».
- `gen.rules` (`cli/messages/gen.mts:19`) es el bloque «Bond: Herdr y otros agentes» que `bond setup` lleva a las instrucciones globales de cada agente; no tiene variante.
- `resolveAuthor()` (`cli/decisions.mts:168`) solo mira `HERDR_ENV`/`HERDR_PANE_ID`; en un run devuelve `user` para una decisión de un agente.
- hc 0.1.22 no documenta ninguna variable ni comando para que un proceso sepa en qué terminal corre (`hc --help`, `hc run --help`). Hipótesis por confirmar en P3.
- bond lanza los agentes del run: el principal con `bond tui` en sitio (`launchInPlace`, `cli/launch.mts:172`) y los delegados con `hcRun` (`cli/herdr.mts:182`, `cli/team.mts:540`).

## Decisiones, dependencias y riesgos

- D1 — Los skills del catálogo valen para los dos transportes en un solo fichero (comprobación `HERDR_ENV=1` o `BOND_APP=1`/`hc`, y el comando de cada uno donde difieren), en vez de carpetas de variante como los globales. Motivo: se copian al repo y los leen los dos entornos. (usuario, 2026-11-25; [`2026-11-25-los-skills-del-catalogo-valen-para-herdr-y-hc-en-un-solo-fichero`](../decisions/2026-11-25-los-skills-del-catalogo-valen-para-herdr-y-hc-en-un-solo-fichero.md))
- D2 — `/delegate` y `/team` dejan de nombrar el transporte: remiten a `bond-delegate`/`bond-team`, que ya traen la variante buena. (usuario, 2026-11-25; [`2026-11-25-los-prompts-delegate-y-team-no-nombran-el-transporte`](../decisions/2026-11-25-los-prompts-delegate-y-team-no-nombran-el-transporte.md))
- D3 — `gen.rules` tiene variante hc elegida por `BOND_APP=1` en `bond setup`, igual que los skills globales. (usuario, 2026-11-25; [`2026-11-25-reglas-globales-con-variante-hc-segun-bond-app`](../decisions/2026-11-25-reglas-globales-con-variante-hc-segun-bond-app.md))
- D4 — Autoría en hc: bond exporta `BOND_AGENT=<kind>/<nombre>` al lanzar un agente (en sitio y con `hcRun`), y `resolveAuthor()` lo usa cuando no hay Herdr. Alternativa: preguntarle a hc por la terminal propia, que hoy no está documentado. (usuario, 2026-11-25; [`2026-11-25-autoria-de-decisiones-en-hc-con-bond-agent`](../decisions/2026-11-25-autoria-de-decisiones-en-hc-con-bond-agent.md))
- Riesgo: un `BOND_AGENT` heredado por un proceso que no es el agente (una shell abierta desde él) firmaría con su nombre; es aceptable (misma terminal) y se documenta. Nunca se usa para aceptar: `accept` sigue exigiendo `--confirmed-by`.
- Dependencia de entrega: los cambios llegan a los runs cuando bond-app sube `BOND_VERSION` y se reconstruye la imagen; los del catálogo, cuando cada repo hace `bond sync`.

## Fases

### P1: plan-team y los prompts /delegate y /team, válidos en Herdr y en hc

- Resultado: en un run de bond-app, `plan-team` pasa su comprobación inicial y da los comandos de hc; `/delegate` y `/team` remiten a los skills; en Herdr nada cambia.
- Repositorio: `jmanuelcorral/bond`.
- Dependencias: ninguna.
- Contratos afectados: texto de `catalog/skills/plan-team/SKILL.md`, `prompts/delegate.md`, `prompts/team.md`, y la línea de `delivery-review-github` que habla de paneles.
- Criterios de aceptación: `plan-team` acepta `HERDR_ENV=1` o `BOND_APP=1`/`hc` y, para cada operación (esperar, leer, tabla, ruta de worktrees), da la forma de Herdr y la de hc (`hc wait <agente> --timeout <s>`, `hc read`); no exige el skill `herdr` bajo hc; los prompts no mencionan Herdr ni paneles; las pruebas de texto del catálogo pasan.
- Acciones:
  - [ ] Reescribir los pasos de `plan-team` que dependen del transporte (comprobación, espera, lectura, tabla en vivo, hub).
  - [ ] Hacer neutros `prompts/delegate.md` y `prompts/team.md`.
  - [ ] Ajustar `delivery-review-github`; entrada en `## Sin publicar`.
  - [ ] Ejecutar las comprobaciones y registrar resultados.
  - [ ] Presentar evidencia y parar para revisión.
- Verificación: `npm run typecheck && bun test` en `~/gitrepos/bond`; `grep -niE "herdr|panel" prompts/*.md` vacío; lectura de `plan-team` con `BOND_APP=1` sin pasos imposibles.
- Riesgos y recuperación: solo texto; se revierte con el commit.

### P2: reglas globales con variante hc

- Resultado: con `BOND_APP=1`, `bond setup` escribe en las instrucciones globales un bloque «Bond: hc y otros agentes» sin Herdr; sin él, el de siempre.
- Repositorio: `jmanuelcorral/bond`.
- Dependencias: ninguna (independiente de P1).
- Contratos afectados: `gen.rules` (nueva clave hc en `cli/messages/gen.mts` y su traducción), la función de `bond setup` que lo elige.
- Criterios de aceptación: el bloque hc dice que se está en una terminal de hc del run, que se delega con `bond-delegate`/`bond-team` solo cuando se pide, que no se cierran terminales ajenas, y mantiene las reglas de búsqueda web y decisiones; prueba de setup con y sin `BOND_APP=1`; las pruebas de i18n del texto generado pasan.
- Acciones:
  - [ ] Añadir la variante y elegirla en `bond setup`.
  - [ ] Pruebas (`test/generated-text-i18n.test.mts` y la de setup); CHANGELOG y `docs/reference.md` si cambia la ayuda.
  - [ ] Ejecutar las comprobaciones y registrar resultados.
  - [ ] Presentar evidencia y parar para revisión.
- Verificación: `npm run typecheck && bun test`.
- Riesgos y recuperación: el bloque está entre marcadores; `bond setup` lo reescribe al volver.

### P3: autoría de las decisiones dentro de un run

- Resultado: una decisión registrada por un agente en un run queda con `decided_by: "agent:<kind>/<nombre>"`; los textos de `decision-record` y del commit nombran Herdr o hc.
- Repositorio: `jmanuelcorral/bond`.
- Dependencias: D4 aprobada.
- Contratos afectados: `resolveAuthor()`; variable de entorno `BOND_AGENT` que bond pone al lanzar agentes (en sitio y en `hcRun`); textos de `decision-record` (SKILL, `decision-template.md`, `run-template.md`) y `git-conventional-commit/references/commit-messages.md`.
- Criterios de aceptación: primero se comprueba si hc expone la terminal propia (si sí, se usa y D4 se ajusta); con `BOND_AGENT` y sin Herdr, `resolveAuthor()` lo devuelve como `agent:…`; con Herdr manda Herdr; sin ninguno, `user`; el override manual sigue primero; `accept` de una decisión propia sigue bloqueado.
- Acciones:
  - [ ] Confirmar lo que expone hc (sin tocar el core del usuario: en una sesión de hc propia).
  - [ ] Exportar la identidad al lanzar y leerla en `resolveAuthor()`; pruebas unitarias.
  - [ ] Actualizar los textos de autoría; CHANGELOG.
  - [ ] Ejecutar las comprobaciones y registrar resultados.
  - [ ] Presentar evidencia y parar para revisión.
- Verificación: `npm run typecheck && bun test`; prueba de `resolveAuthor` con entornos simulados.
- Riesgos y recuperación: si `BOND_AGENT` falta (imagen vieja), se cae a `user` como hoy.

### P4: versión de bond

- Resultado: release de bond con P1-P3 (`release-prepare-github`), y la indicación para subir `BOND_VERSION` en bond-app.
- Repositorio: `jmanuelcorral/bond`.
- Dependencias: P1, P2 y P3 aceptadas.
- Contratos afectados: versión del paquete y binarios.
- Criterios de aceptación: CHANGELOG cerrado, tag anotado, workflow en verde y paquete en el staging de npm; push solo con aprobación expresa.
- Acciones:
  - [ ] Preparar la versión y parar para aprobar el push.
- Verificación: el workflow `release.yml` en verde.

## Progreso (planes locales)

| Fase | Implementación | Verificación | Revisión | Evidencia |
| --- | --- | --- | --- | --- |
| P1 | pending | not_run | pending | none yet |
| P2 | pending | not_run | pending | none yet |
| P3 | pending | not_run | pending | none yet |
| P4 | pending | not_run | pending | none yet |

## Siguiente paso

P1, P2 y P3 en paralelo con `bond team` (codex), una rama por fase; P4 cuando estén integradas y aceptadas.

## Evidencia y seguimiento

Sin evidencia todavía.
