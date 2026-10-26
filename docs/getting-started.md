# Primeros pasos

Vamos a llevarte de una máquina recién estrenada a trabajar con bond sin sobresaltos. Son unos
pocos pasos y casi todos se hacen una sola vez: primero preparas la máquina, luego cada repo, y
a partir de ahí te queda el día a día, que es la parte divertida. Licencia para programar en
mano, empezamos.

## Qué vas a obtener

Lo primero que tendrás es una CLI, `bond`, que se encarga de configurar tus agentes de código y
de abrirlos en **Herdr**. Vale cualquiera de estos: pi, Claude Code, Codex, Copilot CLI,
opencode, Crush o Gemini CLI. No hace falta tenerlos todos; con uno basta, y bond trabaja con
los que tengas.

Lo segundo es Herdr, el multiplexor de terminal donde viven tus agentes. Lo bueno de Herdr es
que los paneles sobreviven aunque cierres la terminal, y que su barra lateral te dice de un
vistazo qué agente está `working`, `blocked` o `done` en cada proyecto. Así no tienes que ir
panel por panel preguntando "¿has terminado ya?".

Y lo tercero, si usas modelos propios (Ollama, LM Studio o una pasarela compatible con OpenAI),
los declaras una sola vez y bond los deja disponibles en todos los agentes que pueden usarlos.
Nada de copiar la misma URL en cinco ficheros de configuración distintos.

## 1. Requisitos

Necesitas poca cosa. Esta tabla te sirve para comprobar que lo tienes todo:

| Herramienta | Para qué | Comprobar |
|---|---|---|
| Al menos un agente | pi, Claude Code, Codex, Copilot CLI, opencode, Crush o Gemini CLI | `bond setup` te dice cómo instalar cada uno |
| `herdr` | abrir el puesto de trabajo | `herdr --version` |

Si aún no tienes ningún agente instalado, tranquilo: `bond setup` te explica cómo instalar cada
uno cuando llegues a ese paso. Herdr sí conviene tenerlo a mano; las instrucciones de
instalación están aquí: https://herdr.dev/docs/install/

## 2. Instalar

En Linux y macOS, lo más rápido es el script de instalación. Si prefieres Homebrew, también
vale:

```sh
curl -fsSL https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.sh | sh   # Linux, macOS
brew install jmanuelcorral/tap/bond                                                    # o Homebrew
```

Si estás en Windows, abre una terminal y ejecuta esto:
`powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.ps1 | iex"`.

Con bond ya instalado, el siguiente paso es configurar la máquina:

```bash
bond setup
```

## 3. `bond setup` (una vez por máquina)

`bond setup` es una conversación corta en la que bond te hace tres preguntas.

Primero mira si tienes **Herdr**. Si falta, te dice cómo instalarlo.

Luego pasa a los **endpoints de modelos**. Detecta por su cuenta Ollama y LM Studio si los tienes en
marcha, y puedes añadir OpenAI o cualquier endpoint compatible dándole la URL y la clave, si la
pide. bond comprueba qué modelos sirve cada endpoint y te deja elegir cuáles quieres usar. Si
tienes, por ejemplo, Ollama con un par de modelos descargados, los verás en la lista y marcas
los que te interesen.

Por último te pregunta por los **agentes**: con cuáles quieres trabajar y cuál será el de por
defecto.

Con esas respuestas, bond se pone manos a la obra. Lleva los modelos a cada agente que puede
usarlos, instala las integraciones de Herdr y los skills de delegación, y copia tus
instrucciones personales (`~/.bond/AGENTS.md`, donde pones cosas como el idioma o el estilo que
te gusta) al fichero global de cada agente. Así escribes tus preferencias una vez y todos los
agentes las conocen.

Todo lo que configura queda guardado en `~/.bond/`. Las claves van aparte, en `~/.bond/keys/`,
con permisos 600 para que solo tú puedas leerlas. Puedes repetir `bond setup` cuando quieras,
por ejemplo al instalar un agente nuevo o añadir otro endpoint. Y si en algún momento algo no
cuadra, `bond doctor` revisa que todo esté en su sitio.

