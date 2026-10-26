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
