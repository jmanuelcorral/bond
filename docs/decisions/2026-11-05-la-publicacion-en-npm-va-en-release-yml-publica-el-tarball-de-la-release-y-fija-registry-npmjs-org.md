---
id: "2026-11-05-la-publicacion-en-npm-va-en-release-yml-publica-el-tarball-de-la-release-y-fija-registry-npmjs-org"
title: "La publicación en npm va en release.yml, publica el tarball de la release y fija registry.npmjs.org"
status: "accepted"
date: "2026-11-05"
decided_by: "agent:pi/stuart"
accepted_by: "Acepto los dos registros de decisión."
accepted_via: "agent:pi"
supersedes: ""
superseded_by: ""
links:
  - "branch: team/issue-66-release-skill"
  - "head: 06092eb"
---


## Context

@jmanuelcorral/bond se genera en dist/npm durante la release pero no se publicaba en ningún registry. Había que añadir la publicación sin romper las releases de quienes no tengan el secret configurado.

## Decision

release.yml gana dos pasos tras crear la release: uno que comprueba si existe el secret NPM_TOKEN (si no, vuelca un aviso en GITHUB_STEP_SUMMARY y no se publica; la release se crea igual que hoy) y otro que publica con `npm publish <tgz> --access public` el mismo jmanuelcorral-bond-X.Y.Z.tgz subido a la release, tras verificar su SHA-256 contra SHA256SUMS. Escribe en $HOME/.npmrc tanto `@jmanuelcorral:registry=https://registry.npmjs.org/` como `//registry.npmjs.org/:_authToken` para fijar el destino. No pasa --provenance.

## Rejected alternatives

Hacer un `npm pack` nuevo en el paso de publicación: rechazado, publicaría bytes distintos de los adjuntos a la release. Confiar en `npm publish --registry=https://registry.npmjs.org/` sin más: comprobado que no basta, una entrada `@jmanuelcorral:registry` (p. ej. apuntando a npm.pkg.github.com) tiene prioridad sobre la opción y desvía el paquete; por eso se escribe la línea de scope en el .npmrc. Job separado en la workflow: rechazado por añadir complejidad sin ganar nada, el paso va después de crear la release y se salta solo.

## Consequences

Hace falta crear el secret NPM_TOKEN en Settings -> Secrets and variables -> Actions para que se publique. --provenance queda como seguimiento: exige trusted publishing configurado por paquete en npmjs.com y el permiso id-token: write en la workflow; se puede añadir cuando el paquete exista. Los mensajes que dicen que el paquete aún no está publicado (cli/messages/update.mts, cli/update.mts, docs/reference.md, docs/en/reference.md) no se cambian hasta la primera publicación real, o serían mentira.

Nota de trazabilidad (2026-11-05): esta decisión había pasado ya a `accepted` desde el panel de
stuart con `bond decisions accept --confirmed-by` citando el texto del encargo, no palabras del
usuario (`decided_by` y `accepted_via` eran el mismo agente: auto-aceptada). Corregido por el
orquestador: `accepted_by` lleva la cita del usuario en el chat y `accepted_via` es `agent:pi`.
El formato del fichero no cambia; solo la autoría de la aceptación.
