# Upstream Sync Manifest — 1.4.0 → 1.5.1 (2026-08-19)

**Range:** `37500c7..cba4f56` (`amirlehmam/wmux` master) — 13 commits spanning two upstream
releases (1.5.0, 1.5.1), 33 files, +956 / −259 lines.

## Verdict: ✅ CLEAN — merged into `production/local` as `1.5.1-local.1`

| Gate step | Result |
|---|---|
| Dependency diff | **Zero** new/changed packages. The `package-lock.json` diff is four lines, all the version field (1.4.0 → 1.5.1). No advisory can originate in this range. |
| `npm audit` delta | **Nothing attributable.** 10 advisories (8 high / 2 moderate), the same dev-toolchain set as the 1.4.0 baseline (`tar`, `undici` via `node-gyp`, et al.). Identical lockfile ⇒ identical audit. |
| Main-process surface | **Untouched.** `git diff --stat 37500c7..master -- src/main src/cli src/preload` is **empty**. Every hot spot the fork's gate names — `claude-context.ts`, `updater.ts`, `cdp-proxy.ts`, `pty-manager.ts` — is byte-identical to what we already ship. |
| gitleaks / semgrep / trivy | Not installed. Substituted a pattern sweep of every added line for `fetch` / `http(s)://` / `ws(s)://` / `child_process` / `exec*` / `spawn*` / `eval` / `new Function` / `require` / `shell.openExternal` / `process.env` / base64 decode / secret shapes. **Three hits, all benign:** the README hero image URL, a `https://localhost:3000` settings placeholder in the new locale, and a `RegExp.exec` in a new unit test. No egress, no secrets, no obfuscation. |
| Full-diff review | No malicious code. The functional change is confined to the renderer (a settings migration and an icon set) plus build/site config — see below. |
| Binary assets | Seven changed/added PNG/ICO files verified by `file(1)` to be genuine images at their claimed dimensions (512×512 icon, 8-entry ICO from 16px, 1919×1029 screenshot). All got **smaller** — the new mark is simpler art. |
| Tests | **1165/1172 pass** (6 skipped). One failure, pre-existing and environmental — diagnosed below. |
| Build | `build:main` (tsc) and `vite build` both clean. |
| `verify:resources` | **Green with no action** this sync — no fork/upstream drift in `resources/` copies. |

## What this range actually is

Two releases: **1.5.0** (Traditional Chinese, a stroke-based titlebar icon set, TRACE promoted to the
default sidebar mode) and **1.5.1** (a new brand mark across every icon surface, plus the
shell-notification and cache-header fixes that rebrand exposed).

## The changes that needed verifying

**1. `settings-slice.ts` — TRACE becomes the default, with a forced one-time promotion.**
The only behavioural change that reaches an existing user's stored state. It is not a plain default
flip: `setAppearancePrefs` persists the whole merged object, so every user who ever touched a theme
already had `uiMode: 'classic'` on disk and `{ ...DEFAULTS, ...loadPersisted() }` would let it win.
Upstream added `uiModeDefaultRev`, read off the **raw** stored blob (correctly — reading it off the
merged blob would make every legacy blob look already-migrated), promoting once and stamping the rev
so a user who picks classic back keeps it. Logic reviewed and correct. **Consequence for us: the
sidebar will switch to TRACE on first launch of this build.** Settings → Appearance reverts it, and
that choice then sticks.

**2. `build/installer.nsh` — a new `System::Call` into `shell32`.**
`SHChangeNotify(SHCNE_ASSOCCHANGED)`, the documented shell-notification call, replacing an
`ie4uinit` invocation upstream measured as a no-op (the icon cache is memory-mapped by the running
`explorer.exe`). Standard, non-destructive, and deliberately *not* the "kill Explorer and delete the
cache" approach. **Inert here regardless** — we ship a portable zip and never run NSIS.

**3. `scripts/build-icons.mjs` — three art tiers collapsed to one.**
Build-time only, no new dependency, still rasterizing through an offscreen `BrowserWindow`. The
removal of `icon-small.svg` / `icon-tiny.svg` is justified in-file by a measured luminance profile
rather than assertion. Does not run in our release path (`pack-local.sh` consumes the committed
`resources/icons/icon.ico`).

**4. `netlify.toml` — `immutable` dropped from the brand assets.**
Correct: `immutable` is only safe with a content-hashed filename, and `favicon.png` / `wmux_logo.png`
keep their names across a rebrand. Site-only; no effect on the app.

**5. Traditional Chinese (`zh-TW.ts`, 525 lines).**
Verified structurally, the check that matters for data: zero `eval` / `require` / `fetch` /
`${}` interpolation / arrow functions; a single `import type` and one `https://localhost:3000`
placeholder. Flat `'key': 'string'` map, with `en.ts` still the compile-time key authority.

## The one test failure — pre-existing, environmental, not a regression

