# Qué hace `pidev`

`pidev` es el lanzador del setup. Monta en Herdr el "puesto de trabajo" de un proyecto:
un panel con el agente **pi** y otro panel con una shell para ti, y te devuelve los ids con
los que conducir ese agente desde cualquier sitio.

Sin `pidev` serían cinco comandos de Herdr encadenados, leyendo ids JSON a mano. Con él:

```bash
pidev ~/gitrepos/mi-proyecto
```

## Paso a paso

Esto es exactamente lo que ejecuta, en orden:

**1. Comprobaciones previas.** `herdr` y `jq` tienen que estar en el PATH. `pi` también, salvo
que uses `--no-agent`. Si `--direction` no es `right` o `down`, para antes de tocar nada.

**2. Resuelve el proyecto y la etiqueta.** El directorio por defecto es el actual; se
resuelve a ruta absoluta. La etiqueta del workspace es `pi:<nombre-del-directorio>`,
salvo que la cambies con `--label`. La etiqueta es la clave de reutilización.

**3. Deriva el nombre del agente.** Herdr exige `[a-z][a-z0-9_-]{0,31}`. El script pasa el
nombre del directorio a minúsculas, sustituye lo que no vale por guiones, lo recorta a 29
caracteres y le pone el prefijo `pi-`. Ejemplo: `Mi_App` → `pi-mi-app`.

**4. Reutiliza si ya existe.**

```bash
herdr workspace list | jq '.workspaces[] | select(.label == $label)'
```

Si encuentra un workspace con esa etiqueta, hace `herdr workspace focus <id>` y termina.
No crea un segundo workspace por mucho que lo lances. Ojo: la comparación es por etiqueta,
no por ruta; si le das otra etiqueta al mismo proyecto, tendrás dos workspaces.

**5. Crea el workspace.**

```bash
herdr workspace create --cwd "$PROYECTO" --label "$ETIQUETA" --focus
```

De la respuesta se queda con dos ids:

| Campo JSON | Para qué se usa |
|---|---|
| `.result.workspace.workspace_id` | El workspace (tipo `w3`) |
| `.result.root_pane.pane_id` | El panel raíz, donde acabará pi (tipo `w3:p5`) |

**6. Parte el panel para tu shell.**

```bash
herdr pane split --pane "$PANEL_PI" --direction right --ratio 0.6 --cwd "$PROYECTO" --no-focus
```

`--no-focus` es a propósito: el foco lo tiene el workspace, no te roba el ratón mientras
monta. Tu shell sale en `.result.pane.pane_id`.

**7. Lanza pi.** Primero comprueba que el nombre de agente no esté vivo en otra parte; si lo
está, le añade un `x` final para no colisionar. Después:

```bash
herdr agent start pi-mi-proyecto --kind pi --pane "$PANEL_PI" --timeout 60000
```

`agent start` no crea paneles ni mueve nada: exige un panel con la shell en su prompt. El
comando no vuelve hasta que Herdr detecta pi en ese panel y lo considera listo para entrada.
Si no lo detecta, `pidev` avisa pero **no deshace nada**: el workspace y los paneles se
quedan creados.

**8. Imprime el resultado** por si lo conduces desde otra terminal:

```
  workspace   : w3  (pi:mi-proyecto)
  panel pi    : w3:p5   (agente: pi-mi-proyecto)
  panel tuyo  : w3:p6

  Desde cualquier shell:
    herdr agent prompt pi-mi-proyecto "la tarea" --wait
    herdr agent read pi-mi-proyecto --source recent-unwrapped --lines 200
```

**9. `--attach`** (opcional) hace `exec herdr` al final, para adjuntarte el TUI. Solo tiene
sentido desde una terminal fuera de Herdr; si ya estás dentro, se ignora con un aviso porque
Herdr bloquea los lanzamientos anidados.

## Resultado

```
workspace  pi:mi-proyecto
└── tab
    ├── panel w3:p5   pi            (60%)
    └── panel w3:p6   shell         (40%)
```

Con `--direction down` el split es vertical y la proporción se aplica igual.

## Flags

| Flag | Defecto | Efecto |
|---|---|---|
| `directorio` posicional | `$PWD` | Proyecto a abrir |
| `-d`, `--direction` | `right` | `right` o `down` |
| `-r`, `--ratio` | `0.6` | Fracción que ocupa el panel de pi |
| `-l`, `--label` | `pi:<dir>` | Etiqueta del workspace, y clave de reutilización |
| `--no-agent` | lanza pi | Deja los dos paneles en shell |
| `--no-focus` | enfoca | Crea el workspace sin cambiar el foco |
| `--attach` | no | Adjunta el TUI de Herdr al terminar |
| `-h`, `--help` | | Uso |

## Lo que `pidev` NO hace

Es deliberadamente acotado:

- No crea worktrees de git ni ramas.
- No abre pestañas adicionales ni un tercer panel de logs.
- No cierra workspaces, paneles ni sesiones.
- No toca ninguna configuración de pi ni de Herdr.
- No mata procesos si algo falla: deja lo creado y avisa.

## Conducirlo después

El agente es conducible por nombre desde cualquier shell de la misma máquina:

```bash
# Mandar trabajo y esperar a que se asiente (idle, done o blocked)
herdr agent prompt pi-mi-proyecto "revisa el diff actual" --wait --timeout 300000

# Leer la respuesta
herdr agent read pi-mi-proyecto --source recent-unwrapped --lines 200

# Esperar a que pida entrada (aprobación, pregunta)
herdr agent wait pi-mi-proyecto --until blocked --timeout 120000

# Cancelar / escapar en la UI del agente
herdr agent send-keys pi-mi-proyecto ctrl+c

# Ver cómo lo ve Herdr
herdr agent get pi-mi-proyecto
herdr agent explain pi-mi-proyecto
```

Estados: `idle` y `done` listo para entrada, `blocked` esperando una respuesta tuya,
`working` ocupado, `unknown` no lo clasifica con seguridad.

## Casos de fallo

| Síntoma | Causa y qué hacer |
|---|---|
| `no pude leer los ids de 'workspace create'` | El servidor no respondió con lo esperado. `herdr status` y repite. |
| `aviso: Herdr aún no detecta pi` | Falta la integración o pi tardó más del timeout. `herdr integration status`, `herdr agent read <panel>`. El workspace queda útil igual: arranca `pi` a mano en ese panel. |
| `--direction debe ser right o down` | Herdr solo parte en esas dos direcciones. |
| `pi no está en el PATH` | `./install.sh`, o `--no-agent` si solo querías los paneles. |
| Dos workspaces para el mismo proyecto | Etiquetas distintas. Cierra el sobrante: `herdr workspace close <id>`. |
| `--attach` no hace nada | Ya estabas dentro de Herdr. |