Un detalle más: la primera vez que abras cada agente, inicia sesión en él como harías
normalmente (`/login` en pi y Claude Code, etc.). Los modelos de tus endpoints no necesitan
login, esos funcionan directamente.

## 4. `bond init` (una vez por repo)

<figure class="bond-video">
<video src="/videos/init.mp4" controls muted playsinline preload="metadata"></video>
<figcaption>bond init en fluzo, un repo en Rust: elegimos pi y Claude Code, quitamos las skills que fluzo ya tiene y añadimos plan-team.</figcaption>
</figure>

Con la máquina lista, toca preparar el repo en el que vas a trabajar. Pongamos que se llama
`mi-proyecto`:

```bash
cd ~/gitrepos/mi-proyecto
bond init
```

`bond init` te pregunta con qué agentes quieres integrar el repo, cuál abre `bond` por defecto
y qué herramientas del catálogo quieres usar. En el catálogo encontrarás servidores MCP de
documentación y búsqueda, skills como `code-context` o `plan-create`, y los comandos `review`,
`commit` y `handoff`. Elige lo que te encaje; siempre puedes volver más tarde.

Cuando termina, verás varios ficheros nuevos en el repo: `.bond/bond.toml` con la configuración
de bond, un `AGENTS.md` para que lo completes con lo que tus agentes deben saber del proyecto,
y la config de cada agente. Commitéalo todo, porque así el resto del equipo tiene la misma
configuración al clonar. La primera vez que abras cada agente en el repo te pedirá que confíes
en él; es normal. Si el repo es tuyo o ya lo has revisado, dile que sí (bond no lo hace por ti).

