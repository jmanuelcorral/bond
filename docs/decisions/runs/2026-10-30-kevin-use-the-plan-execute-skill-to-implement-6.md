---
agent: "kevin"
kind: "agy"
branch: "plan/whats-new-hub-f1"
base: "feat/whats-new@345d38c"
orchestrator: "claude"
started_at: "2026-10-30T15:32:24Z"
finished_at: "2026-10-30T15:43:24Z"
status: "reported"
commits:
  - "f5190ab docs(site): add what's new page introducing hub mode"
decisions: []
---

## Request

**2026-10-30T15:32:24Z**

Use the plan-execute skill to implement only F1 of docs/plans/2026-10-30-whats-new-hub.md (revision 345d38c). This is a linked worktree: treat the plan file as read-only and report progress in your answer. If all of the phase's verification passes, I explicitly authorize one commit on this branch with the git-conventional-commit skill, using the message you would recommend; do not push, open a PR or start another phase. If verification fails or is blocked, do not commit. End with a report: what changed, checks run and their results, acceptance criteria met, risks, and the commit SHA or why there is none.
Notes: the pages are user-facing docs, written in natural Spanish (docs/novedades.md) and natural English (docs/en/whats-new.md), in the same tone as docs/index.md and docs/puesto.md; read docs/reference.md (bond hub section) and docs/puesto.md for the facts and describe only what main does today. Do not reference internal decision ids (D16, D19...) in these pages. Leave a clearly marked spot for the video (F3 fills it); do not add video files. Do not touch site/videos/ or docs/public/videos/. Check the result with (cd site && npm ci --ignore-scripts && npm run build); do not commit site/dist or site/src.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report

### Informe de ejecución: Fase F1 de `docs/plans/2026-10-30-whats-new-hub.md`

#### Progreso de la fase
El fichero del plan ([`docs/plans/2026-10-30-whats-new-hub.md`](file:///home/jose/.herdr/worktrees/bond/plan-whats-new-hub-f1/docs/plans/2026-10-30-whats-new-hub.md)) se ha tratado como de solo lectura por tratarse de un worktree enlazado. El progreso equivalente para F1 queda reflejado en este informe:

| Fase | Implementación | Verificación | Revisión | Evidencia |
| --- | --- | --- | --- | --- |
| **F1** | **done** | **passed** | **ready** | Commit `f5190ab`, build de VitePress verde y 452 pruebas superadas |
| F2 | pending | not_run | pending | pendiente de autorización |
| F3 | pending | not_run | pending | pendiente de F1 y F2 |

---

#### Qué ha cambiado
1. **[`docs/novedades.md`](file:///home/jose/.herdr/worktrees/bond/plan-whats-new-hub-f1/docs/novedades.md)**:
   - Nueva página de novedades en castellano organizada por versión (`## Próxima versión: el modo hub`).
   - Explica el concepto de hub (submódulos y enlaces locales/symlinks), el trabajo vertical en varias carpetas con `bond team`, cuándo usar un hub y cuándo no es necesario.
   - Detalla la estructura de carpetas (`hub.toml`, `repos/`, `docs/plans/`, `docs/decisions/`, bloque `bond:hub` en `AGENTS.md`) y el ciclo completo (`init` → `check` → `pull` → `team` → `collect` → `clean`).
   - Describe exactamente el comportamiento de `main` (sin cabecera `[hub]`, `level` en `hub check --json`, `pull` fast-forward únicamente) sin mención a identificadores internos de decisiones (`D16`, `D19`, etc.).
   - Incluye enlaces cruzados a [la referencia](file:///home/jose/.herdr/worktrees/bond/plan-whats-new-hub-f1/docs/reference.md#bond-hub) y [el puesto de trabajo](file:///home/jose/.herdr/worktrees/bond/plan-whats-new-hub-f1/docs/puesto.md#una-rama-vertical-en-un-hub).
   - Deja un hueco claramente delimitado para el vídeo de la fase F3 mediante estructura `terminal-window` y comentario específico.

2. **[`docs/en/whats-new.md`]
<truncated 1809 bytes>
es auditados, compilación VitePress v1.6.4 completada en 3.13s sin advertencias de rutas ni errores.
  - Se verificó la generación de `site/dist/whats-new.html` y `site/dist/en/whats-new.html`.
  - Se comprobó que el selector de idioma enlaza directamente entre `/bond/whats-new` y `/bond/en/whats-new`.
  - Se comprobó que los enlaces a `reference#bond-hub` y `workstation#una-rama-vertical-en-un-hub` (y `workstation#a-vertical-branch-in-a-hub`) apuntan a anclas existentes en el sitio generado.
- **Tipos y suite de pruebas**:
  `npm run typecheck && bun test`
  - **Resultado**: `exit 0`.
  - Typecheck con `tsc` sin fallos.
  - Pruebas unitarias y de integración: 452 pruebas pasadas, 0 fallos (22 ficheros de test).

---

#### Criterios de aceptación cumplidos
- [x] El site construye y la página se ve en los dos idiomas.
- [x] El selector de idioma lleva de una versión a otra (`whats-new.html` <-> `en/whats-new.html`).
- [x] Los enlaces a la referencia y al puesto de trabajo funcionan y resuelven en los dos idiomas.
- [x] El texto describe fielmente el comportamiento de `main` (sin sección `[hub]`, niveles en `hub check --json`, `pull` fast-forward) y omite referencias internas de decisiones.
- [x] La barra de navegación de cada idioma incluye «Novedades» / «What's new».
- [x] La portada de ambos idiomas cuenta con un aviso que conduce a la sección de novedades.
- [x] Hueco reservado y claramente señalizado para la integración posterior del vídeo en F3.
- [x] Ningún fichero de vídeo, ni `site/dist` ni `site/src` ha sido modificado o añadido a git.

---

#### Riesgos identificados
- Cuando en F3 se graben y añadan los vídeos finales (`hub-es.mp4` y `hub-en.mp4`), será necesario asegurar que los contenedores respeten la relación de aspecto sin alterar los estilos base de VitePress.

---

#### Commit realizado
- **SHA**: `f5190ab`
- **Mensaje**: `docs(site): add what's new page introducing hub mode`

No se ha hecho push ni se ha iniciado ninguna fase posterior, de acuerdo con las instrucciones.
