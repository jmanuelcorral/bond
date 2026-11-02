---
agent: "kevin"
kind: "pi"
branch: "fix/hub-init-validation"
base: "main@835be78"
orchestrator: "pi/gru"
started_at: "2026-11-02T14:43:39Z"
finished_at: ""
status: "sent"
commits: []
decisions: []
---

## Request

**2026-11-02T14:43:39Z**

Estas en un worktree de bond (rama fix/hub-init-validation) creado desde main. bond es una CLI en TypeScript (ficheros .mts, sin paso de compilacion para ejecutar) que configura y opera varios agentes de codigo. Tarea: arreglar tres bugs de validacion y mensajes, los tres en el area de `hub init` / `hub sync`, en UNA sola rama y un solo PR. No hay skills instaladas aqui: sigue estas instrucciones tal cual.

BUG 1 - issue #40: `bond hub init <ruta>` con una sola ruta es ambiguo
Fuera de un repo, `bond hub init <ruta>` toma esa ruta como EL HUB y no como un repo a importar, asi que `bond hub init ../api` crea el hub dentro de `../api`. Arreglo: que sea explicito. Acepta `bond hub init . <ruta>` (hub en el directorio actual, repo a importar la ruta dada) y/o una opcion `--repo <ruta>`, y deja claro en la ayuda que con una sola ruta esa ruta es el hub. Si decides mantener el comportamiento actual, hazlo inequivoco: ayuda explicita y, si la ruta unica parece un repo a importar en vez de un hub, avisar antes de crear nada.

BUG 2 - issue #35: `bond hub init` acepta un origen vacio y deja `hub.toml` invalido
Con `bond hub init . --yes file:// <ruta>` (origen vacio) escribe `[repos.]`, que no es TOML valido, y el hub queda inservible. Debe rechazar el origen con un error claro ANTES de escribir nada. Revisa tambien otros casos de entrada vacia o malformada en esa ruta de codigo (nombre de repo vacio, url vacia) y rejectalos igual, antes de tocar disco.

BUG 3 - issue #39: `bond hub sync` dice «falta hub.toml» cuando existe pero no se puede leer
Con un `hub.toml` invalido, `bond hub sync` avisa del error de parseo y luego termina con `error: no es un hub: falta hub.toml`. El fichero existe. El mensaje final debe decir que existe pero no se puede leer, incluyendo el error de parseo. Distinguir «no existe» de «existe y no se parsea» en TODOS los sitios que hoy dan ese mensaje, no solo en `sync`.

PASOS
1. Lee antes `cli/hub-init.mts`, `cli/hub.mts`, `cli/hub-check.mts` y `cli/hub-pull.mts`, y las pruebas `test/hub*.mts`, para ver donde se parsea `hub.toml`, donde se resuelven las rutas de argumento y donde se emite «falta hub.toml».
2. Arregla los tres bugs. Mantén el estilo del repo.
3. Pruebas nuevas: reproduce cada bug antes de arreglarlo. Minimo: (a) `hub init` con una sola ruta fuera de un repo -> comportamiento documentado y explicito; (b) origen vacio -> error claro y NADA escrito en disco; (c) `hub.toml` invalido -> el mensaje dice que no se puede leer, no que falta.
4. Textos de consola nuevos: van al catalogo `cli/messages/hub.mts` con su clave en `es` y su traduccion en `en` (el catalogo esta tipado contra `es`: sin traduccion, `npm run typecheck` falla). Importa `t` como ya lo hacen esos ficheros.
5. Ayuda: si cambia la firma de `bond hub init`, actualiza su ayuda y tambien `docs/reference.md` y `docs/en/reference.md`, y anade una entrada en `## Sin publicar` del `CHANGELOG.md` (regla del repo).
6. NO toques: `cli/messages.mts`, `cli/instructions.mts` (lo que recibe el agente no se traduce), `docs/plans/*`, `bunfig.toml`, ni ficheros fuera del area de hub.
7. Verifica: `npx tsc -p .` limpio y `bun test` en verde (base: 523 pass / 0 fail; tus pruebas suman).
8. UN commit por bug, conventional en ingles, con trailer `Agent: pi/<tu nombre>` y linea `Closes #40` / `Closes #35` / `Closes #39` segun corresponda. Prohibido push, abrir PR, tocar otra rama.

INFORME FINAL (ultima respuesta, sin banner)
- Que cambiaste en cada bug y por que queda resuelto.
- Que decidiste en #40 (una sola ruta: que significa ahora) y por que.
- Ficheros tocados y pruebas nuevas.
- Resultado de `npx tsc -p .` y `bun test` copiado tal cual.
- SHAs de los commits.
- Si algo no se puede arreglar como se pide, digelo con el motivo exacto en vez de inventar una solucion.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report


