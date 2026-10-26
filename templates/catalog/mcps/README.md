# Servidores MCP

Un fichero JSON por servidor: `mcps/<nombre>.json`. El nombre del fichero es el del servidor,
el que se elige en `bond init` y se escribe en `mcp = [...]` de `.bond/bond.toml`. Cada repo
elige los que quiere; bond escribe la config de cada agente.

## Servidor local (se lanza como un proceso)

```json
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-postgres@0.6.2", "${DATABASE_URL}"],
  "env": { "PGSSLMODE": "require" },
  "description": "Consultas de solo lectura a la base de datos del proyecto"
}
```

## Servidor remoto (HTTP)

```json
{
  "url": "https://mcp.ejemplo.com/mcp",
  "headers": { "Authorization": "Bearer ${EJEMPLO_TOKEN}" },
  "description": "Tickets y documentación interna"
}
```

## Reglas

- `command` (con `args` y `env` opcionales) **o** `url` (con `headers` opcional).
- `description`: la línea que enseña `bond init`.
- **Secretos, nunca en el fichero**: escribe `${VARIABLE}` y que cada persona la tenga en su
  entorno. El catálogo lo lee todo el equipo y queda en el historial de git.
- **Versión exacta** en lo que se descarga al arrancar (`paquete@1.2.3`, `==1.2.3`): así nadie
  ejecuta lo que se publicó ayer sin que el equipo lo haya revisado.

## Comprobar

```bash
bond catalog check
```

Errores típicos: JSON inválido, sin `command` ni `url`, `args` que no es una lista de textos.
Avisa (sin fallar) si un valor de `env` o `headers` parece un secreto escrito tal cual.
