---
name: "2026-11-03-team-status-table"
description: "La tabla de estado de `bond team` se lee de un vistazo: agrupada por vertical en hubs, sin líneas muertas, con las columnas que caben y un pie que cierra"
created_at: "2026-11-03T12:09:11Z"
has_completed_all_phases: false
---

# Tabla de estado de `bond team` legible de un vistazo

## Source and revision

- Plan identifier: `bond-team-status-table`.
- Source: issue https://github.com/jmanuelcorral/bond/issues/33 («tabla de estado de `bond team` con mejor aspecto»).
- Reviewed revision: `2b80463` (`main`), issue `updatedAt` `2026-10-30T16:54:49Z`.
- Reference repository and branch: `jmanuelcorral/bond`, `main`.
- Design baseline: skill `tui-design` de `fluzo-labs/fluzo-skills`, commit `48a1ac36fc229ccbcb1fe671d5dbd9774a567d56`, instalada en `~/.agents/skills/tui-design/` (ver su `ORIGIN.md`). En concreto `references/interface-contract.md` y `references/agent-sessions.md`.
- Approval: pendiente de aprobación explícita de este plan y de su alcance.

## Goal

Que `bond team status` y la vista en vivo de `bond team` muestren la misma tabla, agrupada por vertical cuando hay hub, sin líneas vacías por grupo, con las columnas que caben en el ancho disponible y un pie que resume el total. Se debe poder responder «¿en qué está el equipo?» sin desplazar y sin descifrar decoración.

## Scope and exclusions

**Cambia**: la capa de render de la tabla en `cli/team.mts` (`printStatus`, `renderWatch`, `WATCH_GROUPS`), la agrupación, el orden de sacrificio de columnas, el pie, y el alcance del color.

**Se conserva**: el conjunto de estados (`trabajando`, `bloqueado`, `sin commitear`, `lista`, `integrada`, `sin commits`) y su derivación de git + Herdr; las claves de i18n existentes; `--json` como salida de máquina; los atajos `q` / `Ctrl+C` de la vista en vivo; el intervalo de refresco de 2 s.

**Fuera de alcance**: estados nuevos y lectura de preguntas reales de los paneles (ver D7), navegación con ratón, modo a pantalla completa, cambios en el modelo de datos de `Row`, y cualquier cosa del hub que no sea cómo se agrupa su tabla.

## Verified context

Observado en `2b80463`, no hipotetizado:

- `State` tiene 6 valores y `classify()` (`cli/team.mts:487-494`) solo mira `agentStatus` (`working`/`blocked`) y cae a lo derivado de git (`dirty`, `ahead`, `integrated`, `worked`).
- `integrada` **sale de git** (ancestro por fast-forward, o detección de rebase/cherry-pick en `cli/team.mts:463`), no de que el agente lo afirme. Cumple la regla de la skill *«displayed prose claiming success is not execution evidence»*.
- `STATE_CODE` (`cli/team.mts:673-680`) da un color por estado; `paintState` (`:683`) pinta y `useColor` respeta `isTTY` y `NO_COLOR`.
- `printStatus()` (`cli/team.mts:695`) es la tabla de una sola pasada: sin título, sin pie, color solo en la celda de estado (`:744`). **No tiene iconos.**
- `renderWatch()` (`cli/team.mts:834`) es la vista en vivo: título `bond team · <repo> · base <base>` + hora, grupos por estado con icono (`WATCH_GROUPS`, `:819-826`) y pie `q o Ctrl+C para salir · se actualiza cada 2 s`.
- Los dos renderizadores son **código paralelo que hace lo mismo**. Con 5 ramas y 5 estados distintos, la vista en vivo gasta 10 líneas en cabeceras de grupo y líneas en blanco.
- En un hub, la tabla agrupa **por estado, no por vertical**: una misma `plan/pagos-p1` con 4 repos se parte en 3 grupos y la vertical desaparece. Es el problema central del issue.
- **Ancho mínimo**: probado con `renderWatch` a 30, 20 y 12 columnas → no revienta y ninguna línea supera el ancho. A **4** columnas sí se pasa (`12:34` ocupa 5). Bug real, menor, pero es el caso que la skill exige declarar.
- `visible()` (`cli/team.mts:684`) cuenta celdas quitando ANSI; `clip()` trunca. Los iconos del catálogo llevan variation selector (`✏️`), que es exactamente el caso de cluster de emoji que la skill manda probar.

## Decisions, dependencies, and risks

Todas cerradas por el usuario el 2026-11-03 («Sí, cierra las siete y escribe el plan») sobre las recomendaciones del asistente. Registradas en la memoria de decisiones del repo.

