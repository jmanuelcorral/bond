---
id: "2026-11-02-autoria-de-decisiones-override-explicito-bond-decision-agent-decisions-author"
title: "Autoría de decisiones: override explícito (BOND_DECISION_AGENT / [decisions] author)"
status: "accepted"
date: "2026-11-02"
decided_by: "agent:pi/gru"
accepted_by: "B: override explícito de autoría en bond; hazlo en rama y PR aparte, no mezcles con #53."
accepted_via: "agent:pi/gru"
supersedes: ""
superseded_by: ""
links:
  - "branch: feat/decision-author-override"
  - "pr: https://github.com/jmanuelcorral/bond/pull/54"
  - "head: 19d9555"
---


## Context

Bond calcula decided_by y accepted_via a partir del agente del panel de Herdr (resolveAuthor en cli/decisions.mts). En un worktree delegado ese panel lo ocupa el minion que bond arrancó con MINIONS (cli/team.mts), así que los registros salen firmados como agent:pi/kevin en vez de la identidad con la que el usuario habla (agent:pi/gru, el orquestador del checkout principal). Se barajó renombrar el panel de Herdr, pero duplicaría el nombre gru y rompería el direccionamiento por nombre que uniqueAgentName/firstFreeName evitan.

## Decision

Añadir un override explícito de autoría: BOND_DECISION_AGENT (gana) o [decisions] author en ~/.bond/config.toml, evaluados antes de lo que bond deduce del panel. Formas válidas: "user" o "agent:<kind>[/<nombre>]"; "pi/gru" se normaliza a "agent:pi/gru". Un valor que no encaja muere en vez de escribirse a medias. Un nombre suelto no se acepta: no se puede distinguir kind de nombre. El valor de la config se guarda tal cual y se valida al usarlo, para que un valor malo no rompa bond models.

## Rejected alternatives

Renombrar el panel de Herdr a gru (efecto inmediato pero nombres duplicados: herdr agent prompt gru y bond --agent gru pasan a ser ambiguos). Cambiar la convención D12 para que el autor sea siempre el orquestador y el minion quede solo en el run: pierde qué instancia registró cada decisión y toca docs y filtros por agente. Dejarlo como está y editar los ficheros a mano: no arregla nada y se repite en cada aceptación.

## Consequences

La autoría deja de ser siempre deducida del entorno: al leer un registro hay que saber si había override puesto. El override se propaga a team.mts, que usa resolveAuthor() como orchestrator. La config global (cli/config.mts) gana una sección [decisions] que saveConfig debe preservar.
