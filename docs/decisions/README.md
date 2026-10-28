# Decisiones

Memoria de decisiones de este repo (bond). Cada decisión no trivial —del usuario o de un
agente— queda aquí en un fichero Markdown versionado con git, para poder auditar después qué
se decidió, quién y por qué. La skill `decision-record` explica cuándo y cómo registrarla.

No hay índice que mantener: el listado lo da `bond decisions` (también con `--json`).
Registrar, aceptar o sustituir decisiones no reescribe este README, así que dos ramas
paralelas que registran decisiones se fusionan sin conflictos de memoria.

## Formato

Un fichero por decisión: `YYYY-MM-DD-slug.md`; el id es el nombre del fichero sin extensión
(si el mismo slug se repite el mismo día, sufijo `-2`).

```yaml
---
id: "2026-01-01-ejemplo"
title: "Título corto de la decisión"
status: "proposed"   # proposed | accepted | rejected | superseded
date: "2026-01-01"
decided_by: "user"   # user | agent:<kind>[/<nombre>]
accepted_by: ""      # referencia a la aceptación del usuario, si la hay
supersedes: ""       # id de la decisión que esta sustituye
superseded_by: ""    # id de la decisión que la sustituye
links: []            # plan, fase, commits, PR, run
---
```

Cuerpo (los apartados que escribe `bond decisions add`, en inglés, como las skills):
*Context*, *Decision*, *Rejected alternatives*, *Consequences* (este último solo si
se pasan consecuencias al registrar).

Una decisión tomada por un agente sin confirmar entra como `proposed`; solo el usuario la
pasa a `accepted`. La barrera de terminal interactiva de `accept` evita que un agente la
acepte por descuido; no es una medida de seguridad: la integridad del registro la da git.

## Runs

En `runs/` quedan los encargos hechos a agentes (equipos con `bond team`, delegaciones):
un fichero por run, `YYYY-MM-DD-<agente>-<slug>.md`, con el texto exacto enviado y el
informe recibido. Los escribe el orquestador, nunca el agente de la rama.
