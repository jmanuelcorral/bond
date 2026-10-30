---
agent: "reviewer-10"
kind: "agy"
branch: "plan/hub-session"
base: "plan/hub-session@337df84"
orchestrator: "claude"
started_at: "2026-10-30T13:38:36Z"
finished_at: "2026-10-30T13:38:36Z"
status: "reported"
commits: []
decisions: []
---

## Request

Read-only code review of branch plan/hub-ops-p10 against plan/hub-session in the repo at /home/jose/gitrepos/bond (do not check out branches: use `git diff plan/hub-session...plan/hub-ops-p10` and `git show plan/hub-ops-p10:<file>`). It implements P10 of docs/plans/2026-10-30-hub-ops.md: read that phase's acceptance criteria and the decisions it links. Report only actionable findings: bugs, unmet acceptance criteria, Windows path issues (CI runs on Windows), tests that do not test what they claim, and docs/help out of sync with behavior. For each one give file:line, the concrete failure and a suggested fix; mark it blocker, change or nit. Do not edit files, commit or run bin/bond hub without `export BOND_HOME=$(mktemp -d)` first. End with a verdict: approve or request changes.

## Report

### Revisión de código: `plan/hub-ops-p10` frente a `plan/hub-session`

Implementación de **P10: el orquestador conoce el hub** de [`2026-10-30-hub-ops.md`](file:///home/jose/gitrepos/bond/docs/plans/2026-10-30-hub-ops.md) y Decisión [D18](file:///home/jose/gitrepos/bond/docs/decisions/2026-10-30-description-en-hub-toml-y-bloque-generado-en-el-agents-md-del-hub.md).

---

### Hallazgos

#### 1. `bond hub add` borra la descripción existente y corrompe `agent`/`base` al re-añadir un repo existente
- **Archivo:** [`cli/hub-init.mts:935-978`](file:///home/jose/gitrepos/bond/cli/hub-init.mts#L935-L978)
- **Severidad:** `blocker`
- **Fallo concreto:**
  1. Si un repo ya registrado en `hub.toml` tiene `description = "..."` y se ejecuta de nuevo `bond hub add <target>` sin `--description` (llamada idempotente habitual), `description` es `undefined`. La comprobación de la línea 946:
     ```ts
     } else if ((existing.description ?? "") === (description ?? "")) {
     ```
     evalúa `("descripción_existente" === "")`, que resulta `false`. En lugar de salir con `log("repos.${repoName} ya existe en hub.toml")`, el flujo continúa hacia abajo (líneas 960-978). Como `description` es `undefined`, se reconstruye la entrada **sin descripción**, eliminándola silenciosamente de `hub.toml` y de `AGENTS.md`.
  2. Si se pasa `--description <texto>` para actualizar la descripción de un repo existente, cae en la misma reconstrucción completa:
     - `existing.agent` se descarta y se borra de `hub.toml` porque en la CLI no se pasó `--agent`.
     - `existing.base` se sustituye por `repoBase`, que al no pasarse `--base` redetecta la rama actualmente abierta en el clon local (`currentBranch(resolve(target))`), corrompiendo la base en `hub.toml` si el clon estaba en una rama de trabajo.
     - En la línea 937 se llama `resolve(target)` incondicionalmente, incluso cuando `target` es una URL remota de submódulo (`https://...`).
- **Solución propuesta:**
  Tratar la actualización de un repo existente directamente dentro 
<truncated 3036 bytes>
itula:
  > `"cambiar la descripcion en hub.toml: --check falla, sync actualiza el bloque y conserva lo escrito a mano"`
  
  En la línea 390 se ejecuta:
  ```ts
  writeFileSync(join(hubDir, "AGENTS.md"), "# Mis notas del hub\n");
  ```
  Esto sobreescribe `AGENTS.md` eliminando por completo el bloque generado. En la línea 393, `expect(check(hubDir).status).toBe(1)` pasa no porque se detecte la deriva de la descripción frente al bloque previo, sino porque el bloque entero ha desaparecido del archivo. Además, en la línea 392 se renombra la clave `[repos.front-real]` a `[repos.front]`, mezclando un cambio de clave con la descripción.
- **Solución propuesta:**
  Conservar el bloque existente en `AGENTS.md` añadiendo el texto manual al principio (`# Mis notas del hub\n\n${textoPrevio}`) y modificar únicamente la línea `description` bajo `[repos.front-real]` en `hub.toml`. Así `check` fallará realmente por discrepancia de contenido en el bloque generado.

---

#### 4. Ayuda de `bond hub` desincronizada con el comportamiento y la documentación
- **Archivo:** [`cli/hub.mts:23`](file:///home/jose/gitrepos/bond/cli/hub.mts#L23)
- **Severidad:** `nit`
- **Fallo concreto:**
  La constante `HUB_HELP` mantiene:
  ```text
  Sin subcomando: enseña la sesión del hub (repos, ruta, base, enlace y rama actual).
  ```
  Mientras que [`docs/reference.md`](file:///home/jose/gitrepos/bond/docs/reference.md#L826) y [`docs/en/reference.md`](file:///home/jose/gitrepos/bond/docs/en/reference.md#L828) se actualizaron para reflejar:
  `repos, ruta, base, enlace, rama y descripción (si la hay)`.
- **Solución propuesta:**
  Añadir la mención de la descripción opcional en `HUB_HELP`:
  ```text
  Sin subcomando: enseña la sesión del hub (repos, ruta, base, enlace, rama y descripción si la hay).
  ```

---

### Veredicto

**Request changes** (debido al fallo bloqueante en `bond hub add` que destruye metadatos de repos existentes y al vaciado involuntario del bloque en `AGENTS.md` cuando `hub.toml` tiene errores de sintaxis).
