# Troubleshooting

Algo no va como esperabas. Tranquilo, pasa más de lo que crees, y casi siempre tiene arreglo
rápido. Antes de nada, lanza `bond doctor`: repasa toda la instalación y, cuando encuentra un
fallo, suele decirte cómo arreglarlo. Si con eso no basta, busca abajo el síntoma que se parezca
al tuyo.

## Primero, un diagnóstico rápido

Empieza siempre por aquí:

```bash
bond doctor            # todo de una vez; --quick se salta los MCP
```

`bond doctor` comprueba Node, Herdr (el servidor y la integración), pi, los enlaces de
`~/.pi/agent`, el paquete, el skill de Herdr, las Bond Extensions, las herramientas de contexto,
los servidores MCP y que la pasarela de modelos sirve lo que tienes declarado. Cada fallo viene
con su arreglo, y en la mayoría de los casos el arreglo es `bond setup`.

Si quieres mirar más a fondo, estos tres comandos te cuentan cómo está Herdr y qué agentes ve:

```bash
herdr status                        # cliente, servidor, socket, compatibilidad
herdr integration status | grep pi  # la integración de pi, current o no
bond status                            # qué agentes ve Herdr y en qué estado
```

## "pi no me sale como agente" o se queda en `unknown`

Que salga `unknown` quiere decir que Herdr ve algo en el panel pero no se atreve a clasificarlo.
pi está bien; quien duda es el detector de Herdr. Para ver qué está pasando:

```bash
herdr agent list                       # qué hay
herdr agent explain <panel-o-agente>   # por qué lo clasificó así
herdr agent read <panel> --source detection
```

Lo normal es que sea una de estas tres cosas. La primera, que falte la integración:
`herdr integration status` debería decir `pi: current`, y si no lo dice, ejecuta
`herdr integration install pi` y reinicia el panel de pi. La segunda, que pi arrancara antes de
instalar la integración; en ese caso basta con salir de pi y volver a entrar en el panel. La
tercera, que el panel no estuviera en su prompt cuando `agent start` lo lanzó. `bond` necesita
una shell interactiva libre, así que si el panel estaba ocupado, arranca `pi` a mano en él.

Y un detalle que tranquiliza: un `unknown` no quiere decir que el trabajo no haya terminado.
Echa un vistazo al panel y lo verás.

## `bond` falla al abrir el puesto

Aquí bond suele ser bastante claro con lo que le falta. Busca tu mensaje en esta tabla:

| Mensaje | Causa | Solución |
|---|---|---|
| `Herdr no está instalado` | Falta Herdr | https://herdr.dev/docs/install/ (o `bond setup`) |
| `no hay ningún agente instalado` | Ningún agente en el PATH | `bond setup` te dice cómo instalar uno |
| `Herdr no admite el agente 'x'` | No está en `herdr agent start --help` | Usa uno de la lista |
| `el servidor de Herdr no arrancó` | `herdr server` no respondió | `herdr status`; arráncalo con `herdr` |
| `--direction debe ser right o down` | Valor inválido | Herdr solo parte en esas dos direcciones |

A veces el agente se queda esperando que le contestes algo, como Claude Code cuando te pregunta
si confías en la carpeta. bond te lo avisa y lo deja todo abierto para que respondas tú en el
panel. Ten en cuenta que bond no deshace nada si algo falla a medias. Si quieres limpiar lo que
haya quedado, cierra el workspace con `herdr workspace close <id>`.

## Me salen dos workspaces para el mismo proyecto

Esto despista la primera vez. `bond` reconoce un workspace por su etiqueta (`bond:<repo>`) y
no se fija en la ruta. Si un día lo lanzaste con un `--label` distinto, o renombraste la
carpeta, acabas con dos. Mira cuál sobra y ciérralo:

```bash
herdr workspace list                 # ver ids y etiquetas
herdr workspace close <el-sobrante>
```

Para que no vuelva a pasar, pasa siempre la misma etiqueta, por ejemplo
`bond dev ~/otraruta/miapp -l bond:miapp`.

## No aparecen `/review`, `/commit` y compañía

Si tenías la sesión de pi ya abierta, prueba primero con `/reload` en pi. Muchas veces es solo
eso.

Si siguen sin aparecer, conviene saber de dónde salen. Estos comandos llegan a pi a través de
las Bond Extensions, y solo en repos donde has pasado `bond init` y que tienen pi entre sus
agentes. Para que funcione, `.pi/settings.json` tiene que declarar `~/.bond/pi`, y `~/.bond/pi`
tiene que existir (`bond doctor` lo comprueba). Si quieres ver lo que pi carga de verdad, con
su origen y su ruta, ejecuta `scripts/pi-resources`.

Y si moviste el repo de sitio, lo más probable es que se haya roto un symlink. Vuelve a correr
`bond setup` y listo.

