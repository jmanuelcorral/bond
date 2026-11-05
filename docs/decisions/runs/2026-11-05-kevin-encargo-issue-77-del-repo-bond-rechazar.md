---
agent: "kevin"
kind: "agy"
branch: "team/issue-77-providers-form"
base: "main@06092eb"
orchestrator: "pi"
started_at: "2026-11-05T09:55:50Z"
finished_at: "2026-11-05T10:17:01Z"
status: "reported"
commits:
  - "78a2db7 fix(config): reject [[providers]] and numeric table keys in config.toml"
decisions: []
---

## Request

**2026-11-05T09:55:50Z**

Encargo: issue #77 del repo bond — rechazar la forma `[[providers]]` en config.toml.

Estás en el worktree de TU RAMA del repo `bond` (CLI en TypeScript en `cli/`, sin paso de
compilación; pruebas con `bun test`; tipos con `npm run typecheck`). Trabaja solo en esta rama.

## El bug (issue #77)

`cli/config.mts`, en `loadConfig()`:

```ts
for (const [id, value] of Object.entries((raw.providers ?? {}) as Record<string, Record<string, unknown>>)) {
	if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) die(`proveedor '${id}': usa minúsculas, dígitos, - o _`);
```

Si el usuario escribe los proveedores como array de tablas de TOML (`[[providers]]`) en vez de
la forma canónica (tabla indexada por id: `[providers.halo]`), `Object.entries()` sobre un array
devuelve los **índices como claves** (`"0"`, `"1"`), el regex acepta `"0"`, y bond se crea un
proveedor llamado `0` descartando el `id` que escribió el usuario. Consecuencia real: la clave se
pasa a buscar en `~/.bond/keys/0` (la del usuario está en `~/.bond/keys/halo`) y la autenticación
falla con un mensaje que no explica nada.

Repro (no toques tu HOME real ni la del usuario; usa un directorio temporal SIEMPRE):

```bash
T=$(mktemp -d) && mkdir -p $T/home/.bond
printf 'agents = ["pi"]\n\n[[providers]]\nid = "halo"\nbase_url = "http://127.0.0.1:18080/v1"\n[[providers.halo.models]]\nid = "m1"\n' > $T/home/.bond/config.toml
HOME=$T/home BOND_HOME=$T/home/.bond bin/bond models list
# sale "0  http://127.0.0.1:18080/v1"  <- el id "halo" se ha perdido
```

## Qué hay que hacer

1. **Detectar la forma array en `loadConfig()`** (que `raw.providers` sea `Array.isArray`) y
   `die()` con un mensaje claro en español, en el estilo de los `die()` ya existentes en el
   fichero (mensajes en durísimo español, no claves i18n: mira los de al lado y sé consistente).
   El mensaje debe decir: que la forma `[[providers]]` no es la que espera bond, cuál es la
   canónica (`[providers.<id>]` con sus `[[providers.<id>.models]]`), y cómo migrar una entrada
   de ejemplo. Algo en esta línea:

   ```
   proveedores en la forma [[providers]]: bond espera una tabla por proveedor, [providers.halo]
     cambia:
       [[providers]]
       id = "halo"
     por:
       [providers.halo]
       base_url = "https://..."
   ```

2. **Nunca producir ids de índice.** Con el chequeo del punto 1 basta, pero comprueba que no queda
   otra ruta (por ejemplo `providers` como tabla con claves numéricas: `[providers.0]`): si el id
   es un número puro, debe fallar también con el mismo mensaje de forma canónica, no aceptarse.

3. **Lo que bond escribe por sí mismo no debe romperse.** `bond models init` genera la forma
   canónica con `[[providers.<id>.models]]` (ver `cli/config.mts` en torno a las líneas 275 y 341).
   Compruébalo ejecutándolo con HOME temporal y verificando que sigue funcionando tras tu cambio.

4. **Comportamiento vecino que debes comprobar y reportar (no lo cambies sin decirlo):** en la forma
   canónica, un `id` escrito dentro de la tabla (`[providers.halo]` con `id = "otro"`) se pisa en
   silencio con la clave (`{ ...value, id, ... }`). Di qué hace hoy y qué propones (avisar, o
   ignorarlo); no lo arregles en este encargo salvo que sea trivial y lo menciones en el informe.

## Ficheros

- Toca: `cli/config.mts`, y las pruebas que correspondan (busca dónde se prueban `loadConfig`
  y `bond models init` en `test/` y añade ahí; si no hay sitio, crea un fichero de test siguiendo
  el estilo de los existentes).
