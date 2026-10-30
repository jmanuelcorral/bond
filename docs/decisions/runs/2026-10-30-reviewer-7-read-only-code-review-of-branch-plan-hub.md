---
agent: "reviewer-7"
kind: "pi"
branch: "plan/hub-guided-p7"
base: "plan/hub-session@03d9d20"
orchestrator: "claude"
started_at: "2026-10-30T08:14:09Z"
finished_at: "2026-10-30T08:21:37Z"
status: "reported"
commits:
  - "aa096d6 feat(hub): add bond hub check with --fix and --json"
decisions: []
---

## Request

Read-only code review of branch plan/hub-guided-p7, which implements phase P7 of docs/plans/2026-10-30-hub-guided.md: bond hub check [--fix] [--json] in cli/hub-check.mts and its section in bond doctor. Read that plan (P7, P5 and the decisions), docs/plans/2026-10-29-hub-session.md and AGENTS.md first. Do not switch branches in this checkout: inspect with `git diff plan/hub-session...plan/hub-guided-p7` and `git show plan/hub-guided-p7:<file>`.

Look for: correctness bugs; anything that can delete or overwrite a user's repo, clone or uncommitted work, or change a repo's branch; operations that ignore --dry-run; tests or commands that touch the REAL ~/.bond (must use a temporary BOND_HOME); Windows (paths with /, symlink vs junction, .cmd); regressions for repos without a hub and for the hub mode of bond team; missing tests for P7's acceptance criteria. Another branch implements P6 in parallel and also edits cli/hub.mts, docs/reference.md and CHANGELOG.md: flag semantic clashes.

Constraints: do not edit, create or commit any file and do not change the working tree. Report only actionable findings with file:line, severity (blocker / should-fix / nit), the failing scenario and a fix. End with a verdict: approve or changes requested.

## Report

### Actionable Findings

#### 1. `cli/doctor.mts:258`
- **Severity**: blocker
- **Failing scenario**: On a healthy hub, running `bond doctor` prints:
  `✓ hub <nombre>  X repo(s) de la sesión al día  → bond hub check`
  Because `"bond hub check"` is unconditionally passed as the 4th argument (`fix`) to `add()`, doctor shows a fix suggestion arrow on a passing check row.
- **Fix**: Only provide the fix recommendation when `failed.length > 0`:
  ```ts
  add(
    failed.length ? "fail" : "ok",
    `hub ${r.value.hub}`,
    failed.length ? `${failed.length} problema(s): ${failed.join("; ")}` : `${r.value.repos.length - 1} repo(s) de la sesión al día`,
    failed.length ? "bond hub check" : undefined,
  );
  ```

---

#### 2. `cli/hub-check.mts:51-63`
- **Severity**: blocker
- **Failing scenario**: 
  1. `symlinkSync(src, dest)` without a type argument defaults to `"file"` in Node.js. If a Windows user has Developer Mode enabled, Node creates a file symlink rather than a directory symlink, causing `ENOTDIR` when entering the path.
  2. Spawning `run("cmd", ["/c", "mklink", "/J", dest, src])` fails when paths contain forward slashes `/` because `cmd.exe` parses `/` as option switches (e.g., `/c`, `/j`).
  3. Spawning `cmd.exe` is unnecessary because Node.js / Bun natively supports NTFS directory junctions via `symlinkSync(resolve(src), dest, "junction")` (as already used in [cli/runtime.mts](file:///home/jose/gitrepos/bond/cli/runtime.mts#L61) and P6's `linkRepo`).
- **Fix**: Use `symlinkSync(src, dest, "dir")` and fall back to native junction on Windows:
  ```ts
  function makeDirLink(src: string, dest: string): void {
    mkdirSync(dirname(dest), { recursive: true });
    try {
      symlinkSync(src, dest, "dir");
      log(`enlazado: ${dest} -> ${src}`);
    } catch (e) {
      if (process.platform !== "win32") throw e;
      symlinkSync(resolve(src), dest, "junction");
      log(`junction: ${dest} -> ${src}`);
    }
  }
  ```

---

#### 3. `test/hub-check.test.mts:47, 73, 89, 143`
- **Severity**: blocker
- 
<truncated 3611 bytes>
-bond-hub-check-rama-vertical-a-medias-son-worktrees-de-ramas-que-no-existen-en-el-hub-o-mas-de-una-vertical-abierta.md) specifies two cases for a vertical branch problem: (1) worktree branch not existing in the hub, and (2) multiple vertical branches open at once. Test coverage only exercises case (1); case (2) has no test.
- **Fix**: Add a test in `test/hub-check.test.mts` with worktrees opened on two distinct feature branches verifying the `varias ramas verticales abiertas` failure and error code 1.

---

#### 10. `cli/hub-check.mts:47`
- **Severity**: nit
- **Failing scenario**: `defaultHasAgent` reinvents agent binary detection (`which(agent) || (agent === "agy" && existsSync(agyLocalBin()))`) instead of using `agentInstalled(agent)` already exported by [cli/catalog-agents.mts](file:///home/jose/gitrepos/bond/cli/catalog-agents.mts#L38).
- **Fix**: Import and use `agentInstalled` from `catalog-agents.mts`.

---

### Semantic Clashes with Branch `plan/hub-guided-p6`

1. **Subcommand Dispatch & Help Structure ([cli/hub.mts](file:///home/jose/gitrepos/bond/cli/hub.mts))**:
   - In P6, `HUB_HELP` groups subcommands under a `Comandos:` section (`init`, `add`, `sync`), and `hub(args)` routes via `const [sub, ...rest] = args;`.
   - In P7, `HUB_HELP` adds `bond hub check` under usage examples, and `hub(args)` checks `if (args[0] === "check")`.
   - *Resolution*: Align `check` under `Comandos:` in `HUB_HELP` and route `sub === "check"` through the `[sub, ...rest]` pattern introduced by P6.
2. **Directory Linking Duplication**:
   - P6 exports `linkRepo` in `cli/hub-init.mts` with native Windows junction fallback and `.gitignore` updates. P7 implements `makeDirLink` in `cli/hub-check.mts` using `cmd /c mklink`. Both should share the native Node junction mechanism.
3. **Remediation Hints**:
   - In `cli/hub-check.mts`, when a submodule is uninitialized or a link is missing, suggesting `bond hub sync` is complementary to `bond hub check --fix` and aligns with P6's sync behavior.

---

### Verdict

**Changes requested**
