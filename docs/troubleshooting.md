# Troubleshooting

## Diagnóstico rápido

Tres comandos que responden casi todo:

```bash
herdr status                        # cliente, servidor, socket, compatibilidad
herdr integration status | grep pi  # la integración de pi, current o no
pistatus                            # qué agentes ve Herdr y en qué estado
```

## pi no aparece como agente, o se queda en `unknown`

`unknown` significa que Herdr ve algo pero no lo clasifica con seguridad. No es un fallo de
pi: es el detector dudando.

```bash
herdr agent list                       # qué hay
herdr agent explain <panel-o-agente>   # por qué lo clasificó así
herdr agent read <panel> --source detection
```

Causas habituales:

- **Falta la integración.** `herdr integration status` debe decir `pi: current`. Si no:
  `herdr integration install pi` y reinicia el panel de pi.
- **pi arrancó antes que la integración.** Sal de pi y vuelve a entrar en el panel.
- **El panel no estaba en su prompt** cuando `agent start` lo lanzó. `pidev` necesita una
  shell interactiva libre; si no, arranca `pi` a mano en ese panel.

Un `unknown` no significa que el trabajo no haya terminado: lee el panel.

## `pidev` falla

| Mensaje | Causa | Solución |
|---|---|---|
| `herdr no está en el PATH` | Herdr no instalado o no accesible | Instalar Herdr o arreglar PATH |
| `jq no está en el PATH` | Falta `jq` | Instalar `jq`; `pidev` necesita leer JSON |
| `pi no está en el PATH` | pi sin instalar | `./install.sh`, o `--no-agent` |
| `no pude leer los ids de 'workspace create'` | El servidor no devolvió lo esperado | `herdr status`; si el servidor está caído, `herdr` lo levanta y reintenta |
| `aviso: Herdr aún no detecta pi` | Timeout o integración ausente | El workspace queda creado y útil: revisa con `herdr agent read <panel>` |
| `--direction debe ser right o down` | Valor inválido | Herdr solo parte en esas dos direcciones |

Recuerda: cuando `pidev` avisa, **no deshace nada**. Si quieres limpiar, cierra el workspace
a mano: `herdr workspace close <id>`.

## Tengo dos workspaces para el mismo proyecto

`pidev` reutiliza por **etiqueta**, no por ruta. Si lanzaste con `--label` distinto, o
renombraste la carpeta, hay dos.

```bash
herdr workspace list                 # ver ids y etiquetas
herdr workspace close <el-sobrante>
```

Para el futuro, pasa la misma etiqueta: `pidev ~/otraruta/miapp -l pi:miapp`.

## Los comandos `/review` `/commit` etc. no aparecen

- Sesión ya abierta: ejecuta `/reload` en pi.
- Comprueba que el enlace sigue bien: `ls -l ~/.pi/agent/prompts` debe apuntar al repo y
  `ls ~/.pi/agent/prompts/` debe listar los `.md`.
- Symlink roto (moviste el repo): vuelve a correr `./install.sh`.

## La config no se nota

pi lee la config al arrancar. Tras editar `settings.json` o `AGENTS.md`:

```
/reload
```

Si editaste el repo pero el symlink apunta a otro sitio (o lo rompiste), `./install.sh` lo
repara. Los backups `.bak.<fecha>` de lo que había antes quedan en `~/.pi/agent`.

## Los modelos de `halo` no aparecen en `/model`

- `ls -l ~/.pi/agent/models.json` debe apuntar al repo. Roto o ausente: `./install.sh`.
- `pi --list-models | grep halo` confirma que pi los ve sin arrancar la TUI.
- `/model` recarga `models.json` al abrirse; en una sesión ya iniciada, `/reload`.

## Un modelo de `halo` responde 404

La pasarela lista más modelos de los que puede servir. `GET /v1/models` los muestra todos, pero
al pedir un chat puede devolver `{"error": "Route not available"}` o `{"detail": "Not Found"}`:
ese modelo no está montado ahora mismo.

Quita de `pi/agent/models.json` lo que no responda y recarga. Declarar un modelo que no responde
solo produce fallos confusos desde `/model`.

## El primer `prompt` a un modelo local tarda mucho

Carga bajo demanda: la pasarela sube el modelo a RAM en la primera petición y las siguientes van
a velocidad normal. Si `herdr agent prompt --wait` agota el timeout en esa primera carga, revisa
`herdr agent get <agente>` antes de reenviar nada.

## La respuesta se corta a la mitad

Mira `maxTokens` del modelo en `pi/agent/models.json`: `flash-halogen` está a 8192, y el bloque
comentado de `gufo-qwen38-27b` solo a 2048. Si reactas ese modelo y los diffs se truncan, el
límite está ahí, no en `compaction.reserveTokens` de `settings.json`.

## `tls: unrecognized name` al hablar con la pasarela

El certificado de la host no cubre `halo.example`, así que `baseUrl` va en
`http://` a propósito. Si lo cambias a `https://`, el handshake TLS falla antes de la petición.

## `pi` no está tras instalarlo con bun

El binario va a `~/.bun/bin`. Comprueba:

```bash
ls ~/.bun/bin/pi
echo "$PATH" | tr ':' '\n' | grep bun
```

Si no está, añade `export PATH="$HOME/.bun/bin:$PATH"` a tu perfil de shell.

## No hay servidor de Herdr accesible

```bash
herdr status server
ls -l ~/.config/herdr/herdr.sock
tail -50 ~/.config/herdr/herdr-server.log
```

Levantarlo: `herdr` (engancha y arranca si hace falta) o `herdr server` para modo headless.
Para sesiones con nombre, los logs viven bajo `sessions/<nombre>/` en ese mismo directorio.

## `--attach` no hace nada

Espera si ya estabas dentro de Herdr (`HERDR_ENV=1`): Herdr bloquea lanzamientos anidados
por diseño. `--attach` solo aplica desde una terminal fuera de Herdr.

## El agente está en `blocked`

Hay una aprobación o pregunta esperando. **Mírala antes de responder**: `blocked` puede ser
un diálogo que Herdr no termina de reconocer.

```bash
herdr agent read <agente> --source recent-unwrapped --lines 80
herdr agent send-keys <agente> esc     # si quieres cancelarlo
```

Un `prompt` enviado a un agente bloqueado se rechaza con `agent_blocked` antes de escribir
nada, así que no se pierde entrada.

## Un `prompt` no devuelve nada o da `timeout`

Un timeout **no prueba** que el prompt no se entregara. Antes de reenviar:

```bash
herdr agent get <agente>
herdr agent read <agente> --source recent-unwrapped --lines 200
```

Si devuelve `agent_prompt_stalled`, es que no se observó actividad tras enviar: revisa el
panel, puede que el agente estuviera esperando una respuesta.

## Perdí el hilo de una sesión de pi

pi guarda sesiones por carpeta de trabajo:

```bash
pi --continue      # última sesión de esta carpeta
/resume            # elegir dentro de pi
/session           # estado de la sesión actual
```

Y con Herdr, la sesión del panel sigue viva haya o no cliente enganchado: `herdr` y vuelve.

## El panel se ve raro tras un resize

`ctrl+b` `z` zoom/normaliza el panel. Si persiste el parpadeo o la corrupción,
`herdr --default-config` muestra claves de `[ui]` relacionadas
(`redraw_on_focus_gained`, `host_cursor`, `pane_scrollbars`).
