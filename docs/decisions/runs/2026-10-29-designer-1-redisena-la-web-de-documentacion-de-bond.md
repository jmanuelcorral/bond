---
agent: "designer-1"
kind: "agy"
branch: "feat/site-redesign"
base: "feat/site-redesign@326b7da"
orchestrator: "claude"
started_at: "2026-10-29T07:27:12Z"
finished_at: "2026-10-29T07:36:57Z"
status: "reported"
commits: []
decisions: []
---

## Request

Rediseña la web de documentación de bond (VitePress) siguiendo dos documentos de diseño:
- PRD de diseño y UI/UX: /tmp/tmp.AzSDveiomu/prd_de_dise_o_y_ui_ux.md
- Logotipo vectorial (SVG): /tmp/tmp.AzSDveiomu/logotipo_vectorial_de_bond.md
Léelos enteros antes de empezar. Lee también AGENTS.md del repo.

Contexto del repo (/home/jose/gitrepos/bond, rama feat/site-redesign, ya creada y activa):
- El site está en site/: site/.vitepress/config.mts, site/.vitepress/theme/index.ts y theme/style.css. Las páginas salen de docs/ (castellano) y docs/en/ (inglés): site/prepare.mjs las copia a site/src/, que se regenera y NO se edita ni se versiona. La portada es docs/index.md y docs/en/index.md. Los vídeos están en docs/public/videos/*.mp4.
- Construir: (cd site && npm ci --ignore-scripts && npm run build). Para ver: npm run dev o npm run preview dentro de site/.

Qué hacer:
1. Hero: jerarquía de CTAs (primario sólido "Empieza aquí", secundario outline con icono de GitHub, terciario enlace sutil "Descargar release"), caja de instalación rápida con `brew install jmanuelcorral/tap/bond` y botón de copiar con feedback (check 2 s), y un ancla visual.
2. Vídeos: contenedor tipo ventana de terminal (barra con 3 puntos y título, borde 1px var(--vp-c-divider), radius 12px, sombra), autoplay muted loop playsinline, poster para evitar CLS, y grid 2x2 en >=768px con título encima de cada vídeo. Si generas posters, que sean ligeros (webp) y en docs/public/.
3. Feature cards con badge monospace ($ bond init...), hover con borde de acento (150ms ease) y chevron de navegación.
4. Tokens de color --bond-c-* (elige UNA paleta, la verde, coherente con el logo) para modo claro y oscuro.
5. Logo: usa el SVG del documento como logo de cabecera, favicon y base de la imagen OpenGraph. Haz una variante que se lea bien en modo claro (el texto blanco no vale ahí) y un isotipo solo para el favicon.
6. Aplica lo mismo en la versión inglesa (docs/en/index.md), con el copy traducido.

Restricciones:
- No hagas commit ni push. Solo cambia site/ (salvo site/src/), docs/index.md, docs/en/index.md y docs/public/ (logos, posters, imágenes). No toques cli/, catalog/, ni el resto de docs.
- No añadas dependencias pesadas; si añades alguna a site/package.json, justifícala.
- Comentarios y textos de la web en castellano (y en inglés en docs/en/).
- Mantén Lighthouse alto: nada de fuentes o scripts externos innecesarios, imágenes optimizadas.
- Comprueba que `npm run build` en site/ termina sin errores y revisa el resultado en modo claro, oscuro y a <768px.

Entrega: un resumen breve de lo que cambiaste (ficheros), decisiones de diseño que tomaste donde el PRD dejaba opciones, lo que no pudiste hacer y cómo verificaste el build.

## Report

Se han aplicado y verificado todas las correcciones solicitadas:

### 1. Cambios realizados

* **Corrección de `docs/public/hero-mockup.svg`:**
  * Se eliminaron los atributos `class` duplicados en las etiquetas `<text>` unificándolos (por ejemplo: `class="t-mono cyan"`, `class="t-mono dim"`, etc.).
  * Verificado con `xmllint --noout docs/public/*.svg`: **0 errores en todos los SVG**.
* **Logotipo compacto para cabecera (`docs/public/logo-dark.svg` y `logo-light.svg`):**
  * Se retiró el badge técnico `"AGENT CLI"` y se recortó el `viewBox` a `5 0 310 126`, ajustando el dibujo a los extremos del isotipo y del texto "bond". Al encajar en la barra de navegación de 32 px de alto, las letras y el isotipo se muestran más del doble de grandes, nítidos y perfectamente legibles.
  * Se mantienen las dos variantes: oscuro (`#FFFFFF`) y claro (`#0F172A`).
* **Pósters de vídeo:**
  * Confirmado que solo existen los de [`docs/public/videos/*.webp`](file:///home/jose/gitrepos/bond/docs/public/videos/) (no se han recreado en la raíz de `docs/public/`).
* **Optimización y control de las 5 demos (`docs/index.md` y `docs/en/index.md`):**
  * Se reincorporaron los controles (`controls`) en los 5 vídeos para permitir pausar y desplazarse.
  * Se configuró `preload="none"` en los 4 vídeos del grid secundario (y se quitó su autoplay) para no descargar megabytes innecesarios en la carga inicial de la página. El vídeo principal orquestador mantiene `autoplay muted loop playsinline controls preload="metadata"`.

---

### 2. Verificación de compilación

* `(cd site && npm run build)`: completado con éxito en **3.21 s** sin ningún error ni advertencia.

---

### 3. Capturas con `chrome-headless-shell`

Las capturas se generaron con el binario de Chromium headless shell indicado (`~/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`) contra el servidor preview en `http://localhost:5173/bond/`:

* **Modo claro escritorio (1440x1800 px):**
  `/tmp/bond-light-desktop.png`
* **Modo claro móvil (390x1800 px):**
  `/tmp/bond-light-mobile.png`
* **Sección de vídeos y grid 2x2 (1440x3200 px):**
  `/tmp/bond-light-desktop-videos.png`

También puedes revisar visualmente las capturas organizadas en el artefacto actualizado [preview-redesign.md](file:///home/jose/.gemini/antigravity-cli/brain/3abc703b-0bbd-4345-bf6c-c1c60b99ff4b/preview-redesign.md).
