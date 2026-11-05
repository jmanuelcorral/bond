---
id: "2026-11-05-el-publish-de-npm-va-por-trusted-publishing-oidc-con-provenance-npm-token-se-mantiene-solo-como-fallback"
title: "El publish de npm va por trusted publishing (OIDC) con --provenance; NPM_TOKEN se mantiene solo como fallback"
status: "accepted"
date: "2026-11-05"
decided_by: "agent:pi"
accepted_by: "Confirmo: workflow `release.yml` y `npm publish` permitido. Corta `1.13.1` — mantenemos el npm token, el resto para adelante"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "run: https://github.com/jmanuelcorral/bond/actions/runs/42067759530"
  - "run: https://github.com/jmanuelcorral/homebrew-tap/actions/runs/42070086373"
  - "branch: main"
  - "head: 8fbaf4e"
---


## Context

npm caduca a las 48 horas las configuraciones de trusted publishing sin validar; solo se validan con un publish que pase por ellas. El usuario creó la config del trusted publisher para @jmanuelcorral/bond con ventana hasta el 7 de noviembre, y el workflow publicaba con token y npm 10, que no puede autenticar por OIDC ni firmar attestations.

## Decision

El publish de npm pasa a trusted publishing (OIDC) con --provenance: permissions id-token: write en release.yml, actions/setup-node@v6 con Node 24 y package-manager-cache: false (ubuntu-latest trae npm 10.9.9, que no habla OIDC; trusted publishing exige npm ≥ 11.5.1) y `npm publish "$tgz" --access public --provenance`. El secret NPM_TOKEN se MANTIENE como red de seguridad por decisión explícita del usuario, no como lo que autoriza: npm detecta el entorno OIDC y lo usa antes que los tokens tradicionales.

## Rejected alternatives

Eliminar del todo el NPM_TOKEN y publicar solo por OIDC: era la opción más limpia y se propuso, pero el usuario pidió expresamente mantener el token. No tocar el workflow y publicar a mano: descarta la reproducibilidad y no valida el trusted publisher. Mantener npm del runner: imposible, npm 10.9.9 no soporta OIDC.

## Consequences

Cada release firma una attestation SLSA v1 en el transparency log de sigstore. El token que queda como fallback es del tipo que npm está restringiendo («npm tokens that bypass 2FA are being restricted», gh.io/npm-gat-bypass2fa-deprecation), así que a medio plazo hay que quitarlo. Si el trusted publisher caducara sin validar, el publish caería al token y la config seguiría sin validar: hay que comprobar el log del publish, no solo que salga verde.
