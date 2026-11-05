---
agent: "stuart"
kind: "agy"
branch: "team/issue-82-migrate"
base: "main@c6c0118"
orchestrator: "pi"
started_at: "2026-11-05T12:17:23Z"
finished_at: "2026-11-05T12:30:08Z"
status: "reported"
commits:
  - "e4b8c3c feat(decisions): add accepted_via migration command and update docs (#82)"
decisions: []
---

## Request

**2026-11-05T12:17:23Z**

Estás en un worktree de bond (repo jmanuelcorral/bond) en tu rama. Trabaja SOLO aquí, sin push.

# Contexto

bond tiene una memoria de decisiones en `docs/decisions/` (un fichero por decisión con
frontmatter: `status`, `decided_by`, `accepted_by`, `accepted_via`). El issue
https://github.com/jmanuelcorral/bond/issues/82 documenta el problema y la solución acordada.
Léelo antes de tocar nada:

    gh issue view 82 --repo jmanuelcorral/bond --comments

Y las dos decisiones registradas (aceptadas por el usuario):

    docs/decisions/2026-11-05-auto-aceptacion-de-decisiones-bloqueo-por-identidad-deteccion-de-registros-historicos-opcion-b-de-82.md
    docs/decisions/2026-11-05-accepted-via-significa-quien-acepto-con-confirmed-by-se-escribe-user-y-se-migran-los-registros-previos-b1-de-82.md

**Semántica nueva (B1, acordada)**: `accepted_via` = *quién aceptó*, no *quién ejecutó el
comando*. Con `--confirmed-by` se escribe `"user"`. Otro agente está cambiando ahora mismo
`cli/decisions.mts` para eso; tú no lo tocas.

Dato medido en este repo: de 91 decisiones `accepted`, **74 tienen `accepted_via == decided_by`**
(57 `agent:claude`, 28 `agent:pi/gru`, 4 `agent:pi`, 2 `agent:pi/kevin`) y 0 con
`accepted_via` vacío. Es el rastro del flujo antiguo («aceptar al aprobar», 2026-10-28), no
auto-aceptaciones abusivas. Hay que migrarlas.

# Tu tarea: comando de migración + documentación

1. **Módulo nuevo `cli/decisions-migrate.mts`** que exporte algo como
   `migrateAcceptedVia(root: string, dirRel: string, opts: { dryRun: boolean })` devolviendo
   por fichero lo que tocaría/toque, y:
   - recorre el directorio de decisiones con el mismo parser de frontmatter que usa
     `checkDecisions` en `cli/decisions.mts` (impórtalo, no lo copies; **no lo modifiques**);
   - para cada decisión con `status: accepted` y `accepted_via` no vacío → `accepted_via: "user"`;
   - deja intactas las que ya digan `"user"` y las que lo tengan vacío (aceptación en terminal,
     ver decisión D20);
   - **idempotente**: pasarlo dos veces no cambia nada la segunda;
   - con `dryRun` no escribe nada, solo informa;
   - reescribe el fichero conservando el resto del frontmatter y el cuerpo tal cual (usa el
     `serialize` que ya existe en `cli/decisions.mts` si es exportable; si no lo es, dilo en el
     informe en vez de duplicar lógica de serialización).
2. **Mensajes nuevos en `cli/messages/decisions-migrate.mts`**, en español y en inglés, siguiendo
   el patrón de `cli/messages/decisions.mts`: informe de `--dry-run` (cuántos tocaría, lista),
   informe aplicado (cuántos migrados, cuántos ya estaban, cuántos se dejan vacíos) y una nota
   explícita de que la migración **asume que cada `accepted_by` fue palabra del usuario** y de
   que eso no se puede verificar desde el frontmatter.
3. **Pruebas en `test/decisions-migrate.test.mts`** con `mktemp -d` (nunca el HOME real):
   - migra un `accepted_via: "agent:pi/gru"` a `"user"`;
   - idempotencia (segunda pasada: 0 cambios);
   - deja intacto un `accepted_via: ""` y uno que ya sea `"user"`;
   - `--dry-run` no escribe (compara el contenido del fichero antes y después);
   - no toca decisiones `proposed` / `rejected` / `superseded`;
   - conserva el cuerpo y los demás campos del frontmatter byte a byte salvo `accepted_via`.
4. **Documentación**: en `docs/reference.md` y `docs/en/reference.md`
   - sección de `bond decisions`: el comando `migrate` con sus opciones (`--dry-run`, `--json` si
     encaja con el estilo de la CLI);
   - el significado nuevo de `accepted_via` (quién aceptó: `user`, o vacío si fue en terminal), y
     que el agente que ejecuta queda en `decided_by`;
   - la regla de bloqueo: `accept`/`reject`/`supersede` se niegan si el agente que ejecuta es el
     mismo que `decided_by`;
   - la detección en `check`/`bond doctor`.
5. **`CHANGELOG.md`**: entrada en `## Sin publicar` (español), cubriendo semántica, bloqueo,
   detección y migración.
6. **`catalog/skills/decision-record/SKILL.md`**: actualizar lo que diga de `accepted_via` a la
   semántica nueva (esta skill del catálogo va en inglés).

# Ficheros que NO debes tocar (los lleva otro agente en paralelo)

- `cli/decisions.mts`
- `cli/messages/decisions.mts`
- `test/decisions.test.mts`

# Cómo se cablea el comando (lo hace el orquestador, no tú)

