---
layout: home

hero:
  name: bond
  text: Several coding agents, one workstation
  tagline: Configure pi, Claude Code, Codex, Copilot CLI, opencode, Crush and Gemini CLI from one file per repo and open them in Herdr. One agent is enough.
  actions:
    - theme: brand
      text: Getting started
      link: /en/getting-started
    - theme: alt
      text: Reference
      link: /en/reference
    - theme: alt
      text: GitHub
      link: https://github.com/jmanuelcorral/bond

features:
  - title: bond setup
    details: Once per machine. Herdr, your models (Ollama, LM Studio, OpenAI or your own gateway), which agents you work with and your personal instructions.
    link: /en/getting-started#3-bond-setup-once-per-machine
  - title: bond init
    details: Once per repo. A .bond/bond.toml and each agent's config — instructions, MCP servers, skills and commands — without overwriting what you edited by hand.
    link: /en/reference#per-repo-configuration-bond-init-and-bond-sync
  - title: bond
    details: Every day. Opens the repo in Herdr with the default agent; bond team splits branches across several agents, each in its own worktree.
    link: /en/workstation
  - title: Team catalogs
    details: Your team's skills, commands and MCP servers in their own repo, with the commit pinned in a lock file. bond catalog create, add and update.
    link: /en/reference#your-own-catalog-bond-catalog
---

## Install

```sh
brew install jmanuelcorral/tap/bond                                                    # macOS and Linux
curl -fsSL https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.sh | sh   # without Homebrew
```

On Windows: `powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.ps1 | iex"`.

Then run `bond setup`. Continue with [Getting started](getting-started.md).

::: tip Messages in Spanish
bond's own messages (command output, `bond doctor` rows, status names such as `trabajando` or `lista`) are in Spanish. These docs gloss them in English where they appear.
:::
