---
agent: "kevin"
kind: "pi"
branch: "feat/hub-repo-status"
base: "main@1a586b0"
orchestrator: "pi/gru"
started_at: "2026-11-03T09:09:28Z"
finished_at: ""
status: "sent"
commits: []
decisions: []
---

## Request

**2026-11-03T09:09:28Z**

La PR #57 esta en ROJO en las tres plataformas (run 41606566139). Fallan TODAS tus pruebas nuevas de test/hub-status.test.mts. Localmente pasan porque TU maquina tiene init.defaultBranch=main; en los runners de GitHub no.

Error exacto en CI:
  error: git push -q -u origin main: error: src refspec main does not match any
  error: failed to push some refs to '...bond-hubstatus-fHN1FV/front-origin.git'
  at seededClone (test/hub-status.test.mts:49)

Causa: el fixture crea repos con `git init` a secas y luego empuja `main`. El nombre de la rama inicial lo decide `init.defaultBranch`, que en los runners no es `main`.

QUE HACER
1. Haz que el fixture sea determinista: pasa `-c init.defaultBranch=main` en TODO `git init` del test (incluido el del origen desnudo si lo hay), o crea la rama explicitamente con `git checkout -b main` / `git symbolic-ref`. Lo que encaje mejor con como esta escrito el helper `g()` y `seededClone`.
2. Revisa si los otros ficheros de test que has tocado (test/hub.test.mts) tienen la misma dependencia.
3. Comprueba que no queda NINGUN otro `git init` sin rama determinista en los tests que has anadido.
4. Verifica que reproduce y se arregla: `bun test test/hub-status.test.mts` debe seguir verde en local, y pasa `npx tsc -p .` y `bun test` completo.
5. Commitea el arreglo en tu rama (conventional, en ingles, trailer `Agent: pi/<tu nombre>`), empuja y dime el SHA.
6. NO fusiones, no empujes a main, no abras PR.

IMPORTANTE: esto es una dependencia del entorno, no un fallo de tu logica. No cambies las aserciones para que pasen: arregla el fixture.

[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de docs/decisions/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en docs/decisions/runs/.

## Report


