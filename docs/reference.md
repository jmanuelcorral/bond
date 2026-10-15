# Referencia del setup

Inventario completo: qué hay en el repo, dónde acaba cada cosa y cómo se toca.

## Componentes

| Pieza | Rol |
|---|---|
| **pi** | El agente. CLI mínimo y extensible (`@earendil-works/pi-coding-agent`). |
| **Herdr** | Multiplexor de terminales consciente de agentes. Servidor en segundo plano que mantiene vivos los paneles. |
| **Integración Herdr para pi** | Extensión de pi (`herdr-agent-state.ts`) que reporta a Herdr el estado real del agente. |
| **Skill de Herdr** | Documento que se carga pi para saber controlar Herdr desde dentro de un panel. |
| **`pidev`** | Lanzador del puesto de trabajo. |
| **`pistatus`** | Tabla de agentes vivos. |

## Dónde vive qué

El repo es la fuente de verdad; `~/.pi/agent` se enlaza a él.

| En el repo | Destino | Contenido |
|---|---|---|
| `pi/agent/settings.json` | `~/.pi/agent/settings.json` | Ajustes de pi |
| `pi/agent/models.json` | `~/.pi/agent/models.json` | Modelos locales (proveedor `halo`) |
| `pi/agent/AGENTS.md` | `~/.pi/agent/AGENTS.md` | Instrucciones globales |
| `pi/agent/prompts/` | `~/.pi/agent/prompts` | Plantillas `/review` `/commit` `/handoff` `/delegate` |
| `herdr/config.snippet.toml` | se añade a `~/.config/herdr/config.toml` | Extras opcionales de Herdr |
| (generado) | `~/.pi/agent/skills/herdr/SKILL.md` | Skill generado con `herdr --skill` |
| (lo escribe Herdr) | `~/.pi/agent/extensions/herdr-agent-state.ts` | Integración |

Al ser symlinks, editar el fichero en `~/.pi/agent` edita el repo. Conviene versionar el
repo para tener historia de la config del agente.

## Layout de `~/.pi/agent`

Lo que pi reconoce ahí (lo que no creamos, lo crea pi al usarlo):

| Ruta | Qué guarda |
|---|---|
| `settings.json` | Ajustes de usuario |
| `keybindings.json` | Atajos de la UI de pi |
| `models.json` | Endpoints y modelos compatibles |
| `auth.json` | Claves y credenciales OAuth (**no versionar**) |
| `AGENTS.md` | Instrucciones globales |
| `SYSTEM.md` / `APPEND_SYSTEM.md` | Sustituye / añade al system prompt |
| `extensions/` | Extensiones de pi (aquí cae la de Herdr) |
| `skills/` | Skills y sus ficheros de apoyo |
| `prompts/` | Plantillas expuestas como comandos `/` |
| `themes/` | Temas |

La ubicación se puede cambiar con la variable `PI_CODING_AGENT_DIR`. La config de proyecto
vive en `.pi/` dentro del directorio de trabajo y carga tras conceder confianza al proyecto.

## Ajustes de pi puestos

En `pi/agent/settings.json`. Todos cambiables; esto es lo puesto y el por qué.

| Clave | Valor | Razón |
|---|---|---|
| `tuiMode` | `regular` | pi no usa pantalla alternativa: el transcript queda en el scrollback del panel de Herdr y se puede releer con el ratón o con `pane read`. Con `fullscreen` se comporta como app a pantalla completa dentro del panel. |
| `quietStartup` | `header` | Menos ruido al arrancar en paneles estrechos. |
| `defaultThinkingLevel` | `medium` | Equilibrio coste/calidad. Se cambia con `/thinking` (`Ctrl+S` guarda). |
| `hideThinkingBlock` | `false` | Ver el razonamiento en el transcript. |
| `enableInstallTelemetry` | `false` | Sin telemetría de instalación/actualización. |
| `compaction.enabled` | `true` | Resumen automático al llenarse el contexto. |
| `compaction.reserveTokens` | `16384` | Reservado para la respuesta del modelo. |
| `compaction.keepRecentTokens` | `20000` | Reciente que se conserva sin resumir. |
| `retry.*` | `3` intentos, backoff `2s` a `60s` | Tolerancia a fallos transitorios del proveedor. |

