---
agent: "reviewer-1"
kind: "pi"
branch: "plan/hub-session-p1"
base: "plan/hub-session@4ffbb62"
orchestrator: "claude"
started_at: "2026-10-29T18:29:49Z"
finished_at: "2026-10-29T18:40:12Z"
status: "reported"
commits:
  - "47d737a feat(hub): add bond hub to configure a hub session in [hub]"
decisions: []
---

## Request

Review the commit 47d737a on branch plan/hub-session-p1 (this worktree), which implements phase P1 of docs/plans/2026-10-29-hub-session.md: the `bond hub` command and the [hub] section of .bond/bond.toml. Read the plan's P1 section, the decisions it links, and AGENTS.md first.

Scope: `git diff plan/hub-session...HEAD` (cli/hub.mts, cli/repo.mts, cli/team.mts, cli/util.mts, cli/main.mts, test/hub.test.mts, docs/reference.md, CHANGELOG.md).

Look for: correctness bugs (submodule detection, nested hubs, detached HEAD, rewriting only the [hub] section of bond.toml without losing other content, validation), Windows path issues (`/` in stored paths, .git files), regressions for repos without [hub], whether the API (hubRoot, hubSession) is enough for P2 (one session table) and P3 (vertical team, one agent per repo), and missing tests for P1's acceptance criteria. You may run `npm run typecheck` and `bun test`.

Constraints: do not edit, create or commit files; read-only review. Report only actionable findings, each with file:line, severity (blocker / should-fix / nit), the concrete failing scenario and a suggested fix. End with a verdict: approve or changes requested.

## Report

# Revisión P1 — `bond hub` (commit 47d737a)

Verificado: `npm run typecheck` OK, `bun test` 362/362 OK. Sondeo manual de dry-run, inline `hub = {...}`, HEAD separado, hubs anidados y TOML roto con fixtures temporales.

## Hallazgos

**1. `should-fix` — aviso repetido por cada `hubRoot`/`repoHub` con `[hub]` inválida.** `cli/hub.mts:53` (`hasHub` → `repoHub` → `hubOrWarn`) y `cli/repo.mts:443-447`: `warn` no respeta `catchingDie()`, así que cada llamada imprime el aviso (se ve duplicado en el test "leerla inválida avisa"). En P2, `--watch` llamará a `hubRoot`/`hubSession` en cada refresco de la tabla y spammerá stderr tick a tick. Sugerencia: que `hasHub` use `catchDie(() => parseHub(repoToml(root)?.hub)).hub !== undefined` (sin aviso; el aviso queda para los lectores de config y para el propio `bond hub`, que ya muere con mensaje).

**2. `should-fix` — `--dry-run` sin prueba.** El contrato de P1 lo incluye (`docs/plans/...#p1`, `docs/reference.md`), y `test/hub.test.mts` no lo cubre. Verifiqué a mano que funciona (no escribe, muestra el bloque), pero es barato: `bond(["hub","--yes","--dry-run",...])` + `expect(toml()).toBe(TOML)`.

**3. `should-fix` — criterio "bond team y bond en un repo sin [hub] no cambian" sin prueba específica.** Solo cubierto indirectamente (la suite de team pasa y el cambio en `cli/team.mts` es el traslado neutro de `canonical` a `util.mts`). Conviene una prueba explícita en `hub.test.mts` (p. ej. `bond team status` en el fixture sin `[hub]` da las mismas filas que con el código base), que es además la prueba de no regresión que el plan pide para P2.

**4. `nit` — `--base` no trimea la ruta.** `cli/hub.mts:179`: `--base " front "=main` produce `--base  front : no es un repo de la sesión` (confuso). Añadir `.trim()` a `m[1]` (el ref ya se trimea).

**5. `nit` — `sync` solo vale en argv[0].** `cli/hub.mts:172`: `bond hub --yes sync` muere con "opción desconocida: sync". O aceptarlo en cualquier posición o nada (el error al menos es claro).

**6. `nit` — sombra de hubs anidados no documentada.** Verificado: si un repo intermedio (`front`) y el superproyecto grande tienen ambos `[hub]`, `hubRoot` devuelve el más exterior y la `[hub]` interior queda silenciada sin aviso (coherente con D4, recursivo). Falta una línea en `docs/reference.md` y un test de esa sombra.

**7. `nit` — gramática del error plural.** `cli/hub.mts:244`: "sin base para A, B: está en HEAD separado" → "están".

**8. `nit` — duplicación de lógica.** `cli/hub.mts:190` repite `chain.reverse().find(hasHub)` en vez de reutilizar `hubRoot` (aquí con fallback al superproyecto exterior); se podría expresar como `hubRoot(cwd) ?? chain[chain.length-1]`.

## Suficiencia de la API para P2/P3

Suficiente: `HubRepo {path, dir, base, branch, present}` + `HubSession {root, name, repos}` cubren la fila por repo con su base (P2), `path` permite `~/.herdr/worktrees/<hub>/<sub>/<rama>` (D9) y `root` da la memoria de decisiones del hub (D5); `present` cubre desinicializaciones y `branch: undefined` el HEAD separado. La degradación es correcta: `[hub]` inválida → `hubSession` devuelve `undefined` con aviso y P2/P3 caen al modo mono-repo. Único arrastre es el del hallazgo 1 (aviso por tick en watch).

## Veredicto

**Aprobar**, con los `should-fix` (1–3) como trabajo menor antes o junto a P2; los `nit` son opcionales.
