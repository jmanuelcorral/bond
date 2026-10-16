# Getting started

De cero a trabajar con bond en una máquina nueva.

## Qué vas a obtener

- Una CLI, `bond`, que configura tus agentes de código (pi, Claude Code, Codex, Copilot CLI,
  opencode, Crush, Gemini CLI: los que tengas, con uno basta) y los abre en **Herdr**.
- Herdr: los paneles sobreviven a cerrar la terminal y la barra lateral te dice qué agente
  está `working`, `blocked` o `done` en cada proyecto.
- Modelos propios (Ollama, LM Studio, una pasarela compatible con OpenAI) disponibles en los
  agentes que pueden usarlos, declarados una sola vez.

## 1. Requisitos

| Herramienta | Para qué | Comprobar |
|---|---|---|
| Al menos un agente | pi, Claude Code, Codex, Copilot CLI, opencode, Crush o Gemini CLI | `bond setup` te dice cómo instalar cada uno |
| `herdr` | abrir el puesto de trabajo | `herdr --version` |
| Node 22.18 o más | bond desde el código (hasta la 1.0) | `node --version` |

Herdr: https://herdr.dev/docs/install/

## 2. Instalar

```bash
git clone https://github.com/jmanuelcorral/bond ~/gitrepos/bond
cd ~/gitrepos/bond && npm ci --ignore-scripts
bin/bond setup
```

## 3. `bond setup` (una vez por máquina)

Te pregunta:

1. **Herdr**: si falta, cómo instalarlo.
2. **Endpoints de modelos**: detecta Ollama y LM Studio; puedes añadir OpenAI o un endpoint
   compatible (URL, clave si la pide). Comprueba qué sirve cada uno y te deja elegir modelos.
3. **Agentes**: con cuáles trabajar y cuál es el de por defecto.

Después lleva los modelos a cada agente que puede usarlos, instala las integraciones de Herdr y
los skills de delegación, y copia tus instrucciones (`~/.bond/AGENTS.md`: idioma, estilo…) al
fichero global de cada agente. Todo queda en `~/.bond/`; las claves, en `~/.bond/keys/` con
permisos 600. Puedes repetirlo cuando quieras; `bond doctor` comprueba que todo está bien.

La primera vez que abras cada agente, inicia sesión en él como siempre (`/login` en pi y
Claude Code, etc.). Los modelos de tus endpoints no necesitan login.

## 4. `bond init` (una vez por repo)

```bash
cd ~/gitrepos/mi-proyecto
bond init
```

Te pregunta con qué agentes integrar el repo, cuál abre `bond` por defecto y qué herramientas
del catálogo usar (servidores MCP de documentación y búsqueda, el skill `code-context`, los
comandos `review`, `commit` y `handoff`). Crea `.bond/bond.toml`, un `AGENTS.md` para que lo
completes y la config de cada agente. Commitéalo todo. La primera vez que abras cada agente en
el repo, te pedirá confiar en él.

## 5. `bond` y el bucle de trabajo diario

Dentro del repo:

```bash
bond
```

Abre Herdr con el agente por defecto en un panel y una shell en otro (si ya existe, lo enfoca).
`bond --agent claude` abre otro de los agentes del repo; `bond --worktree feat/x`, en un worktree.
Detalle en [puesto.md](puesto.md).


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

**Conducir un agente desde otra terminal.** Desde cualquier shell de la máquina, sin tocar su
panel:

```bash
herdr agent prompt pi-mi-proyecto "revisa el diff actual" --wait --timeout 300000
herdr agent read pi-mi-proyecto --source recent-unwrapped --lines 200
```

**Ver el estado global.**

```bash
bond status
```

Tabla con agente, kind, estado, cwd y panel. `bond status --json` para scripts.

**Retomar una sesión.**

```bash
bond sessions
```

Sesiones de todos los proyectos, cuáles están abiertas ahora en Herdr y el comando exacto
para retomar cada una. Dentro de pi, el pie de estado te dice qué agente eres, en qué rama
y worktree, y cuánto contexto te queda.

**Enchufar otro proyecto.** `bond` dentro de ese otro repo: otro workspace. La barra lateral de Herdr te
muestra todos los agentes de todos los proyectos a la vez: ves cuál está trabajando, cuál
esperando y cuál terminado sin abrir nada.

## 6. Desconectarse y volver

`ctrl+b` seguido de `q` te desengancha. Todo sigue corriendo: los paneles, pi, los tests.

```bash
herdr                    # volver a engancharse
pi --continue            # dentro de un panel, retomar la última sesión de pi de esa carpeta
```

Para parar de verdad todo: `herdr server stop` (cierra todos los paneles; no lo hagas con
trabajo en marcha).

## 7. Comandos que trae bond

En cada repo inicializado (Claude Code, opencode, Gemini; Copilot los lee como skills) y en pi
con las Bond Extensions:

| Comando | Uso |
|---|---|
| `/review [foco]` | Revisa los cambios sin commitear, solo hallazgos accionables |
| `/commit [contexto]` | Redacta el mensaje en inglés y espera tu OK antes de commitear |
| `/handoff [ruta]` | Deja el estado escrito en `.handoff.md` para retomar luego |

Y en cualquier agente, los skills globales: `bond-delegate` (en pi, `/delegate rol[:agente]
tarea`) para delegar en otro agente en un panel hermano, y `bond-team` (en pi, `/team tarea`)
para repartir una tarea entre varios agentes en worktrees.

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

Siguiente parada: [reference.md](reference.md) para la referencia completa.
