# Origen

Copiada tal cual (carpeta completa, unidad de distribución según el repo de origen).

| Campo | Valor |
| --- | --- |
| Repositorio | https://github.com/fluzo-labs/fluzo-skills |
| Rama | `main` |
| Commit (SHA) | `48a1ac36fc229ccbcb1fe671d5dbd9774a567d56` |
| Ruta de origen | `skills/tui-design/` |
| Copiada | 2026-11-03T11:52:52Z |
| Por | jose, via pi/gru |
| Licencia | MIT (ver `LICENSE`, (c) 2026 fluzo-labs) |
| Destino | `.agents/skills/tui-design/` (dentro del repo, versionada; **no** exportada por `bond init`) |

## Contenido

- `SKILL.md`
- `LICENSE`
- `references/interface-contract.md`
- `references/terminal-safety.md`
- `references/agent-sessions.md`
- `references/frameworks.md`
- `references/verification.md`

## Notas de uso y mantenimiento

- **No es una skill del catálogo de bond** (`catalog/skills/`): no la instala `bond init` en ningún
  repo. Vive en `.agents/skills/` del repo y **no está declarada** en el array `skills` de
  `.bond/bond.toml`, que es lo que la convierte en skill propia del repo: cualquiera que se baje el
  repo la tiene, quien use bond en otro sitio no. Verificado: sobrevive a `bond sync` (que además la
  enlaza a `.claude/skills/`) y `bond init --list` en un repo limpio no la menciona.
- El origen **no distribuye instalador ni auto-update**: *«Review subsequent changes explicitly; this
  collection does not download instructions or alter permissions at runtime.»* Cualquier actualización
  es manual y se revisa contra el SHA de arriba.
- Para actualizar: `git -C /tmp/fluzo-skills fetch --depth 1 origin main && git -C /tmp/fluzo-skills rev-parse FETCH_HEAD`,
  revisar el diff contra `48a1ac3` en GitHub y, si se adopta, copiar otra vez la carpeta completa y
  actualizar esta tabla.
- No confundir con `fluzo-labs/common-skills`, de donde bond adapta otras skills (plan-create,
  git-conventional-commit, delivery-review-github…). La trazabilidad de cada una va aparte.
