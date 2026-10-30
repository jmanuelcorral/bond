# Vídeos de la documentación

Los vídeos de `docs/public/videos/` se graban con [VHS](https://github.com/charmbracelet/vhs) a
partir de los guiones de esta carpeta, sobre un clon limpio de
[fluzo](https://github.com/fluzo-labs/fluzo). Así se pueden volver a grabar cuando cambie bond.

| Guion | Qué enseña | Dónde sale |
|---|---|---|
| `init.tape` | `bond init` en fluzo: elegir agentes y herramientas, qué genera, `bond sync --check` | portada y primeros pasos |
| `puesto.tape` | `bond` abre fluzo en Herdr con gru (pi), una pregunta y `bond status` | portada y el puesto de trabajo |
| `equipo.tape` | `bond team` con dos ramas y dos minions pi, la tabla en vivo y `bond team status` | portada y el puesto de trabajo |
| `catalogos.tape` | `bond catalog create`, `check`, `add` con el commit fijado, `bond init --list` y `bond doctor` | portada y la referencia |
| `orquestador.tape` | Claude, solo en su panel, recibe una instrucción: planifica una web, la reparte entre dos minions pi con `bond team`, revisa, devuelve correcciones, integra en `main` y limpia el equipo | portada (el primero) y el puesto de trabajo |
| `hub-es.tape`, `hub-en.tape` | El modo hub, en castellano y en inglés: `bond hub init` con un frontend React (submódulo) y un backend Express (symlink), `bond hub check` y un orquestador pi que reparte un hola mundo en una rama vertical con `bond team` (un pi por repo), recoge y comprueba | novedades (cada idioma el suyo) y portada |

```bash
site/videos/record.sh            # todos
site/videos/record.sh equipo     # uno
```

Necesitas `vhs`, `ttyd`, `herdr`, `pi`, `claude`, `bond` y `ffmpeg` en el PATH, y un modelo
configurado en pi.
Todo pasa en `/tmp/bond-demo` y en una sesión de Herdr aparte (`bond-demo`), así que tu sesión y
tus repos no se tocan. Detalles:

- `reset-fluzo.sh` deja el clon como recién descargado (y con `init`, preparado con bond), y
  quita los worktrees y ramas `demo/*` que deja el vídeo del equipo.
- `bond-fn.zsh` hace que los agentes que abre bond arranquen con `--thinking off`, para que el
  razonamiento del modelo no llene la pantalla.
- Los vídeos con agentes dependen del modelo: su respuesta cambia en cada grabación. Revísalos
  antes de commitearlos.
- pi apunta `/tmp/bond-demo` en su confianza la primera vez que se acepta; quítalo de
  `~/.pi/agent/trust.json` si no lo quieres.

### El vídeo del orquestador

- `reset-web.sh` crea `/tmp/bond-demo/web` desde cero (un club de lectura en HTML) con
  `bond init` y un `.claude/settings.local.json` que deja a Claude ejecutar comandos de shell
  sin preguntar, **solo en ese repo de demo**: si no, la grabación se pararía en cada permiso.
- `bond-wrapper.sh` se instala como `/tmp/bond-demo/bin/bond` y añade `--thinking off` a los
  minions que crea `bond team`; el guion pone ese directorio delante en el PATH.
- **Antes de la primera grabación, da tú la confianza una vez** (la grabación nunca acepta un
  aviso de seguridad por su cuenta): ejecuta `site/videos/reset-web.sh`, luego
  `cd /tmp/bond-demo/web && pi` («Trust» y sal) y `claude` («Yes, I trust this folder» y
  `/exit`). Claude avisa de que el repo trae permisos preaprobados: es el fichero de arriba.
- Dura unos 3 minutos; la grabación termina cuando Claude acaba (`done HH:MM`).

### Los vídeos del modo hub

- `reset-hub.sh` crea `/tmp/bond-demo/hub-demo` desde cero: un frontend (React + Vite) con su
  remoto local `frontend.git`, un backend (Express) y la carpeta vacía del hub, con las
  dependencias ya instaladas. bond usa ahí su propia carpeta (`BOND_HOME=/tmp/bond-demo/home`)
  con pi como único agente, así que tu `~/.bond` (y su registro de hubs) no se toca. Los
  worktrees de `bond team` quedan en `~/.herdr/worktrees/hub/`: el script solo borra los que
  apuntan a la demo.
- **Antes de la primera grabación, da tú la confianza una vez**: ejecuta `reset-hub.sh`, luego
  `cd /tmp/bond-demo/hub-demo/hub && BOND_HOME=/tmp/bond-demo/home bond hub init . --yes --name demo-hub file:///tmp/bond-demo/hub-demo/src/frontend.git /tmp/bond-demo/hub-demo/src/backend`
  y `pi` («Trust» y sal). pi no pregunta hasta que el hub tiene su config (`.pi/`).
- El encargo en inglés pide expresamente contestar en inglés: si tus instrucciones globales de
  pi (`~/.pi/agent/AGENTS.md`) fijan otro idioma, los agentes lo seguirían.
- Cada uno dura unos 8 minutos de grabación y sale en unos 2: las esperas de los agentes van
  a saltos (unos segundos cada 40 s) y el vídeo acaba cuando el orquestador escribe
  «terminado HH:MM» o «finished HH:MM». Los mensajes de bond salen en castellano también en el
  vídeo en inglés.
- Los pósteres (`poster-hub-*.webp`) son el último fotograma:
  `ffmpeg -sseof -1 -i hub-es.mp4 -frames:v 1 -vf scale=1200:-1 -c:v libwebp -quality 50 poster-hub-es.webp`.
