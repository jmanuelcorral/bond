# Novedades

En esta página recopilamos las novedades más destacadas que van llegando a bond en cada versión.

## Próxima versión: el modo hub

Hasta ahora, bond te permitía trabajar con agentes en un repositorio git independiente: `bond init` preparaba la configuración, `bond` abría tu puesto de trabajo en Herdr y `bond team` repartía ramas paralelas entre varios agentes en sus propios worktrees.

Pero en proyectos reales es muy habitual tener el código repartido en varios repositorios: un frontend web, un backend con la API y quizá una librería compartida. Cuando una tarea requiere tocar el frontend y el backend a la vez (por ejemplo, añadir un nuevo endpoint y consumirlo en la interfaz), coordinar ramas y agentes por separado se vuelve tedioso.

Para eso llega el **modo hub**.

<!-- VIDEO: F3 insertará aquí el vídeo hub-es.mp4 -->
<div class="terminal-window">
  <div class="terminal-header">
    <div class="terminal-dots">
      <span class="terminal-dot dot-red"></span>
      <span class="terminal-dot dot-yellow"></span>
      <span class="terminal-dot dot-green"></span>
    </div>
    <div class="terminal-title">bond hub en acción</div>
  </div>
  <p class="terminal-caption" style="text-align: center; padding: 2.5rem 1rem; margin: 0; color: var(--vp-c-text-2);">
    <em>El vídeo de demostración del modo hub se incluirá aquí próximamente.</em>
  </p>
</div>

### ¿Qué es un hub?

Un **hub** es un repositorio git de operaciones que agrupa los repositorios de tu proyecto (declarados en `hub.toml`). No sustituye a tus repositorios ni los fusiona en un monorepo forzado: cada repositorio conserva su historial, sus remotos y su independencia.

Los repositorios se vinculan al hub de dos formas:
- **Como submódulo (`link = "submodule"`)**: ideal cuando el hub se comparte con el equipo a través de un repositorio git remoto.
- **Como enlace local (`link = "symlink"`)**: ideal para trabajar con clones locales que ya tienes en tu máquina, sin necesidad de convertirlos en submódulos. La ruta a tu clon local se guarda en `.bond/hub.local.toml` (que se queda en tu máquina y nunca se sube a git).

### El trabajo en vertical con `bond team`

La gran potencia del modo hub aparece con `bond team`. En un repositorio individual, `bond team` reparte ramas independientes entre agentes. En un hub, `bond team` trabaja **en vertical**:

1. **Una rama con el mismo nombre en todos los repositorios**: al lanzar `bond team fix/login`, bond crea la rama en el hub y abre un worktree con esa misma rama en cada repositorio de la sesión (o en los que indiques con `--repos`).
2. **Un agente por repositorio**: cada repositorio recibe su propio agente en su worktree aislado (`~/.herdr/worktrees/<hub>/<repo>/<rama>`), con la configuración y herramientas de ese repositorio.
3. **Una sola rama vertical a la vez**: para mantener el foco y evitar colisiones entre cambios interdependientes, bond se asegura de que solo haya una rama vertical activa en el hub.
4. **Una tabla en vivo unificada**: Herdr abre un único panel estrecho `tabla · <hub>` que supervisa el estado de todos los repositorios de la sesión a la vez.

### ¿Cuándo usar un hub?

Usa un hub cuando:
- Tu sistema está dividido en varios repositorios interdependientes (frontend, backend, servicios, librerías).
- Quieres que un agente orquestador (como pi o Claude Code) planifique una tarea global y coordine a minions especializados en cada repositorio.
- Necesitas probar o implementar cambios que cruzan fronteras entre repositorios con ramas sincronizadas.

Si solo trabajas en un repositorio independiente, no necesitas un hub: `bond init` y `bond` siguen funcionando exactamente igual que siempre.

### Estructura de carpetas de un hub

En la raíz del hub conviven la configuración de la sesión, los repositorios y la documentación operativa:

```text
mi-hub/
├── hub.toml                  # Declaración de la sesión (nombre, base y repos)
├── AGENTS.md                 # Instrucciones globales con el bloque generado bond:hub
├── .bond/
│   ├── bond.toml             # Configuración de bond para el hub (agentes y skills)
│   └── hub.local.toml        # Rutas locales de los symlinks en tu máquina (.gitignore)
├── repos/                    # Carpeta por defecto para los repositorios vinculados
│   ├── frontend/             # Submódulo o enlace local
│   └── backend/              # Submódulo o enlace local
├── docs/
│   ├── plans/                # Planes de trabajo globales que abarcan varios repos
│   └── decisions/            # Memoria de decisiones del hub (opcional)
└── .gitignore
```

