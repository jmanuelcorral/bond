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

## Contexto

- Para buscar usa las tools `grep`, `find` y `ls` antes que `bash` con `rg` o `find`: su
  salida va acotada. Lee rangos concretos de un fichero, no ficheros enteros sin motivo.
- En un repo que no conoces, empieza por la tool `repo_map`.
- Antes de usar una API externa que no conoces en la versión del proyecto, o cuando `grep` no
  basta, carga el skill `code-context` (`ast-grep`, documentación con context7, búsqueda web).
- No mandes código ni datos privados a la búsqueda web: busca el mensaje de error, no el fichero.

## Git

- No hagas commit ni push salvo que te lo pida expresamente.
- Mensaje de commit en inglés: línea inicial de menos de 72 caracteres con el qué y el por qué.

## Entorno Herdr

- Puedes estar dentro de un panel de Herdr (`HERDR_ENV=1`). El skill `herdr` explica cómo
  controlarlo: cárgalo antes de usar la CLI. La sintaxis la manda `herdr <grupo>` de la
  versión instalada, no la memoria.
- Usa Herdr (paneles, otros agentes, workspaces, worktrees) solo cuando yo lo pida o lo pida
  un comando como `/delegate`. No abras paneles ni lances agentes por tu cuenta porque algo
  tarde o se pueda paralelizar: ejecútalo en tu propia shell.
- No crees workspaces, pestañas ni worktrees, ni trabajes en otro directorio, salvo que la
  petición lo diga.
- Cuando abras algo: `--no-focus`, `--cwd "$PWD"`, ids leídos del JSON (`.result...`) y
  nombres de agente únicos.
- Nunca cierres workspaces, paneles, agentes ni sesiones que no hayas creado tú.
- No ejecutes `herdr` sin subcomando: abre la interfaz y dentro de un panel está bloqueado.
  Los subcomandos (`herdr agent list`, `herdr pane read`…) sí se usan.
- Fuera de Herdr (`HERDR_ENV` distinto de `1`) no controles ninguna sesión de Herdr.

## Seguridad

- No imprimas ni copies secretos (tokens, claves, `auth.json`, `.npmrc`) en respuestas,
  logs ni ficheros del repo.
- Antes de añadir una dependencia nueva, comprueba qué hay ya disponible en el proyecto.