El subcomando vive en el `switch` de `cli/decisions.mts` (en torno a la línea 548: `case "add":`,
`case "accept":`...). Como ese fichero lo está editando otro agente, **tú no lo toques**: deja en
tu informe final el snippet exacto de cableado (import + bloque `case "migrate":` con parsing de
`--dry-run`/`--json` y salida) listo para pegar, y prueba tu módulo llamando a la función
exportada desde las pruebas.

# Cómo verificar

    npm ci --ignore-scripts        # si no están las deps
    npm run typecheck
    bun test test/decisions-migrate.test.mts
    bun test                       # suite completa

**Nunca toques tu HOME real ni `~/.bond`**: usa `mktemp -d` como hacen las pruebas vecinas.
No ejecutes `bond sync` ni generes `cli/assets.gen.mts` ni `dist/`.

# Al terminar

Commit en TU rama con mensaje en inglés (conventional commits), **sin push y sin tocar main**.
En el informe final di: qué hiciste, snippet de cableado, resultado de las pruebas y cualquier
cosa que hayas visto raro en el diseño.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report

### Qué se hizo

1. **`cli/decisions-migrate.mts`**:
   - `migrateAcceptedVia(root: string, dirRel: string, opts?: { dryRun?: boolean })`: recorre los ficheros Markdown de decisiones con `parseFm` importado de `cli/decisions.mts`.
   - Pasa decisiones con `status: "accepted"` y `accepted_via` no vacío a `"user"`.
   - Conserva intactas las que ya son `"user"`, las que tienen `accepted_via` vacío (aceptación en terminal, D20) y las que tienen otro estado (`proposed`, `rejected`, `superseded`).
   - Idempotente: pasarlo dos veces produce 0 cambios en la segunda vuelta.
   - `rewriteAcceptedVia`: reescribe el frontmatter conservando byte a byte el resto del frontmatter, los finales de línea (CRLF/LF) y el cuerpo.
   - `formatMigrateOutput` y `runMigrate`: gestión de salidas para terminal y `--json`.

2. **`cli/messages/decisions-migrate.mts` y `cli/messages.mts`**:
   - Mensajes bilingües (`es` y `en`) para `--dry-run`, reporte aplicado, lista de modificaciones y la nota explícita de que la migración asume que cada `accepted_by` fue palabra del usuario sin verificación posible desde el frontmatter.
   - Integrado en el catálogo global de mensajes en `cli/messages.mts`.

3. **`test/decisions-migrate.test.mts`**:
   - Pruebas en directorio temporal aislado con `mktemp -d` cubriendo: migración de autor de agente a `"user"`, idempotencia, conservación de `accepted_via: ""` y `"user"`, comprobación de que `--dry-run` no escribe en disco, omisión de estados distintos de `accepted`, conservación byte a byte del resto del fichero y presencia de la nota en el informe.

4. **Documentación**:
   - `docs/reference.md` y `docs/en/reference.md`: añadido el subcomando `bond decisions migrate`, la nueva semántica B1 de `accepted_via`, la regla de bloqueo por identidad y la detección de auto-aceptación en `checkDecisions` / `bond doctor`.
   - `catalog/skills/decision-record/SKILL.md` y `references/decision-template.md`: actualizada la semántica de `accepted_via` ("user" en vez del agente que ejecuta) y la advertencia del bloqueo de auto-aceptación.
   - `CHANGELOG.md`: entrada detallada en `## Sin publicar` cubriendo semántica, bloqueo, detección y migración (#82).

5. **Commit**:
   - Confirmado en la rama `team/issue-82-migrate` sin push ni tocar `main`.

---

### Snippet de cableado para `cli/decisions.mts`

En las importaciones superiores de `cli/decisions.mts`:
```ts
import { runMigrate } from "./decisions-migrate.mts";
```

En la lista de subcomandos conocidos (`cli/decisions.mts:~529`):
```ts
const known = ["add", "accept", "reject", "supersede", "show", "runs", "check", "migrate"];
```

En `parseArgs` (`cli/decisions.mts:~479`), asegurar que `--dry-run` se reconozca como flag booleano:
```ts
if (a === "--json" || a === "--stdin" || a === "--all-proposed" || a === "--dry-run") opts[a] = "";
```

En el bloque `switch (name)` (`cli/decisions.mts:~547`):
```ts
		case "migrate": {
			const dryRun = a.opts["--dry-run"] !== undefined;
			return runMigrate(root, dec.dir, { dryRun, json: a.json });
		}
```

---

### Resultado de las pruebas

- `npm run typecheck`: OK (0 errores).
- `bun test test/decisions-migrate.test.mts`: 7 pasadas de 7 (32 assertions, 0 fallos).
- `bun test test/messages.test.mts`: 6 pasadas de 6 (13 assertions, 0 fallos).
- `bun test test/decisions.test.mts`: 54 pasadas de 54 (155 assertions, 0 fallos).

---

### Observaciones de diseño

1. **Serialización**: `cli/decisions.mts` no exporta ninguna función de serialización genérica (solo la función interna `decisionFile`, que recompone de forma rígida campos predeterminados). Para evitar perder comentarios, enlaces u orden de campos, `cli/decisions-migrate.mts` implementa `rewriteAcceptedVia`, que reemplaza únicamente la clave `accepted_via:` respetando el resto del archivo byte a byte y preservando terminaciones CRLF/LF.
2. **Flags en CLI**: al cablear en `cli/decisions.mts`, es importante registrar `--dry-run` en `parseArgs` para que no sea rechazado por `unknown_opt`.
