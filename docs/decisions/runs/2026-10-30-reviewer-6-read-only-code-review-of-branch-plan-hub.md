---
agent: "reviewer-6"
kind: "agy"
branch: "plan/hub-guided-p6"
base: "plan/hub-session@03d9d20"
orchestrator: "claude"
started_at: "2026-10-30T08:14:09Z"
finished_at: "2026-10-30T08:14:09Z"
status: "reported"
commits:
  - "ad692c2 feat(hub): create hub and import repositories via init, add, and sync"
decisions: []
---

## Request

Read-only code review of branch plan/hub-guided-p6, which implements phase P6 of docs/plans/2026-10-30-hub-guided.md: bond hub init/add/sync in cli/hub-init.mts (create the hub, import repos as submodule or symlink, junction fallback on Windows, .gitignore, hub.local.toml, the ~/.bond/hubs.toml registry, --yes/--dry-run). Read that plan (P6, P5 and the decisions), docs/plans/2026-10-29-hub-session.md and AGENTS.md first. Do not switch branches in this checkout: inspect with `git diff plan/hub-session...plan/hub-guided-p6` and `git show plan/hub-guided-p6:<file>`.

Look for: correctness bugs; anything that can delete or overwrite a user's repo, clone or uncommitted work, or change a repo's branch; operations that ignore --dry-run; tests or commands that touch the REAL ~/.bond (must use a temporary BOND_HOME); Windows (paths with /, symlink vs junction, .cmd); regressions for repos without a hub and for the hub mode of bond team; missing tests for P6's acceptance criteria. Another branch implements P7 in parallel and also edits cli/hub.mts, docs/reference.md and CHANGELOG.md: flag semantic clashes.

Constraints: do not edit, create or commit any file and do not change the working tree. Report only actionable findings with file:line, severity (blocker / should-fix / nit), the failing scenario and a fix. End with a verdict: approve or changes requested.

## Report

# Revisión P6 — `plan/hub-guided-p6` (`bond hub init/add/sync`)

Revisado en solo-lectura con `git diff plan/hub-session...plan/hub-guided-p6` y `git show`. No he ejecutado las pruebas (implicaría cambiar el checkout); los fallos siguientes se verifican por lectura del flujo.

## Blocker

**B1. `bond hub init --dry-run` muere siempre (nunca llega al resumen).**
- `cli/hub-init.mts:586` (rama no interactiva) y `:510` (interactiva) llaman `submodules(root)` justo después de un `git init` que en dry-run solo se registra (`act`). `submodules()` muere si el directorio no es un repo git (`die` en `cli/hub.mts:377`). Escenario: `bond hub init --dry-run nuevo-dir --repo file:///...` → «git submodule status falló».
- Aunque el directorio ya sea un repo git, el `syncHub(root, { yes: true })` final (`cli/hub-init.mts:643`) muere en `:252` (`falta hub.toml`) porque en dry-run el `act("guardar hub.toml")` de `:628` no escribió nada.
- Arreglo: en dry-run, saltar `submodules()` cuando el repo se acaba de «crear» (o hacer `submodules` tolerante con `isDryRun()`), y en `hubInit` no llamar a `syncHub` cuando dry-run y no existe `hub.toml` en disco (o pasarle el `HubToml` en memoria). Falta además una prueba `init --dry-run` (solo existe `sync --dry-run`).

## Should-fix

**S1. El clone interactivo ignora `--dry-run`.** `cli/hub-init.mts:330`: `git(root, ["clone", entry.url, cloneDir])` no está envuelto en `act`. Escenario: `bond hub sync --dry-run` en un TTY con un symlink sin `source` → elegir «Clonar desde ...» clona de verdad. Envolver el clone en `act(...)` (o no ofrecer la opción en dry-run).

**S2. `hub add` sobrescribe en silencio una entrada existente.** `cli/hub-init.mts:722` y `:733` asignan `hubToml.repos[repoName] = {...}` sin comprobar colisión. Escenario: `bond hub add <otra-url> --name front` sobre un `repos.front` ya existente: cambia la URL declarada, y el `sync` posterior ve el submódulo inicializado y loguea «al día» (`:279`), dejando `hub.toml` y el disco inconsistentes sin avisar. Morir (o avisar y pedir confirmación) si la entrada existe con otro `path`/`url`.

