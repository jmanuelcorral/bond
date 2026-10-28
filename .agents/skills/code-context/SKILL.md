---
name: code-context
description: Reunir el contexto justo antes de cambiar código - orientarse en un repo desconocido, localizar definiciones y usos, buscar por estructura con ast-grep, consultar la documentación de una librería por versión (context7) o buscar en la web un error o una versión. Úsalo al empezar en un repo, antes de tocar una API que no conoces y cuando grep no basta.
---

# Contexto de código

Objetivo: entender lo necesario leyendo lo mínimo. Cada lectura grande consume contexto
que luego falta para trabajar.

## 1. Orientarse (repo nuevo o poco conocido)

Llama a la tool `repo_map` (manifiestos, comandos, árbol con nº de ficheros, lenguajes, lo
más tocado en git; `depth` para más detalle). Sin la tool, el mismo script está en
`scripts/repo-map [dir] [profundidad]`, relativo a este skill. Después lee el `AGENTS.md`
o `README.md` del proyecto si existen, y solo entonces el código.

## 2. Localizar

Elige la herramienta por el tipo de pregunta:

| Pregunta | Herramienta |
|---|---|
| Dónde aparece un texto, nombre o mensaje de error | tool `grep` (respeta `.gitignore`, salida acotada) |
| Qué ficheros hay con un nombre o patrón | tool `find` |
| Qué hay en una carpeta | tool `ls` |
| Llamadas, definiciones o construcciones con una forma concreta | `ast-grep` por `bash` |
| Dónde se hace algo descrito en lenguaje natural | `grep` con varios sinónimos; si existe, `code-search-laya search "<pregunta>" .` |

Lee después solo el rango que importa (`read` con `offset`/`limit`), no el fichero entero.

## 3. Búsqueda estructural con ast-grep

`$X` captura un nodo, `$$$` cualquier número de nodos. Ignora espacios, saltos de línea y
comentarios, así que encuentra lo que `grep` se pierde.

```bash
ast-grep run -l ts -p 'fetch($URL, $$$)' src/            # llamadas a fetch con cualquier argumento
ast-grep run -l ts -p 'export function $NAME($$$) { $$$ }' # funciones exportadas
ast-grep run -l rust -p '$X.unwrap()' crates/             # unwraps en Rust
ast-grep run -l python -p 'def $F($$$): $$$' -C 0 pkg/     # definiciones de funciones
ast-grep run -l go -p 'if err != nil { return $$$ }'       # manejo de errores en Go
```

`--json=compact` da salida para filtrar con `jq`. Para reescrituras, primero sin `-r` para
ver qué casaría, y solo con `-r '<nuevo>' -U` cuando el resultado sea el esperado.

## 4. Documentación de librerías: context7

Antes de usar una API externa que no estás seguro de conocer en la versión del proyecto:

1. Mira la versión en el manifiesto (`package.json`, `Cargo.toml`, `pyproject.toml`…).
2. `mcp__context7__resolve_library_id` con el nombre de la librería.
3. `mcp__context7__query_docs` con ese id y una pregunta concreta.

Prefiere esto a recordar la API: las APIs cambian entre versiones.

Los nombres de las herramientas MCP dependen del agente: en Antigravity, por ejemplo, salen
del plugin de bond como `bond_context7` (`resolve-library-id`, `query-docs`) y
`bond_duckduckgo`. Usa los que tengas.

## 5. Web: errores, versiones, novedades

- `mcp__duckduckgo__search` para un error literal, una versión publicada o algo reciente.
- `mcp__duckduckgo__fetch_content` para leer la página que de verdad responde (releases,
  changelog, issue). Cita la URL de la que sale el dato.

No mandes a la web código ni datos privados del proyecto: busca el mensaje de error, no el
fichero.

## Señales de que hace falta más contexto

- Vas a cambiar una función y no has visto quién la llama: busca los usos primero.
- Un test falla por algo que no entiendes: lee el test y el código que ejerce, no solo el error.
- La misma búsqueda devuelve cientos de resultados: acota por carpeta o pasa a `ast-grep`.
