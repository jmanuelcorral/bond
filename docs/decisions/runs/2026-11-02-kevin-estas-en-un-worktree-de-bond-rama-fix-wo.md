---
agent: "kevin"
kind: "agy"
branch: "fix/worktree-namespace"
base: "main@add299c"
orchestrator: "pi/gru"
started_at: "2026-11-02T14:04:25Z"
finished_at: "2026-11-02T14:31:24Z"
status: "reported"
commits:
  - "998951d fix(team): isolate worktree directories by repository canonical path"
decisions:
  - "2026-11-02-espacio-de-nombres-unico-para-worktrees-por-ruta-canonica-del-repo"
---

## Request

**2026-11-02T14:04:25Z**

Estas en un worktree de bond (rama fix/worktree-namespace) creado desde main. Tarea: arreglar el issue #36. No hay skills aqui: sigue estas instrucciones tal cual.

ISSUE #36: un hub y un repo con la misma carpeta comparten ~/.herdr/worktrees/<nombre>
Los worktrees de `bond team` van a `~/.herdr/worktrees/<nombre de la carpeta del repo>/`. Dos hubs, o un hub y un repo, que se llamen igual (p. ej. `testapp/hub` y la demo de los videos, tambien `hub`) comparten directorio y pueden pisarse.

QUE SE PIDE
Que dos repos distintos (hub o no) no puedan acabar en el mismo directorio de worktrees, manteniendo las rutas legibles.

PASOS
1. Localiza primero TODO el codigo que construye o interpreta esa ruta (busca `.herdr/worktrees`, y como lo resuelven `bond team`, `bond team clean`, el modo hub y lo que reanuda o busca worktrees por rama). Hazte una idea completa antes de tocar nada: el arreglo tiene que cubrir todos los sitios, no solo donde se crea.
2. Elige un esquema que sea estable y legible y que distinga por algo que no dependa del nombre de la carpeta: la ruta absoluta del repo (p. ej. un sufijo corto derivado de ella, o un nivel mas de carpeta). Evita esquemas que cambien en cada ejecucion: la ruta tiene que ser la misma siempre para el mismo repo, porque `clean`, `status` y el modo hub la vuelven a calcular.
3. Ten en cuenta lo que ya existe: si hay worktrees creados con el esquema viejo, el codigo no debe quedarse ciego ante ellos. Decide y documenta que pasa (que se localicen tambien, o que se informe con un mensaje claro de como migrar). No borres worktrees de mas.
4. En modo hub, verifica que el nombre que sale en `bond team status` y en los paneles sigue siendo legible y que las rutas de los distintos repos de la sesion no colisionan entre si.

REGLAS
- Pruebas: anade al menos (a) dos repos con la misma carpeta base y rutas distintas -> directorios de worktree distintos; (b) el mismo repo -> misma ruta siempre; (c) `bond team clean` encuentra y limpia lo que `bond team` creo con el esquema nuevo.
- Verifica: `npx tsc -p .` limpio y `bun test` en verde (base: 519 pass / 0 fail; tus pruebas suman).
- Textos nuevos de consola: al catalogo que corresponda (`cli/messages/team.mts` o `cli/messages/hub.mts`) con su clave `es` y su traduccion `en` (sin traduccion, el typecheck falla).
- NO toques: `cli/messages.mts`, `cli/instructions.mts`, `docs/plans/*`, `bunfig.toml`.
- El esquema de rutas es una decision de diseno: registrala con `bond decisions add --title ... --context ... --decision ... --alternatives ... --consequences ...` (sin --confirmed-by: va como propuesta para que la revise el usuario).
- UN commit conventional en ingles con trailer `Agent: agy/<tu nombre>` y linea `Closes #36`. Prohibido push, PR, tocar otra rama.

INFORME FINAL (ultima respuesta, sin banner)
- Esquema elegido y por que; alternativas descartadas.
- Que pasa con los worktrees del esquema viejo.
- Ficheros tocados y pruebas nuevas.
- Resultado de `npx tsc -p .` y `bun test` tal cual.
- Id de la decision registrada y SHA del commit.
- Si algo no se puede arreglar sin romper otra cosa, digelo con el motivo exacto en vez de inventar.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report

### Esquema elegido y por qué; alternativas descartadas

