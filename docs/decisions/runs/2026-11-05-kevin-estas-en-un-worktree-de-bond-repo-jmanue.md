---
agent: "kevin"
kind: "agy"
branch: "team/issue-82-accepted-via"
base: "main@c6c0118"
orchestrator: "pi"
started_at: "2026-11-05T12:17:17Z"
finished_at: "2026-11-05T12:30:43Z"
status: "reported"
commits:
  - "935a132 fix(decisions): block identity self-acceptance and set accepted_via user"
decisions: []
---

## Request

**2026-11-05T12:17:17Z**

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

El problema: un agente delegado registró una decisión y se la aceptó él mismo con
`bond decisions accept --confirmed-by` citando texto del encargo, no palabras del usuario.
Quedó `decided_by == accepted_via` y nada lo detectó.

# Tu tarea: semántica de `accepted_via`, bloqueo y detección

**Significado nuevo**: `accepted_via` = *quién aceptó*, no *quién ejecutó el comando*. Se
escribe literalmente `"user"`. El agente que teclea ya queda en `decided_by` y en el trailer
`Agent:` del commit.

En `cli/decisions.mts`:

1. **`addDecision`** (en torno a la línea 226, hoy `accepted_via: confirmed ? decided_by : ""`):
   con `--confirmed-by` debe escribir `accepted_via: "user"`.
2. **`accept --confirmed-by`** (en torno a la línea 347, hoy `patch.accepted_via = resolveAuthor()`):
   debe escribir `accepted_via: "user"`.
3. **Bloqueo por identidad** en `accept`, `reject` y `supersede`: si la identidad que devuelve
   `resolveAuthor()` coincide con el `decided_by` de la decisión, la orden **falla sin tocar el
   fichero**. El mensaje dice quién la registró y que solo el usuario puede aceptarla (o que la
   registre ya aceptada con `add --confirmed-by`). `decided_by: "user"` nunca coincide, así que
   no se ve afectado. El bloqueo va antes de `patchDecision`.
4. **Detección** en `checkDecisions`: una decisión con `status: accepted`, `accepted_via` no
   vacío y `accepted_via === decided_by` es un **error** de check, con su propio mensaje. Al ser
   un error de check ya sube solo a la fila de decisiones de `bond doctor`: no toques
   `decisionsDoctor`.

Mensajes: en `cli/messages/decisions.mts`, en español y en inglés (el catálogo va duplicado por
idioma, sigue el patrón de las claves vecinas, p. ej. `decisions.check_bad_accepted_via`).

# Ficheros que son tuyos

- `cli/decisions.mts`
- `cli/messages/decisions.mts`
- `test/decisions.test.mts`

# Ficheros que NO debes tocar (los lleva otro agente en paralelo)

- `CHANGELOG.md`, `docs/**`, `catalog/**`
- `cli/decisions-migrate.mts`, `cli/messages/decisions-migrate.mts`, `test/decisions-migrate.test.mts`
- Los ~91 registros ya existentes de `docs/decisions/`: la migración es de otro.

# Pruebas que tienen que salir en `test/decisions.test.mts`

- `add --confirmed-by "..."` deja `accepted_via: "user"`.
- `accept --confirmed-by "..."` deja `accepted_via: "user"`.
- `accept` desde el mismo agente que `decided_by` falla y el fichero queda intacto (compara el
  contenido antes y después).
- `reject` y `supersede` con la misma coincidencia también fallan.
- `decided_by: "user"` se acepta normal desde un agente con `--confirmed-by`.
- `checkDecisions` marca una decisión `accepted` con `decided_by == accepted_via` y no marca una
  con `accepted_via: "user"` y `decided_by: "agent:..."`.

# Cómo verificar

    npm ci --ignore-scripts        # si no están las deps
    npm run typecheck
    bun test

Todo tiene que pasar. **Nunca toques tu HOME real ni `~/.bond`**: para lo que necesites un HOME
o una config, usa `mktemp -d` y variables de entorno, como hacen las pruebas vecinas.

# Al terminar

Commit en TU rama con mensaje en inglés (conventional commits), **sin push y sin tocar main**.
En el informe final di: qué cambiaste, qué pruebas añadiste, resultado de `typecheck` y
`bun test`, y cualquier duda sobre el diseño que hayas detectado.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report

### Cambios realizados

1. [`addDecision`](file:///home/jose/.herdr/worktrees/bond-d201149/team-issue-82-accepted-via/cli/decisions.mts#L226): con `--confirmed-by` escribe `accepted_via: "user"` en vez de `decided_by`.
2. [`changeStatus`](file:///home/jose/.herdr/worktrees/bond-d201149/team-issue-82-accepted-via/cli/decisions.mts#L338-L352):
   - Bloqueo por identidad en `accept`, `reject` y `supersede`: si `resolveAuthor()` no es `"user"` y coincide con `decided_by`, muestra error informando de quién la registró y que solo el usuario puede aceptarla/rechazarla/sustituirla, y continúa sin tocar el fichero.
   - Con `--confirmed-by` escribe `accepted_via: "user"` en lugar de `resolveAuthor()`.
3. [`checkDecisions`](file:///home/jose/.herdr/worktrees/bond-d201149/team-issue-82-accepted-via/cli/decisions.mts#L435-L437): audita registros con `status === "accepted"`, `accepted_via` presente, `accepted_via !== "user"` y `accepted_via === decided_by`, reportando error `decisions.check_same_accepted_via`.
4. [cli/messages/decisions.mts](file:///home/jose/.herdr/worktrees/bond-d201149/team-issue-82-accepted-via/cli/messages/decisions.mts): añadidas las claves `decisions.err_same_author` y `decisions.check_same_accepted_via` en español e inglés.

### Pruebas añadidas

En [test/decisions.test.mts](file:///home/jose/.herdr/worktrees/bond-d201149/team-issue-82-accepted-via/test/decisions.test.mts):
- `add --confirmed-by` ejecutado por un agente deja `accepted_via: "user"`.
- `decided_by: "user"` se acepta normal desde un agente con `--confirmed-by` dejando `accepted_via: "user"`.
- `accept` desde el mismo agente que `decided_by` falla con código de error, muestra mensaje y deja el fichero intacto (comparado antes y después).
- `reject` y `supersede` con el mismo agente que `decided_by` también fallan y dejan los ficheros intactos.
- `checkDecisions` marca error en auto-aceptación histórica (`decided_by == accepted_via` con agente) y no marca una decisión con `decided_by: "agent:..."` y `accepted_via: "user"`.
- Actualizada la prueba existente de override en `accept` para validar la nueva semántica `accepted_via: "user"`.

### Resultado de verificación

- `npm run typecheck`: OK (0 errores).
- `bun test test/decisions.test.mts`: 59 pasados, 0 fallos.
- `bun test` global: 644 pasados, 3 fallos preexistentes ajenos en `test/team.test.mts` (ancho visual de emojis de `renderWatch`).

### Dudas sobre el diseño detectadas

- Al bloquear en `reject` y `supersede`, el mensaje incluye `(o regístrala ya aceptada con add --confirmed-by)`, lo cual tiene sentido principalmente para decisiones en flujo de propuesta/aceptación. En `reject` y `supersede` se mantiene la misma formulación parametrizada por verbo para coherencia.
- La condición de detección en [`checkDecisions`](file:///home/jose/.herdr/worktrees/bond-d201149/team-issue-82-accepted-via/cli/decisions.mts#L435) excluye explícitamente `accepted_via === "user"` para que decisiones registradas por el usuario (`decided_by: "user"`) y aprobadas por el usuario (`accepted_via: "user"`) no computen falsos positivos.
