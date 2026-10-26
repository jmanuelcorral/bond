---
layout: home

hero:
  name: bond
  text: Varios agentes de código, un solo puesto de trabajo
  tagline: Configura pi, Claude Code, Codex, Copilot CLI, opencode, Crush y Gemini CLI desde un fichero por repo y ábrelos en Herdr. Con uno basta.
  actions:
    - theme: brand
      text: Primeros pasos
      link: /getting-started
    - theme: alt
      text: Referencia
      link: /reference
    - theme: alt
      text: GitHub
      link: https://github.com/jmanuelcorral/bond

features:
  - title: bond setup
    details: Una vez por máquina. Herdr, tus modelos (Ollama, LM Studio, OpenAI o una pasarela propia), con qué agentes trabajas y tus instrucciones personales.
    link: /getting-started#3-bond-setup-una-vez-por-máquina
  - title: bond init
    details: Una vez por repo. Un .bond/bond.toml y la config de cada agente — instrucciones, servidores MCP, skills y comandos — sin pisar lo que tengas a mano.
    link: /reference#configuración-por-repo-bond-init-y-bond-sync
  - title: bond
    details: Cada día. Abre el repo en Herdr con el agente por defecto; bond team reparte ramas entre varios agentes, cada uno en su worktree.
    link: /workstation
  - title: Catálogos del equipo
    details: Las skills, comandos y servidores MCP de tu equipo en su propio repo, con el commit fijado en un lock. bond catalog create, add y update.
    link: /reference#catálogo-propio-bond-catalog
---

## Instalar

```sh
brew install jmanuelcorral/tap/bond                                                    # macOS y Linux
curl -fsSL https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.sh | sh   # sin Homebrew
```

En Windows: `powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.ps1 | iex"`.

Después, `bond setup`. Sigue en [Primeros pasos](getting-started.md).
