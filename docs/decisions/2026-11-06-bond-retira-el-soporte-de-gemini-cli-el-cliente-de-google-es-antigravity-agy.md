---
id: "2026-11-06-bond-retira-el-soporte-de-gemini-cli-el-cliente-de-google-es-antigravity-agy"
title: "bond retira el soporte de Gemini CLI; el cliente de Google es Antigravity (agy)"
status: "accepted"
date: "2026-11-06"
decided_by: "agent:pi"
accepted_by: "eliminemos Gemini, que esta descontinuado por google y su cliente oficial es antigravity"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links:
  - "branch: main"
  - "head: 2839224"
---


## Context

Google ha descontinuado Gemini CLI y su cliente oficial es Antigravity (agy). bond soportaba gemini como agente independiente (SUPPORTED_AGENTS, catálogo, trust, comandos, mensajes), lo que duplica superficie con agy y apunta a un cliente muerto.

## Decision

bond retira el soporte del agente Gemini CLI: se elimina el id 'gemini' de SUPPORTED_AGENTS, del catálogo de agentes, de trust/launch/repo/team/doctor y de los mensajes es/en. El soporte de Google queda solo vía agy (Antigravity). Las rutas ~/.gemini/* que usa agy (settings.json, config/plugins/bond) NO se tocan: son la home de configuración de agy, no de Gemini CLI.

## Rejected alternatives

Mantener gemini como agente legacy: rechazado porque el cliente está descontinuado y agy ya cubre a Google. También se descartó renombrar gemini→agy (ya existen ambos; se elimina el primero).

## Consequences

Repos/usuarios con "gemini" en agents de bond.toml necesitan migración (decisión pendiente: avisar e ignorar vs fallar). Docs del site y reference.md deben dejar de listar Gemini. #84 considerará solo Claude, Codex y Antigravity para límites de uso.
