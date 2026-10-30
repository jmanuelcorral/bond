---
name: "2026-10-30-whats-new-hub"
description: "Página de novedades en la web que presenta el modo hub, con un vídeo en castellano y otro en inglés en el que un orquestador pi monta un hola mundo React + Express en un hub"
created_at: "2026-10-30T16:00:00Z"
has_completed_all_phases: false
last_implementation_at: ""
---

# Novedades en la web: el modo hub, con su vídeo

## Origen y revisión

- Identificador: `2026-10-30-whats-new-hub`.
- Origen: petición del usuario: "actualizar la web con un apartado tipo WHAT'S NEW donde podamos
  explicar qué es el modo hub y que contenga un vídeo de ejemplo, en el que creamos 3 repos (un
  hub, un frontend y un backend) y hacemos una historia sencilla (un helloworld con react y
  express)". Revisión del usuario: "usa agentes PI en el vídeo, haz un vídeo en inglés y otro en
  castellano".
- Revisión: `39e3114` en `main` (modo hub fusionado con los PR #26 y #27, sin publicar).
- Base de diseño: `site/.vitepress/config.mts` (navegación por idioma), `site/prepare.mjs`
  (copia `docs/` a `site/src/`), `docs/index.md` y `docs/en/index.md` (galería de vídeos,
  clases `video-grid`/`video-card`/`terminal-window` de `site/.vitepress/theme/style.css`),
  `site/videos/` (`record.sh`, guiones `.tape` de VHS, `reset-*.sh`, `bond-wrapper.sh`,
  `README.md`), `docs/reference.md#bond-hub` y `docs/puesto.md`.
- Aprobación: contenido revisado por el usuario el 2026-10-30.

## Objetivo

Una página de novedades en la web, en castellano y en inglés, que explique el modo hub y lleve un
vídeo en cada idioma: un orquestador pi, en un hub con un frontend (React) y un backend
(Express), reparte una historia sencilla entre dos minions pi con `bond team`.

## Alcance y exclusiones

Entra: las páginas `docs/novedades.md` y `docs/en/whats-new.md`, su entrada en la navegación y
un aviso en la portada; el guion de grabación y su preparación; los dos vídeos con su póster; la
galería de la portada y el README de los vídeos.

Fuera: rehacer los vídeos que ya existen, cambios en la CLI, y la release (se decide aparte).

## Decisiones, dependencias y riesgos

- Todos los agentes del vídeo son pi: el orquestador del hub y los dos minions (usuario).
- Un vídeo por idioma: `hub-es.mp4` con la historia y las instrucciones en castellano y
  `hub-en.mp4` en inglés (usuario).
- La página presenta el modo hub como novedad de la próxima versión, sin número, hasta que se
  decida la release; la sección se titula con la versión al publicarla.
- La página se organiza por versión (la más reciente arriba) para seguir usándola.

Dependencias: F2 depende de F1 (el guion enseña lo que la página explica, y la página enlaza el
vídeo); F3 depende de F1 y F2.

Riesgos:

- La respuesta de los agentes cambia en cada grabación: el orquestador revisa el vídeo antes de
  commitearlo y lo enseña al usuario.
- La grabación usa los modelos del usuario y tarda unos minutos por idioma.
- La confianza de pi en el hub de demo la da el usuario una vez antes de la primera grabación
  (la grabación nunca acepta un aviso de seguridad por su cuenta), como en el vídeo del
  orquestador.
- `bond hub init` escribe en `~/.bond/hubs.toml`: la grabación usa un `BOND_HOME` propio de la
  demo (`/tmp/bond-demo/home`), con la config de agentes copiada, para no tocar el real.

## Fases

### F1: la página de novedades

- Resultado: `docs/novedades.md` y `docs/en/whats-new.md` con la sección del modo hub;
  «Novedades» / «What's new» en la barra de navegación de cada idioma; un aviso en la portada
  (castellano e inglés) que lleva a la página.
- Contenido: qué es un hub (un repo de operaciones con otros repos dentro, como submódulo o
  symlink) y el trabajo en vertical (una rama con el mismo nombre en todos, un agente por repo);
  cuándo usarlo; la estructura de carpetas (`hub.toml`, `repos/`, `docs/plans/`,
  `docs/decisions/`, el bloque del `AGENTS.md`); el flujo `bond hub init` → `bond hub check` →
  `bond hub pull` → `bond team <rama>` → `collect` → `clean`; qué hace el hub por ti (`bond init`
  en el hub y en sus repos, `repos/` por defecto, el bloque `bond:hub`); enlaces a la referencia
  y al puesto de trabajo. Un hueco para el vídeo de su idioma (lo rellena F3).
- Criterios de aceptación:
  - El site construye y la página se ve en los dos idiomas; el selector de idioma lleva de una
    a otra (mismo nombre publicado o mapeo en `prepare.mjs`/config).
  - Los enlaces a la referencia y al puesto funcionan en los dos idiomas.
  - El texto describe el comportamiento actual de `main` (sin `[hub]`, con `level` en
    `hub check --json`, `pull` en fast-forward).
- Verificación: `(cd site && npm run build)` y revisión de las páginas con `npm run dev`.

### F2: los vídeos del hub

- Resultado: `site/videos/reset-hub.sh`, `site/videos/hub-es.tape` y `site/videos/hub-en.tape`,
  `record.sh hub-es|hub-en`, y `docs/public/videos/hub-es.mp4` y `hub-en.mp4` con su póster.
- `reset-hub.sh` crea desde cero en `/tmp/bond-demo/hub-demo/`: un remoto local
  (`frontend.git`) y su clon con React + Vite y una página vacía; un clon `backend` con Express
  y un servidor mínimo; las dependencias instaladas; y una carpeta vacía para el hub. Usa
  `BOND_HOME=/tmp/bond-demo/home`.
- Guion (igual en los dos idiomas, cambia el texto):
  1. `bond hub init` con el frontend por URL (submódulo) y el backend por ruta (symlink): se ven
     `repos/`, el `bond init` de cada repo y el commit inicial; `bond hub check` en verde.
  2. `bond` abre el orquestador pi en el hub. Recibe la historia en una frase: «el frontend
     muestra el saludo que devuelve el backend en `GET /api/hello`»; lee el `AGENTS.md` del
     hub, lanza `bond team feat/hello` (un pi en el frontend y otro en el backend), manda la
     tarea, espera, recoge y revisa.
  3. Final: el backend arranca y `curl /api/hello` responde; el frontend compila
     (`npm run build`); `bond team status`.
- Las esperas de los agentes se ocultan (`Hide`/`Sleep` o `Wait+Screen`), para unos 2–3 minutos.
- Criterios de aceptación:
  - `site/videos/record.sh hub-es` y `hub-en` graban de cero sin tocar la sesión de Herdr del
    usuario ni su `~/.bond`.
  - Cada vídeo enseña los tres pasos y termina con el backend respondiendo y el frontend
    compilado.
  - `site/videos/README.md` documenta los dos guiones, lo que necesitan y la confianza previa.
- Verificación: grabar los dos, revisarlos fotograma a fotograma en los puntos clave
  (`ffmpeg` para extraer imágenes) y enseñarlos al usuario antes de commitearlos.

### F3: integración

- Resultado: cada página de novedades lleva el vídeo de su idioma; la galería de la portada
  añade la tarjeta del modo hub en cada idioma; todo en un PR.
- Criterios de aceptación: el site construye; los vídeos cargan con su póster en las dos
  portadas y en las dos páginas de novedades; `bun test` y `npm run typecheck` siguen en verde.
- Verificación: `(cd site && npm run build)`, `npm run typecheck && bun test`, y revisión en
  `npm run dev`.

## Progreso

| Fase | Implementación | Verificación | Revisión | Evidencia |
| --- | --- | --- | --- | --- |
| F1 | pending | not_run | pending | todavía nada |
| F2 | pending | not_run | pending | todavía nada |
| F3 | pending | not_run | pending | todavía nada |

## Siguiente paso

F1 (la página de novedades).

## Evidencia y seguimiento

Sin evidencia todavía.
