# El puesto de trabajo: `bond`, `bond team` y `bond status`

Esta es la página del día a día. Ya tienes bond configurado en la máquina (`bond setup`) y el
repo preparado (`bond init`), así que toca lo bueno: sentarte a trabajar con tus agentes. Aquí
vas a ver cómo se abre el puesto de trabajo en Herdr, cómo repartir trabajo entre varios agentes
a la vez y cómo saber en todo momento quién está haciendo qué.

La idea de fondo es sencilla. Tú hablas con `gru`, el agente que orquesta, y cuando hay trabajo
que se puede hacer en paralelo, lo repartes entre los minions, cada uno en su rama y en su propio
worktree. Ellos se pelean con el código; tú revisas e integras. Licence to code, pero con
supervisión.

Este es el resumen rápido, por si solo venías a por la chuleta:

```bash
cd ~/gitrepos/mi-proyecto
bond                              # agente por defecto (default_agent de .bond/bond.toml)
bond --agent claude               # otro de los agentes del repo
bond --worktree feat/login        # en un worktree de git para esa rama
bond dev ~/gitrepos/otro          # lo mismo para otro directorio
bond team . feat/a feat/b:claude  # un agente por rama, cada uno en su worktree
bond status                       # agentes vivos
```

`bond status` es el más corto de todos y te lista los agentes que siguen vivos. El resto merece
un paseo con calma.

## Abrir el puesto con `bond`

<figure class="bond-video">
<video src="/videos/puesto.mp4" controls muted playsinline preload="metadata"></video>
<figcaption>bond abre fluzo en Herdr con gru (pi), le preguntamos de qué va el repo y miramos bond status en una shell al lado.</figcaption>
</figure>

Imagina que estás en `~/gitrepos/mi-proyecto` y escribes `bond`, a secas. Lo que obtienes es el
puesto de trabajo del repo en Herdr: el agente por defecto, que se llama `gru`, solo en su panel
y listo para que le hables. Si te gusta tener una terminal a mano, añade `--shell` y tendrás una
shell al lado.

Por debajo, bond hace unas cuantas comprobaciones para que no tengas que pensar en ellas.

Lo primero es mirar si el repo está preparado. Si no tiene `.bond/bond.toml`, te pregunta si
quieres inicializarlo con `bond init`. Y si ni siquiera estás dentro de un repo git, `bond` te
enseña la ayuda, que es lo más útil que puede hacer en ese momento.

Después se asegura de que la configuración está al día. Si `bond.toml` cambió desde la última vez
y la config de algún agente se ha quedado desfasada, ejecuta `bond sync` antes de abrir nada. Los
conflictos, es decir, los ficheros que has editado a mano, no los toca.

Luego elige el agente. Usa el que le pases con `--agent`; si no le pasas ninguno, el
`default_agent` del repo; si el repo no tiene, el que elegiste en `bond setup`; y si tampoco, el
primero que encuentre instalado. En cualquier caso, el agente tiene que estar instalado y Herdr
tiene que admitirlo (lo puedes comprobar con `herdr agent start --help`).

Con el agente decidido, se ocupa de Herdr. Si estás fuera de Herdr y su servidor no está en
marcha, lo arranca en segundo plano. Si ya estás dentro, no anida otro Herdr dentro del tuyo, que
eso no le hace gracia a nadie.

Ahora busca el workspace, que lleva la etiqueta `bond:<repo>` (o `bond:<repo>/<rama>` si usas
`--worktree`). Si ya existe, simplemente lo enfoca y termina, así que puedes escribir `bond`
tantas veces como quieras sin acabar con diez copias del mismo puesto. También reconoce las
etiquetas antiguas, las de tipo `pi:<repo>`.

Si hay que crearlo, monta los paneles. El agente va solo en el panel raíz. Con `--shell`, la shell
se abre a la derecha y el reparto queda en 60 % para el agente y 40 % para la shell. El agente del
checkout principal se llama `gru`, porque es el que orquesta; si ya hay otro `gru` en Herdr, este
será `gru-2`, `gru-3` y así. Con `--worktree`, el nombre sigue el patrón
`<agente>-<repo>-<rama>`.

