# Spike P9: `bond team` con motor `hc`

Resultado: **VIABLE (GO)**  
Fecha: 2026-11-13  
Fase: P9 (`bond team` sobre `hc`: un panel nativo por agente)  
Autor: stuart (repos/bond) en colaboración con bob (repos/bond-app)

## Objetivo del Spike (Criterio 1)

Verificar dentro de un contenedor efímero basado en `bond-app-runner:p5` (con `bond`, `herdr`, `hc` y `pi`) que:
1. `bond team` puede usar `hc` como motor en lugar de la TUI de herdr.
2. Cada agente de repo (y el orquestador si lo hay) corre como una terminal nativa de `hc` en su respectivo worktree.
3. Las operaciones de `prompt`, `status` y `collect` son plenamente funcionales sobre `hc`.
4. Las terminales quedan etiquetadas en el espacio del run (`herdr.space` y `herdr.tab`), permitiendo que `herdr-app` las represente como paneles nativos sin multiplexor anidado ni prefijo `ctrl+b`.
5. `herdr-app check` valida los mods sin errores.

## Ejecución del Spike

### 1. Entorno del contenedor
- Imagen: `bond-app-runner:p5`
- Contenedor efímero: `bond-spike-p9-stuart` con `--init` y usuario `runner`.
- Componentes verificados en el contenedor:
  - `hc 0.1.17`
  - `herdr 0.9.3`
  - `pi 1.5.1`
  - `git 2.43.0`
  - `node 22.18.0`

### 2. Estructura del hub de prueba
Se creó un hub git en `/workspace/hub` con `hub.toml` declarando dos repositorios:
- `repos/repo1` (base `main`)
- `repos/repo2` (base `main`)

### 3. Creación de worktrees y terminales `hc`
Para la rama `feat/spike`:
- Se añadieron los git worktrees en:
  - `/home/runner/.herdr/worktrees/spike-hub-123/repos-repo1/feat/spike`
  - `/home/runner/.herdr/worktrees/spike-hub-123/repos-repo2/feat/spike`
- Se arrancaron terminales `hc` en segundo plano con persistencia y sin atarse al padre (`--bg --keep --no-parent`):
  - Agente `kevin` en repo1 con etiquetas:
    - `herdr.space=s-spike-run`
    - `herdr.tab=t1`
    - `bond.repo=repos/repo1`
    - `bond.branch=feat/spike`
  - Agente `stuart` en repo2 con etiquetas equivalentes.

### 4. Verificación de operaciones
- **Status (`hc ls` / `hc get`)**:
  - `hc ls --json` devolvió ambas terminales en estado `live` con sus rutas exactas de trabajo.
  - `hc get kevin --json` confirmó las etiquetas `herdr.space`, `herdr.tab`, `bond.repo`, `bond.branch`, PID y `keep: true`.
- **Prompt (`hc send`)**:
  - Se envió una tarea a cada terminal vía `hc send`:
    - `kevin`: creación de `result.txt` y commit git en repo1.
    - `stuart`: creación de `result.txt` y commit git en repo2.
- **Collect (`hc read` / git log)**:
  - `hc read --lines 20` recogió la transcripción exacta de la terminal con la ejecución exitosa de los comandos.
  - `git log -1 --oneline` en ambos worktrees confirmó los commits generados (`feat: spike commit in repo1` y `feat: spike commit in repo2`).

### 5. Verificación en `herdr-app`
- Las etiquetas `herdr.space=s-spike-run` y `herdr.tab=t1` permiten a herdr-app mostrar las terminales como paneles nativos divididos en la pestaña `t1` del espacio `s-spike-run`.
- Se ejecutó `herdr-app check` sobre todos los mods de `bond-app` (`bond-agents`, `bond-board`, `bond-settings`, `bond-status`, `bond-tabs`, `bond-titlebar`): todos pasaron sin errores.

### 6. Limpieza
El contenedor efímero `bond-spike-p9-stuart` fue detenido y eliminado.

## Conclusión

El motor `hc` para `bond team` es completamente viable. Procedemos a implementar `--engine hc` y `BOND_TEAM_ENGINE=hc` en `bond` manteniendo `herdr` como motor por defecto.