¿Compartís skills, comandos o servidores MCP en el equipo? Entonces os interesa montar un
catálogo propio. El equipo lo crea en su propio repo con `bond catalog create` y lo comprueba
con `bond catalog check`, que está pensado para meterlo en su CI. Después, cada proyecto que
quiera usarlo lo declara con `bond catalog add <url> [--ref tag|rama]`. El commit concreto queda
fijado en `.bond/lock.json`, así que nadie se lleva sorpresas por un cambio que llegue sin
avisar. `bond doctor` muestra una fila por catálogo, con si está fijado, si está en caché y si
hay una versión más nueva. El detalle y lo relativo a seguridad están en la
[referencia](reference.md#catálogo-propio-bond-catalog).

## 5. `bond` y el bucle de trabajo diario

Esta es la parte que vas a repetir cada día. Entras en el repo y escribes:

```bash
bond
```

bond abre Herdr con el agente por defecto en su panel, y a ese agente lo llama `gru` (es el que
orquesta; si ya hay otro `gru`, será `gru-2`). Si el workspace del repo ya existe, no crea otro,
simplemente te lleva a él. Si quieres una shell al lado del agente,
usa `bond --shell`. Para abrir otro de los agentes del repo, `bond --agent claude`, y para
trabajar en un worktree, `bond --worktree feat/x`. Tienes todos los detalles en
[puesto.md](puesto.md).

**Trabajar en el panel.** Pon el foco en el panel del agente y trabaja con él como siempre,
pidiéndole cosas y revisando lo que hace. Para manejar Herdr usas el prefijo `ctrl+b` seguido
de una tecla. Estos son los atajos que más vas a usar:

| Atajo | Qué hace |
|---|---|
| `prefix+v` | parte el panel a la derecha |
| `prefix+minus` | parte el panel abajo |
| `prefix+c` | abre una pestaña nueva |
| `prefix+h/j/k/l` | te mueve entre paneles |
| `prefix+?` | muestra todos los atajos activos |

**Sin robar el foco.** Las cosas largas, como los tests, un build o un servidor, mejor en un
panel aparte para que no se queden bloqueando tu conversación con el agente. Puedes partir un
panel sin moverte del que estás, lanzar ahí el comando y esperar a que aparezca lo que buscas
en la salida:

```bash
herdr pane split --current --direction down --cwd "$PWD" --no-focus
herdr pane run <panel-nuevo> "npm test"
herdr pane wait-output <panel-nuevo> --match "test result" --timeout 120000
```

**Conducir un agente desde otra terminal.** No hace falta estar dentro de su panel para
hablarle. Desde cualquier shell de la máquina puedes mandarle un prompt, esperar a que acabe y
luego leer lo que ha contestado:

```bash
herdr agent prompt gru "revisa el diff actual" --wait --timeout 300000
herdr agent read gru --source recent-unwrapped --lines 200
```

**Ver el estado global.** Cuando tienes varios agentes en marcha y quieres saber cómo va cada
uno:

```bash
bond status
```

Verás una tabla con el agente, su kind, su estado, el cwd y el panel donde está. Si lo quieres
para un script, `bond status --json` te da lo mismo en JSON.

**Retomar una sesión.** ¿Dejaste algo a medias ayer y no recuerdas dónde?

```bash
bond sessions
```

Te lista las sesiones de todos los proyectos, te marca cuáles están abiertas ahora mismo en
Herdr y te da el comando exacto para retomar cada una. Y si estás dentro de pi, el pie de estado
te recuerda qué agente eres, en qué rama y worktree estás, y cuánto contexto te queda.

**Enchufar otro proyecto.** Basta con ejecutar `bond` dentro del otro repo y tendrás otro
workspace. La barra lateral de Herdr te enseña todos los agentes de todos los proyectos a la
vez, así que sabes cuál está trabajando, cuál está esperando y cuál ha terminado sin tener que
abrir nada.

## 6. Desconectarse y volver

Llega la hora de irse y tienes tests corriendo y un agente a mitad de tarea. No pasa nada.
Pulsa `ctrl+b` y después `q` para desengancharte de Herdr. Todo sigue corriendo por detrás: los
paneles, pi, los tests.

Cuando vuelvas, te enganchas de nuevo y lo encuentras todo como lo dejaste:

```bash
herdr                    # volver a engancharse
pi --continue            # dentro de un panel, retomar la última sesión de pi de esa carpeta
```

Si lo que quieres es apagarlo todo de verdad, usa `herdr server stop`. Ojo, que cierra todos
los paneles, así que no lo hagas si tienes trabajo en marcha.

## 7. Comandos que trae bond

bond trae unos cuantos comandos listos para usar. Los tienes en cada repo inicializado con
Claude Code, opencode y Gemini (Copilot los lee como skills), y también en pi con las Bond
Extensions:

| Comando | Uso |
|---|---|
| `/review [foco]` | Revisa los cambios sin commitear, solo hallazgos accionables |
| `/commit [contexto]` | Redacta el mensaje en inglés y espera tu OK antes de commitear |
| `/handoff [ruta]` | Deja el estado escrito en `.handoff.md` para retomar luego |

Además, en cualquier agente tienes dos skills globales para cuando un solo agente se queda
corto. Con `bond-delegate` delegas una tarea en otro agente que trabaja en un panel hermano; en
pi lo llamas con `/delegate rol[:agente] tarea`. Con `bond-team` repartes una tarea entre varios
agentes, cada uno en su worktree; en pi, con `/team tarea`. Tu propio equipo de agentes, al
estilo de una buena película de espías.

## Glosario mínimo

Herdr usa unos cuantos términos que conviene tener claros. Aquí los tienes para consultarlos
cuando haga falta:

| Término | Qué es |
|---|---|
| **Session** | Espacio del servidor de Herdr. `herdr` a secas usa la por defecto. |
| **Workspace** | Contenedor de nivel proyecto. Uno por repo o tarea. |
| **Tab** | Un layout dentro del workspace. |
| **Pane** | Un terminal real. Divisible a la derecha o abajo. Sobrevive al detach. |
| **Agent** | Proceso que Herdr reconoce dentro de un panel, con estado. |
| **idle / done** | El agente está listo para recibir entrada. |
| **blocked** | Hay una aprobación o pregunta esperando. Mírala antes de responder. |
| **working** | Está ejecutando. |
| **unknown** | Hay agente pero Herdr no lo clasifica con seguridad. Léelo tú. |

Siguiente parada: [reference.md](reference.md) para la referencia completa.

Si algo de esta guía no queda claro o no te funciona como cuenta, abre un issue en
https://github.com/jmanuelcorral/bond/issues y lo vemos.
