---
agent: "kevin"
kind: "pi"
branch: "feat/hub-exec"
base: "main@cf642f8"
orchestrator: "pi/gru"
started_at: "2026-11-03T09:37:10Z"
finished_at: "2026-11-03T09:58:15Z"
status: "reported"
commits:
  - "d3c358e feat(hub): add bond hub exec to run a command across the session"
  - "1ce48b3 test(hub): cover bond hub exec ordering, exit codes, shell and stdin"
  - "418f556 docs: document bond hub exec usage, shell opt-in and exit codes"
  - "b8f8574 docs(decisions): record the hub exec decisions for #46"
decisions:
  - "2026-11-03-bond-hub-exec-requires-before-the-command"
  - "2026-11-03-bond-hub-exec-direct-argv-by-default-shell-opt-in-first-shell-use-in-bond"
---

## Request

**2026-11-03T09:37:10Z**

Estas en un worktree de bond (rama feat/hub-exec) creado desde main. bond es una CLI en TypeScript (.mts, sin paso de compilacion) que opera varios agentes de codigo sobre git y el multiplexor Herdr. Un "hub" es un repo que agrupa varios repos de una sesion, declarados en `hub.toml`, cada uno enlazado como submodulo git o como symlink. Tarea: issue #46. No hay skills aqui: sigue estas instrucciones tal cual.

ISSUE #46: `bond hub exec <cmd>` - ejecutar un comando en el hub y en cada repo de la sesion. Puede ser destructivo: necesita confirmacion, `--dry-run` y salida por repo.

DECISIONES YA TOMADAS POR EL USUARIO (no las reabras, aplícalas tal cual)
1. **`--` obligatorio**: `bond hub exec [opts de bond] -- <cmd...>`. Todo lo que va despues del `--` es el comando y sus argumentos; bond no lo interpreta. Sin `--`, error claro explicando la forma correcta.
2. **argv directo por defecto, `--shell` opt-in**. Sin shell: se ejecuta `<cmd>` con sus argumentos tal cual, SIN pipes, `&&` ni globs. Con `--shell`: se pasa por shell del sistema para quien lo necesite. Motivo: en Windows el shell es cmd.exe con semantica distinta y meter shell por defecto en algo que se propaga a N repos es un riesgo.
3. **Sigue en todos los repos**: si un repo falla, no se corta el resto. El **exit code final es el peor** (el maximo) de los que devolvieron los repos, para que `bond hub exec -- npm test` sirva en scripts.
4. **Una sola confirmacion** antes de ejecutar, que liste los repos afectados y el comando EXACTO que se va a correr en cada uno. Saltable con `--yes` / `-y`. Con `--dry-run` no se pregunta porque no se ejecuta nada.
5. **Secuencial**, repo a repo, con cabecera por repo en la salida. No paralelizas (entrelazaria la salida).
6. **stdin**: si el comando lee stdin, bajo un agente no hay TTY y se colgara. Debe **fallar con mensaje claro en vez de colgarse** (p. ej. cerrar stdin al hijo y detectar el intento, o rechazar por adelantado lo que se pueda). Piensalo y elige el mecanismo, pero el requisito es: nunca colgado.

DONDE ESTAS (apoyate en lo que hay, no dupliques)
- `cli/hub-bump.mts:226` (`hubBump`) es el MOLDE de forma: parseo de opts, `hubRoot()`, `hubSession()`, resultado por repo, informe, `--dry-run`, `--json`. Copia esa estructura.
- Confirmacion: mira `cli/catalog.mts:436` (`confirm(lines, yes)`) y `cli/hub-check.mts:303` - usan `p.confirm` de @clack y `die(..., 130)` al cancelar. Reusa el patron.
- El parseo de bond es lista blanca (`args.includes(...)` + `die` en desconocidas). El `--` es lo que permite que el comando arbitrario no choque con ella: parsea los opts de bond ANTES del `--` y todo lo despues es el comando.
- `bond nunca usa shell` hoy: no hay ningun `shell: true` en `cli/`. Si lo anades con `--shell`, que sea la unica excepcion y dejalo claro en el codigo.
- `cli/hub-status.mts` (recien merged) tiene el estado por repo; si te sirve para saber que repos estan presentes, usalo.

REGLAS
- `--dry-run`: muestra que comando se correra en que repo, sin ejecutar nada.
- `--json`: salida por repo con comando, cwd, exit code, stdout, stderr y si se confirmo o no.
- Repos `not present`: se omiten y se dice. Symlink y submodulo: ambos reciben el comando (es su working tree).
- Textos de consola: al catalogo `cli/messages/hub.mts` con su clave en `es` y su traduccion en `en` (estan tipados contra `es`: sin traduccion, `npm run typecheck` falla). Importa `t` como ya lo hacen esos ficheros.
- Docs: ayuda de `bond hub exec`, `docs/reference.md` y `docs/en/reference.md`, y entrada en `## Sin publicar` del `CHANGELOG.md` (regla del repo).
- NO toques: `cli/messages.mts`, `cli/instructions.mts` (lo que recibe el agente no se traduce), `docs/plans/*`, `bunfig.toml`.
- Registra las decisiones de diseno con `bond decisions add` (minimo la del `--` obligatorio y la de argv-vs-shell, que es la que cambia un patrón del repo: `hub exec` sera el primer shell de bond), con contexto y alternativas descartadas, SIN `--confirmed-by`: el usuario ya las aprobo en la conversacion pero el registro entra como propuesta para trazabilidad.
- Pruebas: cubre al menos (a) comando ejecutado en el hub y en cada repo de la sesion, en orden, con cabecera por repo; (b) `--` ausente -> error claro y nada ejecutado; (c) exit code peor: un repo falla con 3 y otro con 1 -> el global es 3; (d) sigue adelante tras un fallo; (e) `--dry-run` no ejecuta nada y muestra el de-a; (f) `--yes` no pregunta; (g) cancelar la confirmacion no ejecuta nada y sale 130; (h) `--shell` permite algo que argv no (p. ej. un pipe) y sin el flag NO lo permite; (i) `--json` con los campos; (j) repo `not present` se omite y se dice; (k) el mecanismo de stdin no cuelga (prueba un comando que intente leer stdin y comprueba que termina).
- Verifica: `npx tsc -p .` limpio y `bun test` en verde (base: 572 pass / 0 fail; tus pruebas suman).
- OJO con el entorno de CI: los fixtures que crean repos deben fijar TODO lo que dependa de la config global de git (p. ej. `-c init.defaultBranch=main`), porque la del runner no es la de tu maquina. Y en Windows: rutas con `\`, sin symlinks (junctions) y comandos que existan en las tres plataformas - no uses `true`/`false`/`echo` suponiendo POSIX si hay forma portable.
- Commits conventional en ingles, trailer `Agent: pi/<tu nombre>`, `Closes #46` en el ultimo. Puedes empujar TU rama. PROHIBIDO: fusionar, empujar a main, abrir PR, tocar otra rama.

