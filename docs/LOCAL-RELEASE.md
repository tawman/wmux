# Local Fork Release Workflow (`production/local`)

> **Scope:** this file lives only on `production/local` (the `tawman/wmux` fork's
> default branch). It documents how *this fork* versions and ships local builds.
> It is intentionally separate from `CLAUDE.md` so upstream's release process
> stays pristine and version/release changes never leak into upstream PRs.

## What this is (and isn't)

- Local builds are installed on this machine via `C:\tools\swap-wmux.cmd` (folder
  swap, version-agnostic).
- GitHub Releases are published **on the fork** (`tawman/wmux`) **purely for
  human-facing release notes** via `gh ... --generate-notes`. They do **not**
  drive auto-update.
- **No auto-update feed.** The app's `electron-updater` still points at upstream
  `amirlehmam/wmux`, and it is disabled locally via `WMUX_DISABLE_UPDATER=1`. We
  never publish `latest.yml` on the fork. Upstream is merged in manually.

## Versioning convention

**`<upstream-base>-local.<N>`**

- `<upstream-base>` = the exact upstream version `production/local` is built from
  (currently `0.15.1`).
- `<N>` = local build counter; **resets to `1`** when `<upstream-base>` changes.
- Progression: `0.15.1-local.1` → `0.15.1-local.2` → *(merge upstream 0.16.0)* →
  `0.16.0-local.1`.

`package.json` `version` (line 3) is the **single source of truth**. It propagates
to the About panel (`app.getVersion()` → `HelpSettings.tsx`, renders
`wmux v0.15.1-local.1`), the zip artifact name, and the git tag. `swap-wmux.cmd`
does not read it.

Why `-local.N` (hyphen prerelease) and not `+local.N` (build metadata):
- Clean in git tags, GitHub release URLs, and zip filenames (electron-builder
  sanitizes `+` in artifact names).
- Distinct from the upstream `v0.15.1` tag the fork inherited (no collision).
- The one semver caveat — `0.15.1-local.1 < 0.15.1`, so upstream `0.15.1` would
  outrank it — is moot because the updater is disabled.

## Branch & PR hygiene

- The version bump is a **commit on `production/local` only** — never on `master`
  (the clean upstream mirror) and never on `feature/*` branches headed for
  upstream PRs. `package.json`'s version line is the only rebase-conflict point;
  keeping it off feature branches keeps them mergeable upstream.
- Feature work: branch `feature/*` off `master`, open a PR **into
  `production/local` on the fork**, and merge it there. `--generate-notes` then
  lists each merged PR. Do the `-local.N` bump *after* those merges.

## Per-release steps

Run in `C:\git\wmux-fork` on `production/local`:

1. **Bump** the version (creates the commit + `v…` tag):
   - Next build at the same base: `npm version prerelease`
     (e.g. `0.15.1-local.1` → `0.15.1-local.2`, tag `v0.15.1-local.2`).
   - New base after an upstream merge: `npm version 0.16.0-local.1`.
   - *First release only:* the version is already `0.15.1-local.1` (set during
     setup), so tag it directly instead of re-bumping:
     `git commit -am "chore(local): 0.15.1-local.1" && git tag v0.15.1-local.1`.

2. **Build** per `CLAUDE.md` → "Release Process" (`npm run build:main`,
   `npx vite build`, ASAR pack), producing `wmux-<version>-win-x64.zip`, **with
   these two fork adaptations:**

   a. **rcedit — strip the suffix.** rcedit's PE `file-version`/`product-version`
      are numeric-only (`x.y.z.w`) and reject `-local`. Derive a bare base:
      ```js
      const base = process.env.VER.split(/[-+]/)[0];   // 0.15.1-local.1 -> 0.15.1
      // use `base` for BOTH 'file-version' and 'product-version'
      ```
      (The free-text `version-string` block — ProductName/FileDescription — is
      unaffected.)

   b. **Skip `latest.yml`.** It only feeds electron-updater, which we don't feed.
      Don't generate it and don't attach it.

3. **Push**: `git push origin production/local --follow-tags`.

4. **Publish the release on the fork**:
   ```bash
   gh release create v0.15.1-local.1 --repo tawman/wmux --target production/local \
     --generate-notes --notes-start-tag v0.15.1 \
     ./wmux-0.15.1-local.1-win-x64.zip
   ```
   `--notes-start-tag` pins the changelog baseline. For the first release use the
   upstream tag you branched from (`v0.15.1`); on later releases use the previous
   `-local` tag (e.g. `v0.15.1-local.1`).

5. **Install locally**: stage the built app folder as
   `C:\tools\wmux-build-<timestamp>`, fully exit wmux, run
   `C:\tools\swap-wmux.cmd`, relaunch.

## Syncing upstream (when upstream releases)

1. `git fetch upstream`
2. `git checkout master && git merge --ff-only upstream/master && git push origin master`
   (keep the mirror clean).
3. `git checkout production/local && git merge master` — on the `package.json`
   version conflict, take the **new upstream base** and reset the counter:
   `npm version <new-base>-local.1`.
4. Rebuild → tag → release → swap (as above).

## Updater kill-switch

Persistent user env var **`WMUX_DISABLE_UPDATER=1`** disables the installing
update path in packaged builds. (The notify-only badge still polls upstream and
merely opens the release page in a browser — harmless; it never installs.) Set
once per machine:

```powershell
[Environment]::SetEnvironmentVariable('WMUX_DISABLE_UPDATER','1','User')
```

## Verify a release

- `node -p "require('./package.json').version"` → `0.15.1-local.1`.
- Build + swap + launch → **Settings → Help** shows `wmux v0.15.1-local.1`.
- Right-click `C:\tools\wmux\wmux.exe` → Properties → Details →
  **File version = `0.15.1.0`** (suffix stripped, no rcedit error).
- `git tag --list "v0.15.1-local.*"` shows the tag; no collision with upstream
  `v0.15.1`.
- Fork release page shows auto-generated notes + the attached zip.
- With `WMUX_DISABLE_UPDATER=1`, no "update ready / Install and restart" dialog.