**S3. En Windows una junction existente no se reconoce como enlace.** `cli/hub-init.mts:191`: `lstatSync(dest).isSymbolicLink()` es `false` para junctions (son reparse points, no symlinks).
- Junction de bond cuyo clon local se movió: `existsSync(dest)` es `false` y `brokenLink()` también → se intenta crear el enlace → el symlink «dir» falla (EPERM sin modo desarrollador) y la junction de respaldo falla con EEXIST → `die`. `sync` no puede reparar lo que él mismo creó.
- Junction apuntando a otro repo con `.git`: entra en «ya existe como repositorio real; no se sustituye» (`:193`) y `sync` no puede re-enlazar nunca.
Arreglo: tratar reparse points como enlaces (p. ej. `readlinkSync` funciona con junctions: si `readlinkSync(dest)` no lanza, es enlace), y borrar/recrear en consecuencia.

**S4. `bond hub init|add|sync --help` muestra la ayuda genérica del hub.** `cli/main.mts:66` intercepta `--help` antes de despachar (`wantsHelp ? console.log(h.HUB_HELP)`), y `hub()` (`cli/hub.mts:405-412`) también comprueba `args.includes("--help")` antes de los subcomandos. `HUB_INIT_HELP`, `HUB_ADD_HELP` y `HUB_SYNC_HELP` son inalcanzables desde la CLI, y son contrato de esta fase. Despachar el subcomando antes de la ayuda global (o que main no intercepte cuando `rest[0]` es subcomando de `hub`).

## Nit

- **N1.** `--dir` (`cli/hub-init.mts:394`) no aparece en `HUB_INIT_HELP`.
- **N2.** `linkRepo` devuelve `"symlink"` también cuando se negó a sustituir un repo real (`:193-194`); el llamador no puede distinguir «no se enlazó nada».
- **N3.** `catch { rmSync(dest); }` (`:201-202`) puede lanzar ENOENT (falta `force: true`).
- **N4.** La prueba de junction (`test/hub-init.test.mts:230+`) es un mock puro que nunca toca el disco: cubre la lógica del fallback pero no la creación real de junctions que pide el criterio «prueba en CI». Una junction real (`symlink(..., "junction")`) funciona en Windows sin modo desarrollador; se podría probar de verdad.
- **N5.** `test/hub-init.test.mts:9-11`: el guard `if (!process.env.BOND_HOME)` respeta un `BOND_HOME` del entorno del desarrollador; si apunta al real, el `rmSync(hubsPath(), { force: true })` de `beforeEach`/`afterEach` (`:51`, `:58`) borra el `hubs.toml` real. Otros suites (`catalogs`, `repo`, `decisions`) lo fijan incondicionalmente; conviene alinearse.
- **N6.** `hubInit` fuerza `syncHub(root, { yes: true })` incluso en modo interactivo (`:643`, `:759`): si el `hub.toml` cargado tiene un symlink sin `source`, init muere al final sin preguntar, pudiendo haberlo preguntado.

## Regresiones y P7

- **Repos sin hub / modo hub de `bond team`:** sin cambios en `cli/team.mts` ni en `hubRoot`/`hubSession`; el registro solo lo escribe `hub-init`. Sin regresión aparente.
- **Choque con P7 (`plan/hub-guided-p7`):** conflictivo pero solo textual: ambas ramas tocan el dispatch de `hub()` (P7 añade `check` en el mismo punto que init/add/sync), `HUB_HELP` (P7 mantiene el formato de línea vieja «bond hub Enseña...» mientras P6 lo reestructura en «Comandos:»), `CHANGELOG.md` y `docs/reference.md` en las mismas secciones. Semánticamente son complementarios. Quien fusione lo segundo debe: añadir `check` a la lista «Comandos:» de P6, colocar su rama de dispatch junto a las de P6 y concatenar las entradas de CHANGELOG. Nada que redesignar, pero conviene coordinar el orden de merge.

## Veredicto

**Changes requested** — B1 (init `--dry-run` roto, contrato explícito de la fase), S1 (dry-run violado con un clone real), S2 (sobrescrita silenciosa de `hub.toml`), S3 (junctions de Windows irreparables por `sync`) y S4 (ayuda inalcanzable). Los nits son opcionales.
