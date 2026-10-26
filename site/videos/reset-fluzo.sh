#!/usr/bin/env bash
# Deja /tmp/bond-demo/fluzo como recién clonado; con "init", además preparado con bond.
set -e
cd /tmp/bond-demo/fluzo
git checkout -q main && git reset -q --hard origin/main && git clean -fdq
# Worktrees y ramas que deja el vídeo del equipo (demo/*).
for w in $(git worktree list --porcelain | awk '/^worktree /{w=$2} /^branch refs\/heads\/demo\//{print w}'); do git worktree remove --force "$w"; done
git worktree prune
for b in $(git for-each-ref --format='%(refname:short)' refs/heads/demo/); do git branch -q -D "$b"; done
if [ "$1" = "init" ]; then
  bond init --agents pi,claude --default pi --skills code-context,plan-team --commands review,commit,handoff >/dev/null 2>&1
fi
