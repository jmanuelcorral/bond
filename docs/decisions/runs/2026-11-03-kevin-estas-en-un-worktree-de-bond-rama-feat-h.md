---
agent: "kevin"
kind: "pi"
branch: "feat/hub-bump-base"
base: "main@390c2f7"
orchestrator: "pi/gru"
started_at: "2026-11-03T06:53:40Z"
finished_at: "2026-11-03T07:17:04Z"
status: "reported"
commits:
  - "77b199f feat(hub): bump submodule pointers to their base with bond hub bump"
  - "36966a1 docs(decisions): record the hub bump command decision"
decisions:
  - "2026-11-03-hub-bump-comando-nuevo-bond-hub-bump-en-cli-hub-bump-mts"
---

## Request

**2026-11-03T06:53:40Z**

Estas en un worktree de bond (rama feat/hub-bump-base) creado desde main. bond es una CLI en TypeScript (.mts, sin paso de compilacion) que opera varios agentes de codigo sobre git y el multiplexor Herdr. Un "hub" es un repo que agrupa varios repos de una sesion, declarados en `hub.toml`, cada uno enlazado como submodulo git o como symlink. Tarea: issue #43. No hay skills aqui: sigue estas instrucciones tal cual.

ISSUE #43: mover los punteros de los submodulos a su base
Cuando se integra el trabajo de un repo en su base (p. ej. la rama del feature se fusiona en main
del repo), el hub sigue apuntando al commit viejo del submodulo. Hay que poder mover esos punteros
a la base actual y dejar el commit del hub **propuesto, sin push**.

LO QUE HACE FALTA
1. Un `bond hub bump` (o `--bump` en `bond hub sync`/`bond hub pull`: decide cual encaja mejor con
   como esta organizado el codigo hoy y justificelo). Para cada repo de la sesion enlazado como
   SUBMODULO: llevar el gitlink del hub al commit actual de su rama base y commitearlo en el hub.
2. Sin push, nunca. El commit queda local en el hub para que el usuario lo revise y lo empuje.
3. Repos enlazados por SYMLINK: no hay gitlink que mover. Que el comando lo diga explicitamente en
   su salida para que no parezca que se ha olvidado.
4. Dry-run: `--dry-run` (o lo que ya use bond) mostrando que puntero moveria de que commit a cual,
   sin tocar nada.
5. Si un submodulo ya apunta a la base, decir que esta al dia y no commitear nada vacio.
6. Si el submodulo esta sucio, desincronizado o su base no se puede resolver, NO tocar y explicar
   por que, por repo.

PASOS
1. Lee antes `cli/hub.mts`, `cli/hub-sync` (donde este `syncHub`), `cli/hub-pull.mts` y los tests
   `test/hub*.mts`. En `main` hay maquinaria reciente que ya avanza refs de base desincronizadas en
   `hub pull` (commits `b3a740e` y `c23f375`): apoyate en ella en vez de duplicarla.
2. Decide donde vive la accion y registrala como decision con `bond decisions add` (title, context,
   decision, alternatives, consequences) SIN `--confirmed-by`: entra como propuesta para que la
   revise el usuario.
3. Implementa. Mantén el estilo del repo.

REGLAS
- Textos de consola: al catalogo `cli/messages/hub.mts` con su clave en `es` y su traduccion en
  `en` (estan tipados contra `es`: sin traduccion, `npm run typecheck` falla). Importa `t` como ya
  lo hacen esos ficheros.
- Ayuda y docs: anade la ayuda del comando nuevo o de la opcion nueva, actualiza `docs/reference.md`
  y `docs/en/reference.md`, y mete una entrada en `## Sin publicar` del `CHANGELOG.md` (regla del repo).
- NO toques: `cli/messages.mts`, `cli/instructions.mts` (lo que recibe el agente no se traduce),
  `docs/plans/*`, `bunfig.toml`.
- Pruebas: cubre al menos (a) puntero movido a la base y commit creado en el hub SIN push;
  (b) submodulo ya al dia -> nada commiteado; (c) symlink -> se dice que no aplica; (d) dry-run ->
  no toca nada y muestra el de-a; (e) submodulo sucio -> no toca y explica.
