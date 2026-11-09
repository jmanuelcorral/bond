---
agent: "budget-pi"
kind: "agy"
branch: "main"
base: "main@842c608"
orchestrator: "pi"
started_at: "2026-11-09T15:43:51Z"
finished_at: "2026-11-09T15:43:51Z"
status: "reported"
commits: []
decisions:
  - "2026-11-09-adaptador-de-presupuesto-de-pi-por-extension-bond-extensions-con-degradacion-honesta"
---

## Request

Trabajas en el repo bond (~/gitrepos/bond, rama main, árbol limpio). Tarea: implementar el adaptador de PRESUPUESTO del agente pi para `bond budget` (issue #86). No hay que hacer commit ni push: deja los cambios en el árbol.

CONTEXTO
- `bond budget` (cli/budget.mts) agrega eventos append-only de `~/.bond/events/` (formato y política en los 4 commits locales de #86: mira `git show 72c6843 --stat` y el código actual) y pinta una tabla con {agent, state ok|low|exhausted|unknown, windows, source, checkedAt}.
- Hay adaptadores hechos: codex (hook Stop → último token_count del transcript), claude (headers anthropic-ratelimit-*), agy (hooks en ~/.gemini/config/hooks.json). `bond sync` los instala (cli/repo.mts, busca budgetHook).
- Decisión de alcance registrada HOY en docs/decisions/2026-11-09-86-cierra-el-alcance-con-pi-opencode-no-se-soporta-en-bond-budget.md: opencode NO se soporta en budget; el único adaptador pendiente es pi.

ALCANCE
1. Adaptador de pi: bond ya instala extensiones de pi (`bond sync`; mira cómo: `grep -n "pi" cli/repo.mts` y `grep -rn "extensions" cli/ | head`). Añade una extensión de presupuesto que escriba eventos en el MISMO canal `~/.bond/events/` que los hooks, usando los eventos de la API de extensiones de pi. Documentación de la API: /home/jose/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md y examples/extensions/ (léelos enteros antes de diseñar; NO buceles por el node_modules sin rumbo).
2. `bond budget` debe dejar de mostrar pi como unknown cuando haya eventos suyos, con el mismo contrato BudgetStatus.
3. Opencode fuera: quítalo de HOOKED_AGENTS y de donde se liste para budget, y reflejo en CHANGELOG (sección «Sin publicar»).
4. Tests con bun test (sigue el patrón de budget.test.mts) + npm run typecheck en verde. Actualiza docs/reference.md si cambia la salida de `bond budget` o `bond sync`.

RESTRICCIONES
- No commitees ni empujes nada. No toque ficheros fuera del repo salvo escribir en ~/.bond/events solo vía código de prueba si hace falta.
- Timebox de investigación de la API de extensiones: si algún dato de presupuesto (límites de plan, % de ventana, reset) no es accesible desde extensiones, degrada honestamente a unknown/documenta qué señal sí hay; NO buceles más de ~15 minutos buscando API oculta (sesiones anteriores buclearon aquí).
- Al final responde un informe compacto: qué implementaste (ficheros:línea), qué señales de presupuesto expone la API de extensiones de pi y cuáles no, resultados de typecheck y bun test, y qué queda en unknown. Si durante el trabajo se te ocurra una decisión de diseño relevante, regístrala con `bond decisions add` (skill decision-record).

## Report

### Informe de implementación: Adaptador de presupuesto de `pi` para `bond budget` (#86)

---

#### 1. Qué se ha implementado

- [`extensions/budget.ts`](file:///home/jose/gitrepos/bond/extensions/budget.ts#L1-L109):
  Nueva extensión de Bond Extensions para pi. Escribe eventos append-only de forma fail-open en `~/.bond/events/YYYY-MM-DD.jsonl` (respetando `BOND_EVENTS_DIR`). Escucha los eventos de la API de extensiones:
  - `session_start` (evento `session_start`)
  - `session_shutdown` (evento `session_end`)
  - `session_before_compact` (evento `pre_compact`)
  - `session_compact` (evento `compact`)
  - `agent_end` (evento `stop`)
  - `after_provider_response` (evento `provider_response`, con `status` HTTP y `headers` normalizados).

- [`cli/budget.mts`](file:///home/jose/gitrepos/bond/cli/budget.mts#L44-L49):
  - Línea 47: `HOOKED_AGENTS` actualizado a `["codex", "claude", "agy", "pi"]` (excluido formalmente `opencode`).
  - Línea 36: `BudgetEvent` ampliado con campos opcionales `headers` y `detail`.
  - Líneas 108–113: `hookEvent` preserva `headers` y `detail` si vienen en el payload JSON.
  - Líneas 268–315: Funciones `statusFromPiEvents(events, now)` y `piStatus(now)`. Procesa eventos de pi: si hay cabeceras de rate limit (ej. Anthropic) extrae ventanas y porcentajes de uso (`ok` o `low`); si el código HTTP más reciente es 429 marca `exhausted`; si hay actividad normal sin cuotas en cabeceras degrada a `ok` con ventanas vacías.
  - Línea 482: En `budget(args)`, el bucle invoca `piStatus()` cuando `a === "pi"`.

- [`test/budget.test.mts`](file:///home/jose/gitrepos/bond/test/budget.test.mts#L245-L394):
  - Verificación de que `opencode` queda fuera de `HOOKED_AGENTS` y `budgetHook(["opencode"])` no registra eventos.
  - Pruebas completas de `statusFromPiEvents` y `piStatus` (sin eventos `unknown`, ciclo de vida `ok`, cabeceras Anthropic `ok`/`low`/`exhausted`, código HTTP 429 `exhausted`, recuperación temporal 429 → 200, conservación de ventanas tras `stop`).
  - Pruebas unitarias de [`extensions/budget.ts`](file:///home/jose/gitrepos/bond/extensions/budget.ts#L1-L109) (`appendPiEvent` y mock de handlers de `budgetExtension`).

- [`CHANGELOG.md`](file:///home/jose/gitrepos/bond/CHANGELOG.md#L13-L27):
  Actualizada la sección `## Sin publicar` reflejando el adaptador de pi y la exclusión de opencode.

- [`docs/reference.md`](file:///home/jose/gitrepos/bond/docs/reference.md#L20):
  Actualizado con la orden `bond budget`, la extensión `budget.ts` en Bond Extensions y la carpeta `~/.bond/events/`.

- Decisión registrada con `bond decisions add`:
  [`docs/decisions/2026-11-09-adaptador-de-presupuesto-de-pi-por-extension-bond-extensions-con-degradacion-honesta.md`](file:///home/jose/gitrepos/bond/docs/decisions/2026-11-09-adaptador-de-presupuesto-de-pi-por-extension-bond-extensions-con-degradacion-honesta.md).

---

#### 2. Señales de presupuesto en la API de extensiones de pi

- **Qué sí expone**:
  - `after_provider_response`: código de estado HTTP (`event.status`, e.g. 200, 429 para rate limit) y cabeceras de respuesta HTTP normalizadas (`event.headers`), permitiendo leer headers de cuotas (`anthropic-ratelimit-*`, `x-ratelimit-*`).
  - Ciclo de vida de sesiones: `session_start`, `session_shutdown`, `agent_end` (`stop`), `session_before_compact` y `session_compact`, con `session_id`, `transcript_path` (`getSessionFile()`) y `cwd`.
- **Qué no expone**:
  - Límites de suscripción o planes a nivel de cuenta (como el token_count de OpenAI Codex en rollout local o cuotas globales de planes Pro/Team). Si el proveedor HTTP no devuelve cabeceras de límite, pi no conoce la cuota máxima ni el reset del plan.
- **Degradación**:
  - Ante respuestas normales 200 o actividad de sesión sin cabeceras de rate limit, `bond budget` muestra con honestidad `state: "ok"` y `windows: []` sin inventar números.

---

#### 3. Qué queda en `unknown`

- `pi` muestra su estado real (`ok`, `low` o `exhausted`) en cuanto tiene eventos en `~/.bond/events/`. Solo permanece en `unknown` si no hay ningún evento registrado en la ventana de retención (7 días).
- Sus ventanas (`windows`) quedan vacías si el proveedor no envía cabeceras con porcentajes y resets (degradando honestamente a `ok` sin cuota inventada).
- Agentes sin adaptador (`agy`, `crush`, `copilot`) continúan saliendo en `unknown`.

---

#### 4. Resultados de verificación

- `npm run typecheck`: **0 errores** (TypeScript 5.9 en verde).
- `bun test test/budget.test.mts`: **38 pass, 0 fail** (84 expect calls).
- `NO_COLOR=1 bun test`: **703 pass, 0 fail** (4153 expect calls en 37 ficheros).
- `bin/bond decisions check`: **109 decisión(es) auditadas sin errores**.
- Árbol de trabajo con los cambios listos sin commitear ni pushear.
