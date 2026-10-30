---
agent: "reviewer-5"
kind: "agy"
branch: "plan/hub-guided-p5"
base: "plan/hub-session@ce6b98c"
orchestrator: "claude"
started_at: "2026-10-30T07:24:01Z"
finished_at: "2026-10-30T07:24:01Z"
status: "reported"
commits:
  - "f8e930e feat(hub): read session from hub.toml and find hub via global registry"
decisions: []
---

## Request

Read-only code review of branch plan/hub-guided-p5 (commit f8e930e), which implements phase P5 of docs/plans/2026-10-30-hub-guided.md: hub.toml (+ .bond/hub.local.toml) as the only source of a hub session, the global registry ~/.bond/hubs.toml to find the hub from a symlinked repo, removal of [hub] from bond.toml, and canonical() resolving symlinks. Read that plan (P5 and its decisions), the previous plan docs/plans/2026-10-29-hub-session.md, and AGENTS.md first. Do not switch branches in this checkout: inspect with `git diff plan/hub-session...plan/hub-guided-p5` and `git show plan/hub-guided-p5:<file>`.

Look for: correctness bugs in parsing/validation of the three files; whether tests or normal commands can write to the REAL ~/.bond/hubs.toml (tests must isolate HOME); symlink/realpath issues (cwd through the symlink vs the real clone path matching the same repo and its worktrees; agents' cwd matching in teamRows); Windows paths and junctions; regressions in the hub mode of cli/team.mts (sessionRows, vertical teams, runs in the hub) and for repos without a hub; leftovers of [hub]/parseHub; missing tests for P5's acceptance criteria. Also say whether the API is ready for P6 (init/add/sync) and P7 (check).

Constraints: do not edit, create or commit any file and do not change the working tree. Report only actionable findings with file:line, severity (blocker / should-fix / nit), the failing scenario and a fix. End with a verdict: approve or changes requested.

## Report

# Revisión P5 — `plan/hub-guided-p5` (f8e930e)

Verificado en el worktree de la rama: `npm run typecheck` limpio, `bun test` 383/0. El `~/.bond/hubs.toml` real no se crea ni se toca al pasar la suite entera (los tests fijan `BOND_HOME` antes del import y `hubsPath()` lee la variable en cada llamada; los `bond` hijos la heredan). Ningún comando normal escribe el registro en P5: `registerHubRepo` no tiene llamador en producción todavía. `parseHub`/`HubConfig`/`repoHub`/`hubBlock`/`withHub` desaparecieron por completo de `cli/` y tests, y `loadRepoConfig` ya no expone `.hub`.

## should-fix

1. **`cli/main.mts:34` — ayuda general obsoleta.** Dice `hub  Repo con submódulos: su sesión (repos y bases) en [hub] de bond.toml (sync)`. `[hub]` ya no existe y `bond hub sync` tampoco (hub.mts:375 muere con «opción desconocida» ante cualquier argumento). Escenario: `bond --help` enseña una sección y un subcomando inexistentes. Arreglo: reescribir la línea (p. ej. «Repo hub: la sesión declarada en hub.toml»). La ayuda entra en el contrato de P5.

2. **`cli/team.mts:1713` — mensaje que manda a un comando que ya no existe.** `la base no existe en ...: cámbiala con bond hub --base <ruta>=<ref>`. Escenario: `bond team fix/x` en un hub con una base mal declarada → el arreglo sugerido falla con «opción desconocida: --base». Arreglo: hasta P6, «cambia `base` en hub.toml (o en `[repos.x]`)».

3. **`hub.toml`/`hub.local.toml` inválidos: silencio desde un repo de la sesión** (`cli/hub.mts:300` `hasHub` traga el error; `cli/team.mts:722` solo comprueba el `hub.toml` del propio root). Escenarios:
   - `hub.toml` inválido y `bond team status`/`fix/x` desde `hub/front` (o desde el clon enlazado): tabla de un solo repo, sin aviso de que el hub está roto. El criterio «bond team lo trata como repo normal **con un aviso**» solo se cumple desde la raíz del hub.
   - Peor aún: un `hub.local.toml` inválido hace `hasHub(hub) === false`, así que el hub desaparece de la cadena de superproyectos sin más.
   Arreglo: en `hubRoot` (o en `sessionRows`), si la cadena contiene un directorio con `hub.toml` que no parsea, avisar una vez (dedupe tipo `warnedInvalidHub`) con el error de `catchDie(() => hubSession(...))`.

4. **Ruta sin testear: `hubRoot` desde un worktree de un repo enlazado** (`cli/hub.mts:322-329`, el fallback con `--git-common-dir`). Es la ruta real de trabajo: el agente de `back` vive en `~/.herdr/worktrees/<hub>/back/<rama>` y cualquier `bond` desde ahí depende de que ese fallback casé con el registro. `test/hub.test.mts` prueba `hubRoot(backReal)` y subcarpetas, pero nunca un worktree de `backReal`. Arreglo: `git -C backReal worktree add ...` y `expect(hubRoot(wt)).toBe(canonical(hub))`.

## nits

5. **`cli/hub.mts:251`** — `hubsPath` reimplementa `BOND_HOME` (`cli/runtime.mts:17`) en vez de reutilizarlo; dos fuentes de la verdad que pueden divergir.
6. **`cli/hub.mts:271`** — `readHubsRegistry` devuelve `{}` en silencio con un registro corrupto: un typo en `~/.bond/hubs.toml` desactiva la detección de todos los hubs enlazados sin decir nada. Avisar una vez.
7. **`cli/team.mts:649`** — la fila del hub se marca con `repo: session.name`; el nit de P3 sigue vivo: un repo de la sesión cuya ruta coincida con el nombre del hub hace que `subRows`/`repoOfRow` confundan la fila del hub con la de ese sub-repo. Marcar la fila del hub con `"."` como se propuso entonces.
8. **Windows** — el test de `canonical` (`test/util.test.mts`) y el fixture symlink se saltan win32; la sección de riesgos del plan pedía probar realpath en las dos direcciones en Windows (una junction con `cmd /c mklink /J` es factible sin modo desarrollador). Aceptable si P6 cubre junctions, pero P5 deja el `canonical` sin cobertura en Windows.
9. **`cli/hub.mts:277-297`** — `writeHubsRegistry`/`registerHubRepo` ignoran `--dry-run` (`act()`). Nada los llama aún, pero P6 los usará desde `init`/`add`/`sync`.
10. **`cli/hub.mts:382`** — con un `hub.toml` válido en un directorio que no es repo git, el mensaje es «falta hub.toml» cuando está ahí. Mensaje confuso en un caso raro.
11. **Rendimiento** — `hubRoot`→`hasHub`→`hubSession` parsea los dos TOML y corre git por repo, y `sessionRows`/`subRows` repiten la cascada varias veces por invocación (`promptInHub` llama `subRows` 3-4 veces; el watch loop cada 2 s). Un caché por proceso o pasar la sesión ya resuelta lo abarataría.
12. **Skills y `docs/puesto.md`** siguen describiendo `[hub]` (`global/skills/bond-team/SKILL.md:3,22,86`, `catalog/skills/plan-team/SKILL.md`, `docs/puesto.md:149,203,332`) — diferido a P8 por el plan, pero hoy son activamente engañosas para un agente que instale el catálogo.

## Listo para P6/P7

- **P6**: bloques suficientes — parse/validación de los tres ficheros, `readHubsRegistry`/`writeHubsRegistry`/`registerHubRepo`, `submodules()` para la importación, `expandSource` (privado, mismo módulo). Faltan, y son propios de P6: serializador de `hub.toml`/`hub.local.toml`, rediseño del dispatcher de `hub()` (hoy rechaza cualquier argumento), `.gitignore` del hub para symlinks y `hub.local.toml`, y respetar `--dry-run` en las escrituras (nit 9).
- **P7**: tiene los bloques (`present`, `currentBranch`, verificación de base, `catchDie`), pero conviene arreglar antes el 3: `check` se apoyará en `hasHub`, y hoy una config rota es invisible desde los repos de la sesión. Para `--json` hará falta algo más estructurado que los mensajes de `die` en castellano.

## Veredicto

**Changes requested** — sin bloqueadores funcionales (suite verde, aislamiento de HOME correcto, sin regresión visible en el modo hub); los cuatro should-fix son baratos: dos mensajes obsoletos (`main.mts:34`, `team.mts:1713`), el aviso que falta con config inválida desde un repo de la sesión, y una prueba del fallback por `--git-common-dir` que es justo la ruta por la que un agente enlazado encuentra su hub.
