---
layout: home

hero:
  name: bond
  text: Tus agentes de código, trabajando juntos
  tagline: pi, Claude Code, Codex, Copilot, opencode, Crush o Gemini. Usa los que quieras, configúralos una vez por repo y ábrelos en Herdr. Licence to code.
  actions:
    - theme: brand
      text: Empieza aquí
      link: /getting-started
    - theme: alt
      text: Ver en GitHub
      link: https://github.com/jmanuelcorral/bond
    - theme: alt
      text: Descargar
      link: https://github.com/jmanuelcorral/bond/releases/latest

features:
  - title: bond setup
    details: Lo haces una vez en tu máquina. Te ayuda con Herdr, se trae tus modelos (Ollama, LM Studio, OpenAI o tu propia pasarela) y deja listos los agentes que uses.
    link: /getting-started#3-bond-setup-una-vez-por-máquina
  - title: bond init
    details: Una vez por repo. Eliges agentes y herramientas, y bond escribe la config de cada uno desde un único .bond/bond.toml. Lo que tengas a mano no lo toca.
    link: /reference#configuración-por-repo-bond-init-y-bond-sync
  - title: bond
    details: Lo de cada día. Abre tu repo en Herdr con tu agente favorito. ¿Mucho trabajo? bond team reparte ramas entre varios agentes, cada uno en su worktree.
    link: /workstation
  - title: Catálogos del equipo
    details: Las skills, comandos y servidores MCP de tu equipo en su propio repo, con la versión fijada. Todo el mundo trabaja con lo mismo, use el agente que use.
    link: /reference#catálogo-propio-bond-catalog
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

## El código, en GitHub

bond es software libre (MIT). El código, las [releases](https://github.com/jmanuelcorral/bond/releases)
y el [registro de cambios](https://github.com/jmanuelcorral/bond/blob/main/CHANGELOG.md) están en
[github.com/jmanuelcorral/bond](https://github.com/jmanuelcorral/bond). Si algo no funciona o se te
ocurre una mejora, abre un [issue](https://github.com/jmanuelcorral/bond/issues): se agradece.
