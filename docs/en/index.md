---
layout: home

hero:
  name: bond
  text: Your coding agents, working together
  tagline: pi, Claude Code, Codex, Copilot, opencode, Crush or Gemini. Use whichever you like, configure them once per repo and open them in Herdr. Licence to code.
  image:
    src: /hero-terminal.webp
    alt: Herdr and bond running an agent team in fluzo
  actions:
    - theme: brand
      text: Start here
      link: /en/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/jmanuelcorral/bond
    - theme: alt
      text: Download release
      link: https://github.com/jmanuelcorral/bond/releases/latest

features:
  - icon: '<span class="feature-badge">$ bond setup</span>'
    title: bond setup
    details: You do it once on your machine. It helps you with Herdr, brings in your models (Ollama, LM Studio, OpenAI or your own gateway) and gets the agents you use ready.
    link: /en/getting-started#3-bond-setup-once-per-machine
    linkText: View guide
  - icon: '<span class="feature-badge">$ bond init</span>'
    title: bond init
    details: Once per repo. Pick your agents and tools, and bond writes each one's config from a single .bond/bond.toml. Anything you edited by hand stays untouched.
    link: /en/reference#per-repo-configuration-bond-init-and-bond-sync
    linkText: View reference
  - icon: '<span class="feature-badge">$ bond</span>'
    title: bond
    details: The everyday part. Opens your repo in Herdr with your favourite agent. Lots to do? bond team splits branches across several agents, each in its own worktree.
    link: /en/workstation
    linkText: View workstation
  - icon: '<span class="feature-badge">$ bond catalog</span>'
    title: Team catalogs
    details: Your team's skills, commands and MCP servers in their own repo, with the version pinned. Everyone works with the same set, whichever agent they use.
    link: /en/reference#your-own-catalog-bond-catalog
    linkText: View catalogs
---

## What is this about?

If you use coding agents, you have probably been here: Claude Code wants a `CLAUDE.md`, pi
reads `AGENTS.md`, Copilot looks for MCP servers in one place and opencode in another. And the
moment you want two agents working at once, each on its own branch, you end up with five
terminals and no idea which one is waiting for you to answer.

bond sorts that out. You declare once what you want in your repo (agents, MCP servers, skills,
commands) and it translates it into each agent's format. Then it opens your workstation in
[Herdr](https://herdr.dev), a terminal multiplexer built for agents: panes stay alive even if
you close the terminal, and the sidebar shows at a glance who is working, who is done and who
needs you.

## Install it

```sh
brew install jmanuelcorral/tap/bond                                                    # macOS and Linux
curl -fsSL https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.sh | sh   # without Homebrew
```

On Windows: `powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.ps1 | iex"`.

Then run `bond setup` and off you go. We walk you through it in [Getting started](getting-started.md).

::: tip Messages in Spanish
bond's own messages (command output, `bond doctor` rows, status names such as `trabajando` or `lista`) are in Spanish. These docs gloss them in English where they appear.
:::

## See it in action

Start with this one. You open `bond` with Claude alone in its pane and ask it, in a single
sentence, for a very simple website: make a plan, split it between two pi agents with
`bond team` and act as the orchestrator. Everything else happens on its own, inside bond: the
minions each write their page, the live table shows how they are doing, Claude reviews and sends
two fixes back, merges into `main` and tidies up the team. No cuts: it takes as long as it takes.

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
<p class="terminal-caption">Claude orchestrates two pi agents: plan, split, four panes at once, review with fixes, merge and cleanup.</p>

And four more, short ones, on [fluzo](https://github.com/fluzo-labs/fluzo), a real Rust project:

<div class="video-grid">

<div class="video-card">
  <h3 class="video-card-title">Setting up a repo with bond init</h3>
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
  <h3 class="video-card-title">The workstation in Herdr</h3>
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
  <h3 class="video-card-title">A team of agents with bond team</h3>
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
  <h3 class="video-card-title">Team catalogs</h3>
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


## The code, on GitHub

bond is free software (MIT). The source, the [releases](https://github.com/jmanuelcorral/bond/releases)
and the [changelog](https://github.com/jmanuelcorral/bond/blob/main/CHANGELOG.md) live at
[github.com/jmanuelcorral/bond](https://github.com/jmanuelcorral/bond). If something does not
work or you have an idea, open an [issue](https://github.com/jmanuelcorral/bond/issues): it is
much appreciated.