- Verifica: `npx tsc -p .` limpio y `bun test` en verde (base: 546 pass / 0 fail; tus pruebas suman).
- Commits conventional en ingles, trailer `Agent: pi/<tu nombre>`, `Closes #43` en el ultimo.
  Puedes empujar TU rama. PROHIBIDO: fusionar, empujar a main, abrir PR, tocar otra rama.

INFORME FINAL (ultima respuesta, sin banner)
- Donde has puesto la accion (comando nuevo u opcion) y por que esa y no la otra.
- Que hace cada caso (al dia, symlink, sucio, dry-run) y como lo dice.
- Ficheros tocados y pruebas nuevas.
- `npx tsc -p .` y `bun test` tal cual.
- Id de la decision registrada y SHAs de los commits.
- Si algo no se puede hacer como se pide, digelo con el motivo exacto en vez de inventar.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report

## Informe

**Dónde vive la acción y por qué.** Comando nuevo: `bond hub bump`, en `cli/hub-bump.mts` (misma forma que `hub-pull`: decisión por repo leída en seco, aplicación aparte, informe, `--dry-run`, `--json`). Descarté `--bump` en `hub pull` porque pull tiene contrato explícito de «nunca commitea» (solo fetch + fast-forward de refs) y meterle un commit en el hub mezclaría dos efectos. Descarté `--bump` en `hub sync` porque sync es «dejar el disco como dice `hub.toml`» (montar enlaces, bond init, registro) y tampoco commitea. bump consume el estado local que `hub pull` avanza (b3a740e/c23f375) en vez de duplicar esa maquinaria: el flujo es `bond hub pull` → `bond hub bump` → revisar y empujar.

**Qué hace cada caso.**
- **Movido**: el gitlink (`160000` en el índice del hub) no apunta a la base → `git update-index --cacheinfo` al commit de `refs/heads/<base>` del submódulo y un único commit `chore: bump submodules to base` en la rama actual del hub. Salida: `sub (repos/sub)  movido abc1234 → def5678 (base main)` y `commit <sha> creado en el hub; sin push, revísalo y empújalo tú`. Si el submódulo estaba limpio en HEAD separado, tras el commit se le actualiza el checkout al nuevo puntero para dejar el hub limpio.
- **Al día**: puntero == base → `al día`, nada commiteado.
- **Symlink**: `no aplica: enlazado por symlink, no hay gitlink que mover` (línea explícita por repo, nunca silencio).
- **Sucio / desincronizado / base no resolvable / fuera de disco / no registrado en el índice**: saltado con el motivo por repo (`saltado: N cambio(s) sin commitear en el submódulo`; `desincronizado: su HEAD (x) no coincide ni con el puntero del hub (y) ni con su base (z)`); no toca nada.
- **Dry-run**: `movería abc1234 → def5678 (base main)` con prefijo `[dry-run]`, sin tocar índice ni commits.
- **Extra de seguridad**: aborta (exit 1) si el hub tiene cambios ya `staged`, para no commitear nada ajeno. Nunca hace push.

**Ficheros.** Nuevos: `cli/hub-bump.mts`, `test/hub-bump.test.mts` (12 pruebas: movido+commit sin push, al día, symlink, dry-run, sucio, desincronizado, HEAD separado sincronizado, staged abort, json, ayuda, fuera de hub, opción desconocida). Tocados: `cli/hub.mts` (dispatch `bump`), `cli/messages/hub.mts` (grupo `hub-bump.*` en `es` y `en` + línea en `hub.help`), `docs/reference.md`, `docs/en/reference.md` (sección `### bond hub bump`), `CHANGELOG.md` (`## Sin publicar`).

**Verificación.**
- `npx tsc -p .` → exit 0, sin errores.
- `bun test` → `558 pass / 0 fail` (base 546 + 12 nuevas), 3494 expect, 29 ficheros.

**Decisión.** `2026-11-03-hub-bump-comando-nuevo-bond-hub-bump-en-cli-hub-bump-mts` (proposed, sin `confirmed-by`), en `docs/decisions/`, commiteada en la rama.

**Commits** (rama `feat/hub-bump-base`, empujada; nada fusionado ni push a main):
- `77b199f` feat(hub): bump submodule pointers to their base with bond hub bump
- `36966a1` docs(decisions): record the hub bump command decision (`Closes #43`)

Nada pendiente: todo lo pedido es realizable y está hecho.
