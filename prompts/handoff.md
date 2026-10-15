---
description: Deja el estado del trabajo por escrito para retomarlo más tarde
argument-hint: "[ruta del fichero]"
---
Escribe un handoff en ${1:-.pi-handoff.md} (raíz del proyecto) con:

- **Objetivo**: qué se está construyendo y qué decisiones se tomaron (y por qué).
- **Estado**: qué funciona, qué está a medias, qué está roto.
- **Ficheros**: los tocados y qué papel juega cada uno.
- **Verificación**: comandos exactos para comprobar el estado actual.
- **Siguientes pasos**: concretos y ordenados.

Breve y factual. Lo va a leer alguien sin contexto de la sesión, posiblemente otro agente
en otra máquina. No pegues diffs ni logs largos: referencia ficheros y líneas.