Por último, si lanzaste `bond` desde fuera de Herdr, al terminar engancha su interfaz para que
aparezcas directamente en el puesto. Si no quieres eso, `--no-attach` lo evita, y `--no-focus` va
un paso más allá y lo deja todo en segundo plano sin cambiarte de workspace.

Un detalle importante. Algunos agentes se paran a hacer una pregunta al arrancar; Claude Code, por
ejemplo, te pide que confirmes si confías en una carpeta nueva, y eso pasa a menudo en un
worktree. Cuando ocurre, bond te lo dice y no contesta por ti. Esa decisión es tuya.

## Opciones

Esta tabla sí merece seguir siendo tabla, porque es lo que vas a querer consultar de un vistazo:

| Opción | Efecto |
|---|---|
| `-a`, `--agent <agente>` | Otro agente en vez del de por defecto |
| `-w`, `--worktree <rama>` | Worktree para esa rama con `herdr worktree` (lo crea, o lo abre si existe), colgado del workspace `bond:<repo>` |
| `-b`, `--base <ref>` | Con `--worktree`: de dónde sale una rama nueva |
| `--shell` | Una shell en otro panel, junto al agente |
| `-d`, `--direction <right\|down>` | Con `--shell`: dónde va la shell (defecto: `right`) |
| `-r`, `--ratio <0.1-0.9>` | Con `--shell`: fracción del panel del agente (defecto: 0.6) |
| `-l`, `--label <texto>` | Etiqueta del workspace |
| `--no-agent` | Una shell en vez del agente |
| `--no-attach` | No enganchar la interfaz de Herdr |
| `--no-focus` | En segundo plano: ni enfoca ni engancha |
| `--trust-repository` | Se pasa a `herdr worktree` (solo en repos que hayas revisado) |
| `-- args…` | Argumentos para el agente, p. ej. `-- --model halo/flash-halogen` |

## `bond team`

<figure class="bond-video">
<video src="/videos/orquestador.mp4" controls muted playsinline preload="metadata"></video>
<figcaption>Así se ve desde dentro: Claude, solo en su panel, monta un equipo de dos minions pi con bond team, les reparte una web, revisa, pide correcciones, integra y limpia. Una sola instrucción, sin cortes.</figcaption>
</figure>

Aquí es donde bond se pone interesante. Con `bond team` abres un worktree y un agente por cada
rama que le pidas, y tienes a la vista cómo va cada una. Estos son sus cuatro modos:

```bash
bond team [repo] <rama[:agente]>... [--agent <a>] [--base <ref>] [--tabs | --same-tab | --workspaces] [--yes] [--no-trust] [-- args de los agentes]
bond team status [repo] [--base <ref>] [--json | --watch [--keep-open]]
bond team prompt <rama> "la tarea" [--wait] [--timeout <ms>]
bond team clean [repo] [rama...] [--force] [--delete-branch] [--keep-table] [--dry-run]
```

### Un ejemplo de principio a fin

<figure class="bond-video">
<video src="/videos/equipo.mp4" controls muted playsinline preload="metadata"></video>
<figcaption>Dos ramas, dos minions pi: cada uno hace su cambio y su commit, y la tabla en vivo los pasa a «Por revisar». (La espera está recortada.)</figcaption>
</figure>

Sigamos en `mi-proyecto`, con `gru` abierto. Tienes dos cosas que hacer que no se pisan entre
sí, el login y la página de pagos, y quieres que vayan a la vez. Desde la shell del repo:

```bash
bond team . feat/login feat/pagos:claude
bond team prompt feat/login "implementa el login con email y contraseña"
bond team prompt feat/pagos "añade la página de pagos"
```

