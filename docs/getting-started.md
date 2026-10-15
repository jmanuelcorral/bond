# Getting started

De cero a trabajar con pi dentro de Herdr en una máquina nueva.

## Qué vas a obtener

- **pi** como agente, con su config de usuario apuntando a este repo (instrucciones,
  prompts y ajustes versionados).
- **Herdr** como multiplexor: los paneles sobreviven a cerrar la terminal, y la barra lateral
  te dice qué agente está `working`, `blocked` o `done` en cada proyecto.
- Un lanzador (`pidev`) que monta el puesto de trabajo de cada proyecto en un comando.

## 1. Requisitos

| Herramienta | Para qué | Comprobar |
|---|---|---|
| `herdr` | multiplexor | `herdr --version` |
| `bun` o `npm` | instalar pi | `bun --version` / `npm --version` |
| `jq` | leer los ids JSON de la API de Herdr | `echo '{}' \| jq .` |

Si falta Herdr: https://herdr.dev/docs/install/

## 2. Instalar

```bash
cd ~/gitrepos/piSetup
./install.sh --dry-run   # opcional: ver qué va a hacer
./install.sh
```

El instalador es idempotente y no pisa nada sin backup: si en `~/.pi/agent` ya existía algo
de lo que él enlaza, lo guarda como `.bak.<fecha>` antes de crear el symlink.

Si además quieres los extras de Herdr (etiquetas de agente en los bordes de panel y
`new_cwd = "follow"`):

```bash
./install.sh --herdr-config
```

Conviene poner el bin del repo en el PATH:

```bash
export PATH="$HOME/gitrepos/piSetup/bin:$PATH"
```

## 3. Primera sesión

```bash
pidev ~/gitrepos/mi-proyecto --attach
```

Se abre Herdr con el workspace `pi:mi-proyecto`: pi a la izquierda, shell tuya a la
derecha. Dentro de pi, una única vez:

```
/login
```

Elige proveedor y credenciales. Luego `/model` para elegir modelo (`Ctrl+S` lo guarda como
defecto) y `/thinking` para el nivel de razonamiento. Las claves quedan en
`~/.pi/agent/auth.json`, fuera de este repo.

El modelo local del proveedor `halo` (`flash-halogen`) aparece en `/model` sin necesidad de
login: apunta a `http://halo.example/v1` y se declara en `pi/agent/models.json`.
Detalle, verificación y cómo activar más modelos en [reference.md](reference.md).

Prueba con algo pequeño:

```
explícame la estructura de este repo y cómo se ejecutan sus comprobaciones
```

## 4. El bucle de trabajo diario

**Trabajar en el panel.** Foco en el panel de pi y trabajar normal. Con el prefijo
`ctrl+b` controlas Herdr: `prefix+v` parte a la derecha, `prefix+minus` parte abajo,
`prefix+c` pestaña nueva, `prefix+h/j/k/l` te mueves entre paneles, `prefix+?` muestra
todos los atajos activos.

**Sin robar el foco.** Para cosas largas (tests, builds, un servidor), parte un panel y
ejécuta ahí:

```bash
herdr pane split --current --direction down --cwd "$PWD" --no-focus
herdr pane run <panel-nuevo> "npm test"
herdr pane wait-output <panel-nuevo> --match "test result" --timeout 120000
```

**Conducir a pi desde otra terminal.** Desde cualquier shell de la máquina, sin tocar su
panel:

```bash
herdr agent prompt pi-mi-proyecto "revisa el diff actual" --wait --timeout 300000
herdr agent read pi-mi-proyecto --source recent-unwrapped --lines 200
```

**Ver el estado global.**

```bash
pistatus
```

Tabla con agente, kind, estado, cwd y panel. `pistatus --json` para scripts.

**Retomar una sesión.**

```bash
pisessions
```

Sesiones de todos los proyectos, cuáles están abiertas ahora en Herdr y el comando exacto
para retomar cada una. Dentro de pi, el pie de estado te dice qué agente eres, en qué rama
y worktree, y cuánto contexto te queda.

**Enchufar otro proyecto.** Otro `pidev` y otro workspace. La barra lateral de Herdr te
muestra todos los agentes de todos los proyectos a la vez: ves cuál está trabajando, cuál
esperando y cuál terminado sin abrir nada.

## 5. Desconectarse y volver

`ctrl+b` seguido de `q` te desengancha. Todo sigue corriendo: los paneles, pi, los tests.

```bash
herdr                    # volver a engancharse
pi --continue            # dentro de un panel, retomar la última sesión de pi de esa carpeta
```

Para parar de verdad todo: `herdr server stop` (cierra todos los paneles; no lo hagas con
trabajo en marcha).

## 6. Comandos de pi que trae el setup

Plantillas versionadas en `prompts/` (llegan a pi por el paquete), disponibles en cualquier proyecto:

| Comando | Uso |
|---|---|
| `/review [foco]` | Revisa los cambios sin commitear, solo hallazgos accionables |
| `/commit [contexto]` | Redacta el mensaje en inglés y espera tu OK antes de commitear |
| `/handoff [ruta]` | Deja el estado escrito en `.pi-handoff.md` para retomar luego |
| `/team <tarea>` | Reparte la tarea entre 2-3 agentes, cada uno en su worktree; espera tu OK y te resume cada rama |
| `/delegate [rol] [tarea...]` | Lanza otro pi en un panel hermano (nombre único, p. ej. `reviewer-1`) y te trae el informe |

Tras editar a mano cualquier config del setup, aplica en caliente dentro de pi con `/reload`.

## Glosario mínimo

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

Siguiente parada: [reference.md](reference.md) para el inventario completo del setup.
