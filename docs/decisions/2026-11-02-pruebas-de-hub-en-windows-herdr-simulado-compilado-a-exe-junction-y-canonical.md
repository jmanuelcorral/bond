---
id: "2026-11-02-pruebas-de-hub-en-windows-herdr-simulado-compilado-a-exe-junction-y-canonical"
title: "Pruebas de hub en Windows: herdr simulado compilado a .exe, junction y canonical()"
status: "proposed"
date: "2026-11-02"
decided_by: "agent:pi/kevin"
accepted_by: ""
accepted_via: ""
supersedes: ""
superseded_by: ""
links:
  - "run: https://github.com/jmanuelcorral/bond/actions/runs/41507903830"
  - "branch: fix/hub-tests-windows"
  - "head: 130c07f"
---


## Context

Los tres bloques de pruebas de hub se saltaban en Windows (#41). Lo POSIX-only era el arnés, no bond: el herdr falso se apoyaba en un shebang que en Windows no existe, y CreateProcess no arranca un `.cmd` sin shell. Además el PATH se unía con `:`, el symlink del fixture pide privilegios elevados y TEMP llega con nombre corto (RUNNER~1), que solo la variante nativa de realpath resuelve.

## Decision

En Windows el herdr simulado de las pruebas se materializa compilando su JS con `bun build --compile` a un `herdr.exe` real (una vez por fichero de test, no por prueba), y los stubs de agente que nadie ejecuta (`pi`, `claude`) son un `.cmd` vacío. El PATH falso se monta una sola vez por fichero y se unen con `path.delimiter` en vez de `:`. El symlink `back` del fixture del hub pasa a ser una junction en Windows, y el directorio temporal del fixture se canoniciza con `canonical()` (realpathSync.native).

## Rejected alternatives

Shim `.cmd` invocado con shell: obliga a escapar argv por el BatBadBut de cmd.exe y añadiría riesgo al arnés. Cambiar `run()` en `cli/herdr.mts` para resolver con `which()`: complica el producto para un problema que solo tiene el test, y en Windows el herdr real es un `.exe` que CreateProcess ya encuentra por PATH.

## Consequences

Las pruebas de hub corren en los tres sistemas. Un `.exe` compilado son ~90 MB y ~150 ms: por eso el PATH falso se monta una vez por fichero y no por prueba. Cualquier fixture nuevo en Windows debe usar junction y canonical(), como hacen ya hub-check y hub-pull.
