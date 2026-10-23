---
name: "2026-10-23-prompt-suggestions"
description: "bond setup instala y configura las sugerencias de prompt (ghost text after-turn) en pi y bond doctor informa de su estado"
created_at: "2026-10-23T09:36:35Z"
last_implementation_at: "2026-10-23T10:06:11Z"
has_completed_all_phases: true
next_step: "Plan completo. Empujar main (aprobado por el usuario) y, si se pide, preparar la release con release-prepare-github"
---

# Sugerencias de prompt en pi como parte de bond

## Source and revision

- Plan identifier: `bond/prompt-suggestions/2026-10-23`.
- Source: petición del usuario en sesión tras probar en vivo `@mrclrchtr/supi-prompt-suggestions` en el repo `fluzo` (panel hermano de Herdr).
- Reviewed revision: `2a554e4` (main, `bond` 1.4.0).
- Reference repository and branch: `bond`, `main`.
- Design baseline: `cli/setup.mts`, `cli/config.mts`, `cli/repo.mts`, `cli/doctor.mts`, `cli/models.mts`; docs de pi `packages.md` y `settings.md`; ADR-0008 y fuentes de `@mrclrchtr/supi-prompt-suggestions` / `@mrclrchtr/supi-core` 11.0.1 inspeccionados en el tarball.
- Approval: aprobada por el usuario en sesión la propuesta mostrada (contenido y destino), con las opciones recomendadas de D1–D6.

## Goal

Al terminar `bond setup` con pi entre los agentes, el usuario tiene instalada la extensión de sugerencias de pi, un modelo barato elegido del registro de bond y las sugerencias activas: tras cada turno del agente, pi muestra en ghost text el siguiente prompt sugerido, aceptable con `→`/`Tab`. `bond doctor` informa del estado y de cómo arreglarlo.

## Scope and exclusions

- Entra: instalación del paquete npm en el ámbito personal de pi desde `bond setup`, elección y persistencia del modelo de sugerencia en `~/.config/bond/config.toml`, garantía de `enabledModels` en la configuración personal de pi, fila en `bond doctor`, ayuda y documentación.
- Se conserva: el comportamiento de `bond setup` para quien no quiera la función (`--no-suggestions`), los ficheros de supi que no sean de esta sección (se fusionan, no se sustituyen) y una lista de `enabledModels` ya existente y no vacía.
- Fuera: extensiones de completado mientras se escribe; otros agentes (opencode, crush, codex, Claude, Copilot); publicación en npm; cambios en el proceso de release más allá del pin de versión.

## Verified context

- pi no expone API nativa de ghost text: `earendil-works/pi` #2223 cerrado como `not_planned` y #2355 con la indicación de construir un componente de editor propio. La extensión reemplaza el editor con `setEditorComponent`; **solo una de este tipo puede estar activa a la vez** (ADR-0008 de supi documenta el conflicto por orden de carga).
- `@mrclrchtr/supi-prompt-suggestions` 11.0.1 (MIT): sugerencias **solo after-turn** (editor vacío al asentarse el agente). Inspección del tarball: sin llamadas de red propias (ni `fetch`, ni `http.request`, ni `net.connect`, ni WebSocket), sin claves de telemetría, 5.175 líneas de fuente junto con `@mrclrchtr/supi-core`, 10 ficheros de test. Las llamadas van por el registro de modelos de pi, que es dueño de auth y routing.
- Config de supi: global `~/.pi/agent/supi/config.json`, proyecto `.pi/supi/config.json`; sección `promptSuggestions`, clave `model` con `provider/model-id` o `"disabled"` (por defecto). **Fichero compartido** con otros paquetes de la suite supi: hay que fusionar JSON preservando claves ajenas.
- Tropiezo comprobado en vivo: `getSelectableModels()` de `supi-core` devuelve lista vacía si `enabledModels` de pi no está definido o está vacío, aunque el default de pi sea «todos los modelos». Con `enabledModels: ["*"]` el picker se puebla y la sugerencia se genera.
- En bond: `cli/repo.mts:265` escribe el `.pi/settings.json` del repo con `{ defaultTools, packages: ["~/.bond/pi"] }`; el manifiesto del paquete de bond declara `pi.extensions: ["./extensions"]` desde `extensions/` del repo. pi admite entradas `{"source": "npm:..."}` con filtros de recursos en `packages`, en ámbito personal y de proyecto.
- Registro de modelos de bond: `~/.config/bond/config.toml` (`cli/config.mts`), con `Provider.free?: boolean` («modelos propios sin coste»), `Model.enabled`, `Model.agents`.
- `bond setup` (`cli/setup.mts`): wizard → `saveConfig` → `migrateLegacy` → directorio de extensiones de pi + `ensureBondLink` → `herdrSkill`/`globalSkills`/`contextTools` → integraciones de Herdr → `syncAgents` → instrucciones → `linkBond`.
- `bond doctor` (`cli/doctor.mts`): `add(level, name, detail, fix)`; `checkUpdate()` delega en un módulo que devuelve `{ level, name, detail, fix }` — patrón a seguir.
- Estado manual dejado en esta máquina durante la prueba (a reconciliar por `bond setup`): `enabledModels: ["*"]` en `~/.pi/agent/settings.json` y `~/.pi/agent/supi/config.json` con `halo/flash-halogen`, cargada con `-e` (no instalada de forma permanente).