Regla general de reintentos: dejar `retry.provider.maxRetries` en `0` salvo necesidad, para
que pi gestione él mismo los errores de cuota.

## Modelos locales (`models.json`)

`pi/agent/models.json` declara el proveedor `halo` contra la pasarela de modelos locales
(`llama-swap`, API OpenAI-compatible). Se enlaza a `~/.pi/agent/models.json` y se versiona:
no lleva secretos, la `apiKey` es un dummy que la pasarela ignora.

| Campo | Valor | Por qué |
|---|---|---|
| `baseUrl` | `http://halo.example/v1` | HTTP a pelo: el certificado de la host no cubre este nombre, con HTTPS falla `tls: unrecognized name` |
| `api` | `openai-completions` | La pasarela expone `/v1/chat/completions` con streaming SSE |
| `apiKey` | `halo` | Pi necesita una credencial para listar el modelo como disponible; manda `Authorization: Bearer halo` y la pasarela lo ignora |

`compat` va puesto a mano porque pi autodedecta estas cosas por URL y esta host no la conoce:

| Clave | Valor | Verificado en la pasarela |
|---|---|---|
| `maxTokensField` | `max_tokens` | Acepta también `max_completion_tokens`; se fija `max_tokens` para no depender del autodetección |
| `thinkingFormat` | `openai` | El razonamiento vuelve en `reasoning_content` (también en streaming) |
| `supportsReasoningEffort` | `true` | Acepta `reasoning_effort` sin quejarse |
| `supportsUsageInStreaming` | `true` | Acepta `stream_options.include_usage` y devuelve `usage` al final del stream |
| `supportsFinishReason` | `true` | Los chunks traen `finish_reason` |
| `supportsDeveloperRole` | `true` | Acepta el rol `developer` |
| `supportsStore` | `false` | `store` se acepta pero no significa nada aquí; mejor no mandarlo |

Modelos declarados:

| Modelo | Estado | Contexto | Salida máx. | Razona | Herramientas |
|---|---|---|---|---|---|
| `flash-halogen` | activo | 131072 | 8192 | sí (`reasoning_content`) | sí, también en streaming |
| `gufo-qwen38-27b` | comentado | 131072 | 2048 | no | sí (`auto` y `required`; no acepta `tool_choice` nombrado) |

Solo `flash-halogen` está servido ahora en la pasarela, así que el bloque de `gufo` queda
comentado con `//` para que no aparezca en `/model`. pi tolera comentarios `//` en
`models.json` (los elimina antes del `JSON.parse`), así que el fichero puede guardar
configuración apagada pero legible. Para reactivar: quitar los `//` y `/reload` en pi.

Coste puesto a `0` en los cuatro campos: son modelos propios, el pie de sesión de pi no debe
simular gasto.

Comprobado end-to-end con `pi --model halo/flash-halogen --no-session -p "..."` y lo mismo con
`gufo-qwen38-27b`: ambos usan herramientas (bash) y responden. `pi --list-models` los lista
como `halo / flash-halogen` y `halo / gufo-qwen38-27b`.

### Añadir o quitar modelos

La lista viva de la pasarela:

```bash
python3 -c "import urllib.request,json;print([m['id'] for m in json.load(urllib.request.urlopen('http://halo.example/v1/models'))['data']])"
```

Cada modelo nuevo es una entrada en `providers.halo.models` con su `id` y, si la pasarela los
reporta, `contextWindow` (de `context_window`) y `maxTokens` (de `meta.llamaswap.max_output_tokens`).
`/model` recarga el fichero al abrirse; en una sesión ya abierta, `/reload`.

`laya` y `winnow-12b-cpu` salen en `GET /v1/models` pero hoy devuelven 404 al pedirles un chat
(`{"error": "Route not available"}` en winnow, `{"detail": "Not Found"}` en laya), así que no
están declarados: en el picker solo conviene lo que responde.