- No toques: `docs/decisions/` (la memoria de decisiones es del orquestador), `package.json`,
  `.github/workflows/` (otro agente trabaja en la parte de npm), `cli/assets.gen.mts`, `dist/`,
  `packaging/`.
- `CHANGELOG.md`: añade tu entrada bajo `## Sin publicar` (en español, estilo del fichero).
- Si cambia ayuda de algún comando, actualiza `docs/reference.md` y `docs/en/reference.md`.
  En este caso probablemente no cambie ninguna ayuda: solo el mensaje de error.

## Verificación (hazla y pon el resultado en el informe)

1. `npm run typecheck` limpio.
2. `bun test` de la suite COMPLETA (no solo tu fichero): pasa todo.
3. Repro manual con HOME temporal: la forma `[[providers]]` da el error nuevo con la forma
   canónica en el mensaje; la forma canónica (`[providers.halo]`) sigue funcionando normal.
4. `bond models init` con HOME temporal sigue escribiendo la forma canónica y `models list`
   la lee sin error.

## Al terminar

Haz **commit en tu rama** con mensaje en inglés (conventional commits, línea inicial < 72 chars,
cuerpo explicando el qué y el por qué). **NO hagas push.** No merges ni rebase.

En tu último mensaje del panel escribe un informe: qué has cambiado (ficheros), qué has
verificado con el resultado literal de los comandos, qué has encontrado del punto 4, y cualquier
ruido o test inestable que hayas visto.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

---

**2026-11-05T10:09:46Z**

Revisión de tu commit f9ee655: va bien, la forma [[providers]] y [providers.0] fallan con el mensaje canónico, la forma canónica funciona y la suite completa pasa (641 pass / 0 fail, comprobado por mi en tu worktree). Falta un cabo: 'providers = []' (array vacio inline) ahora tambien muere con el mensaje de migracion de [[providers]], que para un array vacio no tiene sentido: no hay nada que migrar. He comprobado el historial del repo y bond nunca escribe esa forma, asi que solo la encontraria alguien escrita a mano; aun asi, un config con 'providers = []' es inofensivo (cero proveedores) y hoy falla con una sugerencia que no aplica.

Cambio pequeno: que el chequeo solo falle con array NO vacio, p.ej. 'if (Array.isArray(raw.providers) && raw.providers.length) die(CANONICAL_PROVIDERS_MSG)'. Un array vacio se trata como 'sin proveedores' y 'models list' responde normal. Mantén estricto todo lo demas ([providers.0], [[providers]] con entradas, etc.).

Anade un test que cubra 'providers = []' -> sale normal, sin error (y que 'bond models list' no liste proveedores). Vuelve a pasar 'npm run typecheck' y 'bun test' completo, y haz commit en tu rama (mensaje en ingles, sin push). Puedes enmendar tu commit anterior o anadir uno nuevo, lo que veas mas limpio.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report

Se ha enmendado el commit anterior con el ajuste para permitir arrays vacíos.

### Ficheros actualizados

- [cli/config.mts](file:///home/jose/.herdr/worktrees/bond-d201149/team-issue-77-providers-form/cli/config.mts#L133): `if (Array.isArray(raw.providers) && raw.providers.length) die(CANONICAL_PROVIDERS_MSG);`. Si `providers = []` está vacío se acepta como configuración sin proveedores; si tiene elementos (`[[providers]]`), falla con el mensaje canónico.
- [test/models.test.mts](file:///home/jose/.herdr/worktrees/bond-d201149/team-issue-77-providers-form/test/models.test.mts#L508-L521): prueba añadida que verifica que `providers = []` no lanza error y `bond models list` responde indicando que no hay proveedores.
- [CHANGELOG.md](file:///home/jose/.herdr/worktrees/bond-d201149/team-issue-77-providers-form/CHANGELOG.md): mención expresa de que `providers = []` se acepta sin error.

### Verificación

1. `npm run typecheck`: limpio (código 0).
2. `bun test` de la suite completa:
   ```text
   $ NO_COLOR=1 BOND_ICONS=emoji bun test
    642 pass
    0 fail
    4002 expect() calls
   Ran 642 tests across 34 files. [83.68s]
   ```
3. Comprobación manual de `providers = []`:
   ```bash
   $ HOME=$T/home BOND_HOME=$T/home/.bond bin/bond models list
   Sin proveedores. Edita /tmp/.../config.toml (bond models init crea uno de ejemplo).
   (código de salida: 0)
   ```

### Commit

Enmendado en la rama `team/issue-77-providers-form`:
`78a2db7 fix(config): reject [[providers]] and numeric table keys in config.toml` (sin push).
