---
name: "2026-10-22-autoupdate-package"
description: "bond se ofrece actualizar al arrancar: avisa, pregunta y aplica según el canal de instalación"
created_at: "2026-10-22T14:46:20Z"
has_completed_all_phases: false
last_implementation_at: "2026-10-22T17:02:24Z"
---

# Que bond se actualice solo cuando tú digas que sí

## Origen y revisión

- Identificador: `2026-10-22-autoupdate-package`.
- Origen: petición del usuario en sesión (auto-actualizar el paquete de bond).
- Revisión revisada: `4184e69` en `main` (bond 1.3.0), árbol limpio.
- Base de diseño: `cli/update.mts` (`update`, `latestTag`, `downloadVerified`, `installMethod`,
  `replaceBinary`, `refreshRuntime`), `cli/main.mts` (`prepare`), `cli/config.mts`
  (`~/.bond/config.toml` y `state.json`), `docs/reference.md` (sección Actualizar),
  `test/update.test.mts`, `packaging/README.md`, `scripts/build.mts`.
- Publicación en npm: canal previsto pero **no publicado** (`npm view @jmanuelcorral/bond` → 404).
  Queda en un ticket aparte del usuario; sin referencia: `gh issue list --repo jmanuelcorral/bond`
  no devuelve ninguna issue (ni abiertas ni cerradas) ni PRs.
- Aprobación: contenido y destino aprobados por el usuario el 2026-10-22 (D1 y D4 resueltos en
  la misma conversación; npm diferido a su ticket).

## Objetivo

Al arrancar, bond comprueba si hay release nueva, te lo dice y, si contestas que sí, la instala
por ti según cómo se instaló bond. Sin tu respuesta, no toca nada.

## Alcance y exclusiones

Entra: el chequeo en segundo plano con throttle, la pregunta en el arranque, la aplicación
automática en el canal de binario (`install.sh`/`install.ps1`) y en Homebrew, el control
(`--skip`, `bond doctor`) y la documentación.

Fuera: npm (hasta que el paquete se publique, en su ticket), AUR (compilación y sudo
interactivos), `bond` desde el código, y cualquier actualización sin respuesta del usuario.

## Contexto verificado

- `bond update` es hoy 100% manual (`cli/update.mts:158`). `--check`, `--version <v>`,
  `--force` y `--dry-run` ya existen; el pipeline del binario descarga, comprueba SHA-256
  contra `SHA256SUMS`, prueba que arranca (`--version`) y sustituye con `rename` atómico.
- `prepare()` (`cli/main.mts:45`) se ejecuta en cada arranque que no sea ayuda/versión/logo y
  llama a `cleanupOld()` y `refreshRuntime()`: es el punto natural para el chequeo.
- `installMethod()` (`cli/update.mts:76`) distingue `binary` / `brew` / `npm` / `source`.
- `~/.bond/state.json` (`cli/config.mts:16`) es el fichero de estado que escribe bond: ahí van
  la marca de la última comprobación y la versión omitida.
- `latestTag()` usa la redirección de `/releases/latest`, sin API ni límite
  (`cli/update.mts:35`), y `BOND_RELEASES_URL` permite apuntar a un servidor propio.
- `test/update.test.mts` ya monta un servidor de releases falso con `BOND_RELEASES_URL`
  (`/latest` redirige al tag, `SHA256SUMS` y assets) y `BOND_HOME` permite aislar el estado.
- Brew: `brew update && brew upgrade jmanuelcorral/tap/bond` solo toca bond y sus dependencias,
  pero `brew update` refresca el índice de todos los taps y tarda de 10 a 90 s. El binario
  nuevo queda en `$(brew --prefix bond)/bin/bond`. brew no está en la máquina de desarrollo:
  no se puede probar aquí.
- npm: el paquete no está publicado (404). `scripts/build.mts:66-91` no genera `postinstall`
  ni `preinstall`, así que `npm i -g` sería limpio cuando exista; el prefijo global puede pedir
  `sudo` fuera de nvm/bun.
- `bond update` en una instalación npm imprime hoy `npm i -g @jmanuelcorral/bond@latest`
  (`cli/update.mts:185`), un comando que hoy falla: hay que decir la verdad mientras el paquete
  no esté publicado.

## Decisiones, dependencias y riesgos

- Decidido (usuario, 2026-10-22) **D1**: se auto-aplica solo si el usuario dice que sí. Se
  pregunta en el arranque con tres salidas — 1) actualizar ahora, 2) omitir esta versión,
  3) no volver a preguntar.
- Decidido (usuario, 2026-10-22) **D4**: se auto-aplica en binario y en brew. npm se deja para
  su ticket de publicación; AUR y desde el código, solo se muestra el comando.
- Pendiente: la referencia del ticket de publicación en npm (no está en las issues del repo).
- Riesgo de seguridad: `SHA256SUMS` se sirve desde el mismo origen que el binario, sin firma.
  El auto-apply amplía el impacto de un compromiso del repo de GitHub; se mitiga manteniendo la
  prueba de arranque y el `rename` atómico, y dejando el auto-apply desactivable
  (`BOND_NO_UPDATE=1`, opción 3 de la pregunta).