## Decisions, dependencies and risks

Decisiones aprobadas (opción recomendada):

- **D1 ámbito personal**: `bond setup` instala con `pi install npm:...`, disponible en todos los repos sin gating por confianza y sin footprint en el repo.
- **D2 preguntado en el asistente**: por defecto sí si resuelve un modelo barato; por defecto no si no lo hay. `--no-suggestions` para saltarlo.
- **D3 modelo**: `[suggestions] model` explícito en `config.toml`; heurística por defecto: proveedor con `free = true` → por nombre (`haiku`, `mini`, `flash`, `nano`) → primer modelo habilitado. El asistente enseña la elección y permite cambiarla.
- **D4 `enabledModels`**: bond escribe `["*"]` en `~/.pi/agent/settings.json` solo si está ausente o vacío; nunca pisa una lista no vacía.
- **D5 versión fijada**: constante en fuente de bond con el pin exacto (`@11.0.1`); se actualiza al preparar release.
- **D6 desactivar**: `enabled = false` escribe `"disabled"` en el config de supi y deja el paquete instalado; la eliminación completa se documenta como `pi remove npm:@mrclrchtr/supi-prompt-suggestions`.

Dependencias y riesgos:

- Conflicto de editor: otra extensión que también reemplace el editor se sobreescribe según orden de carga (ADR-0008). Mitigación: detección en `bond doctor` y documentación explícita.
- `pi install` necesita red durante `bond setup`: si falla, aviso no fatal y el resto del setup continúa.
- Windows: `pi install` usa npm y `.cmd`; se comprueba con pruebas que simulan el entorno y con la CI de las tres plataformas.
- El config de supi es compartido: escribir sin fusionar perdería secciones de otros paquetes de la suite. Mitigación: merge JSON preservando claves desconocidas, cubierto por test.
- Cambiar `enabledModels` afecta al cycling de modelos de pi: con `["*"]` el conjunto efectivo no cambia respecto del default; se documenta.

## Phases

### P1: Instalar y configurar las sugerencias desde `bond setup`

- Outcome: tras `bond setup` con pi y un modelo barato en el registro, `pi install` dejó el paquete en el ámbito personal, `~/.pi/agent/supi/config.json` tiene el modelo resuelto y `enabledModels` de pi es utilizable; con `--no-suggestions` queda desactivado sin tocar nada más.
- Owning repository: `bond`, rama de trabajo desde `main`.
- Dependencies: ninguna.
- Affected contracts:
  - Nuevo módulo `cli/suggestions.mts` con API pública: resolver modelo de sugerencia desde el registro de bond, fusionar el config de supi, garantizar `enabledModels`, instalar el paquete.
  - `Config` de `cli/config.mts`: sección `[suggestions]` con `enabled?: boolean` y `model?: string`.
  - `bond setup`: nuevo paso en la fase «Aplicando» y opción `--no-suggestions`; pregunta en el asistente con el modelo propuesto.
  - Constante de paquete con versión fijada en fuente de bond.
- Acceptance criteria:
  1. Con la opción afirmativa se ejecuta `pi install npm:@mrclrchtr/supi-prompt-suggestions@<pin>` y se escribe `promptSuggestions.model` con el modelo resuelto.
  2. `--no-suggestions` escribe `enabled = false` y `"disabled"` en el config de supi, y no instala.
  3. `--dry-run` enseña las acciones sin escribir ficheros ni ejecutar la instalación.
  4. Si pi no está entre los agentes elegidos, el paso se omite por completo.
  5. Un `~/.pi/agent/supi/config.json` preexistente con otras secciones conserva esas secciones y sus claves desconocidas.
  6. Una lista `enabledModels` ya existente y no vacía no se modifica; si está ausente o vacía, se escribe `["*"]`.
  7. Sin red (o si `pi install` falla) el setup continúa con aviso no fatal.
  8. La heurística del modelo respeta en orden: proveedor `free`, nombre barato, primer modelo habilitado; si no hay nada, se propone desactivado.