INFORME FINAL (ultima respuesta, sin banner)
- Forma exacta del comando con un par de ejemplos de uso real.
- Mecanismo que elegiste para stdin y por que no puede colgar.
- Como se propaga el exit code y que sale en cada caso (cancelado, repo ausente, fallo parcial).
- Que es exactamente lo que muestra la confirmacion.
- Ficheros tocados y pruebas nuevas.
- `npx tsc -p .` y `bun test` tal cual.
- Ids de las decisiones registradas y SHAs de los commits.
- Si algo no se puede hacer como se pide, digelo con el motivo exacto en vez de inventar.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report

## Informe

**Forma exacta**

```
bond hub exec [opciones-de-bond] -- <comando> [args...]
```

Opciones antes del `--`: `--dry-run`, `--yes`/`-y`, `--shell`, `--json`, `-h`/`--help`. Sin `--`, error claro y nada ejecutado. Ejemplos reales:

```bash
bond hub exec --yes -- npm test               # prueba en el hub y en cada repo de la sesión
bond hub exec --dry-run -- git status -sb     # ver el de-a sin ejecutar
bond hub exec --yes --shell -- "make lint | tee /tmp/lint.log"   # pipe, solo con --shell
```

**stdin (por qué no puede colgar):** el hijo se ejecuta con `stdio[0] = "ignore"`, es decir stdin apuntando a `/dev/null` (`NUL` en Windows). Cualquier lectura devuelve EOF al instante: `cat`-like termina, no espera. No hay TTY que bloquear ni timeout de por medio (el comando del usuario dura lo que dura; lo que garantiza el no-cuelgue es el stdin cerrado, no un reloj). Probado en (k) con `readFileSync(0)`.

**Exit code:** final = máximo de los exit codes de los repos ejecutados. Cancelada la confirmación → 130 y nada ejecutado. Repo `not present` → se omite, no suma. Sin TTY y sin `--yes` → 1 (se niega a ejecutar). Comando inexistente → 127. Fallo parcial (3 y 1) → 3, habiendo corrido todos.

**La confirmación muestra:** «Se va a ejecutar en N repo(s) de la sesión:», el comando exacto (en modo shell, prefijado `/bin/sh -c «…»` / `cmd.exe /c «…»`) y la lista de repos afectados con su ruta absoluta; luego `p.confirm` de @clack con `initialValue: false`. Cancelar o responder «no» → 130. Con `--json` la pregunta se desvía a stderr (incluido el write propio de clack) para que stdout sea solo el informe.

**Ficheros**

- `cli/hub-exec.mts` (nuevo): núcleo `hubExecRun` (inyectable `confirm`, testeable sin TTY), `shellInvocation` marcada como única excepción shell del repo, CLI con parseo antes del `--`.
- `cli/hub.mts`: dispatch `exec`; `cli/messages/hub.mts`: `hub.exec.*` en `es` y `en` + línea en `hub.help`.
- `test/hub-exec.test.mts` (nuevo): 16 pruebas cubriendo (a)–(k) más `--help`, `--` vacío, opción desconocida, negativa sin TTY y 127.
- `docs/reference.md`, `docs/en/reference.md`, `CHANGELOG.md` (`## Sin publicar`), `docs/decisions/` (2 ficheros, commiteados en la rama).

**Verificación**

- `npx tsc -p .` → limpio (exit 0).
- `bun test` → **588 pass / 0 fail** (base 572 + 16 nuevas).

**Decisiones registradas** (proposed, sin `confirmed_by` como se pidió)

- `2026-11-03-bond-hub-exec-requires-before-the-command`
- `2026-11-03-bond-hub-exec-direct-argv-by-default-shell-opt-in-first-shell-use-in-bond`

**Commits** (empujados a `feat/hub-exec`, nada fusionado ni abierto)

- `d3c358e` feat(hub): add bond hub exec to run a command across the session
- `1ce48b3` test(hub): cover bond hub exec ordering, exit codes, shell and stdin
- `418f556` docs: document bond hub exec usage, shell opt-in and exit codes
- `b8f8574` docs(decisions): record the hub exec decisions for #46 (lleva `Closes #46`)

Nada pendiente: todo lo pedido es realizable y está hecho. Nota: el modo `--shell` en Windows (`cmd.exe /d /s /c`) está escrito y testeado en Linux; la pata Windows del pipe la confirmará el runner de CI.
