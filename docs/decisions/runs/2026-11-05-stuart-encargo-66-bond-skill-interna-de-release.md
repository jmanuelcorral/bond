---
agent: "stuart"
kind: "pi"
branch: "team/issue-66-release-skill"
base: "main@06092eb"
orchestrator: "pi"
started_at: "2026-11-05T10:05:15Z"
finished_at: "2026-11-05T10:29:11Z"
status: "reported"
commits:
  - "d408ca7 feat(catalog): add release-bond skill and npm publish to release.yml"
decisions:
  - "2026-11-05-release-bond-la-skill-de-release-de-bond-va-en-el-catalogo-con-default-false"
  - "2026-11-05-la-publicacion-en-npm-va-en-release-yml-publica-el-tarball-de-la-release-y-fija-registry-npmjs-org"
---

## Request

**2026-11-05T10:05:15Z**

Encargo #66 (bond) — skill interna de release + preparar la publicación en npm.

Estás en el worktree de TU RAMA del repo `bond` (CLI en TypeScript en `cli/`, sin paso de
compilación; `npm run typecheck` para tipos, `bun test` para pruebas). Trabaja solo en esta rama y
**NO hagas push, merge ni rebase**.

Lee antes de tocar nada: `AGENTS.md` (sección de release), `CHANGELOG.md` (convención de
`## Sin publicar`), `catalog/catalog.toml`, alguna skill existente de `catalog/skills/` para el
estilo, `scripts/packaging.mts`, `.github/workflows/release.yml` y `.github/workflows/brew.yml`.

Son dos partes. Haz A primero; B es corta y depende de lo que aprendas en A.

## A. Skill interna de release (el núcleo de #66)

El procedimiento real de publicar bond son 4 pasos con dependencias entre ellos, y uno toca **otro
repo**. Hoy solo está escrito en prose en `AGENTS.md`. Hay que convertirlo en una skill del catálogo
que un agente pueda seguir sin equivocarse, con sus comprobaciones.

Los 4 pasos, tal como se ejecutaron en 1.12.0:

| Paso | Operación | Depende de |
|---|---|---|
| 1 | `npm version X.Y.Z --no-git-tag-version` (mueve `package.json` y `package-lock.json`), pasar `## Sin publicar` a `## X.Y.Z` con resumen, commit `Release X.Y.Z`, tag anotado `vX.Y.Z` con mensaje `bond X.Y.Z` | — |
| 2 | push `main` + push tag → `release.yml` compila 3 plataformas, genera el `.tgz` de npm y `SHA256SUMS`, y crea la release | 1 |
| 3 | `bun scripts/packaging.mts` → commit `Regenerate packaging for X.Y.Z` + push | **el 2 tiene que haber terminado** |
| 4 | copiar `packaging/homebrew/bond.rb` al tap **`jmanuelcorral/homebrew-tap`** (otro repo) + push + lanzar `brew.yml` | 3 |

La skill debe dejar explícitas las comprobaciones que evitan los errores caros:

- **Nunca correr `packaging.mts` antes de que `release.yml` haya terminado**: lee los artefactos de
  la release publicada, y si no están sale con hashes vacíos o erróneos. Di cómo comprobarlo con `gh`
  antes de lanzarlo.
- **El tag debe coincidir con `package.json`** (`release.yml` lo comprueba; la skill lo pre-comprueba
  para no descubrirlo en CI).
- **Verificar `SHA256SUMS`** contra lo descargado tras la release.
- **El tap es otro repo**: hace falta una copia local suya; nunca `--force` allí, y comprobar que la
  versión y los hashes del `.rb` coinciden con la release.
- **Qué hacer cuando algo falla a mitad** (release creada pero packaging mal, tap desactualizado...).

Nómbrala siguiendo las convenciones del catálogo (mira los nombres que hay). Regístrala en
`catalog/catalog.toml` con su `summary` y decide si es `default = false` (es una skill de
mantenedor, no de cualquier repo que init bond) — justifica la decisión en tu informe.

**Las skills del catálogo van en inglés** (así están las demás); el resto del repo, en español.

## B. Preparar la publicación en npm (SIN publicar)

Estado actual, comprobado antes de darte este encargo:

- `scripts/build.mts` ya genera `dist/npm/package.json` con `name: "@jmanuelcorral/bond"`,
  `bin: { bond: "bin/bond.mjs" }`, `engines: { node: ">=22" }` y `files: ["bond.mjs", "bin"]`.
- `release.yml` ya hace `npm pack` en `dist/npm` y sube el `.tgz` a la release.
- El `package.json` de la raíz es `"name": "bond"` con `"private": true`. **No lo renombres**: el
  paquete público es el que se genera en `dist/npm`, no el de la raíz.
- `npm whoami` en esta máquina → `ENEEDAUTH`: no hay sesión, así que **nadie publica aquí**.

Qué hay que hacer:

1. Añadir a `.github/workflows/release.yml` un paso de publicación **después** de crear la release,
   condicionado a que exista el secret `NPM_TOKEN` (si no existe, se salta con un mensaje claro, de
   forma que las releases sigan funcionando igual que hoy sin ese secret).