- **Esquema elegido**: `<nombre>-<hash>` como directorio de espacio de nombres en `~/.herdr/worktrees/`, donde `<nombre>` es el nombre del repositorio o hub (`basename` o `s.name`) y `<hash>` son los primeros 7 caracteres hexadecimales del SHA-256 de la ruta canónica (`canonical(root)` normalizada).
  - Repositorio estándar: `~/.herdr/worktrees/<nombre>-<hash>/<rama>`
  - Modo hub: `~/.herdr/worktrees/<hub>-<hash>/<sub>/<rama>`
  - **Por qué**: Es determinista, estable entre ejecuciones y lecturas sucesivas, no desborda la profundidad de carpetas ni la longitud visual en `ls` o prompts, y garantiza que dos repositorios con el mismo nombre base en rutas distintas tengan espacios de nombres aislados.
- **Alternativas descartadas**:
  - *Nivel adicional de carpeta (`~/.herdr/worktrees/<nombre>/<hash>/<rama>`)*: Descartada por añadir profundidad innecesaria al árbol y requerir lógica extra de borrado en cascada.
  - *Jerarquía completa de rutas del sistema (`~/.herdr/worktrees/home/user/...`)*: Descartada por generar rutas excesivamente largas y difíciles de leer en la terminal.

### Qué pasa con los worktrees del esquema viejo

- Los worktrees creados con el esquema anterior (`~/.herdr/worktrees/<nombre>/...`) siguen siendo descubiertos automáticamente por `git worktree list --porcelain` (`gitWorktrees`).
- En `teamRows` y `sessionRows`, su ruta sigue conteniendo `.herdr/worktrees/`, por lo que se marcan como `managed: true`.
- `bond team status` los lista y monitoriza con normalidad.
- Si se invoca `bond team <rama>` para una rama que ya tenía worktree en el esquema anterior, `pendingInTab` detecta el worktree existente en git y lo reutiliza sin duplicarlo.
- `bond team clean` los elimina de git y de disco. Al quedar vacía la carpeta del repositorio o del hub viejo, se limpia con `rmdirSync` sin borrar carpetas ajenas ni worktrees de más.

### Ficheros tocados y pruebas nuevas

- **Ficheros tocados**:
  - [`cli/team.mts`](file:///home/jose/.herdr/worktrees/bond/fix-worktree-namespace/cli/team.mts): implementación de `worktreeNamespace()`, actualización de `tabWorktreePath()` para calcular el espacio de nombres según la ruta del repositorio/hub, invocación con `root` en `openInTab()`, y soporte de limpieza de directorios padre y esquema previo en `removeWorktrees()` y `cleanInHub()`.
  - [`CHANGELOG.md`](file:///home/jose/.herdr/worktrees/bond/fix-worktree-namespace/CHANGELOG.md): entrada descriptiva en `## Sin publicar`.
  - [`docs/reference.md`](file:///home/jose/.herdr/worktrees/bond/fix-worktree-namespace/docs/reference.md): actualización de la ruta de worktrees documentada.
  - [`docs/decisions/2026-11-02-espacio-de-nombres-unico-para-worktrees-por-ruta-canonica-del-repo.md`](file:///home/jose/.herdr/worktrees/bond/fix-worktree-namespace/docs/decisions/2026-11-02-espacio-de-nombres-unico-para-worktrees-por-ruta-canonica-del-repo.md): registro de la decisión de diseño.
  - [`test/team.test.mts`](file:///home/jose/.herdr/worktrees/bond/fix-worktree-namespace/test/team.test.mts): pruebas unitarias y de integración para aislamiento de repositorios, estabilidad de ruta y limpieza de esquemas nuevo y previo.
  - [`test/team-hub.test.mts`](file:///home/jose/.herdr/worktrees/bond/fix-worktree-namespace/test/team-hub.test.mts): actualización de aserciones de integración que verificaban la ruta del worktree contra el fixture del hub.
- **Pruebas nuevas en `test/team.test.mts`**:
  - `dos repos con la misma carpeta base y rutas distintas tienen directorios de worktree distintos`
  - `el mismo repo produce la misma ruta siempre`
  - `bond team clean encuentra y limpia lo que bond team creó con el esquema nuevo`
  - `bond team clean también encuentra y limpia worktrees con el esquema viejo (compatibilidad)`

### Resultado de `npx tsc -p .` y `bun test`

```
npm notice run bond@1.11.0 npx
npm notice run 'tsc' -p .

 523 pass
 0 fail
 3289 expect() calls
Ran 523 tests across 28 files. [64.56s]
```

### Id de la decisión registrada y SHA del commit

- **Id de la decisión**: `2026-11-02-espacio-de-nombres-unico-para-worktrees-por-ruta-canonica-del-repo`
- **SHA del commit**: `998951d52e5a6bfa40a134ddaf91a8cd904f8f47`