## Un skill sale duplicado o no es la versión que esperaba

pi busca skills en tres sitios: `~/.pi/agent/skills/`, `~/.agents/skills/` (la carpeta que
comparte con otros agentes) y los paquetes. Cuando dos se llaman igual, pi se queda con el
primero que encuentra y te avisa al arrancar. Para ver cuál gana y desde qué ruta:

```bash
scripts/pi-resources        # qué skill gana y desde qué ruta
```

El caso de `herdr` ya lo resuelve `bond setup` por ti. Si existe `~/.agents/skills/herdr`, usa
ese y borra la copia que él mismo generaba en `~/.pi/agent/skills/herdr`.

## Un servidor MCP no conecta

Lo primero es ver qué dice cada servidor y qué ha quedado en el log:

```bash
pi mcp list                  # estado y error de cada servidor
tail -50 ~/.pi/agent/mcp.log
```

`duckduckgo` se lanza con `uvx`, así que la primera vez descarga el paquete y tarda un rato.
Si falla, pruébalo a mano con `uvx duckduckgo-mcp-server==0.7.0 --help`. Además, DuckDuckGo
limita las peticiones cuando buscas mucho seguido; si te pasa, espera un poco y reintenta.

`context7` es remoto, así que sin red no va a funcionar. Cuando vuelvas a tener conexión,
dentro de pi puedes hacer `/mcp reconnect context7`.

Si lo que quieres es apagar un servidor sin borrarlo, pon `"enabled": false` en su entrada o
desactívalo desde `/mcp`.

## Con varios agentes a la vez me salen errores 429

Si tienes varios agentes tirando del mismo modelo local (`halo`), la pasarela puede responder
429 a alguno porque no da abasto con tantas peticiones en paralelo. Lo verás contado en el pie
de estado, en `req ✗`. pi reintenta solo, así que muchas veces ni te enteras. Si algún agente
se rinde, mándale la tarea otra vez cuando acabe otro. Para tener paralelismo de verdad, reparte
el trabajo entre modelos o proveedores distintos (`bond --agent`, o `-- --model …` en
`bond team`).

## Lancé un agente con `bond` y se queda en `blocked`

Esto le pasa mucho a Claude Code (y a otros) cuando arranca en una carpeta nueva, como un
worktree recién creado: te pregunta si confías en ella. `bond` no contesta por ti, a propósito.
Para ver qué te está preguntando:

```bash
herdr agent read <agente> --source visible   # qué pregunta
```

Contesta en el panel. Si es un repo tuyo, la próxima vez ya no te lo preguntará para esa
carpeta.

## He cambiado la config y no se nota

pi lee la configuración al arrancar, así que lo que cambies después no le llega solo. Después
de editar `settings.json` o `AGENTS.md`, recarga dentro de pi:

```
/reload
```

Si editaste el repo pero el symlink apunta a otro sitio (o se te rompió), `bond setup` lo
repara. Y si te preocupa lo que había antes, tranquilo: los backups `.bak.<fecha>` se quedan en
`~/.pi/agent`.

## Un agente no ve los modelos del registro

Empieza por ver qué agentes pueden usar cada proveedor y qué escribiría bond en cada uno:

```bash
bond models list           # qué agentes pueden usar cada proveedor
bond models sync --dry-run # qué escribiría en cada agente
```

Cada agente habla un dialecto distinto. Codex necesita que la pasarela sirva la API Responses,
mientras que pi, opencode y Crush usan la de chat. `bond models probe` te dice qué sirve tu
pasarela. Claude Code y Gemini, por su parte, no pueden usar pasarelas compatibles con OpenAI,
así que con ellos no hay nada que hacer aquí.

Con Crush hay un caso concreto. Si en tu `crushrc` tienes definido a mano un proveedor con el
mismo id, bond no lo toca y te lo avisa en `sync`. Bórralo de tu `crushrc` para que pase a
gestionarlo bond.

## Los modelos de `halo` no aparecen en `/model`

Comprueba primero que `bond models list` muestra `halo` y su modelo. Luego,
`bond models sync --check` te dice si pi se ha quedado desfasado respecto a
`~/.bond/config.toml`; si es así, lo arreglas con `bond models sync`.

Para confirmar que pi los ve sin tener que arrancar la TUI, usa
`pi --list-models | grep halo`. Ten en cuenta que `/model` recarga `models.json` al abrirse,
pero en una sesión que ya estaba iniciada necesitas `/reload`.

## Un modelo de `halo` me responde 404

La pasarela anuncia más modelos de los que puede servir en cada momento. `GET /v1/models` los
lista todos, pero al pedirle un chat a uno que no está montado ahora mismo te devuelve
`{"error": "Route not available"}` o `{"detail": "Not Found"}`.