- Actions:
  - [x] Crear `cli/suggestions.mts` con la resolución, el merge del config de supi, la garantía de `enabledModels` y la instalación vía `pi`.
  - [x] Añadir la sección `[suggestions]` al tipo `Config`, a la configuración inicial y a la lectura/escritura TOML.
  - [x] Conectar el paso en `bond setup` (fase «Aplicando»), la opción `--no-suggestions` y la pregunta en el asistente con el modelo propuesto.
  - [x] Pruebas unitarias de heurística, merge preservando claves ajenas, `enabledModels` solo-cuando-toca, dry-run sin escrituras y omisión sin pi.
  - [x] Ejecutar `npm run typecheck && bun test` y registrar el resultado real.
  - [x] Presentar evidencia y parar a revisión antes de otra fase.
- Verification: `npm run typecheck && bun test` desde la raíz del repo; `bin/bond setup --dry-run` con `HOME` temporal para comprobar que no escribe y que enseña el paso. Entorno: Node >= 22.18, bun para las pruebas.
- Risks and recovery: escribir el config de supi sin fusionar (mitigado con merge y test); instalar sin red (aviso no fatal, se puede repetir `bond setup`); si el pin deja de servir, se cambia la constante y se repite setup.

### P2: Visibilidad en `bond doctor`, ayuda y documentación

- Outcome: `bond doctor` muestra una fila `sugerencias` con estado y arreglo accionable; la ayuda de `bond setup` y `docs/reference.md` explican la función, el tropiezo de `enabledModels` y cómo desactivarla o quitarla.
- Owning repository: `bond`.
- Dependencies: P1 aceptada (usa su API).
- Affected contracts: `bond doctor` (fila nueva), `SETUP_HELP`, `docs/reference.md`, `CHANGELOG.md` en `## Sin publicar`.
- Acceptance criteria:
  1. Fila `sugerencias` con `ok` cuando paquete, modelo y `enabledModels` son coherentes.
  2. `warn` cuando el modelo elegido queda fuera de `enabledModels`, cuando el paquete no está instalado o cuando hay otra extensión que reemplaza el editor.
  3. `fix` accionable en cada caso no OK.
  4. Ayuda y referencia documentan activar, desactivar y quitar; `CHANGELOG` con entrada en `## Sin publicar`.
- Actions:
  - [x] Fila en `bond doctor` delegando en la API de `cli/suggestions.mts`.
  - [x] Actualizar `SETUP_HELP` y `docs/reference.md`.
  - [x] Entrada en `## Sin publicar` del `CHANGELOG.md`.
  - [x] Pruebas de los estados OK/warn/fail de la fila.
  - [x] Ejecutar `npm run typecheck && bun test` y registrar el resultado real.
  - [x] Presentar evidencia y parar a revisión.
- Verification: `npm run typecheck && bun test`; `bin/bond doctor` con `HOME` temporal en cada estado.
- Risks and recovery: falsos positivos al detectar otras extensiones de editor (mitigación: informar listando los paquetes de pi en el detalle, sin fallar).

## Progress (local plans only)

| Phase | Implementation | Verification | Review | Evidence |
| --- | --- | --- | --- | --- |
| P1 | implemented | passed | accepted | recorded |
| P2 | implemented | passed | accepted | recorded |

## Next step

Plan completo: las dos fases están implementadas, verificadas y aceptadas.
P1 aceptada el 2026-10-23T10:06:11Z («acepto P1 y commit opcion 1»); P2 aceptada el
2026-10-23T10:08:03Z («acepto P2 y empuja main»), que además aprueba el push de `main`.

Lo que queda fuera de este plan, si se pide después: preparar la release (`release-prepare-github`),
regenerar `packaging/` y actualizar el tap de Homebrew.

Nota de alcance: el `CHANGELOG.md` y `docs/reference.md` se actualizaron en P2 según este plan; en
P1 solo cambió código y pruebas.

## Evidence and tracking

Rama de trabajo: `main` del checkout `/home/jose/gitrepos/bond` (base `2a554e4`). Ficheros de P1: `cli/suggestions.mts` (nuevo), `cli/config.mts`, `cli/wizard.mts`, `cli/setup.mts`, `test/suggestions.test.mts` (nuevo).

Comandos ejecutados y resultado real:

