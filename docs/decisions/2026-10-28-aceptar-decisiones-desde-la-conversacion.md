---
id: "2026-10-28-aceptar-decisiones-desde-la-conversacion"
title: "Aceptar decisiones desde la conversación"
status: "accepted"
date: "2026-10-28"
decided_by: "agent:claude"
accepted_by: "chat 2026-10-28: «acepta D20 y D21»"
accepted_via: "agent:claude"
supersedes: "2026-10-28-aceptar-rechazar-y-sustituir-son-del-usuario"
superseded_by: ""
links:
  - "plan: docs/plans/2026-10-28-decision-memory.md#D20"
  - "branch: main"
  - "head: 769d604"
---


## Context

Tomada por el usuario en sesión el 2026-10-28 (plan docs/plans/2026-10-28-decision-memory.md, Revisión 4): «se tienen que poder aceptar desde aquí, no vamos a salir a una terminal y picar comandos, esto rompe el flow del desarrollo». Sustituye a la barrera de terminal de D13.

## Decision

accept, reject y supersede funcionan sin terminal con --confirmed-by "<lo que dijo el usuario>"; la decisión guarda accepted_by con esa referencia y accepted_via con quien lo ejecutó. Admiten varios ids y --all-proposed. El comando /accept enseña las proposed, pregunta y solo ejecuta con respuesta explícita del usuario. Sin terminal ni --confirmed-by, se niegan.

## Rejected alternatives

Mantener la terminal interactiva (rompe el flujo); un panel de Herdr con bond decisions review donde el usuario teclea (sigue siendo salir de la conversación).

## Consequences

La garantía pasa a ser el rastro accepted_by + accepted_via en git y, en Claude Code, el cuadro de permiso (D21); un agente podría ejecutar accept con --confirmed-by sin que se lo pidan, y se vería en el diff.
