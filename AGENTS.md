# bond

Instrucciones del proyecto para todos los agentes de código que lo usan (vía bond).
Las personales de cada uno van en su configuración global; aquí, solo lo de este repo.

## Qué es

`bond` es una CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...)
en Herdr: `bond setup` configura la máquina, `bond init` prepara un repo y `bond` abre el puesto
de trabajo. Se distribuye como binario (Bun compile) para Linux, macOS y Windows.

## Cómo se trabaja aquí

```bash
npm ci --ignore-scripts          # dependencias
bin/bond <comando>               # bond desde el código (Node >= 22.18)
npm run typecheck && bun test    # tipos y pruebas: lo mismo que CI
bun scripts/build.mts --targets linux-x64 --no-npm   # un binario en dist/ para probar
```

- **Código**: TypeScript en `cli/` (`.mts`), sin paso de compilación para ejecutarlo. Pruebas en
  `test/` con `bun test`. CI las pasa en Linux, macOS y Windows: cuida las rutas (`/` en lo que
  se guarda), los `.cmd`/`.exe` y los symlinks en Windows.
- **Idioma**: mensajes de la CLI, comentarios, documentación, CHANGELOG y PRs en español.
  Commits en inglés. Las skills del catálogo, en inglés.
- **Cambios de comportamiento**: entrada en `## Sin publicar` del `CHANGELOG.md` y, si cambia
  un comando, su ayuda y `docs/reference.md`.
- **PRs**: contra `main`, se fusionan con rebase (historial lineal).
- **Catálogo** (`catalog/`): lo que `bond init` instala en un repo. Cada skill es una carpeta en
  `catalog/skills/` con su entrada en `catalog/catalog.toml` (`summary` y, si es opcional,
  `default = false`). Las adaptadas de fluzo-labs/common-skills conservan su `LICENSE`.
- **Release**: con `release-prepare-github`. Versión en `package.json` y `package-lock.json`
  (`npm version X.Y.Z --no-git-tag-version`), `## Sin publicar` pasa a `## X.Y.Z`, commit
  `Release X.Y.Z` y tag anotado `vX.Y.Z` ("bond X.Y.Z"). Empujar el tag publica: `release.yml`
  compila, crea la release y sube los binarios, el `.tgz` y `SHA256SUMS`. Después,
  `bun scripts/packaging.mts`, commit `Regenerate packaging for X.Y.Z`, copiar
  `packaging/homebrew/bond.rb` al tap `jmanuelcorral/homebrew-tap` y lanzar `brew.yml`.

## Qué no hacer

- No editar ni commitear `cli/assets.gen.mts` ni `dist/`: los genera `scripts/build.mts`.
- `packaging/` se genera con `scripts/packaging.mts` desde una release publicada: no a mano.
- `.agents/skills/`, `.claude/`, `.pi/`, `.mcp.json` y el bloque de `CLAUDE.md` los genera
  `bond sync` desde `.bond/bond.toml`. Para cambiar una skill del catálogo, edita
  `catalog/skills/` y pasa `bond sync`.
- No publicar en npm ni en AUR desde CI ni a mano sin que se pida.
- No empujar tags ni a `main` sin aprobación explícita.