2. Publicar **el mismo `.tgz`** que se adjunta a la release, no un `npm pack` nuevo: lo que se
   publica debe ser byte a byte lo que se distribuye.
3. `--access public` (es un paquete scoped). Valora `--provenance` (trusted publishing por OIDC de
   GitHub): si requiere configuración previa en npm que no podemos hacer ahora, **no lo añadas** y
   déjalo anotado en la skill como seguimiento con el motivo.
4. **No ejecutes `npm publish` de verdad.** Verifica con `npm publish --dry-run` sobre el tarball
   construido en local (construye sin `--no-npm`). Si el dry-run pidiera autenticación, dilo en el
   informe y quédate en `npm pack` + inspección del contenido.
5. En la skill, deja escrito lo que hay que hacer **después de la primera publicación real**: cambiar
   los mensajes que hoy dicen que el paquete no está publicado — `cli/messages/update.mts`
   (`update.manual_npm`, en español e inglés) y `docs/reference.md` / `docs/en/reference.md`
   (en torno a la línea 1291). No cambies esos mensajes ahora: serían mentira hasta que exista la
   publicación.

## Verificación (hazla y pon el resultado literal en el informe)

1. `npm run typecheck` limpio.
2. `bun test` de la suite **completa**.
3. `release.yml`: si tienes `actionlint`, pásalo; si no, comprueba al menos que el YAML parsea y
   pega el diff del workflow en el informe.
4. Construye el paquete de npm en local y `npm publish --dry-run` (o `npm pack` + `tar -tzf` si el
   dry-run pide auth). No imprimas tokens ni configures credenciales reales.
5. Si la skill nueva se instala con `bond init` / `bond sync`, compruébalo en un **directorio
   temporal** (no en este repo) y reporta que el catálogo valida bien.

## No toques

- `cli/config.mts` — otro agente está arreglando #77 ahí.
- `cli/assets.gen.mts`, `dist/`, `packaging/` — generados.
- `docs/decisions/` — la memoria de decisiones la lleva el orquestador.
- `CHANGELOG.md`: añade tu entrada bajo `## Sin publicar` (en español). Es previsible un conflicto
  trivial con la otra rama al integrar: se resuelve conservando las dos entradas.

## Al terminar

Commit en tu rama, mensaje en inglés (conventional commits, línea inicial < 72 chars, cuerpo con el
qué y el por qué). **Sin push.**

En tu último mensaje del panel, informe: ficheros tocados, verificación con salida literal, y las
decisiones que hayas tomado (nombre de la skill, `default` sí/no y por qué, provenance sí/no y por
qué).

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report

Commit `d408ca7` en `team/issue-66-release-skill`. Sin push.

## Ficheros

- `catalog/skills/release-bond/SKILL.md` (nuevo) — la skill, en inglés.
- `catalog/catalog.toml` — entrada `[skills.release-bond]` con `default = false`.
- `.github/workflows/release.yml` — dos pasos nuevos tras crear la release + comentario de cabecera.
- `CHANGELOG.md` — dos entradas bajo `## Sin publicar` (skill y publicación npm).
- `docs/decisions/2026-11-05-*.md` — dos decisiones registradas con bond (una `proposed`, la de npm `accepted` con tus palabras).

No toqué `cli/config.mts`, `cli/assets.gen.mts`, `dist/`, `packaging/` ni los mensajes de "aún no publicado".

## Verificación (salida literal)

**1. `npm run typecheck`** — limpio (exit 0):
```
npm notice run bond@1.12.0 typecheck
npm notice run tsc -p .
```

**2. `bun test`** — suite completa:
```
 635 pass
 0 fail
 3979 expect() calls
Ran 635 tests across 34 files. [81.69s]
```
(El build inicial falló por `node_modules` ausente en el worktree; `npm ci --ignore-scripts` → `added 12 packages`.)

