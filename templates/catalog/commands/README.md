# Comandos

Un fichero Markdown por comando: `commands/<nombre>.md` se usa como `/<nombre>` en los agentes.
Se escribe una vez, con una sintaxis común, y bond lo convierte al formato de cada agente (pi,
Claude Code, Copilot, Codex, opencode, Crush, Gemini).

## Formato

```markdown
---
description: Prepara las notas de la release a partir de los commits
argument-hint: "[versión]"
---
Prepara las notas de la release $1 a partir de los commits desde el último tag.

Agrupa por tipo (nuevo, cambios, arreglos) y no inventes nada que no esté en los commits.
```

- `description` (obligatoria): la línea que enseñan `bond init` y el agente.
- `argument-hint` (opcional): qué argumentos espera.
- En el cuerpo, `$ARGUMENTS` es todo lo que se escribe tras el comando; `$1`, `$2`… cada
  argumento por separado.
- El nombre del fichero es el del comando: minúsculas, dígitos y `-`.

## Comprobar

```bash
bond catalog check
```

Errores típicos: falta el frontmatter o su `description`.