- Riesgo de arranque: el chequeo de red no puede bloquear ni romper el arranque de `bond`. Tope
  de ~2 s, fallo silencioso y nunca se pregunta sin TTY en la entrada.
- Riesgo en Windows: el exe en uso no se puede sobrescribir; `replaceBinary` ya renombra a
  `.old` (`cli/update.mts:88`) y `cleanupOld()` lo borra después. Si el rename falla, se avisa
  y se deja para el próximo arranque.
- Riesgo en brew: su salida no se traga; si falla, se ve el error de brew y bond no finge haber
  actualizado.

## Fases

### P1: chequeo en segundo plano, pregunta y aplicación en binario

- Resultado: al arrancar `bond`, `bond dev` o `bond team`, si hay release nueva sale la
  pregunta y con «1» bond queda actualizado sin teclear nada más.
- Repositorio: `jmanuelcorral/bond`.
- Dependencias: ninguna.
- Contratos:
  - Nuevo punto de entrada en `cli/update.mts` (p. ej. `offerUpdate()`) llamado desde
    `prepare()` (`cli/main.mts:45`) para los comandos que arrancan el puesto de trabajo.
  - Throttle: guarda la última comprobación en `~/.bond/state.json`; no vuelve a tocar la red
    durante 24 h. `BOND_NO_UPDATE=1` desactiva el chequeo por completo.
  - Tope de ~2 s para la consulta; si no responde a tiempo, se ignora y el arranque sigue.
  - Pregunta con tres salidas: 1) actualizar ahora, 2) omitir esta versión (se guarda en
    `state.json` y no se vuelve a nombrar hasta que salga otra), 3) no volver a preguntar
    (`auto = false` en `~/.bond/config.toml`).
  - Sin TTY en la entrada no se pregunta: solo se informa de que hay versión nueva.
  - Con «1» y `installMethod() === "binary"`, aplica el pipeline actual (descarga → SHA-256 →
    prueba de arranque → `replaceBinary` → `_runtime`).
- Criterios: el primer arranque del día con release nueva pregunta; el segundo dentro de las
  24 h no toca la red; sin red el arranque sale igual y rápido; con «2» esa versión no vuelve
  a salir y una versión posterior sí; con «3» queda `auto = false` y no vuelve a preguntar;
  con `BOND_NO_UPDATE=1` no hay chequeo; con la salida redirigida no pregunta y solo informa;
  con «1» en método binario, `bond --version` da la versión nueva al relanzar; si el binario
  nuevo no arranca, se conserva el actual y se avisa; ayuda y `CHANGELOG.md` al día.
