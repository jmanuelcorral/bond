---
layout: home

hero:
  name: bond
  text: Tus agentes de código, trabajando juntos
  tagline: pi, Claude Code, Codex, Copilot, opencode, Crush o Gemini. Usa los que quieras, configúralos una vez por repo y ábrelos en Herdr. Licence to code.
  image:
    src: /hero-terminal.webp
    alt: Herdr y bond ejecutando un equipo de agentes en fluzo
  actions:
    - theme: brand
      text: Empieza aquí
      link: /getting-started
    - theme: alt
      text: Ver en GitHub
      link: https://github.com/jmanuelcorral/bond
    - theme: alt
      text: Descargar release
      link: https://github.com/jmanuelcorral/bond/releases/latest

features:
  - icon: '<span class="feature-badge">$ bond setup</span>'
    title: bond setup
    details: Lo haces una vez en tu máquina. Te ayuda con Herdr, se trae tus modelos (Ollama, LM Studio, OpenAI o tu propia pasarela) y deja listos los agentes que uses.
    link: /getting-started#3-bond-setup-una-vez-por-máquina
    linkText: Ver guía
  - icon: '<span class="feature-badge">$ bond init</span>'
    title: bond init
    details: Una vez por repo. Eliges agentes y herramientas, y bond escribe la config de cada uno desde un único .bond/bond.toml. Lo que tengas a mano no lo toca.
    link: /reference#configuración-por-repo-bond-init-y-bond-sync
    linkText: Ver referencia
  - icon: '<span class="feature-badge">$ bond</span>'
    title: bond
    details: Lo de cada día. Abre tu repo en Herdr con tu agente favorito. ¿Mucho trabajo? bond team reparte ramas entre varios agentes, cada uno en su worktree.
    link: /workstation
    linkText: Ver puesto de trabajo
  - icon: '<span class="feature-badge">$ bond catalog</span>'
    title: Catálogos del equipo
    details: Las skills, comandos y servidores MCP de tu equipo en su propio repo, con la versión fijada. Todo el mundo trabaja con lo mismo, use el agente que use.
    link: /reference#catálogo-propio-bond-catalog
    linkText: Ver catálogos
---

## ¿De qué va esto?

Si usas agentes de código, seguramente ya te ha pasado: Claude Code quiere un `CLAUDE.md`, pi
lee `AGENTS.md`, Copilot busca los servidores MCP en un sitio y opencode en otro. Y en cuanto
quieres dos agentes trabajando a la vez, cada uno en su rama, acabas con cinco terminales y
ninguna idea de cuál está esperando que le contestes.

bond pone orden en eso. Declaras una vez lo que quieres en tu repo (agentes, servidores MCP,
skills, comandos) y él lo traduce al formato de cada agente. Luego te abre el puesto de trabajo
en [Herdr](https://herdr.dev), un multiplexor de terminal pensado para agentes: los paneles
siguen vivos aunque cierres la terminal, y la barra lateral te dice de un vistazo quién está
trabajando, quién ha terminado y quién te necesita.

## Instálalo

```sh
brew install jmanuelcorral/tap/bond                                                    # macOS y Linux
curl -fsSL https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.sh | sh   # sin Homebrew
```

En Windows: `powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.ps1 | iex"`.

Después, `bond setup` y a correr. Te lo contamos paso a paso en [Primeros pasos](getting-started.md).

## Míralo en acción

Empieza por este. Abres `bond` con Claude solo en su panel y le pides, en una sola frase, una
web muy sencilla: que haga un plan, lo reparta entre dos agentes pi con `bond team` y haga de
orquestador. Lo demás pasa solo, dentro de bond: los minions escriben cada uno su página, la
tabla en vivo enseña cómo van, Claude revisa y les devuelve dos correcciones, integra en `main`
y recoge el equipo. Sin cortes: dura lo que dura.

<div class="terminal-window">
  <div class="terminal-header">
    <div class="terminal-dots">
      <span class="terminal-dot dot-red"></span>
      <span class="terminal-dot dot-yellow"></span>
      <span class="terminal-dot dot-green"></span>
    </div>
    <div class="terminal-title">bond team: fluzo</div>
  </div>
  <video src="/videos/orquestador.mp4" poster="/videos/poster-orquestador.webp" autoplay muted loop playsinline controls preload="metadata"></video>
</div>
<p class="terminal-caption">Claude orquesta a dos agentes pi: plan, reparto, cuatro paneles a la vez, revisión con correcciones, integración y limpieza.</p>

Y cuatro más, cortos, sobre [fluzo](https://github.com/fluzo-labs/fluzo), un proyecto real en Rust:

<div class="video-grid">

<div class="video-card">
  <h3 class="video-card-title">Preparar un repo con bond init</h3>
  <div class="terminal-window">
    <div class="terminal-header">
      <div class="terminal-dots">
        <span class="terminal-dot dot-red"></span>
        <span class="terminal-dot dot-yellow"></span>
        <span class="terminal-dot dot-green"></span>
      </div>
      <div class="terminal-title">bond init</div>
    </div>
    <video src="/videos/init.mp4" poster="/videos/poster-init.webp" controls muted loop playsinline preload="none"></video>
  </div>
</div>

<div class="video-card">
  <h3 class="video-card-title">El puesto de trabajo en Herdr</h3>
  <div class="terminal-window">
    <div class="terminal-header">
      <div class="terminal-dots">
        <span class="terminal-dot dot-red"></span>
        <span class="terminal-dot dot-yellow"></span>
        <span class="terminal-dot dot-green"></span>
      </div>
      <div class="terminal-title">bond workstation</div>
    </div>
    <video src="/videos/puesto.mp4" poster="/videos/poster-puesto.webp" controls muted loop playsinline preload="none"></video>
  </div>
</div>

<div class="video-card">
  <h3 class="video-card-title">Un equipo de agentes con bond team</h3>
  <div class="terminal-window">
    <div class="terminal-header">
      <div class="terminal-dots">
        <span class="terminal-dot dot-red"></span>
        <span class="terminal-dot dot-yellow"></span>
        <span class="terminal-dot dot-green"></span>
      </div>
      <div class="terminal-title">bond team</div>
    </div>
    <video src="/videos/equipo.mp4" poster="/videos/poster-equipo.webp" controls muted loop playsinline preload="none"></video>
  </div>
</div>

<div class="video-card">
  <h3 class="video-card-title">Catálogos del equipo</h3>
  <div class="terminal-window">
    <div class="terminal-header">
      <div class="terminal-dots">
        <span class="terminal-dot dot-red"></span>
        <span class="terminal-dot dot-yellow"></span>
        <span class="terminal-dot dot-green"></span>
      </div>
      <div class="terminal-title">bond catalog</div>
    </div>
    <video src="/videos/catalogos.mp4" poster="/videos/poster-catalogos.webp" controls muted loop playsinline preload="none"></video>
  </div>
</div>

</div>


## El código, en GitHub

bond es software libre (MIT). El código, las [releases](https://github.com/jmanuelcorral/bond/releases)
y el [registro de cambios](https://github.com/jmanuelcorral/bond/blob/main/CHANGELOG.md) están en
[github.com/jmanuelcorral/bond](https://github.com/jmanuelcorral/bond). Si algo no funciona o se te
ocurre una mejora, abre un [issue](https://github.com/jmanuelcorral/bond/issues): se agradece.
