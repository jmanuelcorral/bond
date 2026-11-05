---
name: release-bond
description: Ship a bond release end to end - version bump and annotated tag, the GitHub release built by release.yml, the regenerated packaging and the Homebrew tap in its own repository. Use when asked to release, tag or ship bond, or to finish a release that stopped halfway. Every step needs explicit user approval; never push, tag, publish or trigger a workflow on your own.
user-invocable: true
---

# Ship a bond release

Releasing bond is four operations with hard dependencies between them, and the last one writes to
**another repository** (`jmanuelcorral/homebrew-tap`). Each step has a gate that must be verified
before starting the next one, because the expensive mistakes here are ordering mistakes - running
the packaging generator before the release exists, or pointing the tap at hashes that are not the
binaries people download.

Read `AGENTS.md` (release section) and `CHANGELOG.md` first. The changelog, CLI messages and docs
are in Spanish; commits and this skill are in English.

## Boundaries

- Nothing here is authorized by the user asking "release bond". Show the exact plan (version,
  commit, tag, pushes, workflow dispatches, the tap commit) and get an explicit OK. A tag push
  publishes: it triggers `release.yml`, which creates a public release.
- Never `git push --force`, and never force anything in the tap repository. Never hand-edit
  `packaging/`, `cli/assets.gen.mts` or `dist/` - all generated.
- Do not publish to AUR or npm by hand; npm publication runs in CI when the secret exists (step 2).
- If a step's gate fails, stop and report. Do not "continue and fix later" down the pipeline.

## The pipeline

| # | Operation | Requires | Gate before starting |
| --- | --- | --- | --- |
| 1 | `npm version X.Y.Z --no-git-tag-version`, changelog, commit `Release X.Y.Z`, annotated tag `vX.Y.Z` | clean `main` | user approved the version and the changelog |
| 2 | push `main` + push the tag; `release.yml` builds 3 platforms, packs npm, makes `SHA256SUMS`, creates the release, publishes npm if `NPM_TOKEN` exists | 1 | tag equals `package.json` |
| 3 | `bun scripts/packaging.mts`, commit `Regenerate packaging for X.Y.Z`, push | **2 finished** | release is not a draft and every asset is there |
| 4 | copy `packaging/homebrew/bond.rb` into the tap's `Formula/bond.rb`, push, run `brew.yml` | 3 | the `.rb` hashes equal the release's `SHA256SUMS` |

## Step 1 - version, changelog, tag

1. `git status --porcelain` empty and `git pull --ff-only` on `main`. `grep -n '^## Sin publicar'
   CHANGELOG.md` must find the section; if it is empty, say so before bumping.
2. `npm version X.Y.Z --no-git-tag-version` - it moves `package.json` **and** `package-lock.json`.
   Both belong in the release commit.
3. Rewrite `## Sin publicar` as `## X.Y.Z` with a short Spanish summary paragraph above its bullets
   (what changed and why it matters). Keep every bullet that belongs to this release; never drop
   earlier versions.
4. Commit `Release X.Y.Z` (one commit with the two manifests and the changelog).
5. Tag with the house message, not with `gh release create` (it would make an implicit tag without it):
   ```bash
   tag="v$(jq -r .version package.json)"
   test "$tag" = "vX.Y.Z" || { echo "tag y package.json no coinciden"; exit 1; }
   git tag -a "$tag" -m "bond $tag"
   ```
   `release.yml` fails the build when tag and `package.json` disagree; check it here instead of
   finding out in CI.

## Step 2 - push and let CI publish

1. `git push origin main` then `git push origin "$tag"`. The tag push is the publication trigger.
2. Watch it until it ends - the `ci-status` skill if installed, or:
   ```bash
   run="$(gh run list --workflow release.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
   gh run watch "$run"
   ```
   Do not start step 3 while it runs.
