---
name: "2026-10-22-team-table"
description: "La tabla en vivo se lee de un vistazo: grupos por estado e iconos, sin la columna de última línea"
created_at: "2026-10-22T10:58:41Z"
has_completed_all_phases: false
---

# La tabla en vivo se lee de un vistazo: grupos por estado e iconos

## Origen y revisión

- Identificador: `2026-10-22-team-table`.
- Origen: petición del usuario tras ver la tabla de P4 en la sesión de prueba. Descarta la
  columna `ÚLTIMA LÍNEA` («no me aporta nada») y pide un icono por agente según cómo le va:
  trabajando, acabado o con algún problema. Variante elegida del boceto: la **C**, agrupada por
  estado.
- Revisión: `2928f80` en `feat/plan-team` (PR [#7](https://github.com/jmanuelcorral/bond/pull/7)
  abierta al escribir el plan; si se fusiona antes, esta fase se rebasea a `main`).
- Base de diseño: `cli/team.mts` (`renderWatch`, `paintState`, `STATE_CODE`, `pendingWork`,
  `clip`, `visible`), `test/team.test.mts` (tests de render de la tabla), `docs/puesto.md` y
  `docs/reference.md`.
- Aprobación: contenido y destino aprobados por el usuario el 2026-10-22.

## Objetivo

Que al mirar el panel de la tabla se sepa qué hay que hacer sin leer fila por fila: los agentes
agrupados por estado, cada uno con un icono en el color de ese estado, y sin la columna de
última línea.

## Alcance y exclusiones

Entra: el render de `bond team status --watch` (agrupación por estado, iconos, línea de
pregunta de los bloqueados), helper de ancho visual, sus pruebas y la documentación.

Fuera: la lógica de estados (`classify`, `pendingWork` y el auto-cierre de P7 keep semantics
igual), el `bond team status` normal (tabla plana, sin cambios) y cualquier cambio de paneles o
de reparto (P2 y P6).

## Contexto verificado

- `renderWatch(rows, o)` pinta hoy: cabecera `bond team · <repo> · base <base>` con la hora a la
  derecha, columnas `MINION RAMA ESTADO COMMITS FICHEROS` y `ÚLTIMA LÍNEA` en la misma línea o
  debajo si no cabe (`MIN_LAST = 20`).
- Estados y colores: `trabajando`, `bloqueado`, `sin commitear`, `lista`, `integrada`,
  `sin commits` a través de `STATE_CODE` y `paintState()`.
- `pendingWork()` toma como trabajo pendiente `trabajando`, `bloqueado`, `sin commitear` y
  `lista`: coincide con los grupos que quieren verse, así que el auto-cierre de P7 no cambia.
- `visible()` solo quita secuencias ANSI: **no** hay en el repo ningún helper de ancho visual. Los
  emoji ocupan doble columna y hoy nada los cuenta.
- Los tests actuales de `renderWatch` prueban alineación, recorte a 20/35/50/80, color y el aviso
  de cierre: al cambiar el render hay que rehacerlos, no solo añadir.

## Decisiones, dependencias y riesgos

- Decidido por defecto (el usuario aprobó el boceto C): sin línea de resumen arriba; los grupos
  vacíos se omiten; `sin commitear` va en su propio grupo ✏️ entre «Trabajando» y
  «Por revisar».
- Dependencia: P4 (tabla en vivo) y P7 (auto-cierre sin trabajo), integradas y aceptadas en
  `feat/plan-team`.
- Riesgo: el ancho de los emoji varía con la fuente y el terminal. Mitigación: recortar y alinear
  por ancho visual calculado, no por caracteres, y que el título del grupo lleve la palabra del
  estado, para que el significado no dependa de que el emoji se renderice bien.
- Riesgo: cambiar `renderWatch` rompe los tests de render existentes. Mitigación: rehacerlos en la
  misma fase, con los casos nuevos explícitos.
- Recuperación: si en algún terminal los emoji descuadran, se cambia el set por círculos de color
  (`🟢🟡🔴⚪`) sin tocar la agrupación; el cambio queda aislado en el render.

## Fases

### P1: tabla agrupada por estado con iconos

- Resultado: `bond team status --watch` muestra los agentes agrupados, en este orden y omitiendo
  los grupos vacíos: **⛔ Necesita tu respuesta** (`bloqueado`, con `└ pregunta: …` bajo su
  fila), **🔄 Trabajando**, **✏️ Sin commitear**, **📦 Por revisar** (`lista`) y
  **✅ Integradas / sin empezar**.
- Repositorio: `jmanuelcorral/bond`.
- Dependencias: P4 y P7 de [2026-10-22-team-ux.md](2026-10-22-team-ux.md).
- Contratos: `renderWatch` pasa de filas planas a grupos; desaparece la columna `ÚLTIMA LÍNEA`
  (el campo `last` de `WatchRow` deja de pintarse). Cada fila: `MINION RAMA COMMITS FICHEROS`
  con un icono del estado al principio, en el color de ese estado. Nuevo helper de ancho visual
  que cuenta el emoji por 2 columnas para recortar y alinear. `--watch`, `--keep-open` y el
  auto-cierre de P7 siguen comportándose igual.
- Criterios: ninguna fila muestra la última línea del panel; los grupos salen en el orden dicho y
  los vacíos no aparecen; una fila `bloqueado` lleva debajo `└ pregunta: …` recortada al ancho;
  con `color: false` los iconos siguen identificando el estado; a anchos 40, 60 y 80 todas las
  líneas respetan el ancho y las columnas quedan alineadas habiendo emoji; si solo queda el grupo
  ✅ la tabla sigue estándose sin trabajo pendiente y se auto-cierra como en P7; ayuda de
  `bond team`, `docs/puesto.md`, `docs/reference.md` y `CHANGELOG.md` al día.
- Acciones:
  - [ ] Nuevo render por grupos con iconos y helper de ancho visual; rehacer los tests de
    `renderWatch` y actualizar la documentación.
  - [ ] Ejecutar las comprobaciones y apuntar los resultados reales.
  - [ ] Presentar la evidencia y parar para revisión.
- Verificación: `npm run typecheck && bun test` (grupos y orden, grupos vacíos omitidos, línea de
  pregunta, modo sin color, anchos 40/60/80 con emoji, auto-cierre con solo ✅); a mano, un
  `bond team` real con ramas en distintos estados y la tabla en su panel.
- Riesgos y recuperación: arriba, en «Decisiones, dependencias y riesgos».

## Progreso

| Fase | Implementación | Verificación | Revisión | Evidencia |
| --- | --- | --- | --- | --- |
| P1 | pending | not_run | pending | ninguna aún |

## Siguiente paso

P1 es la única fase y no tiene dependencias sin integrar sobre la base: ejecutarla con
`plan-execute` sobre `plan/team-table-p1` (base `feat/plan-team`). Al ser una sola fase no hay
nada que paralelizar.

## Evidencia y seguimiento

Continuación natural de [2026-10-22-team-ux.md](2026-10-22-team-ux.md) (P4 y P7). La PR
[#7](https://github.com/jmanuelcorral/bond/pull/7) trae esas fases; esta va sobre ella.