- **`hub.toml`**: define el nombre de la sesión, la rama base global (por ejemplo `main`) y cada repositorio con su ruta, base, tipo de enlace (`submodule` o `symlink`), agente por defecto y una descripción opcional.
- **`repos/`**: es la ubicación estándar donde se colocan los repositorios vinculados para mantener limpia la raíz del hub.
- **`docs/plans/` y `docs/decisions/`**: el hub centraliza los planes del equipo y, si activas la memoria de decisiones con `[decisions]`, los registros de encargos e informes de los agentes (`runs`) se almacenan aquí.
- **El bloque `bond:hub` en `AGENTS.md`**: `bond sync` escribe automáticamente un bloque delimitado con la tabla de los repositorios, sus descripciones, sus ramas base y las reglas de convivencia (como no editar `repos/` directamente desde el hub, sino a través de `bond team`). Lo que escribas fuera del bloque se respeta intacto.

### El flujo de trabajo: de principio a fin

El ciclo de trabajo en un hub sigue seis pasos muy claros:

```bash
# 1. Crear o inicializar el hub
bond hub init

# 2. Comprobar que toda la sesión está lista
bond hub check --fix

# 3. Poner al día las ramas base en fast-forward
bond hub pull

# 4. Abrir la rama vertical y asignar tareas
bond team feat/auth
bond team prompt feat/auth "Añade login con JWT: endpoint en backend y formulario en frontend"

# 5. Recoger el trabajo de los agentes
bond team collect feat/auth --repo backend
bond team collect feat/auth --repo frontend

# 6. Limpiar los worktrees
bond team clean feat/auth
```

1. **`bond hub init`**: asistente interactivo que prepara el hub, hace `bond init` si no estaba hecho (incluyendo la skill `plan-team`), vincula submódulos o enlaces locales, y configura bond en los repositorios miembros que no lo tuvieran.
2. **`bond hub check`**: audita todos los repositorios de la sesión. Comprueba que los repositorios existan, que los enlaces sean correctos, que las bases existan, que la configuración de agentes esté sincronizada y que no haya cambios sueltos. Con `--fix`, repara automáticamente enlaces rotos e inicializa submódulos pendientes. En formato `--json`, reporta el nivel de cada chequeo (`ok`, `warn`, `fail`) y el total de incidencias.
3. **`bond hub pull`**: actualiza la rama base del hub y de cada repositorio con `git fetch` y avance rápido (*fast-forward*). Si un repositorio tiene cambios locales o ha divergido, lo salta de forma segura sin hacer merge ni rebase.
4. **`bond team <rama>`**: abre la rama vertical en el hub y crea los worktrees y agentes en cada repositorio. Con `bond team prompt`, repartes la tarea; bond añade una nota contextual a cada agente para que sepa quiénes son sus compañeros y en qué carpeta trabajan.
5. **`bond team collect`**: extrae el resumen y los commits de cada agente. Si el hub tiene memoria de decisiones, guarda el encargo y la respuesta en un run centralizado.
6. **`bond team clean`**: retira los worktrees de trabajo de todos los repositorios. Con `--delete-branch`, borra también las ramas integradas una vez finalizado el trabajo.

### Qué hace el hub por ti

- **Configuración heredada**: al añadir repositorios con `bond hub init` o `bond hub add`, bond aplica la configuración de agentes a los repos que aún no tenían bond, ahorrándote inicializarlos a mano uno a uno.
- **Contexto automático para los agentes**: mediante el bloque `bond:hub` en `AGENTS.md`, cualquier agente que abras en el hub sabe al instante qué repositorios existen, qué hace cada uno y dónde están los planes.
- **Orden garantizado**: la convención de `repos/`, el aviso de bases atrasadas y la regla de una sola rama vertical evitan conflictos cruzados y descuidos habituales al trabajar con varios repos.

Para conocer todos los parámetros y opciones en detalle, consulta la sección de [bond hub en la Referencia](reference.md#bond-hub) y la guía sobre ramas verticales en [El puesto de trabajo](puesto.md#una-rama-vertical-en-un-hub).
