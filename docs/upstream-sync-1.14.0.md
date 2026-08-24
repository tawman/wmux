# Upstream Sync Manifest — 1.13.0 → 1.14.0 (2026-08-24)

**Range:** `73a2196..9cd6177` (`amirlehmam/wmux` master) — 2 commits, one upstream release
(1.14.0), 12 files, +530 / −46 lines.

## Verdict: ✅ CLEAN — merged into `production/local` as `1.14.0-local.1`

| Gate step | Result |
|---|---|
| Dependency diff | **None.** The only `package.json` / `package-lock.json` change in the range is the `1.13.0 → 1.14.0` version bump. No dependency added, removed, or bumped. |
| `npm audit` delta | **0 vulnerabilities** after `npm ci` — unchanged from the 1.13.0 baseline. |
| Main-process surface | **Untouched.** Nothing under `src/main/` changed. The audit's hot spots — `claude-context.ts`, `updater.ts`, `cdp-proxy.ts`, `pty-manager.ts` — are all outside the diff. |
| gitleaks / semgrep / trivy | Not installed on this machine. Substituted a pattern sweep of the whole `src/` diff for `fetch` / `http` / `ws:` / `child_process` / `exec` / `eval` / `new Function` / `require(` / `import(` / `process.env` / `shell.openExternal`. **Zero hits** — the four grep matches are the word "rows" and a `Digit([1-9])` regex. |
| Full-diff review | No malicious code. **Renderer-only, and mostly pure.** No new IPC channel, no new preload surface, no new pipe method, no file or registry write, no network egress of any kind. |
| Binary assets | **None.** |
| Tests | **1583/1591 pass** (6 skipped, 1 failed). The single failure is environmental and pre-existing — see below. Upstream added `tests/unit/index-shortcuts.test.ts` (149 lines), which passes. |
| Build | `build:main` (tsc) and `npx vite build` both clean; `scripts/pack-local.sh` completed end to end. |
| `verify:resources` | **Green.** Upstream did not touch `src/cli/` in this range, so the shipped `resources/cli/` needs no resync. |

## What this range actually is

One feature, one release:

- **Remappable number-row index shortcuts (#202 / PR #203)** — `Ctrl+1…9` (jump to workspace N) and
  `Ctrl+Alt+1…9` (jump to surface N) were two hardcoded keydown listeners with no way to rebind or
  disable them. They become **one modifier "mode" per family** (`ctrl` / `alt` / `ctrl-alt` /
  `ctrl-shift` / `alt-shift` / `off`) surfaced as two dropdowns under Settings → Keyboard, rather
  than eighteen individual `ShortcutAction` rows.

New pure module `src/renderer/utils/index-shortcuts.ts` (DOM-free, so the node-environment Vitest
suite exercises it without jsdom), plus wiring in `useKeyboardShortcuts.ts`, `settings-slice.ts`,
`KeyboardSettings.tsx`, `ShortcutCheatSheet.tsx`, and en/fr locales.

## The changes worth noting (behaviour, not security)

### 1. Default surface binding moved: `Alt+1–8` → `Ctrl+Alt+1–9`

README's shortcut table changed accordingly. If muscle memory is on `Alt+1…8`, set the **surface**
family back to `alt` in Settings → Keyboard → Number-row shortcuts.

### 2. `Ctrl+Shift+R` → `Ctrl+Shift+F2` for "rename workspace"

Documented in the same README diff. (`Ctrl+Shift+R` is a browser-reload-shaped combo; F2 is the
conventional rename key.)

### 3. Digit `9` now means LAST, not "the ninth"

`resolveIndexTarget()` maps digit 9 to `count - 1`. README always documented "jump to last
workspace" while the code selected index 8; with ≤ 9 items the two readings coincide, so this only
changes behaviour past nine items.

### 4. Digit detection reads `e.code` before `e.key`

A genuine fix, not a regression risk: `parseInt(e.key)` returned `NaN` on AZERTY (the unshifted
digit row emits `&é"'(-è_ç`), so `Ctrl+1…9` never fired at all for those users. The `e.key`
fallback is retained precisely so the numpad keeps working (`Numpad1…9` physical codes, plain
digit `e.key` with NumLock on).

### 5. The two families can never share a combo

`reconcileIndexModifiers()` **swaps** rather than creating a dead binding: picking `ctrl` for
surfaces hands surfaces' old `ctrl-alt` back to workspaces. `off` is exempt (both may be off at
once). Matching is exact — `ctrl` mode deliberately rejects `Ctrl+Alt+3` — so the families coexist
on the same digit row without one swallowing the other.

## Fork-specific risk carried forward ⚠️

**The portable-zip self-updater still points at `amirlehmam/wmux`, and `C:\tools\wmux` is a portable
zip extract.** Re-verified against `compareVersions()` this sync:

- **Still inert.** `'1.14.0-local.1'.split('.')` parses to `[1,14,0,1]` (`parseInt('0-local')` → 0),
  which outranks upstream `1.14.0` → `[1,14,0]`, so `resolvePortableZipTarget()` throws `NO_UPDATE`.
  The 1.13.0 manifest predicted this would go live at upstream 1.14.0 — it does **not**; the
  trailing `.1` keeps it inert. **It goes live the moment upstream ships 1.15.0.**
- **`WMUX_DISABLE_UPDATER=1` is still set at neither User nor Machine scope on this machine**
  (re-checked during this sync — both empty). `CLAUDE.md` records the updater as disabled; it is
  not. **Recommended for the third time**, and now with a deadline:

  ```powershell
  [Environment]::SetEnvironmentVariable('WMUX_DISABLE_UPDATER','1','User')
  ```

## Test failures (environmental, not from this range)

1. `pty-manager.test.ts › resolveExistingShellPath › skips WindowsApps aliases and finds a real file
   for pwsh` — **environmental and unchanged.** This machine has only the WindowsApps `pwsh.exe`
   alias (`%LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe`) and no real PowerShell 7 install, so the
   function correctly skips the alias and finds nothing. Recorded identically in the 1.8.0 and
   1.13.0 manifests. The file is untouched by this range.

## Conflicts resolved during the merge

| File | Resolution |
|---|---|
| `README.md` | **Ours.** The fork deliberately replaces upstream's full README body with a pointer to it; upstream's shortcut-table changes in this range land inside the region we removed. |
| `package.json` / `package-lock.json` | Version set to `1.14.0-local.1` — new upstream base, so `N` resets to 1. |