3. Verify the release is complete before anything reads from it:
   ```bash
   v="${tag#v}"
   gh release view "$tag" --repo jmanuelcorral/bond --json isDraft,assets \
     --jq 'if .isDraft then "DRAFT - no continuar" else ([.assets[].name] | sort | join(" ")) end'
   ```
   Expect exactly: `SHA256SUMS bond-darwin-arm64 bond-darwin-x64 bond-linux-arm64
   bond-linux-x64 bond-windows-x64.exe jmanuelcorral-bond-$v.tgz`. A missing asset means the job
   did not finish or died halfway - step 3 must not run.
4. Check the sums against what is actually downloadable (not against what CI logged):
   ```bash
   mkdir -p /tmp/bond-verify && cd /tmp/bond-verify
   base="https://github.com/jmanuelcorral/bond/releases/download/$tag"
   curl -fsSLO "$base/SHA256SUMS"
   for f in bond-linux-x64 "jmanuelcorral-bond-$v.tgz"; do curl -fsSLO "$base/$f"; done
   for f in bond-linux-x64 "jmanuelcorral-bond-$v.tgz"; do grep -F " $f" SHA256SUMS | sha256sum -c -; done
   ```
   On macOS use `shasum -a 256 -c -`. Any mismatch: stop, the release is broken.

## Step 3 - regenerate packaging (only after step 2 is finished)

`scripts/packaging.mts` reads `SHA256SUMS` **from the published release URL**, not from `dist/`.
Run it too early and it dies with a 404 (`no encuentro SHA256SUMS de vX.Y.Z`) or with
`falta <asset> en SHA256SUMS` - loud, but it costs a wasted run. What is quieter and worse is
generating the formula against a release that is then re-cut or whose assets are re-uploaded:
the tap ends pointing at bytes that no longer exist. Re-run the `gh release view` gate above
immediately before it, even if step 2 looked fine:

```bash
bun scripts/packaging.mts            # defecto: la versión de package.json
grep -c "releases/download/$tag/" packaging/homebrew/bond.rb   # 4 URLs, todas de este tag
```

Then confirm the four hashes in `packaging/homebrew/bond.rb` appear in the release's `SHA256SUMS`
(one per platform binary). Commit `Regenerate packaging for X.Y.Z` and push. The AUR files
(`packaging/aur/PKGBUILD`, `.SRCINFO`) are regenerated too but are not pushed anywhere by this
skill - publishing to AUR is a separate, explicitly requested operation.

## Step 4 - the tap (another repository)

The tap is `jmanuelcorral/homebrew-tap`, formula at `Formula/bond.rb`. It is not this repo: it
has its own history, its own CI (`brew.yml`) and its own mistakes.

1. Find a local clone (`ls -d ~/gitrepos/homebrew-tap` or ask the user; clone it if it does not
   exist). Never work on the tap from a temp copy you forget about, and never assume its path.
2. `git -C <tap> pull --ff-only` first; if it cannot fast-forward, stop and report the divergence.
3. Copy `packaging/homebrew/bond.rb` over `<tap>/Formula/bond.rb`.
4. Verify before committing - the four hashes in the formula must be GitHub's own digests for this
   release's binaries (empty diff means they agree):
   ```bash
   diff <(grep -oE 'sha256 "[0-9a-f]+"' <tap>/Formula/bond.rb | cut -d'"' -f2 | sort) \
        <(gh release view "$tag" --repo jmanuelcorral/bond --json assets \
             --jq '.assets[] | select(.name | test("^bond-(darwin|linux)-")) | .digest | sub("^sha256:";"")' | sort)
   grep -n "version \"$v\"" <tap>/Formula/bond.rb
   ```
   GitHub computes `.assets[].digest` itself, so this compares the formula against the registry of
   truth rather than against a file this repo generated.