- `npm run typecheck` (tsc -p .): sin errores.
- `bun test`: 139 pass, 0 fail, 425 expect() en 10 ficheros (antes de P1: 114; +25 en `test/suggestions.test.mts`).
- `HOME=<temp> bin/bond setup --yes --dry-run` sin proveedores: `Sugerencias: desactivadas`; no se crea `~/.pi`.
- `HOME=<temp> bin/bond setup --yes --dry-run` con un proveedor `free = true` y modelos `big-model` + `flash-halogen`:
  - `Sugerencias de prompt: activadas con halo/flash-halogen` (la heurística prefiere el nombre barato).
  - `[dry-run] enabledModels de pi: ["*"] (no estaba puesto)`
  - `[dry-run] <HOME>/.pi/agent/supi/config.json: promptSuggestions.model = halo/flash-halogen`
  - `[dry-run] pi install npm:@mrclrchtr/supi-prompt-suggestions@11.0.1`
  - `ls $HOME/.pi`: no existe, es decir el dry-run no escribió nada.
- `HOME=<temp> bin/bond setup --yes --no-suggestions --dry-run`: `Sugerencias de prompt: desactivadas (--no-suggestions)`, sin línea de `enabledModels` ni de `pi install`.

Criterios de aceptación cubiertos: 1 (instalación con el pin y modelo resuelto), 2 (`--no-suggestions` escribe `disabled` y no instala), 3 (`--dry-run` sin escrituras), 4 (sin pi en los agentes no se entra en el paso), 5 (claves ajenas del config de supi conservadas, probado con `otherPackage`), 6 (`enabledModels` no se pisa si ya tenía lista), 7 (fallo de instalación no cortante: nota y config escrito), 8 (orden free → nombre barato → primero; sin nada, propuesto apagado).

Pendiente de revisión por el usuario. Commit de P1: `5fe7a64` en `main` (mensaje 1 elegido por el usuario).

### Evidencia de P2

Ficheros: `cli/doctor.mts` (fila `sugerencias`, `suggestionsCheck`, `checkSuggestions`, `DOCTOR_HELP`), `cli/suggestions.mts` (helpers `readSupiModel`, `enabledModelsCover`, `otherEditorExtensions`), `test/doctor-suggestions.test.mts` (nuevo), `test/suggestions.test.mts` (nuevas lecturas), `docs/reference.md`, `CHANGELOG.md`.

Comandos y resultado real (2026-10-23, `/home/jose/gitrepos/bond`):

- `npm run typecheck`: sin errores.
- `bun test`: 157 pass, 0 fail, 476 expect() en 11 ficheros (P1 dejó 139; +18).
- `bun run cli/main.mts doctor --quick` en esta máquina: `! sugerencias  halo/flash-halogen · paquete no instalado · enabledModels: todos  → bond setup` (cierto: la extensión se había probado con `-e`, nunca instalada).
- Instalación real aislada (`HOME` temporal, proveedor `free` con `big-model` + `flash-halogen`, `setup --yes`):
  - `~/.pi/agent/settings.json` quedó con `enabledModels: ["*"]` y `packages: ["npm:@mrclrchtr/supi-prompt-suggestions@11.0.1"]`.
  - `~/.pi/agent/supi/config.json`: `{ "promptSuggestions": { "model": "halo/flash-halogen" } }`.
  - `bond doctor --quick` después: `✓ sugerencias  halo/flash-halogen · paquete instalado · enabledModels: todos`.
- Repetir `setup --yes` con un config de supi que tenía `otroPaquete` y un campo extra dentro de `promptSuggestions`: se conservan ambos, solo cambia `model`; `enabledModels` no se reescribe y el paquete no se vuelve a instalar (avisos «ya estaba puesto» / «ya estaba declarado»). Sin duplicados en `packages`.
- `bond doctor --help` y `bond setup --help` reflejan la fila y el flag nuevos.

Criterios de P2: 1 (fila `ok` con todo coherente, probado en la instalación real), 2 (avisos por paquete ausente, config desajustado, `enabledModels` sin poner o sin cubrir el modelo y otra extensión de editor), 3 (`fix` en cada caso no OK: `bond setup` o `bond models init`), 4 (ayuda, referencia y changelog actualizados).

Limitación registrada: la detección de otras extensiones que reemplazan el editor es mejor esfuerzo sobre `~/.pi/agent/extensions`; los paquetes npm de terceros no se inspeccionan (documentado en `docs/reference.md`).

El `1 fallo(s)` que muestra `bond doctor` en esta máquina es `Bond Extensions: ~/.bond/pi apunta a otra versión de bond`, previo a esta fase y ajeno a ella (se ejecuta desde el código).