`tests/unit/pty-manager.test.ts > resolveExistingShellPath > skips WindowsApps aliases and finds a
real file for pwsh` fails on this machine, now at `expect(resolved).toBeTruthy()`.

**It is not caused by this merge**, and that is provable rather than assumed:

- The failing assertion (`toBeTruthy`, line 255) is a **context line** in upstream's diff — unchanged.
- `src/main/pty-manager.ts` is **unchanged** across the whole range.

Same code, same assertion ⇒ 1.4.0-local.1 fails it identically.

**Why it fails now, when the 1.4.0 manifest recorded it passing that assertion.** The machine's PATH
changed, not the code. The 1.4.0 record shows `where pwsh` returning the real Store exe *first*;
today it returns only the alias:

```
$ where pwsh
C:\Users\toddw\AppData\Local\Microsoft\WindowsApps\pwsh.exe     # the alias, and nothing else
```

`C:\Program Files\WindowsApps\Microsoft.PowerShell_7.6.5.0_x64__8wekyb3d8bbwe` is no longer on PATH.
So resolution now runs to the end of its chain and comes back empty:

1. `firstExistingOnPath('pwsh.exe')` finds only the alias; `existsSync` is false (EACCES) → skipped.
2. `findStorePwsh(false)` does `readdirSync('%ProgramFiles%\WindowsApps')` → **EACCES**, caught by
   the function's own `catch` ("ACL-denied listing is fine — caller falls back") → `undefined`.
3. `resolveExistingShellPath('pwsh.exe')` → `undefined`.

Confirmed at the shell: `ls "C:/Program Files/WindowsApps"` → *Permission denied*, while
`pwsh -NoProfile -c '(Get-Process -Id $PID).Path'` reports the real
`...\Microsoft.PowerShell_7.6.5.0_x64__8wekyb3d8bbwe\pwsh.exe`. The binary exists; an unelevated
process simply cannot enumerate the directory to find it.

**Note on PR #181** (`9a13676`, ours, upstream in this very range): it fixed the *other* assertion in
this test — `resolved.includes('WindowsApps')`, which conflated "under the WindowsApps tree" with "is
an alias". That fix is correct and still correct. It just cannot rescue a run where resolution
returns `undefined` before any assertion about the path is reached.

**Consequence for this fork:** `getDefaultShell()` falls through `pwsh.exe` → `powershell.exe`, so a
default pane on this machine gets **Windows PowerShell 5.1 rather than pwsh 7** unless a shell is
configured explicitly. Graceful, pre-existing, and unchanged by this sync — but worth knowing.

**Follow-up (upstream-PR candidate, `feature/wmux-*` off `master`):** the test asserts something the
environment cannot guarantee. It should skip when no non-Store `pwsh` is on PATH *and*
`%ProgramFiles%\WindowsApps` is not enumerable — the same "is this shape even testable here" guard
the `pwsh-preview` case below it already applies via `if (!resolved) return`. Not fixed here: a sync
is not the place to change upstream's tests.

## Merge

```
git checkout master && git merge --ff-only upstream/master     # 37500c7..cba4f56
git checkout production/local && git merge master
```

| File | Resolution |
|---|---|
| `package.json`, `package-lock.json` | Version → `1.5.1-local.1` (new upstream base, so the local counter resets to 1). |
| `README.md` | Took the fork's side. Upstream added a hero screenshot and grew the feature list; our README deliberately replaces that body with a pointer to the upstream README, so the fork header and pointer are kept and upstream's body is not re-imported. |

`CLAUDE.md` auto-merged, taking upstream's `**Version**: 1.5.1` line while keeping the fork's
"Fork Build on production/local" section intact.

## Two packaging defects found while cutting this release

Not upstream's, and not new to this sync — both were wrong in every local release `pack-local.sh`
has produced. Fixed in `b1a31a5`.

1. **The packaged build shipped stale agent instructions.** `resources/claude-instructions.md` (108
   lines) is canonical, but `agent-instructions.ts` reads the **directory** copy
   (`resourcesPath/claude-instructions/claude-instructions.md`) in packaged builds and the root file
   only in dev. The tracked directory copy is a duplicate that stopped being updated at `4498cf1` —
   43 lines, missing the #152/#158 gate that stops an agent reading "wmux: command not found" as
   "wmux is absent". The packer copied it verbatim. It now derives the directory copy from the
   canonical file, so the duplicate cannot drift into a release again.
2. **No `icon.ico` was shipped.** `getAppIcon()` prefers `resourcesPath/icon.ico` and falls back to
   `icon.png`. The Electron `dist` base carries no `icon.ico` and nothing copied one in, so every
   local release silently took the png fallback — a downscaled 512px png at the 16/20/24px slots the
   shell actually draws. Now copied from `resources/icons/icon.ico`.

Both files were added to the step-4 resource guard, which exists precisely so a
resource loaded *by path* cannot go missing silently (issue #81).
