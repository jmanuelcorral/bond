#!/usr/bin/env bash
# Demo del modo hub: /tmp/bond-demo/hub-demo, recién creado. Un frontend (React + Vite) con su
# remoto local, que entra al hub como submódulo; un backend (Express), que entra como symlink a
# su clon; y la carpeta vacía del hub, que crea el vídeo con bond hub init.
#
# bond usa aquí su propia carpeta (BOND_HOME=/tmp/bond-demo/home) con pi como único agente: así
# bond hub init no toca tu ~/.bond (registro de hubs incluido) y la demo solo enseña pi.
set -e
D=/tmp/bond-demo/hub-demo
export BOND_HOME=/tmp/bond-demo/home
export GIT_AUTHOR_NAME=Demo GIT_AUTHOR_EMAIL=demo@example.com GIT_COMMITTER_NAME=Demo GIT_COMMITTER_EMAIL=demo@example.com

# Lo que dejó la grabación anterior: los worktrees de bond team, que viven fuera de /tmp en
# ~/.herdr/worktrees/<carpeta del hub>/. Solo se borran los que apuntan a esta demo: otro hub
# tuyo con carpeta "hub" comparte ese directorio.
for wt in "$HOME"/.herdr/worktrees/hub/*/*; do
  [ -f "$wt/.git" ] && grep -q "^gitdir: $D/" "$wt/.git" && rm -rf "$wt"
done
rmdir "$HOME"/.herdr/worktrees/hub/* "$HOME"/.herdr/worktrees/hub 2>/dev/null || true
rm -rf "$D" "$BOND_HOME"
mkdir -p "$D/src" "$D/hub" "$BOND_HOME"
printf 'agents = ["pi"]\ndefault_agent = "pi"\n' > "$BOND_HOME/config.toml"

# Frontend: React + Vite con una página vacía.
F="$D/src/frontend"
mkdir -p "$F/src" && cd "$F"
git init -q -b main
cat > package.json <<'JSON'
{
  "name": "frontend",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build" },
  "dependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" },
  "devDependencies": { "@vitejs/plugin-react": "^4.3.4", "vite": "^5.4.11" }
}
JSON
cat > vite.config.js <<'JS'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api va al backend (Express, puerto 3000) mientras desarrollas.
export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:3000" } } });
JS
cat > index.html <<'HTML'
<!doctype html>
<html lang="es">
  <head><meta charset="UTF-8" /><title>Hello</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>
HTML
cat > src/main.jsx <<'JSX'
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);
JSX
cat > src/App.jsx <<'JSX'
export default function App() {
  return <main />;
}
JSX
printf 'node_modules/\ndist/\n' > .gitignore
cat > AGENTS.md <<'MD'
# frontend

React + Vite. `npm install` and `npm run build` must pass. The backend is served under `/api`
(Vite proxies it to http://localhost:3000 in development). Commit messages in English.
MD
# Las dependencias, ya instaladas (y su lock en el commit): los agentes no esperan a la red.
npm install --silent --no-audit --no-fund >/dev/null
git add -A && git commit -qm "Start the frontend"
git clone -q --bare "$F" "$D/src/frontend.git"

# Backend: Express con un servidor mínimo.
B="$D/src/backend"
mkdir -p "$B" && cd "$B"
git init -q -b main
cat > package.json <<'JSON'
{
  "name": "backend",
  "private": true,
  "type": "module",
  "scripts": { "start": "node server.js" },
  "dependencies": { "express": "^4.21.2" }
}
JSON
cat > server.js <<'JS'
import express from "express";

const app = express();

const port = process.env.PORT ?? 3000;
app.listen(port, () => console.log(`backend on http://localhost:${port}`));
JS
printf 'node_modules/\n' > .gitignore
cat > AGENTS.md <<'MD'
# backend

Express API on port 3000 (`npm start`). Endpoints live under `/api`. Commit messages in English.
MD
npm install --silent --no-audit --no-fund >/dev/null
git add -A && git commit -qm "Start the backend"

echo "demo del hub lista en $D"