- **D1 — Sin cabecera por fila; el estado va como icono en la columna MINION.** La fila pasa a `MINION · RAMA · …` con el icono de estado pegado al minion. Evita una columna entera para algo que ya se ve. (`docs/decisions/…-tabla-team-d1-estado-como-icono-en-minion.md`)
- **D2 — Cabeceras de grupo de una sola línea, sin líneas en blanco.** Se elimina el patrón «línea en blanco + título + línea en blanco» por grupo. En un hub el grupo es la **vertical** (`plan/pagos-p1`), no el estado; el estado se ve por el icono de cada fila.
- **D3 — Prioridad de sacrificio de columnas fija y documentada.** Orden de importancia: `MINION` > `RAMA` > `ESTADO` (icono) > `COMMITS` > `FICHEROS` > `DÓNDE`. Al faltar ancho se quitan desde el final, nunca desde el principio. Las columnas no se reordenan entre refresco (*«keep column roles stable during streaming updates»*).
- **D4 — Ruta al valor completo cuando la tabla no cabe.** `bond team status <rama>` imprime esa fila desplegada en `clave: valor` sin truncar. Es la respuesta a *«expose full values separately when a table cannot fit them»* y sustituye a cortar una ruta de worktree por la mitad.
- **D5 — Pie con totales derivados.** `4 ramas · 2 trabajando · 1 lista · 1 integrada`. Se calculan en el momento de renderizar a partir de las `Row` ya recogidas; **no se guarda ningún contador** en ningún sitio (*«do not introduce a second authoritative task ledger only for the UI»*). En la vista en vivo el pie conserva además los atajos.
- **D6 — Color solo en icono de estado y en el estado.** El resto de la tabla va en color por defecto. Se acabó pintar celdas enteras. El icono aporta la redundancia no cromática que la skill exige conservar (*«preserve labels or symbols that make status understandable without color»*).
- **D7 — No se añade `outcome-unknown`.** La skill lista ese estado, pero al comprobar `classify()` el hueco es menor de lo que parecía: los estados de bond describen *git + vivacidad del agente*, no *terminación de la tarea*. Un agente muerto con ficheros sucios da `sin commitear`, que es honesto (hay cambios sin commitear). Añadir `outcome-unknown` obligaría a llevar un registro de «tarea en vuelo», que es justo el segundo ledger que la skill prohíbe. En su lugar queda **propuesto como issue aparte** (no en este plan): mostrar la vivacidad del agente (activo / ocioso / ido) en la celda de agente, derivable de Herdr sin ledger nuevo.
  **Tampoco se añade lectura de preguntas reales** (acordado al revisar la tabla ya hecha). Lo que bond reconoce en un panel es solo el aviso de confianza de la carpeta (`questionIn`), una cadena fija; parsear texto arbitrario para reconstruir la pregunta de un agente no tiene contrato estable y un falso positivo en una fila ⛔ es peor que callar. La fila bloqueada dice el estado y nada más: el ⛔, el aviso de cómo responder bajo la tabla, y `espera:` en `bond team status <rama>` con lo único detectable. La línea `└ pregunta:` se quita de la tabla y ningún ancho vuelve a imprimirla.

**Dependencias**: ninguna de otros issues. `#33` no bloquea ni está bloqueado.

**Riesgos**:
- *Regresión visual en paneles estreitos de Herdr.* Mitigado con los casos de revisión de tallas y pruebas de render por ancho.
- *Truncado que rompe clusters de emoji o secuencias ANSI.* Mitigado con pruebas explícitas sobre `clip()`/`visible()` con `✏️`, CJK y combining marks.
- *Unificar `printStatus` y `renderWatch` puede romper pruebas existentes de ambas.* Mitigado: se ejecuta la suite completa antes de dar por hecha la fase y se adaptan las pruebas que asuman el render viejo, no el render para que pasen las pruebas viejas.
- *Paridad Windows.* El render es puro texto, pero las pruebas de rutas (`DÓNDE`) deben seguir valiendo en `windows-x64`.

## Phases

### P1: Una sola tabla, agrupada por vertical, legible a 60 columnas

- **Outcome**: `bond team status` y la vista en vivo de `bond team` producen la misma tabla; en un hub las ramas salen agrupadas por vertical con una cabecera de una línea; el pie resume el total; a 60 columnas se leen minion, rama y estado, y el valor completo de lo que no cabe se obtiene con `bond team status <rama>`.
- **Owning repository**: `jmanuelcorral/bond`, rama de trabajo de `#33`.
- **Dependencies**: ninguna.
- **Affected contracts**:
  - `printStatus()` y `renderWatch()` pasan a compartir un único renderer de tabla. Cambio interno, pero visible: la tabla de una sola pasada gana título, iconos y pie.
  - Orden de columnas y orden de sacrificio (D3): contrato visual para quien lea la salida.
  - `bond team status <rama>`: nueva forma de invocación (salida desplegada sin truncar).
  - Pie de tabla: nuevo, con totales derivados (D5).
  - Color: se reduce a icono + estado (D6). Salida sin color invariante.
  - `--json`: **sin cambios** de esquema.