### Gotchas de los modelos locales

- **Carga bajo demanda.** La pasarela tiene los modelos descargados y los sube a RAM al primer
  uso: el primer `prompt` tras un rato parado puede tardar mucho más que el resto.
- **`gufo` corta a 2048 tokens de salida.** Para un agente de código es justo: diffs o archivos
  largos se truncan. Si lo reactivas, tenlo en cuenta.
- **`settings.json` reserva 16384 tokens de respuesta** (`compaction.reserveTokens`) por encima
  del `maxTokens` de `gufo`; el límite real lo manda el modelo, no ese ajuste.
- **Sin TLS.** El tráfico, incluido el prompt, va en claro por la red. Vale en una LAN de
  confianza; no lo saques de ella.
- **No uses el proveedor `llama.cpp` que trae pi** (`/login llama.cpp`, `LLAMA_BASE_URL`) para
  esto: está pensado para el router de llama.cpp en local, exige login interactivo y gestión de
  carga con `/llama`. Con `models.json` el setup funciona headless en los paneles de Herdr.

## Instrucciones globales (`AGENTS.md`)

Se aplican en todos los proyectos, en cualquier carpeta. Cubren:

- **Idioma**: respuestas en español; código, identificadores y commits en inglés.
- **Método**: leer antes de editar, no asumir APIs, verificar con lo más específico primero,
  no repetir un enfoque que ya falló.
- **Git**: ni commit ni push sin pedido explícito.
- **Herdr**: normas para paneles (split sin robar el foco, no cerrar lo ajeno, nunca lanzar
  `herdr` desde dentro de un panel, y no controlar la sesión de nadie desde fuera).
- **Seguridad**: no volcar secretos (`auth.json`, `.npmrc`, tokens) en respuestas ni logs.

## Plantillas de prompt

Ficheros Markdown en `pi/agent/prompts/`; el nombre de fichero es el comando.

| Comando | Argumentos | Resultado |
|---|---|---|
| `/review [foco]` | foco, por defecto "los cambios sin commitear" | Revisión priorizada (bugs, seguridad, errores, rendimiento, estilo) con `fichero:línea`. No edita. |
| `/commit [contexto]` | contexto extra | Propuesta de mensaje en inglés, muestra y espera OK. Nunca push. |
| `/handoff [ruta]` | ruta, por defecto `.pi-handoff.md` | Estado escrito: objetivo, estado, ficheros, verificación, siguientes pasos. |
| `/delegate [rol] [tarea]` | rol `reviewer`, tarea de revisión | Monta un panel hermano, lanza otro pi, espera, lee y resume. |

Sustituciones disponibles en cualquier plantilla: `$1`, `$@` / `$ARGUMENTS`,
`${1:-defecto}`, `${@:N}`, `${@:N:L}`.

## Integración de Herdr para pi

```bash
herdr integration status | grep '^pi:'
# pi: current (v9) (~/.pi/agent/extensions/herdr-agent-state.ts)
```

Sin ella, Herdr clasifica a pi mirando la pantalla. Con ella, el propio pi reporta su ciclo
de vida, así que `working` / `blocked` / `done` pasan a ser fiables y las notificaciones
llegan bien. Se instala con `herdr integration install pi` y se quita con
`herdr integration uninstall pi`.

## Skill de Herdr

`install.sh` ejecuta `herdr --skill` y lo guarda en `~/.pi/agent/skills/herdr/SKILL.md`.
Se genera en cada instalación a propósito: el skill describe la CLI **de la versión
instalada**, así que no queda desfasado. No se versiona en el repo (ver `.gitignore`).

Con el skill cargado, un pi que está dentro de un panel de Herdr sabe partir paneles, lanzar
comandos sin robar el foco, leer salida de otros paneles y esperar a otros agentes. Es lo
que hace posible `/delegate`.

## `install.sh`

Orden que sigue y flags.

1. Comprueba `herdr` en el PATH.
2. Instala pi si falta: `bun add -g @earendil-works/pi-coding-agent`, o si no hay bun
   `npm install -g --ignore-scripts --prefix ~/.npm-global ...`.
