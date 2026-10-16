# Plan: bond 1.0, más simple

Estado: aprobado. G1 hecha: binario autocontenido (`bun scripts/build.mts`) y paquete de npm;
probado en Linux fuera del repo; Windows y macOS, en CI (`.github/workflows/ci.yml`).
G2 hecha: `bond setup` interactivo (Herdr, endpoints, agentes, instrucciones), config en
`~/.bond/`. Siguiente: G3. Fecha: 2026-10-16.
Sustituye la dirección de [plan-bond-cli.md](plan-bond-cli.md), que queda como historia.

## La idea en tres comandos

```bash
bond setup      # una vez por máquina: Herdr, endpoints de modelos, agentes instalados
bond init       # una vez por repo: con qué agentes trabajas y cuál es el de por defecto
bond            # cada día, dentro del repo: abre Herdr con el agente por defecto, listo
```

Todo lo demás (`doctor`, `sync`, `status`…) queda como apoyo, no como algo que haya que
aprender para empezar.

## Qué cambia respecto a hoy

| Hoy (0.7) | 1.0 |
|---|---|
| Se instala clonando el repo y con Node | Un binario autocontenido: `brew`, AUR, npm, o `curl … \| sh` / PowerShell |
| pi es obligatorio; `setup` enlaza mi config personal de pi | Ningún agente es obligatorio; basta con uno. Si no hay ninguno, se dan los enlaces de instalación |
| Los modelos se declaran a mano en `config.toml` | `setup` detecta y pregunta los endpoints (Ollama, LM Studio, OpenAI, compatible con OpenAI) y los prueba |
| `init` activa los agentes instalados | `init` pregunta con cuáles integrarte y cuál es el de por defecto |
| `pidev`, `piteam`, `pistatus`, `pisessions` (bash) | `bond` a secas abre el puesto de trabajo; el resto, subcomandos del binario |
| Ficheros del repo enlazados en `~/.pi/agent`, filtro de git para `settings.json` | La config de cada agente se genera; nada personal vive en el repo de bond |

## 1. `bond setup` (global, una vez por máquina)

Interactivo, re-ejecutable (cada paso enseña lo que hay y pregunta si cambiarlo). Con
`--yes` usa los valores detectados sin preguntar, para scripts.

1. **Herdr.** Si `herdr` no está en el PATH, explica cómo instalarlo según el sistema
   detectado y para (o sigue sin la parte de Herdr si el usuario lo pide):
   - Linux/macOS: `curl -fsSL https://herdr.dev/install.sh | sh` o `brew install herdr`
   - Windows: `powershell -ExecutionPolicy Bypass -c "irm https://herdr.dev/install.ps1 | iex"`
   - Enlace: https://herdr.dev/docs/install/
2. **Endpoints de modelos.** Detecta los locales sin preguntar (Ollama en `localhost:11434`,
   LM Studio en `localhost:1234`) y pregunta si quieres añadir otros:
   - OpenAI (pide el nombre de la variable de entorno con la clave, nunca la clave),
   - cualquier endpoint compatible con OpenAI (como tu `halo`): URL y, si hace falta, variable
     con la clave.
   Para cada uno: lista sus modelos (`/v1/models`), prueba qué APIs sirve (chat, responses) y
   deja elegir qué modelos registrar. Resultado: `~/.config/bond/config.toml`.
3. **Agentes.** Detecta cuáles hay instalados (pi, Claude Code, Codex, Copilot CLI, opencode,
   Crush, Gemini CLI). Si no hay ninguno, enseña cómo instalar cada uno con su enlace y para:
   hace falta al menos uno. Para los instalados:
   - lleva los endpoints a los que puedan usarlos (lo que hoy hace `bond models sync`);
   - instala la integración de Herdr de cada uno;
   - instala los skills globales `bond-delegate` y `bond-team`.
4. **Agente por defecto global** (el que se propone en cada `bond init`).
5. **Resumen** con lo configurado y el siguiente paso: `cd <repo> && bond init`.

Lo específico de pi (paquete con pie de estado, cabecera BOND y `repo_map`) solo se instala
si pi está instalado y elegido.

## 2. `bond init` (por repo)

1. Si el repo ya tiene `.bond/bond.toml`, lo dice y ofrece cambiarlo.
2. Pregunta con qué agentes integrarte (multiselección entre los **instalados**, marcando los
   que elegiste en `setup`) y cuál es el **de por defecto** en este repo.
3. Pregunta qué herramientas añadir del catálogo (MCP, skills, comandos), todas marcadas por
   defecto.
4. Genera la config de cada agente elegido (lo que hoy hace `bond sync`) y `AGENTS.md` si
   falta.
5. Dice qué commitear y qué pedirá cada agente la primera vez (confianza en la carpeta…).

## 3. `bond` (dentro de un repo)

- Repo sin `.bond/`: ofrece `bond init`.
- Fuera de Herdr: arranca Herdr (o se engancha al servidor que ya haya) con un workspace para
  el repo: el agente por defecto en un panel y una shell en otro. Si el workspace ya existe,
  lo enfoca.
- Dentro de Herdr: crea o enfoca el workspace sin anidar otro Herdr.
- Antes de lanzar, si la config del repo está desfasada (`bond.toml` cambió), la regenera.
- `bond --agent claude` abre con otro agente de los integrados; `bond --worktree feat/x`, en un
  worktree (lo que hoy hacen `pidev --kind/--worktree`).