La primera línea levanta el equipo. `feat/login` se queda con el agente por defecto y
`feat/pagos` va con Claude Code, porque se lo has pedido con `:claude`. Las otras dos le mandan a
cada rama su tarea. Mientras trabajan, tú sigues con lo tuyo y vas echando un ojo a la tabla. Cuando
una rama sale como `lista`, la revisas, la integras tú como prefieras y al final recoges con
`bond team clean`. Vamos por partes.

### Qué vas a ver en pantalla

Si estás dentro de Herdr, cada agente aparece en un panel de tu propia pestaña, debajo del tuyo,
todos en fila y con el mismo ancho. Cada uno recibe el nombre de un minion, el primero que esté
libre (`kevin`, `stuart`, `bob`, `dave`...), y su panel se titula, por ejemplo, `kevin · <rama>`.
Así sabes de un vistazo quién lleva qué. Su worktree vive en `~/.herdr/worktrees/<repo>/<rama>`.

A la derecha de tu panel se abre otro estrecho, `tabla · <repo>`, con la tabla en vivo
(`bond team status --watch`) de todas las ramas del repo, estén donde estén. Si esa tabla ya
estaba abierta de antes, bond la reutiliza en vez de abrir otra.

Si lanzas `bond team` fuera de Herdr, el comportamiento es el de siempre: un workspace por rama
con `herdr worktree`.

### Cuando no caben todos

Tu pestaña admite 6 paneles: el tuyo, la tabla y 4 minions, y en la cuenta entran los que ya
tenga abiertos. Si los agentes nuevos caben, `bond team` no pregunta nada. Si no caben, te
pregunta antes de crear nada y te ofrece tres caminos:

1. `Pestañas nuevas` (por defecto): los que caben van a tu pestaña y el resto a pestañas nuevas
   `equipo · <repo>` (`equipo · <repo> · 2`...), 4 por pestaña y en fila.
2. `Todo en mi pestaña`: filas de 4 (del quinto en adelante, cada uno debajo del de su columna),
   aunque se apriete.
3. `Workspaces aparte`: un workspace por rama, como con `--workspaces`.

Si ya sabes lo que quieres, `--tabs`, `--same-tab` y `--workspaces` eligen sin preguntar. Y si no
hay terminal (porque la entrada o la salida están redirigidas) o pasas `--yes`, tampoco pregunta y
aplica la primera opción.

No te preocupes por dónde acabó cada uno. `status` y `clean` encuentran y cierran los paneles
estén en la pestaña que estén, y cuando se cierra el último panel de una pestaña nueva, Herdr la
quita.

### Qué agente le toca a cada rama

Si no le pasas `[repo]`, bond usa el del directorio actual. Para cada rama, el agente sale de
`rama:agente` si lo has escrito así; si no, de `--agent`; si no, del agente por defecto del repo
(`default_agent` de `.bond/bond.toml`); y si el repo no tiene, del que elegiste en `bond setup`.

bond te avisa en dos casos que conviene saber. Uno, si un agente no está entre los del repo,
porque entonces no tendrá su config. Dos, si tienes cambios sin commitear, porque los worktrees
salen de lo commiteado y no los van a ver.

### Repartir el trabajo

Una vez montado el equipo, el trabajo se reparte con `bond team prompt`, que manda una tarea al
agente de una rama sin que tengas que acordarte de si se llamaba `kevin` o `stuart`.

También puedes dejar que lo haga un agente. Desde cualquiera de ellos tienes el skill
`bond-team` (en pi, `/team`), que además te propone cómo repartir la tarea, espera tu OK y luego
recoge los resultados. Es gru haciendo de gru.

Si trabajas con planes en `docs/plans/`, el skill del catálogo `plan-team` hace lo mismo pero por
fases. Comprueba cuáles pueden ir a la vez, manda cada una con `plan-execute` (con commit en su
rama y sin push) y actualiza el plan a medida que integras cada rama.

### `bond team status`: cómo va cada rama

