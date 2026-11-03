---
name: "2026-11-03-generated-text-i18n"
description: "El texto que bond genera para el agente (reglas, plantilla, bloque del hub, nota de coordinación) sigue el idioma elegido en bond setup"
created_at: "2026-11-03T15:53:45Z"
has_completed_all_phases: false
---

# El texto generado sigue el idioma de bond

## Source and revision

- Plan identifier: `2026-11-03-generated-text-i18n`
- Source: https://github.com/jmanuelcorral/bond/issues/49 — «bond setup: elegir el idioma de bond», que pide explícitamente que el idioma alcance a «los textos que genera (p. ej. el bloque `bond:hub` del `AGENTS.md` o las notas de coordinación de `bond team prompt`)».
- Reviewed revision: `a25c9f9` (main, tras fusionar #60).
- Reference repository and branch: `jmanuelcorral/bond`, `main`.
- Design baseline: `cli/messages.mts` (comentario de cabecera, línea 6), `cli/instructions.mts`, `cli/repo.mts` (`withBlock`, `hubAgentsBlock`, `MARKER_TEXT`), `cli/team.mts` (`verticalNote`), `lib/lang.mts`.
- Approval: pendiente de aprobación de este plan. Las decisiones G1–G4 quedan aprobadas por el usuario en la conversación del 2026-11-03.

## Goal

Que un usuario con `lang = "en"` en `~/.bond/config.toml` reciba en inglés también lo que bond escribe en ficheros para los agentes —las reglas globales, el bloque del hub y la nota de coordinación de cada encargo—, no solo lo que bond imprime por consola.

## Scope and exclusions

**Entra**: las ~25 cadenas de prosa de los 6 bloques de texto generado; un área nueva de mensajes para ellas; el aviso al cambiar de idioma; la distinción en `bond sync --check`; las cabeceras de la tabla del hub.

**Se conserva**: el mecanismo de marcadores (`withBlock` casa por prefijo, no por nota); `ensurePersonal` solo escribe si `~/.bond/AGENTS.md` no existe; los bloques se regeneran igual que hoy; los runs y encargos ya enviados conservan el idioma con que se escribieron.

**Fuera**: migrar el `~/.bond/AGENTS.md` de quien cambió de idioma después del seed (G3); traducir caminos (`docs/plans/`, `docs/decisions/`, `hub.toml`) o comandos de bond (G4); idiomas distintos del español y el inglés; que cada repo o cada agente tenga su propio idioma — el idioma es de la máquina.

## Verified context

Observado en el código, no supuesto:

- `cli/messages.mts:6` declara hoy: «Aquí va solo lo que bond imprime por consola. Los textos que reciben los agentes (las reglas de `cli/instructions.mts`, la plantilla de `~/.bond/AGENTS.md`) no están: siguen en español.» Es un aplazamiento documentado, no un olvido.
- `t(key, params, at = lang())` acepta multilínea: `setup.help` en `cli/messages.mts` es un template literal de ~20 líneas. El patrón de tipado (claves tipadas contra `es`, `en` obligatorio) funciona igual con bloques largos.
- `withBlock` (`cli/repo.mts`) localiza el bloque por `MARKER_TEXT[style].open`, que en el estilo `hub` es `"<!-- >>> bond:hub >>>"` **sin la nota**. La nota solo entra en `begin(note)`. Traducir `BLOCK_NOTE`/`DEFAULT_NOTE` no rompe la detección de bloques.
- `ensurePersonal` (`cli/instructions.mts`) sale inmediato si `PERSONAL_FILE` existe. Cambiar `PERSONAL_TEMPLATE` no toca ficheros ya sembrados.
- `blockCurrent()` compara el fichero entero contra `withBlock(current, body, ...)`. Si cambia el idioma, cambia `body` y el bloque pasa a estar «no al día»: el mecanismo de detección ya existe, solo falta hacerlo visible.
- Texto generado afectado: `BOND_RULES` y `PERSONAL_TEMPLATE` y `BLOCK_NOTE` (`cli/instructions.mts:16,31,61`), `hubAgentsBlock()` y `DEFAULT_NOTE` (`cli/repo.mts`), `verticalNote()` (`cli/team.mts:2198`).
- 3 ficheros de test fijan texto generado exacto: `test/hub-init.test.mts`, `test/repo.test.mts`, `test/team-hub.test.mts` (4 aserciones de prosa).
- El idioma ya está resuelto antes de generar: `resolveLang()` en `lib/lang.mts` con `BOND_LANG` → `[ui] lang` → detección del sistema.

## Decisions, dependencies, and risks

Decisiones aprobadas por el usuario (2026-11-03), registradas en `docs/decisions/2026-11-03-el-texto-que-bond-genera-para-el-agente-sigue-el-idioma-g1-g4.md`:

- **G1 — Área nueva `cli/messages/gen.mts` con claves `gen.*`.** El contenido de fichero no se mezcla con el de consola; se actualiza el comentario de cabecera de `messages.mts` para decir que hay dos categorías.
- **G2 — El idioma se fija al generar; cambiarlo reescribe los bloques con aviso explícito.** `bond sync` dice cuántos bloques reescribe y en qué idioma. `bond sync --check` distingue «bloque desactualizado» de «cambio de idioma».
- **G3 — `~/.bond/AGENTS.md` no se migra.** Tras el seed es del usuario.
- **G4 — Cabeceras de tabla traducidas; caminos y comandos, nunca.**

Dependencias: ninguna. El i18n de consola (1.11.0) ya está fusionado y publicado, así que `resolveLang()`, el catálogo de áreas y el tipado es-origen son comportamiento aceptado, no código en una rama suelta.

Riesgos:

- **R1 — Diff grande en repos ajenos.** Cambiar de idioma reescribe el `AGENTS.md` de cada repo. Mitigado por el aviso de G2: sin él, el usuario ve un cambio de idioma convertido en una lluvia de bloques modificados sin explicación.
- **R2 — Tests de texto exacto.** Las 4 aserciones de prosa de `hub-init`, `repo` y `team-hub` fallarán al traducir. Hay que adaptarlas a las claves, no a la cadena literal, para que no vuelvan a romperse en cada retoque de redacción.
- **R3 — Traducción nueva de prosa larga.** El `en` de estos bloques no reutiliza nada de consola; se escribe y se revisa a mano. El tipado impide olvidarlo, pero no impide que sea malo.
- **R4 — Windows.** Sin impacto: no hay `.cmd` ni `.exe` en el texto generado, y las rutas que se mencionan son literales de documentación.

## Phases

### P1: El texto generado sale del catálogo de mensajes y sigue el idioma en vigor

- Outcome: con `BOND_LANG=en`, `bond setup` escribe en inglés las reglas globales en cada agente, `bond sync` escribe en inglés el bloque `bond:hub`, y `bond team prompt` manda en inglés la nota de coordinación. Con `es`, lo de siempre. `bond sync --check` dice si un bloque está desactualizado o si lo que cambió fue el idioma.
- Owning repository: `jmanuelcorral/bond`, rama de trabajo desde `main`.
- Dependencies: ninguna.
- Affected contracts:
  - Nuevo `cli/messages/gen.mts` exportando `es`/`en` con claves `gen.rules`, `gen.personal_template`, `gen.block_note`, `gen.hub_*`, `gen.default_note`, `gen.vertical_note_*`; registrado en `cli/messages.mts`.
  - `BOND_RULES`, `PERSONAL_TEMPLATE`, `BLOCK_NOTE` pasan de constantes de módulo a funciones que leen del catálogo (o constantes calculadas con `t()`), manteniendo sus firmas exportadas donde las haya.
  - `hubAgentsBlock(hub, decisionsDir)` invariada en firma; su salida depende de `lang()`.
  - `verticalNote(hub, branch, me, team)` invariada en firma; su salida depende de `lang()`.
  - `bond sync` y `bond sync --check`: nueva salida que distingue los dos casos y cuenta los bloques reescritos.
- Acceptance criteria:
  1. Con `BOND_LANG=en`, el bloque escrito en el fichero de instrucciones global de un agente está en inglés, incluido el título de la sección y las 5 reglas.
  2. Con `BOND_LANG=en`, `hubAgentsBlock` produce título, intro, cabeceras de tabla y reglas del hub en inglés; `docs/plans/`, `docs/decisions/`, `hub.toml` y los comandos `bond …` siguen intactos en su forma literal.
  3. Con `BOND_LANG=en`, `verticalNote` produce la nota de coordinación en inglés; con `es`, en español.
  4. `bond sync --check` sobre un bloque escrito en otro idioma lo reporta como cambio de idioma, no como bloque desactualizado genérico.
  5. `bond sync` que reescribe bloques por cambio de idioma lo avisa con el número de bloques y el idioma destino.
  6. `ensurePersonal` no toca un `~/.bond/AGENTS.md` que ya existe, sea cual sea su idioma.
  7. Un `~/.bond/AGENTS.md` nuevo con `BOND_LANG=en` se siembra en inglés.
  8. Negativo: cambiar el idioma no modifica runs ni encargos ya escritos en disco.
  9. Negativo: `bond sync --check` en un bloque ya en el idioma en vigor no lo marca como cambio de idioma.
  10. `npx tsc -p .` limpio, lo que obliga a que las ~25 claves tengan su traducción `en`.
- Actions:
  - [ ] Crear `cli/messages/gen.mts` con las claves `gen.*` en `es` y `en` (G1) y registrarlo en `cli/messages.mts`; actualizar el comentario de cabecera de ese fichero.
  - [ ] `cli/instructions.mts`: `BOND_RULES`, `PERSONAL_TEMPLATE` y `BLOCK_NOTE` salen del catálogo.
  - [ ] `cli/repo.mts`: `hubAgentsBlock` y `DEFAULT_NOTE` salen del catálogo; cabeceras de tabla traducidas, caminos y comandos sin tocar (G4).
  - [ ] `cli/team.mts`: `verticalNote` sale del catálogo.
  - [ ] `bond sync` / `bond sync --check`: detección y aviso de cambio de idioma, con recuento de bloques (G2).
  - [ ] Adaptar las 4 aserciones de prosa de `test/hub-init.test.mts`, `test/repo.test.mts` y `test/team-hub.test.mts` para que comparen contra las claves del catálogo y no contra la cadena literal (R2).
  - [ ] Pruebas nuevas cubriendo los 9 criterios anteriores, con el idioma fijado por `BOND_LANG` en cada caso.
  - [ ] `CHANGELOG.md`, `docs/reference.md` y `docs/en/reference.md`: el cambio de idioma reescribe bloques y se avisa.
  - [ ] Correr `npx tsc -p .` y `bun test`; registrar resultados reales.
  - [ ] Presentar evidencia y parar a revisión antes de otra fase.
- Verification: desde la raíz del repo, `npx tsc -p .` sin errores; `bun test` sin fallos; `BOND_LANG=en bun -e` que imprima `hubAgentsBlock` y `verticalNote` y se compruebe a ojo que el inglés es correcto y que `docs/plans/`, `hub.toml` y los comandos salen intactos; `BOND_LANG=es` igual en español; `bond sync --check` en un bloque escrito en el idioma opuesto, comprobando que el mensaje es el de cambio de idioma.
- Risks and recovery: R1 se mitiga con el aviso; si aun así no se quiere, la recuperación es volver a poner el idioma anterior y pasar `bond sync`, que reescribe los bloques de vuelta. R2 se resuelve en esta fase. Ninguna migración irreversible: todo lo generado se regenera.

## Progress (local plans only)

| Phase | Implementation | Verification | Review | Evidence |
| --- | --- | --- | --- | --- |
| P1 | implemented | passed | pending | `npx tsc -p .` limpio; `bun test` 618 pass / 0 fail (3929 `expect()`, 33 ficheros), +14 nuevos en `test/generated-text-i18n.test.mts` |

## Next step

Revisión humana de P1. Los 10 criterios de aceptación están cubiertos y verificados; el código está
en la rama `feat/generated-text-i18n` esperando PR. Nota de la ejecución: el criterio 4 («`--check`
distingue cambio de idioma») obligó a corregir `loadManifest`, que reconstruía el manifiesto a mano y
se dejaba `lang` fuera — sin él el aviso nunca se disparaba. Y en modo `--check` no se escribe el
manifiesto, así que repetir `--check` vuelve a reportar el mismo cambio pendiente: es lo correcto, no
un fallo. Responder «apruebo P1» para aceptarlo, o «cambios: …» para pedir ajustes.

## Evidence and tracking

- Issue: https://github.com/jmanuelcorral/bond/issues/49
- Decisión: `docs/decisions/2026-11-03-el-texto-que-bond-genera-para-el-agente-sigue-el-idioma-g1-g4.md`
- PR: pendiente de abrir al terminar P1.
