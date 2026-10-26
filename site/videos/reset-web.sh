#!/usr/bin/env bash
# Repo de la demo del orquestador: /tmp/bond-demo/web, recién creado y preparado con bond.
set -e
W=/tmp/bond-demo/web
if [ -d "$W/.git" ]; then
  for w in $(git -C "$W" worktree list --porcelain | awk '/^worktree /{w=$2} /^branch refs\/heads\/team\//{print w}'); do git -C "$W" worktree remove --force "$w"; done
fi
rm -rf "$W" && mkdir -p "$W" && cd "$W"
git init -q -b main
export GIT_AUTHOR_NAME=Demo GIT_AUTHOR_EMAIL=demo@example.com GIT_COMMITTER_NAME=Demo GIT_COMMITTER_EMAIL=demo@example.com
printf '# Club de lectura\n\nWeb de demo para bond: HTML sin estilos.\n' > README.md
cat > AGENTS.md <<'MD'
# Club de lectura

Web estática de ejemplo para enseñar bond. Solo HTML, sin CSS ni JavaScript: páginas cortas y
claras, en castellano. Mensajes de commit en inglés.
MD
bond init --agents claude,pi --default claude --mcp "" --skills "" --commands "" >/dev/null 2>&1
git add -A && git commit -qm "Start the reading club site"
mkdir -p .claude && printf '{\n  "permissions": { "allow": ["Bash"], "defaultMode": "acceptEdits" }\n}\n' > .claude/settings.local.json
echo ".claude/settings.local.json" >> .git/info/exclude
