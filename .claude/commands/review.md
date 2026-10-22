---
description: Revisa los cambios sin commitear y reporta solo hallazgos accionables
argument-hint: "[foco]"
---
Revisa los cambios sin commitear. Foco opcional (puede estar vacío): $ARGUMENTS

Empieza por `git status` y `git diff HEAD` para ver el alcance real; no te fíes de lo que
creías que se había tocado.

Busca, en este orden:

1. Bugs y casos borde (nulos, vacío, concurrencia, rangos, codificaciones).
2. Seguridad (inyección, secretos, permisos, datos no confiables).
3. Manejo de errores ausente o que tapa fallos.
4. Regresiones de rendimiento.
5. Estilo, solo si rompe el del repo.

Reporta cada hallazgo como `fichero:línea` + qué pasa + sugerencia concreta, ordenado por
gravedad. Si no hay nada accionable, dilo y para. No edites nada.