- Acciones:
  - [x] Chequeo con throttle, pregunta de tres salidas, aplicación en binario, pruebas y
    documentación.
  - [x] Ejecutar las comprobaciones y apuntar los resultados reales.
  - [x] Presentar la evidencia y parar para revisión (aceptada con el merge del PR #9).
- Verificación: `npm run typecheck && bun test` (con el servidor de releases falso de
  `test/update.test.mts` y `BOND_HOME` temporal: throttle, omitir versión, `auto = false`,
  fallo de red y binario que no arranca); a mano, `bin/bond` contra `BOND_RELEASES_URL` local
  con y sin TTY.
- Riesgos y recuperación: en Windows, si el `rename` del exe falla, se deja `.old` y se avisa;
  en cualquier canal, una versión mala no sustituye a la actual porque se prueba que arranca
  antes de reemplazar.

### P2: brew en el auto-apply y mensaje de npm honesto

- Resultado: con «1» en una instalación de Homebrew, bond corre la actualización de brew por ti.
- Repositorio: `jmanuelcorral/bond`.
- Dependencias: P1 (aceptada).
- Contratos:
  - Con `installMethod() === "brew"` y «1»: `brew update && brew upgrade jmanuelcorral/tap/bond`
    con la salida de brew a la vista; al terminar, `_runtime` desde
    `$(brew --prefix bond)/bin/bond`.
  - Si brew falla (lock, sin red, tap caído), se muestra su error, bond no actualiza nada y el
    arranque continúa.
  - Mensaje de npm: mientras `@jmanuelcorral/bond` no esté publicado, decir que no está
    publicado y remitir al `.tgz` de la release en vez de imprimir `npm i -g
    @jmanuelcorral/bond@latest`, que hoy da 404.
  - La rama de auto-apply por npm queda explícitamente fuera, ligada al ticket de publicación.
- Criterios: en macOS con brew, «1» deja la versión nueva y `bond doctor` la ve; con brew
  caído, sale el error de brew y la versión queda intacta; en método npm el mensaje ya no
  promete un paquete inexistente; en método binario no hay cambios respecto a P1; ayuda,
  `docs/reference.md` y `CHANGELOG.md` al día.
- Acciones:
  - [ ] Auto-apply de brew con salida visible y manejo de fallo, corrección del mensaje npm,
    pruebas (gestor simulado) y documentación.
  - [ ] Ejecutar las comprobaciones y apuntar los resultados reales.
  - [ ] Presentar la evidencia y parar para revisión.
- Verificación: `npm run typecheck && bun test` (selección de comando y fallo del gestor con
  `brew` simulado en el `PATH` y `BOND_RELEASES_URL` local); a mano en macOS con brew real.
  Limitación registrada: sin brew en la máquina de desarrollo, la prueba a mano de brew queda
  pendiente de otra máquina.
- Riesgos y recuperación: `brew update` toca el índice de todos los taps del usuario (efecto
  colateral no reversible por bond) — se anuncia antes de ejecutarlo.

### P3: control y documentación

- Resultado: se puede saber y cambiar el estado del auto-actualizado sin leer el código.
- Repositorio: `jmanuelcorral/bond`.
- Dependencias: P1 (aceptada).
- Contratos:
  - `bond doctor` muestra: método de instalación, última comprobación, versión pendiente,
    versión omitida y estado del auto-apply.
  - `bond update --skip <v>` omite una versión y `--skip-reset` quita la omisión.
  - Ayuda de `bond update` (`UPDATE_HELP`), `docs/reference.md` (Actualizar),
    `docs/getting-started.md` y `CHANGELOG.md` en `## Sin publicar`.
- Criterios: `bond doctor` refleja lo que hay en `state.json` y `config.toml`; `--skip <v>`
  evita el aviso de esa versión hasta que salga otra y `--skip-reset` lo restaura; la ayuda
  enumera las opciones nuevas; `bond sync --check` al día; la documentación coincide con el
  comportamiento real.
- Acciones:
  - [ ] `--skip`/`--skip-reset`, fila en `bond doctor`, documentación y pruebas.
  - [ ] Ejecutar las comprobaciones y apuntar los resultados reales.
  - [ ] Presentar la evidencia y parar para revisión.
- Verificación: `npm run typecheck && bun test`; a mano `bin/bond doctor`,
  `bin/bond update --help` y `bin/bond sync --check`.

P2 depende de P1 y P3 depende de P1. **P2 y P3 no se ejecutan en paralelo**: las dos tocan
`cli/update.mts` y su test.

## Progreso

| Fase | Implementación | Verificación | Revisión | Evidencia |
| --- | --- | --- | --- | --- |
| P1 | implemented | passed | accepted (usuario, 2026-10-22, merge del PR #9) | rama `plan/autoupdate-package-p1` (Claude, `kevin`): commit `995911a`, rebaseado en `main` como `3a422d2`; PR #9 fusionado el 2026-10-22T17:01:54Z; 7 ficheros (+424/−37), `test/offer.test.mts` (13 casos) y `test/offer-driver.mts` nuevos. CI en verde en linux, macOS y Windows. Verificado en el checkout principal sobre `3a422d2`: `tsc` limpio y `bun test` 95/95. Comprobaciones independientes: `bond update --check` con red real («bond 1.3.0 ya es la última», camino refactorizado sin regresión), `state.json` intacto tras un `--check` (el aviso solo escribe desde el puesto de trabajo) y revisión del diff: el chequeo no puede bloquear el arranque (timeout + `catch` que sigue), nada se instala sin un «1» explícito y un fallo deja la versión actual intacta. Prueba a mano en Linux (Claude, `BOND_HOME` temporal y `BOND_RELEASES_URL` local): salida redirigida solo avisa por stderr; «2» guarda `skipped` y no nombra esa versión pasadas 24 h; «3» deja `[update] auto = false` y deja de consultar; `BOND_NO_UPDATE=1` no consulta; sin red, mismo tiempo de arranque; binario compilado con «1» instala |
| P2 | pending | not_run | pending | none yet |
| P3 | pending | not_run | pending | none yet |

## Siguiente paso

**P1 integrada y aceptada** (PR #9 fusionado con rebase en `main` como `3a422d2`): `tsc` limpio,
`bun test` 95/95 y CI en verde en las tres plataformas.

Siguiente fase elegible: **P2** (brew en el auto-apply y mensaje de npm honesto). P3 también es
elegible tras P1, pero **no pueden ir en paralelo**: las dos tocan `cli/update.mts` y su test, así
que se ejecutan de una en una — P2 primero, porque deja el mensaje de npm correcto antes de tocar
el control. Ejecutar con `plan-execute` sobre esta ruta y solo P2. Alternativas: `revisa` el plan
o `para`.

## Evidencia y seguimiento

- Pendiente de referencia: ticket de publicación de `@jmanuelcorral/bond` en npm (fuera de este
  plan; bloquea solo la rama de auto-apply por npm).
- Limitaciones a cerrar en su fase: prueba a mano de brew en macOS (fuera de la máquina de
  desarrollo actual).