`bond models probe` te enseña qué está sirviendo de verdad la pasarela. Para el modelo que
falla, pon `enabled = false` en `~/.bond/config.toml`, ejecuta `bond models sync` y recarga.
Merece la pena hacerlo, porque tener declarado un modelo que no responde solo te da fallos
confusos desde `/model`.

## El primer `prompt` a un modelo local tarda una eternidad

Es normal. La pasarela carga los modelos bajo demanda, así que en la primera petición sube el
modelo a RAM y a partir de ahí todo va a velocidad normal. Si `herdr agent prompt --wait` agota
el timeout durante esa primera carga, no reenvíes nada todavía: mira antes cómo va con
`herdr agent get <agente>`.

## La respuesta se corta a la mitad

Revisa el `max_output` del modelo en `~/.bond/config.toml`. `flash-halogen` lo tiene a 8192, y
el bloque comentado de `gufo-qwen38-27b` solo a 2048. Si reactivas ese modelo y ves que los
diffs salen truncados, el culpable es ese límite. Tocar `compaction.reserveTokens` en
`settings.json` no lo va a arreglar.

## Me sale `tls: unrecognized name` al hablar con la pasarela

El certificado del host no cubre `halo.example`, y por eso `baseUrl` va en `http://` a
propósito. Si lo cambias a `https://`, el handshake TLS falla antes de llegar a hacer la
petición. Déjalo en `http://` y se acabó el problema.

## Instalé `pi` con bun y no lo encuentro

bun deja el binario en `~/.bun/bin`, y es muy fácil que esa carpeta no esté en tu `PATH`.
Compruébalo así:

```bash
ls ~/.bun/bin/pi
echo "$PATH" | tr ':' '\n' | grep bun
```

Si la carpeta no aparece en el `PATH`, añade `export PATH="$HOME/.bun/bin:$PATH"` a tu perfil
de shell y abre una terminal nueva.

## No hay servidor de Herdr accesible

Toca mirar si el servidor está vivo, si existe el socket y qué dice su log:

```bash
herdr status server
ls -l ~/.config/herdr/herdr.sock
tail -50 ~/.config/herdr/herdr-server.log
```

Para levantarlo, ejecuta `herdr`, que se engancha y arranca el servidor si hace falta, o
`herdr server` si lo quieres en modo headless. Si usas sesiones con nombre, sus logs están en
`sessions/<nombre>/` dentro de ese mismo directorio.

## `--attach` no hace nada

Si ya estabas dentro de Herdr (`HERDR_ENV=1`), es lo esperado. Herdr bloquea los lanzamientos
anidados por diseño, y `--attach` solo tiene efecto cuando lo usas desde una terminal fuera de
Herdr.

## El agente está en `blocked` y no sé por qué

Hay una aprobación o una pregunta esperando respuesta. Antes de contestar nada, míralo bien,
porque `blocked` también puede ser un diálogo que Herdr no termina de reconocer:

```bash
herdr agent read <agente> --source recent-unwrapped --lines 80
herdr agent send-keys <agente> esc     # si quieres cancelarlo
```

Lo bueno es que no vas a perder nada por intentarlo. Un `prompt` enviado a un agente bloqueado
se rechaza con `agent_blocked` antes de escribir nada.

## Mi `prompt` no devuelve nada o da `timeout`

Ojo con este, porque un timeout no prueba que el prompt no llegara. Antes de reenviarlo y
acabar con la tarea duplicada, comprueba en qué está el agente:

```bash
herdr agent get <agente>
herdr agent read <agente> --source recent-unwrapped --lines 200
```

Si te devuelve `agent_prompt_stalled`, significa que no se vio actividad después del envío.
Echa un vistazo al panel, porque puede que el agente estuviera esperando que le respondieras
algo.

## Perdí el hilo de una sesión de pi

No está perdido. pi guarda las sesiones por carpeta de trabajo, así que puedes recuperarlas:

```bash
pi --continue      # última sesión de esta carpeta
/resume            # elegir dentro de pi
/session           # estado de la sesión actual
```

Y si trabajas con Herdr, la sesión del panel sigue viva aunque no haya ningún cliente
enganchado. Ejecuta `herdr` y vuelves a donde lo dejaste.

## El panel se ve raro después de cambiar el tamaño

Pulsa `ctrl+b` `z` para hacer zoom o devolver el panel a su tamaño normal. Si aun así sigue el
parpadeo o la imagen se corrompe, `herdr --default-config` te enseña las claves de `[ui]` que
tienen que ver con esto (`redraw_on_focus_gained`, `host_cursor`, `pane_scrollbars`).

---

¿Tu problema no aparece aquí? Abre un issue en https://github.com/jmanuelcorral/bond/issues y
pega la salida de `bond doctor`. Con eso es mucho más fácil echarte una mano.
