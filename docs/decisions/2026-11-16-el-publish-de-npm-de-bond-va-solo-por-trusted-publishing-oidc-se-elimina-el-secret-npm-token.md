---
id: "2026-11-16-el-publish-de-npm-de-bond-va-solo-por-trusted-publishing-oidc-se-elimina-el-secret-npm-token"
title: "El publish de npm de bond va solo por trusted publishing (OIDC); se elimina el secret NPM_TOKEN"
status: "accepted"
date: "2026-11-16"
decided_by: "agent:pi/kevin"
accepted_by: "make .github/workflows/release.yml publish to npm ONLY through trusted publishing (OIDC), without NPM_TOKEN"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "plan: none"
  - "workflow: .github/workflows/release.yml"
  - "branch: chore/release-oidc"
  - "head: 82b1d91"
---


## Context

La release 1.15.0 falló al publicar en npm con EOTP/E403: el paso 'Publicar en npm' estaba condicionado al secret NPM_TOKEN y lo escribía en ~/.npmrc, así que npm lo prefería al OIDC y la política de 2FA del paquete bloqueaba el publish. El trusted publisher de npmjs (repo jmanuelcorral/bond, workflow release.yml) ya está configurado. Esto revoca la decisión de 2026-11-05 de mantener NPM_TOKEN como fallback.

## Decision

release.yml publica en npm ÚNICAMENTE por trusted publishing (OIDC): sin el secret NPM_TOKEN, sin gate '¿Hay NPM_TOKEN?' y sin escribir _authToken en ~/.npmrc. El .npmrc del runner solo fija '@jmanuelcorral:registry=https://registry.npmjs.org/'. Se mantienen id-token: write, Node 24 (npm >= 11.5.1), 'npm publish <tgz> --access public --provenance', la comprobación SHA256SUMS y el chequeo de disponibilidad post-publish como warning.

## Rejected alternatives

Mantener NPM_TOKEN como red de seguridad (la decisión anterior): rechazada porque su mera presencia hace que npm omita OIDC y la política de 2FA responda EOTP; además deja el trusted publisher sin validar y caduca a las 48h. Publicar a mano: descarta reproducibilidad.
</parameter>
=
