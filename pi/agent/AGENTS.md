# Instrucciones globales

## Idioma y estilo

- Responde en español, corto y directo. Sin preámbulos ni resúmenes de cierre.
- Código, identificadores, mensajes de commit y nombres de rama en inglés.
- Sin emojis.

## Forma de trabajar

- Lee el código relevante antes de editar. No asumas APIs, librerías ni comandos: comprueba.
- Cambios mínimos, en el estilo del repo que toque. No reformatees lo ajeno.
- Verifica con lo más específico primero (un test, un script, `bash -n`) y luego amplía.
- Si algo falla, lee el error entero y cambia de enfoque en vez de repetir lo mismo.
- Si falta información, di exactamente qué falta y qué sustituto sirve; no pares a medias.

## Git

- No hagas commit ni push salvo que te lo pida expresamente.
- Mensaje de commit en inglés: línea inicial de menos de 72 caracteres con el qué y el por qué.

## Entorno Herdr

- Puedes estar dentro de un panel de Herdr (`HERDR_ENV=1`). Entonces tienes el skill `herdr`
  para crear paneles, lanzar comandos y leer salida de otros paneles.
- Para trabajo largo (tests, builds, servidores) abre un panel hermano y ejecuta allí,
  sin robar el foco:
  `herdr pane split --current --direction right --cwd "$PWD" --no-focus`
- Nunca cierres workspaces, paneles ni sesiones que no hayas creado tú.
- Nunca lances `herdr` desde dentro de un panel: está bloqueado por diseño.
- Fuera de Herdr no controles la sesión de nadie: limita el trabajo a la shell actual.

## Seguridad

- No imprimas ni copies secretos (tokens, claves, `auth.json`, `.npmrc`) en respuestas,
  logs ni ficheros del repo.
- Antes de añadir una dependencia nueva, comprueba qué hay ya disponible en el proyecto.