5. Commit (message like `bond X.Y.Z`, matching the tap's history), push, then dispatch its workflow:
   ```bash
   gh workflow run brew.yml --repo jmanuelcorral/homebrew-tap
   sleep 5   # la lista tardan en reflejar la run nueva
   run="$(gh run list --repo jmanuelcorral/homebrew-tap --workflow brew.yml --limit 1 \
     --json databaseId --jq '.[0].databaseId')"
   gh run watch --repo jmanuelcorral/homebrew-tap "$run"
   ```
   `brew.yml` installs from the tap on macOS (arm + intel) and Linux and runs `bond --version`.
   A green run is the proof the release is installable; report it.

## When something fails halfway

| Situation | Do |
| --- | --- |
| Tag pushed, `release.yml` red | Fix and `gh run rerun <id>`; the tag may stay. Do not run step 3. |
| Tag pushed, release never created, need to redo | Delete the tag both sides (`git tag -d "$tag"`, `git push origin :refs/tags/"$tag"`) and redo step 1. Never reuse a tag that produced a partial release. |
| Release created with missing assets | Do not run `packaging.mts`. Rerun the job, or `gh release delete "$tag" --cleanup-tag -y` and redo. Never upload assets by hand to patch it. |
| `packaging/` generated from a stale or wrong `SHA256SUMS` | Re-run `bun scripts/packaging.mts` after the release is correct and commit the fix. Never edit the generated files. |
| Tap pushed with a wrong formula | `git revert` the tap commit (never force-push), fix, redo step 4. A bad formula breaks `brew upgrade` for everyone. |
| npm publish failed but the release is fine | The GitHub release stands on its own. Fix the cause and rerun the job; npm rejects a re-publish of an existing version, so if a broken tarball got published, `npm deprecate @jmanuelcorral/bond@X.Y.Z "<reason>"` and ship a patch. |

## Follow-up work not covered by this run

- **npm provenance is not enabled.** `release.yml` publishes with `--access public` only. Adding
  `--provenance` needs trusted publishing configured per package on npmjs.com (provider GitHub
  Actions, pinned to this repo and workflow) plus `id-token: write` in the workflow. Do that once
  the package exists on the registry, then add the flag; until then, do not pass it - it fails.
- **The publish step pins the registry on purpose.** A scoped `@jmanuelcorral:registry` entry in
  any `.npmrc` in effect (a developer machine pointing the scope at `npm.pkg.github.com`, for
  instance) wins over `npm publish --registry=...`, so the workflow writes both the scoped line
  and the `//registry.npmjs.org/:_authToken` line into `$HOME/.npmrc` before publishing. If a
  release ever lands in GitHub Packages instead of npmjs.com, look there first.
- **`npm publish --dry-run` needs no credentials**: it prints the tarball contents and the target
  registry without authenticating, so it is safe to run anywhere to inspect what would ship.
- **The "not published yet" messages were flipped after 1.13.0**, the first real npm publish:
  `update.manual_npm` in `cli/messages/update.mts` (both locales), the comment above
  `manualCommand` in `cli/update.mts` and the update sections of `docs/reference.md` and
  `docs/en/reference.md` now give `npm i -g @jmanuelcorral/bond@<version>`. If npm ever stops
  publishing, fix the publish - do not put the old wording back.
- **`NPM_TOKEN` has to be an automation token.** A granular "Read and write" token on an account
  with 2FA publishes nothing: npm answers `EOTP` and asks for a one-time password that CI cannot
  produce. The token type must be Automation, the one that bypasses 2FA for CI.
- **`gh release create` is not idempotent.** Rerunning the release job once the release exists
  dies on that step, so a downstream failure can only be retried by deleting the release with
  `--cleanup-tag` and re-pushing the tag - which rebuilds the binaries and changes every hash.
  Generate the packaging and the tap only after the run you are keeping has finished.

## Guided next step

End with the state of each of the four steps (done / pending / blocked, with the tag, run id and tap
commit), one recommended next operation and why. If a gate is unverified, recommend verifying it
rather than moving on. Never chain a push, a tag or a workflow dispatch off your own recommendation.