`status` te da una fila por cada worktree del repo con su estado, su agente, los commits que
lleva por delante de la base (por defecto, la rama del checkout principal) y los ficheros que
toca. Los estados son estos:

| Estado | Qué quiere decir |
|---|---|
| `trabajando` | El agente está en ello |
| `bloqueado` | El agente espera una respuesta tuya (p. ej. confiar en la carpeta) |
| `sin commitear` | Hay cambios en el worktree fuera de un commit |
| `lista` | Tiene commits sin integrar y toca revisar |
| `integrada` | Ya está en la base, entrara por merge, fast-forward, rebase o squash |
| `sin commits` | Nada todavía: la rama no ha avanzado desde que se creó |

### La tabla en vivo

Con `--watch` tienes la tabla en vivo, que es lo que ves en el panel `tabla · <repo>`. Ocupa la
pantalla, se refresca cada 2 s y sale con `q` o Ctrl+C dejando el terminal como estaba. Las ramas
van agrupadas por estado, empezando por lo que te está esperando a ti, y los grupos vacíos no
salen. Tiene esta pinta:

```text
MINION  RAMA    COMMITS  FICHEROS

⛔ Necesita tu respuesta
stuart  feat/b  -        -
   └ pregunta: confiar en la carpeta del proyecto

🔄 Trabajando
kevin   feat/a  +2       3

✏️ Sin commitear
bob     feat/e  -        1

📦 Por revisar
-       feat/c  +1       1

✅ Integradas / sin empezar
-       feat/d  +1       -
```

El icono va solo en el título de cada grupo, pintado del color de su estado: rojo si te espera,
amarillo si se mueve, verde si toca revisar y tenue si no hay nada. Las filas llevan el minion, la
rama, los commits y los ficheros, y debajo de una rama bloqueada aparece la pregunta que está
esperando. Como el título de cada grupo dice el estado con palabras, se entiende aunque tu
terminal no pinte bien los emoji, y las columnas se alinean contando cada emoji como dos
caracteres.

La tabla también sabe retirarse a tiempo. En el panel `tabla · <repo>`, cuando ninguna rama tiene
trabajo pendiente, muestra `sin trabajo pendiente`, espera unos segundos para que lo veas y cierra
el panel. Si antes de cerrarse vuelve a haber trabajo, sigue a lo suyo. Por trabajo pendiente se
entiende una rama en `trabajando`, `bloqueado`, `sin commitear` o `lista`, o un agente abierto
que aún no ha hecho commits. Una rama a la que la tabla ya le vio commits y vuelve a
`sin commits` se ha integrado por merge, así que cuenta como terminada. Hay tres casos en los que
no se cierra y solo avisa: si es el panel enfocado, si la lanzaste con `--keep-open` o si la
ejecutaste a mano en otro panel.

### Cuando un minion pregunta si confías en la carpeta

pi, Claude Code y Antigravity (`agy`) preguntan si confías en cada carpeta nueva, y cada worktree es una carpeta nueva.
Con cuatro minions eso serían cuatro diálogos iguales, así que bond te echa una mano.

Cuando los agentes van en paneles y ya confías en el checkout principal, bond da esa misma
confianza al worktree antes de lanzar su agente, y este arranca sin preguntar. Lo verás indicado
como `confianza heredada`. En pi, eso significa que la entrada más cercana del checkout en
`~/.pi/agent/trust.json` es `true`; en Claude, que el checkout o una carpeta superior tiene
`hasTrustDialogAccepted` en `~/.claude.json`; en `agy`, que el checkout o una carpeta superior
está en `trustedWorkspaces` de `~/.gemini/antigravity-cli/settings.json` (bond añade el worktree
con su ruta exacta).

bond es cuidadoso con esos ficheros. No toca nada más que eso, respeta el cerrojo de pi y escribe
de forma atómica. Y si en algún momento dijiste que no confías en una carpeta, se queda así. Si
prefieres que no haga nada de esto, `--no-trust` lo desactiva.