3. Crea `~/.pi/agent/{skills,extensions}`.
4. Enlaza `settings.json`, `AGENTS.md` y `prompts/` (backup `.bak.<fecha>` de lo previo).
5. Enlaza las subcarpetas de `pi/agent/skills/` si existen (para skills propios).
6. Genera el skill de Herdr.
7. Instala la integración de Herdr para pi si no está `current`.
8. Con `--herdr-config`, añade el snippet a `~/.config/herdr/config.toml` entre marcas
   `>>> piSetup >>>` y recarga el servidor.

| Flag | Efecto |
|---|---|
| `--dry-run` | Imprime las acciones sin ejecutar nada |
| `--no-pi` | Se salta la instalación del CLI de pi |
| `--herdr-config` | Aplica el snippet de Herdr (opt-in: tu `config.toml` es tuyo) |
| `-h`, `--help` | Uso |

## Snippet de Herdr

`herdr/config.snippet.toml`, solo con claves verificadas contra `herdr --default-config`:

| Clave | Efecto |
|---|---|
| `terminal.new_cwd = "follow"` | Paneles, pestañas y workspaces nuevos nacen en el directorio del panel de origen |
| `ui.show_agent_labels_on_pane_borders = true` | En paneles divididos se ve qué agente ocupa cada uno |

Para ver todas las opciones de Herdr: `herdr --default-config`. Para recargar tras editar:
`herdr server reload-config`.

## Variables de entorno

| Variable | Quién la pone | Para qué |
|---|---|---|
| `HERDR_ENV` | Herdr en cada panel | `1` significa "estoy dentro de un panel de Herdr" |
| `HERDR_WORKSPACE_ID` | Herdr | Id del workspace del panel (`w3`) |
| `HERDR_TAB_ID` | Herdr | Id de la pestaña (`w3:t1`) |
| `HERDR_PANE_ID` | Herdr | Id del panel (`w3:p5`) |
| `PI_CODING_AGENT_DIR` | Tú, si quieres | Cambiar `~/.pi/agent` de sitio |

## Herdr CLI de uso frecuente

```bash
herdr status                      # cliente, servidor, compatibilidad, socket
herdr workspace list              # workspaces con ids y estados
herdr workspace focus w3
herdr tab list --workspace w3
herdr pane list --workspace w3
herdr pane split --current --direction right --cwd "$PWD" --no-focus
herdr pane run w3:p6 "npm test"
herdr pane wait-output w3:p6 --match "test result" --timeout 120000
herdr pane read w3:p6 --source recent-unwrapped --lines 200
herdr agent list
herdr agent prompt pi-mi "tarea" --wait
herdr agent wait pi-mi --until blocked
herdr agent explain pi-mi         # por qué lo clasificó así
herdr integration status
```

Fuentes de `pane read`: `visible` (lo pintado), `recent` (con saltos de línea suaves),
`recent-unwrapped` (ideal para logs y transcripciones), `detection` (instantánea que usa el
detector).

## Actualizar

```bash
herdr update                                    # Herdr
bun add -g @earendil-works/pi-coding-agent@latest   # pi (si se instaló con bun)
cd ~/gitrepos/piSetup && ./install.sh           # regenera skill de Herdr y revalida todo
```

`pi update` solo aplica a instalaciones hechas con el instalador oficial
(`curl -fsSL https://pi.dev/install.sh | sh`); con bun o npm se actualiza desde el
gestor de paquetes.

## Desinstalar

```bash
# Desactivar la config versionada (solo los symlinks)
rm ~/.pi/agent/settings.json ~/.pi/agent/AGENTS.md ~/.pi/agent/prompts
rm -rf ~/.pi/agent/skills/herdr

# Quitar la integración de Herdr
herdr integration uninstall pi

# Quitar el CLI de pi
bun uninstall -g @earendil-works/pi-coding-agent    # o npm uninstall -g ...
```

Los backups `.bak.<fecha>` que creó `install.sh` siguen en `~/.pi/agent`. Sesiones y
credenciales no se tocan.