- **Acceptance criteria**:
  - [ ] `bond team status` y la vista en vivo producen **el mismo cuerpo de tabla** (mismas columnas, mismo orden, mismos iconos) para las mismas `Row`.
  - [ ] En un hub con una vertical de 4 repos, las 4 ramas aparecen **juntas bajo una cabecera de vertical**, no repartidas por estado.
  - [ ] Ninguna línea en blanco entre filas de un mismo grupo; una cabecera de grupo ocupa **exactamente una línea**.
  - [ ] Con 5 ramas en 5 estados distintos, la vista en vivo ocupa **menos líneas que en `2b80463`** (antes: 10 líneas de cabeceras y blancos).
  - [ ] A **80×24** y a **60 columnas**: minion, rama y estado visibles; se sacrifican desde el final en el orden D3 y se indica qué se ha sacrificado.
  - [ ] A **12 columnas** no revienta y ninguna línea supera el ancho. A **4 columnas** muestra un estado mínimo honesto con salida, **sin líneas que superen el ancho** (corrige el desborde observado de `12:34`).
  - [ ] `bond team status <rama>` imprime esa fila en `clave: valor` **sin truncar**, incluidas rutas de worktree largas.
  - [ ] El pie muestra totales que **coinciden con las filas mostradas** y desaparece si no hay ramas.
  - [ ] Con `NO_COLOR` o sin TTY, la salida es idéntica en contenido y los estados se siguen distinguiendo por icono.
  - [ ] `--json` no cambia de esquema y su salida **no lleva ANSI** ni el pie.
  - [ ] Truncado probado con `✏️` (variation selector), CJK y combining marks: ni clusters rotos ni secuencias ANSI a medias.
  - [ ] `npm run typecheck && bun test` en verde; suite completa sin regresiones.
- **Actions**:
  - [ ] Extraer un renderer de tabla común y hacer que `printStatus` y `renderWatch` lo llamen.
  - [ ] Agrupar por vertical en hub (rama base común) y por estado fuera de hub, con cabecera de una línea (D2).
  - [ ] Icono de estado en la columna MINION (D1) y quitar la columna de estado redundante donde proceda.
  - [ ] Implementar el orden de sacrificio de columnas D3 con aviso de qué se ha caído.
  - [ ] Añadir `bond team status <rama>` con salida desplegada sin truncar (D4).
  - [ ] Añadir el pie con totales derivados en el render, sin estado persistente (D5).
  - [ ] Restringir el color a icono + estado (D6).
  - [ ] Declarar y respetar un ancho mínimo; corregir el desborde a 4 columnas.
  - [ ] Nuevas claves de i18n en `cli/messages/team.mts` (`es` + `en`) para cabeceras de vertical, aviso de columnas caídas y pie de totales.
  - [ ] Pruebas de render por ancho (80×24, 60, 12, 4), de agrupación por vertical, de ruta al valor completo, de totales y de truncado con emoji/CJK.
  - [ ] Actualizar `docs/reference.md` y `docs/en/reference.md` (nueva forma `bond team status <rama>`) y `CHANGELOG.md` en `## Sin publicar`.
  - [ ] Ejecutar `npm run typecheck && bun test` y registrar el resultado real.
  - [ ] Presentar evidencia y parar a revisión antes de otra fase.
- **Verification**: `npm run typecheck && bun test` desde la raíz del repo en el worktree de la fase; render manual con `bond team status` y `bond team` en paneles de Herdr de 80×24 y 60 columnas, en un hub con al menos una vertical de 3+ repos y en un repo sin hub; `NO_COLOR=1 bond team status` y `bond team status --json | grep -c $'\x1b'` (debe dar 0). Evidencia: salida literal de los renders a cada ancho y resultado de la suite.
- **Risks and recovery**: riesgo de romper pruebas que asuman el render viejo — se adaptan esas pruebas, no el render. Si la unificación de los dos renderizadores resulta demasiado enredada en una sola fase, se revierte a dos renderizadores que compartan solo el cálculo de columnas y se repropone el plan. Ninguno de los cambios toca datos persistentes ni el esquema de `--json`, así que revertir es revertir el commit.

## Progress (local plans only)

| Phase | Implementation | Verification | Review | Evidence |
| --- | --- | --- | --- | --- |
| P1 | done | pass (typecheck limpio; `bun test` 603 pass / 0 fail, +6 nuevas; sin desbordes en anchos 1..100) | pendiente | rama `feat/team-status-table` |

## Next step

P1 ejecutada y verificada en local. Falta la revision y, si se aprueba, el PR contra `main` y cerrar
#33. Nada se ha empujado ni fusionado por iniciativa propia.

## Evidence and tracking

- Issue: https://github.com/jmanuelcorral/bond/issues/33
- Decisiones: `docs/decisions/` (D1–D7, registradas con `record_decision`).
- PR: pendiente de crear al terminar P1.
- Lente de diseño: `~/.agents/skills/tui-design/` (`ORIGIN.md` con el SHA de origen).

## Optional handoff to another skill

Este plan no se autoriza a sí mismo. Quien lo ejecute debe revalidar la revisión del repo, el estado del issue y la aprobación explícita del usuario para el alcance de P1.