Sin esa confianza previa, con otros agentes o con `--workspaces`, el agente pregunta como
siempre. Herdr no siempre lo reconoce como una pregunta, así que bond lee el panel. La rama sale
como `bloqueado` y `prompt` no manda nada, porque su Enter elegiría "Trust" por ti y encima la
tarea se perdería. Contesta tú en el panel del agente. Un truco en pi: elegir "Trust parent
folder" una vez sirve para todos los worktrees de ese repo.

### Antigravity (`agy`) en un equipo

Con `bond team <rama>:agy` (y con la skill `bond-delegate`), bond lanza `agy` con
`--dangerously-skip-permissions`: sin él, `agy` pide permiso para cada comando y el minion no
avanza. Ejecuta sin preguntar dentro de su worktree; si prefieres otra cosa, pasa tus propios
argumentos tras `--` y se usan esos en su lugar.

El instalador de `agy` lo deja en `~/.local/bin`, que no siempre está en el PATH de los paneles.
Si bond no lo encuentra en el PATH pero sí ahí, añade esa carpeta al PATH de la shell del panel
antes de lanzarlo, así que no hace falta tocar tu configuración.

Al arrancar, `agy` enseña a veces un aviso de novedades («esc to dismiss»). No es una pregunta:
la rama no sale `bloqueado` por él y `prompt` lo cierra antes de mandar la tarea si Herdr lo
toma por una. La pregunta de confianza en la carpeta, en cambio, sí bloquea.

### `bond team clean`: recoger

Cuando ya has revisado e integrado, `clean` quita los worktrees, es decir, la carpeta y su panel o
workspace con el agente. Las ramas se quedan donde estaban.

Si no le dices qué ramas, solo quita los worktrees integrados que abrió Herdr; si le das ramas,
quita esas. Nunca quita uno con el agente trabajando o esperando, con cambios sin commitear o en el
que estás tú, salvo que le pases `--force`. Con `--delete-branch` borra además las ramas
integradas.

Si al terminar no queda ningún agente del equipo, cierra también el panel de la tabla en vivo y
tu pestaña vuelve a quedar como estaba. Con `--keep-table` la tabla se queda abierta (aunque, si
no tiene nada pendiente, luego se cierra ella sola, salvo que la lanzaras con `--keep-open`). El
workspace del repo no lo cierra; te dice cómo hacerlo si quieres.

## Conducir los agentes a mano

A veces quieres hablar con un agente directamente desde la shell, sin pasar por bond. Para eso
tienes los comandos de Herdr:

```bash
herdr agent prompt gru "revisa el diff actual" --wait --timeout 300000
herdr agent read gru --source recent-unwrapped --lines 200
herdr agent wait gru --until blocked --timeout 120000
herdr agent send-keys gru ctrl+c
```

Herdr clasifica a cada agente en uno de estos estados. `idle` y `done` quieren decir que está
listo para recibir algo. `blocked` es que espera una respuesta tuya. `working` es que está
ocupado. Y `unknown` es que Herdr no sabe clasificarlo con seguridad.

## Limpiar a mano

Si prefieres recoger sin `bond team clean`, o tienes algo abierto con `bond --worktree`, estos son
los comandos:

```bash
herdr worktree remove --workspace <id>   # quita el worktree y su workspace; la rama se queda
herdr workspace close <id>               # cierra un workspace normal
git branch -d <rama>                     # la rama, cuando ya no la quieras
```

Para que quede claro dónde está la línea: bond no hace merge, rebase ni push, no borra ramas ni
cierra workspaces por su cuenta, y no responde por ti a los diálogos de los agentes. La confianza
heredada de `bond team` solo repite la que tú ya diste al checkout principal. Los minions hacen
el trabajo, pero las decisiones siguen siendo tuyas.

¿Algo no se entiende o no funciona como aquí se cuenta? Abre un issue en
[github.com/jmanuelcorral/bond/issues](https://github.com/jmanuelcorral/bond/issues) y lo vemos.
