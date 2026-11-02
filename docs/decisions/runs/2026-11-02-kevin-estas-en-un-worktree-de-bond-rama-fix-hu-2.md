---
agent: "kevin"
kind: "pi"
branch: "fix/hub-tests-windows"
base: "main@44aeeaa"
orchestrator: "pi/gru"
started_at: "2026-11-02T18:11:15Z"
finished_at: "2026-11-02T19:40:48Z"
status: "reported"
commits:
  - "ae49658 ci: allow a manual run on any ref"
  - "5efe009 test(hub): run the hub team tests on Windows instead of skipping them"
  - "67fc93b test(hub): canonicalize the fixture temp dir with the native realpath"
  - "130c07f test(hub): give the stall-retry tests the 30s timeout the hub files use"
  - "b863258 docs(decisions): record the Windows test harness and the CI manual trigger"
decisions:
  - "2026-11-02-pruebas-de-hub-en-windows-herdr-simulado-compilado-a-exe-junction-y-canonical"
  - "2026-11-02-ci-workflow-dispatch-en-ci-yml-para-dar-senal-de-windows-a-una-rama-sin-abrir-pr"
---

## Request

**2026-11-02T18:11:15Z**

Estas en un worktree de bond (rama fix/hub-tests-windows) creado desde main. bond es una CLI en TypeScript (.mts, sin paso de compilacion) que opera varios agentes de codigo sobre git y el multiplexor Herdr. Tarea: issue #41. No hay skills aqui: sigue estas instrucciones tal cual.

ISSUE #41: las pruebas de `bond team` en un hub se saltan en Windows
Hay tres bloques `describe.skipIf(process.platform === "win32")` que dejan el modo hub sin cubrir en Windows en CI:
- `test/team-hub.test.mts:134` "bond team en un hub" (19 tests: abrir rama vertical, prompt, collect, clean, submodulos y symlinks)
- `test/hub.test.mts:209` "bond team status en un hub con submodulo y symlink"
- `test/team-prompt-stall.test.mts:122` "H4: reintento de prompt estancado en un hub"

OBJETIVO: que esos tests se EJECUTEN en Windows en CI. El skip general no vale: hay que averiguar por que fallan alli y arreglar la causa.

