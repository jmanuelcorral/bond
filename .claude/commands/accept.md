---
description: Acepta o rechaza decisiones propuestas desde la conversación (bond decisions)
argument-hint: "[ids o 'todas']"
---

Gestiona las decisiones pendientes de la memoria de decisiones de este repo
(`[decisions]` en `.bond/bond.toml`) sin salir de esta conversación.

Si el repo no tiene la sección `[decisions]`, dilo brevemente y para.

1. Lista las pendientes: `bond decisions --status proposed`. Si no hay ninguna, dilo y para.
2. Enséñamelas (id, quién las registró, título) y pregúntame cuáles quieres: ids
   concretos, "todas", o rechazar alguna en vez de aceptarla. Espera mi respuesta.
3. Solo si he respondido de forma explícita, ejecuta el comando citando mis palabras
   textuales en `--confirmed-by`:
   - Aceptar: `bond decisions accept <id>... --confirmed-by "<cita literal de mi respuesta>"`
     (para todas: `--all-proposed --confirmed-by "..."`).
   - Rechazar: `bond decisions reject <id>... --confirmed-by "<motivo que di>"`.
   - Sustituir: `bond decisions supersede <id> --by <nueva> --confirmed-by "<lo que dije>"`.
4. Repórtame el resultado de cada una, incluido lo que haya fallado.

Nunca aceptes, rechaces ni sustituyas por iniciativa propia, sin una respuesta mía
explícita en esta conversación, ni uses `--confirmed-by` con palabras que no haya dicho.
La cita en `--confirmed-by` debe ser lo que he dicho (o su resumen fiel), no el tuyo:
queda como `accepted_by` en la decisión y `accepted_via` deja constancia de que lo
ejecutaste tú. Si mi respuesta es ambigua, vuelve a preguntar.

Argumentos: $ARGUMENTS
