---
description: Redacta y crea un commit a partir de lo que está staged
argument-hint: "[contexto extra]"
---
Prepara un commit con los cambios ya staged. Contexto extra (puede estar vacío): $ARGUMENTS

1. `git status` y `git diff --cached` para entender el alcance real.
2. Redacta el mensaje en inglés: línea inicial de menos de 72 caracteres que explique el
   qué y el por qué; cuerpo solo si aporta razonamiento o tradeoffs.
3. Muéstrame el mensaje antes de commitear.
4. Crea el commit solo después de mi OK. Nunca hagas push.

Si hay staged mezcla de temas inconexos, dilo y propón cómo separarlos antes de commitear.
