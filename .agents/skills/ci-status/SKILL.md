---
name: ci-status
description: Check whether a GitHub branch or PR pipeline is green in one call, and tell apart a real code failure from infrastructure flakiness (runner died, GitHub time limit, network, OOM). Shows the failing job's log excerpt, can block until done, and can re-run only the failed jobs. Use when asked if CI/pipeline/acciones is green, after pushing, or when a red check needs triaging.
user-invocable: true
disable-model-invocation: false
---

# Estado de la pipeline en GitHub

Responde en una sola llamada a «¿está verde?» y, si no, «¿es mi culpa?».

Sin dependencias: **Node ≥ 22** y **`gh`** (GitHub CLI). Nada de shell alrededor — los comandos se
ejecutan con argv, así que no hay problemas de comillas ni de separadores en Windows.

## Uso

```bash
node scripts/ci.mjs                     # rama actual
node scripts/ci.mjs --pr 64           # una PR
node scripts/ci.mjs --branch feat/x   # una rama
node scripts/ci.mjs --watch           # bloquea hasta que termine
node scripts/ci.mjs --log             # extracto del log de cada fallo
node scripts/ci.mjs --rerun-failed    # reejecuta solo lo que fallo
node scripts/ci.mjs --json            # salida maquina
```

Opciones de `--watch`: `--timeout S` (por defecto 1800) y `--interval S` (por defecto 20).

## Códigos de salida

| Código | Significado |
| --- | --- |
| `0` | Verde. |
| `1` | Rojo: fallo de código **o** de infraestructura (se distingue en la salida). |
| `2` | Pendiente, o requiere acción humana (`action_required`). |
| `3` | Error de uso o de entorno (`gh` sin sesión, argumento inválido). |

## La parte que importa: código vs infraestructura

Confundir estas dos cosas es lo que hace perder la tarde. Un `cancelled` porque el runner se cayó no
es un fallo de tu código, y tratarlo como tal manda a buscar un bug que no existe.

La clasificación usa las conclusiones de la API de GitHub y, si hace falta, el log:

- **`infra`** — `cancelled`, `timed_out`, `startup_failure`, `stale`, o si el log contiene patrones
  de runner caído, límite máximo de tiempo de GitHub, red, `exit code 137` (OOM) o *rate limit*.
- **`code`** — `failure` sin ninguna de esas señales.
- **`human`** — `action_required`: hay que aprobar algo en la UI, no hay nada que arreglar.
- **`pending`** — aún corriendo.
- **`skipped`** / **`neutral`** — no cuentan para el veredicto.

El refino por log solo se aplica cuando hay 5 o menos fallos de código, porque cada refino es una
llamada a la API: con 30 fallos no se va a descargar 30 logs para refinar cuatro.

## Salida

```
FAIL rama 2dc3122
     verde 3 · codigo 1 · infra 0 · pendiente 0 · saltado 1 · requiere humano 0
  FAIL build (ubuntu-latest, linux-x64)  [failure]  https://github.com/.../job/126131008461
     ┌──────────────────────────────────────────────────────────────────────
     │ dist/bond-linux-x64 sync --check
     │ ~ CLAUDE.md  bond block
     │ ##[error]Process completed with exit code 1.
     └──────────────────────────────────────────────────────────────────────
```

Con `--log` se quitan el prefijo `job<TAB>step<TAB>`, la marca de tiempo y las secuencias de color
(tanto las reales `0x1b[…m` como las que `gh` devuelve ya escapadas como texto `^[[…m`), que son
ruido que tapa la causa.

## Cómo trabajarlo

1. **Tras un push**: `--watch` y ya. Sale solo cuando hay veredicto.
2. **Con rojo**: mirar la cuenta de `codigo` vs `infra`. Si `infra > 0` y `codigo == 0`, **no hay
   nada que arreglar**: es `--rerun-failed` y a otra cosa.
3. **Con `--log`** se ve la causa sin abrir el navegador.

## Notas

- Si la rama no tiene checks, se reporta como `none` (verdict), no como error. Una rama sin CI es un
  dato, no un fallo.
- `--rerun-failed` resuelve el run id desde `details_url`; si no lo encuentra, falla diciendo que no
  pudo, en vez de reejecutar a ciegas.
- Requiere `gh auth login`. Si falta sesión, sale con código 3 y lo dice, no se queda colgado.

## Distribución

Skill **propia de este repo**, en `.agents/skills/`, **no declarada** en el array `skills` de
`.bond/bond.toml`. La tiene quien se baje el repo; `bond init` no la instala en otros repos.