METODO (siquelo, es lo importante)
1. Lee los tres ficheros de test y su helper `bond()` / `exe()` / `repo()` / `g()`. Fijate en lo que es especifico de POSIX: scripts de shell como shim de agentes falsos (`exe("pi", "#!/bin/sh...")`), symlinks, rutas con `/`, permisos, `#!/bin/sh`.
2. Quita los tres `skipIf` en TU rama y **empuja la rama** para que CI la pase en Windows (linux, macOS, windows). Necesitas la senal real de Windows: no la puedes simular desde aqui.
3. Lee los fallos de Windows (`gh run view <run> --log-failed`) y arregla la causa raiz. Vuelve a empujar. Repite hasta que Windows este verde o hasta que demuestres que algo no puede correr alli.
4. PISTA: en las ultimas horas se arreglaron dos cosas de Windows que igual te sirven: (a) `file://` con rutas de Windows hay que partirlo por `/` y por `\`; (b) `process.cwd()` puede salir con nombre 8.3 (`RUNNER~1`) y hay que canonicizar con `canonical()` (en `cli/util.mts`, es `realpathSync.native`) antes de `relative()`. En Windows los `.cmd`/`.exe` se resuelven distinto y los symlinks pueden requerir privilegios: mira como lo hace ya el repo en otros tests que si corren en Windows antes de inventar.

REGLAS
- **No suavices aserciones para que pasen.** Un `expect` mas debil o borrado no es un arreglo.
- Si un test concreto de verdad no puede correr en Windows (p. ej. un symlink que exige privilegios que el runner no da), deja el skip PERO: (a) acotado a ese test, no al bloque entero, (b) con un comentario al lado diciendo exactamente por que, y (c) listado en tu informe final. El objetivo es que el bloque pase en Windows; los skips puntuales y justificados se aceptan, el `describe.skipIf` general no.
- Si arreglar algo del codigo de bond (no del test) es lo que hace falta, hazlo, y su texto de consola va al catalogo que corresponda (`cli/messages/team.mts` o `cli/messages/hub.mts`) con su clave `es` y su traduccion `en` (estan tipados contra `es`: sin traduccion, `npm run typecheck` falla).
- NO toques: `cli/messages.mts`, `cli/instructions.mts`, `docs/plans/*`, `bunfig.toml`.
- Verifica en local (Linux): `npx tsc -p .` limpio y `bun test` en verde (base: 537 pass / 0 fail). En Windows, la senal es CI.
- Commits conventional en ingles, trailer `Agent: pi/<tu nombre>`, y `Closes #41` en el ultimo. Puedes empujar TU rama tantas veces como haga falta. PROHIBIDO: fusionar, tocar otra rama, empujar a main, crear PR.

INFORME FINAL (ultima respuesta, sin banner)
- Cuantos tests corren ahora en Windows de los 21 que estaban saltados.
- Causas raiz de los que fallaban y que cambiaste en cada una.
- Skips que hayas dejado, con el motivo exacto de cada uno.
- Ficheros tocados.
- `npx tsc -p .` y `bun test` en local, tal cual, y el estado final de CI en las tres plataformas.
- SHAs.
- Si algo no se puede arreglar, digelo con la prueba de por que (el fallo concreto de CI) en vez de inventar.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report

Verde en los tres sistemas sobre el SHA final.

## Resultado

**Windows (antes: 21 tests saltados, ahora: 535 pass / 11 skip / 0 fail).** Los 23 tests de hub (`bond team en un hub` 19, `H4 stall` 3, `bond team status en un hub` 1) se ejecutan y pasan en Windows.

## Causas raíz encontradas en Windows

1. **El herdr simulado se apoyaba en un shebang.** En Windows no hay shebang y CreateProcess no arranca un `.cmd` sin shell. El JS del falso herdr se compila a un `herdr.exe` real con `bun build --compile` (~150 ms). Como eso se paga por ejecutable, el PATH falso se monta **una vez por fichero** en vez de por prueba. `pi`/`claude` no los ejecuta nadie (quien arranca agentes es Herdr, también simulado) → un `.cmd` vacío basta para que `which()` los vea.
2. **PATH unido con `:`.** En Windows dejaba el PATH inservible; ahora `path.delimiter`.
3. **Symlink del fixture `back`.** Un symlink real pide privilegios elevados; pasa a `junction`, como ya hacían `hub-check` y `hub-pull`. Con el enlace presente en Windows, desaparecieron los condicionales `if (process.platform !== "win32")` que debilitaban las aserciones (`present: true`, `toContain("symlink")`).
4. **TEMP con nombre 8.3** (`C:\Users\RUNNER~1`): `fs.realpathSync` no lo resuelve y bond sí lo hace con `realpathSync.native`, así que el mensaje esperado nunca coincidía. Los fixtures usan `canonical()` (la misma corrección de `22b6a80`).
5. **Faltaba `setDefaultTimeout`** en `team-prompt-stall.test.mts`: era el único test de hub sin los 30 s del resto; en Windows el `beforeEach` (`git worktree add`) más los 5 s de stall reventaban los 5 s por defecto de bun.

Ninguna aserción se aflojó; se quitaron las que conditionalizaban por plataforma.

## Skips restantes en Windows (11, todos preexistentes y fuera de #41)

`accept con TTY` (2, requieren TTY), `respuestas`/`«1» con el binario` (2) y `«1» con Homebrew` (3) (Linux/macOS), `installMethod reconoce Homebrew` (1), `which fuera de Windows` (1), `canonical resuelve symlinks en las dos direcciones` (1), `doctor con la raíz detrás de un symlink` (1). Ninguno de los tres bloques de hub.

## Ficheros

- `test/team-hub.test.mts`, `test/team-prompt-stall.test.mts`, `test/hub.test.mts` — quitan los tres `describe.skipIf` + arnés portable.
- `.github/workflows/ci.yml` — `workflow_dispatch` (opción A que aprobaste).
- `docs/decisions/` — dos decisiones registradas (una aceptada, una propuesta).

Sin cambios en `cli/`: el producto no tenía el bug, lo tenía el arnés.

## Verificación

- Local (Linux): `npx tsc -p .` limpio, `bun test` → **546 pass / 0 fail**.
- CI en `b863258`: linux ✓ 2m54s, macOS ✓ 3m36s, **windows ✓ 10m40s** — [run 41509891147](https://github.com/jmanuelcorral/bond/actions/runs/41509891147).

## Commas en `fix/hub-tests-windows` (pushed, sin PR ni merge)

```
b863258 docs(decisions): record the Windows test harness and the CI manual trigger   (Closes #41)
130c07f test(hub): give the stall-retry tests the 30s timeout the hub files use
67fc93b test(hub): canonicalize the fixture temp dir with the native realpath
5efe009 test(hub): run the hub team tests on Windows instead of skipping them
ae49658 ci: allow a manual run on any ref
```