## Arquitectura

- **Binario único** compilado con `bun build --compile` a partir del código TypeScript actual
  (probado: incluye dependencias y ficheros incrustados, y compila para Linux, macOS y Windows
  desde una sola máquina). Lleva dentro el catálogo, los skills globales y el paquete de pi.
- **Ficheros que necesitan estar en disco** (los skills, el paquete de pi, que los agentes leen
  por ruta) se extraen en `~/.local/share/bond/<versión>/` (en Windows, `%LOCALAPPDATA%\bond`).
  Así cada versión de bond trae los suyos y actualizar es reemplazar el binario.
- **Configuración global**: `~/.config/bond/config.toml` (endpoints, agentes elegidos, agente por
  defecto) y `state.json`. Instrucciones personales opcionales en `~/.config/bond/AGENTS.md`,
  llevadas al fichero global de cada agente.
- **Windows**: sin symlinks (necesitan permisos especiales); donde hoy se enlaza, se copia.
- **Se reaprovecha**: generadores de modelos por agente (F2), `init`/`sync` con su registro de
  lo generado (F3/F4), skills de delegación (F5), `doctor`, logo y extensiones de pi.
- **Se quita**: `install.sh`, `pi/agent/` enlazado (settings, AGENTS.md, mcp.json personales), el
  filtro de git de `settings.json`, los scripts bash de `bin/` (pasan a subcomandos).

## Distribución

| Canal | Cómo | Notas |
|---|---|---|
| GitHub Releases | Workflow al crear un tag: binarios para linux x64/arm64, macOS x64/arm64, windows x64, con sumas SHA-256 | Base de todo lo demás |
| `curl … \| sh` / PowerShell | Script que descarga el binario de la release y lo deja en el PATH | Como el de Herdr |
| Homebrew (macOS y Linux) | Tap propio `jmanuelcorral/tap` con la fórmula `bond`; el workflow la actualiza en cada release | `brew install jmanuelcorral/tap/bond` |
| npm (todas las plataformas) | `npm i -g @jmanuelcorral/bond`: el código JavaScript para Node ≥ 22, sin binario | `bond` está cogido en npm |
| Arch | AUR `bond-bin` | Los repos oficiales de pacman no admiten paquetes de terceros; AUR se instala con `yay`/`paru` |
| Windows | npm (`@jmanuelcorral/bond`) y script de PowerShell (`irm …/install.ps1 \| iex`) | Sin winget por ahora |

El nombre `bond` está libre en Homebrew y AUR (comprobado 2026-10-16); en npm, no.

## Fases

| Fase | Entrega | Verificación |
|---|---|---|
| **G1** Binario | `bond` compilado con todo dentro; extracción de ficheros a `~/.local/share/bond`; los subcomandos actuales funcionan desde el binario | El binario funciona en una máquina sin el repo ni Node |
| **G2** `setup` interactivo | Herdr, endpoints (detección y alta), agentes (≥1, enlaces si faltan), integraciones, skills globales, agente por defecto; `--yes` | En contenedor limpio: sin Herdr, sin agentes, con Ollama y con un endpoint propio |
| **G3** `init` interactivo | Agentes integrados y por defecto, catálogo, generación | Repo de prueba con 1 y con varios agentes |
| **G4** `bond` lanza el puesto | Workspace de Herdr con el agente por defecto; `--agent`, `--worktree`; regenera si hace falta | Dentro y fuera de Herdr, con pi y con Claude |
| **G5** Limpieza y migración | Quitar scripts, enlaces personales y filtro de git; `bond setup` migra la instalación 0.7 actual | Mi máquina pasa de 0.7 a 1.0 sin perder config |
| **G6** Distribución | Workflow de releases, scripts de instalación (sh y PowerShell), tap de Homebrew, AUR, npm | Instalar desde cada canal en una máquina limpia |

## Decisiones

| # | Decisión | Elegido |
|---|---|---|
| 1 | Runtime del binario | **Bun compile** (reaprovecha el código; 68–92 MB) |
| 2 | Configuración global y claves | En **`~/.bond/`** (nunca en el proyecto): `config.toml`, `state.json` y las claves en un fichero propio con permisos 600 |
| 3 | Instrucciones personales | Las gestiona bond (un cambio se propaga a todos los agentes). Más adelante, un comando `bond eject` para dejarlas en el repo como independientes |
| 4 | Windows | Desde la primera versión. Sin la store de winget: basta con npm (`npm i -g @jmanuelcorral/bond`; `bond` está cogido en npm) y el script de PowerShell |
| 5 | Extensiones de pi | Se llaman **Bond Extensions** y se instalan en `bond init` cuando el repo usa pi |

Consecuencias en el diseño:

- `~/.bond/` sustituye a `~/.config/bond/` (se migra solo). Contiene `config.toml`, `state.json`,
  `credentials.toml` (600) y `runtime/<versión>/`, donde se extraen los ficheros que llevan
  dentro el binario (skills, catálogo, Bond Extensions).
- Distribución de Windows: npm (paquete JavaScript para Node ≥ 22, sin binario) y el script de
  PowerShell que descarga el binario de la release. Sin winget.
- Bond Extensions: por repo, en `.pi/settings.json` (`packages`), apuntando a
  `~/.bond/runtime/<versión>/pi`; ya no se cargan globalmente en pi.