**3. `actionlint` 1.7.12** (descargado para la ocasión; sin `shellcheck` en la máquina, así que no revisa el shell embebido):
```
actionlint exit=0
YAML OK 11 steps
```
Diff del workflow:
```diff
@@ -1,6 +1,7 @@
 # Al subir un tag vX.Y.Z: compila bond para todas las plataformas, genera SHA256SUMS y crea la
 # release de GitHub con las notas de esa versión del CHANGELOG. Los instaladores (install.sh,
-# install.ps1) y la fórmula de Homebrew descargan de aquí.
+# install.ps1) y la fórmula de Homebrew descargan de aquí. Si existe el secret NPM_TOKEN, publica
+# además en npm el mismo .tgz que se adjunta a la release; sin él, la release se crea igual.
@@ -45,3 +46,33 @@ jobs:
       - name: Crear la release
         ... gh release create ...
+      # npm: se publica el MISMO .tgz que se adjunta a la release, no un pack nuevo. Sin el
+      # secret NPM_TOKEN la release se crea igual que siempre y este paso no hace nada.
+      # --provenance no va todavía: exige trusted publishing configurado en npm por paquete.
+      - name: ¿Hay NPM_TOKEN?
+        id: npm
+        env:
+          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
+        run: |
+          if [ -n "${NPM_TOKEN:-}" ]; then
+            echo enabled=true >> "$GITHUB_OUTPUT"
+          else
+            echo enabled=false >> "$GITHUB_OUTPUT"
+            echo "Sin el secret NPM_TOKEN: no se publica @jmanuelcorral/bond en npm. La release queda creada igual; añade el secret en Settings -> Secrets and variables -> Actions para publicar." >> "$GITHUB_STEP_SUMMARY"
+          fi
+      - name: Publicar en npm
+        if: steps.npm.outputs.enabled == 'true'
+        env:
+          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
+        run: |
+          # Registry explicito: una config de scope rara (p.ej. el scope apuntando a
+          # npm.pkg.github.com) no debe desviar la publicacion.
+          printf '@jmanuelcorral:registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" > "$HOME/.npmrc"
+          cd "$GITHUB_WORKSPACE/dist"
+          tgz="$(ls ./*.tgz)"
+          [ -f "$tgz" ] || { echo "esperaba un unico .tgz en dist/"; exit 1; }
+          grep -F " $(basename "$tgz")" SHA256SUMS | sha256sum -c -
+          npm publish "$tgz" --access public
+          name="$(jq -r .name npm/package.json)"
+          npm view "$name@$(jq -r .version ../package.json)" version \
+            || echo "::warning::npm todavia no responde por $name; revisa https://www.npmjs.com/package/$name"
```

**4. Paquete construido y dry-run** (`bun scripts/build.mts --targets linux-x64`, `npm pack` en `dist/npm`, `npm publish --dry-run` con `HOME` aislada y token falso, sin credenciales reales):
```
jmanuelcorral-bond-1.12.0.tgz: La suma coincide
npm notice 📦  @jmanuelcorral/bond@1.12.0
npm notice 12.5kB README.md
npm notice 42B bin/bond.mjs
npm notice 1.1MB bond.mjs
npm notice 399B package.json
npm notice package size: 328.2 kB
npm notice total files: 4
npm notice Publishing to https://registry.npmjs.org/ with tag latest and public access (dry-run)
+ @jmanuelcorral/bond@1.12.0
exit=0
```
El dry-run **no pide autenticación**. Dos hallazgos que cambiaron el workflow:
- `npm publish dist/foo.tgz` sin `./` lo interpreta como spec git (`EALLOWGIT`); por eso el paso hace `cd dist` y publica `./…`.
- `--registry=https://registry.npmjs.org/` **no gana** a una entrada `@jmanuelcorral:registry` del `.npmrc` (la de esta máquina apunta a `npm.pkg.github.com` y desvió el destino). De ahí fijar la línea de scope en el `.npmrc` del runner.

**5. Catálogo e instalación en directorio temporal** (no en este repo):
```
✓ catálogo "bond" correcto: 12 skills, 4 comandos, 2 servidores MCP   (exit=0)
+ .agents/skills/release-bond/SKILL.md
bond sync --check → al día
bond init --list → release-bond  Ship a bond release: tag, GitHub release, packaging and the Homebrew tap, in order (opcional)
```
Instalado en `/tmp/bond-init-test2` con `BOND_HOME` aislada; la config global real quedó intacta (copia, no movida). Temporales limpiados.

Comprobé además contra la release real `v1.12.0` que los comandos que documenta la skill funcionan: `gh release view --json isDraft,assets` devuelve los 7 assets esperados, `grep -F … SHA256SUMS | sha256sum -c -` verifica el `.tgz` descargado, y el `diff` entre los hashes del `.rb` y los `digest` de GitHub sale vacío.

## Decisiones

- **Nombre: `release-bond`.** Convención verbo-objeto del catálogo (`release-prepare-github`, `delivery-review-github`). Descarté `bond-release`/`release-bond-pipeline` por no seguir esa forma, y descarté ampliar `release-prepare-github`: es genérica, adaptada de fluzo-labs, y no debe conocer `packaging.mts` ni el tap.
- **`default = false`.** Es de mantenedor: solo aplica al repo bond. Preseleccionarla en `bond init` sería ruido en cualquier repo y un riesgo, porque quien la siga en un repo equivocado dispara releases.
- **`--provenance`: no.** Trusted publishing exige configurar el paquete en npmjs.com (proveedor GitHub Actions, workflow fijado) y `id-token: write`; no hay paquete publicado ni acceso ahora. Queda anotado en la skill como seguimiento, con el motivo y los pasos.
- **Registro fijado en `registry.npmjs.org`** dentro del paso, no por defecto del runner, por el motivo del punto 4.
- **No añadí `release-bond` al `skills` de `.bond/bond.toml` de este repo.** Sería útil para mantener aquí, pero obliga a `bond sync` (copia en `.agents/skills/` + enlace en `.claude/`) y a más superficie de conflicto con la otra rama. Se puede añadir aparte si lo quieres.
- **Mensajes de "no publicado" sin tocar** (`update.manual_npm`, comentario de `manualCommand`, `docs/reference.md:1291`, `docs/en/reference.md:1342`): serían mentira hasta la primera publicación real; la skill lo deja como trabajo posterior obligatorio.
