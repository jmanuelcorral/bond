---
id: "2026-11-06-retirada-de-gemini-cli-sin-avisos-de-migracion-se-quita-del-setup-a-secas"
title: "Retirada de Gemini CLI sin avisos de migración: se quita del setup a secas"
status: "accepted"
date: "2026-11-06"
decided_by: "agent:pi"
accepted_by: "ya no soportamos gemini y nuestros usuarios no deberian de usarlo, asi que ni eso, de hecho ni hemos probado que funcionara. Simplemente crea una us de decomission para quitarlo del setup y listo"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "branch: main"
  - "head: 2839224"
---


## Context

Pendiente en la retirada de Gemini CLI cómo tratar configs de usuario que contuvieran "gemini" en agents (avisar e ignorar vs fallar).

## Decision

Sin gestión de migración: bond simplemente retira gemini del setup, catálogo y resto de superficies, sin avisos ni errores para configs que lo contuvieran. Justificación del usuario: nuestros usuarios no deberían usar Gemini y además nunca se probó que funcionara con bond.
