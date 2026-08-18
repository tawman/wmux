# Upstream Sync Manifest — 1.1.0 → 1.4.0 (2026-08-18)

**Range:** `34478dc..37500c7` (`amirlehmam/wmux` master) — 27 commits spanning four upstream
releases (1.1.1, 1.2.0, 1.3.0/1.3.1, 1.4.0), 52 files, +8,444 / −138 lines.

## Verdict: ✅ CLEAN — merged into `production/local` as `1.4.0-local.1`

| Gate step | Result |
|---|---|
| Dependency diff | **Zero** new/changed packages. The `package-lock.json` diff is four lines, all the version field (1.1.0 → 1.4.0). Dependency tree byte-identical across four upstream releases. |
| `npm audit` delta | **Nothing attributable.** 10 advisories (8 high / 2 moderate) across `brace-expansion, concurrently, dompurify, fast-uri, js-yaml, nanoid, postcss, shell-quote, tar, undici` — the same dev-toolchain set as the 1.1.0 baseline. Identical lockfile, so no advisory can originate here. |
| gitleaks / semgrep / trivy | Not installed. Substituted a full hand-read of the diff plus a pattern sweep of every added line for `eval` / `new Function` / `child_process` / `exec*` / `spawn*` / `fetch` / `http(s).request` / `WebSocket` / `net.connect` / `shell.openExternal` / `Invoke-Expression` / `DownloadString` / `curl` / `wget`, secret shapes, and external URLs. Three spawn sites, all reviewed below. The only new external URL anywhere in `src/` is `https://localhost:3000` in a Quick-launch settings placeholder. **No secrets, no obfuscation, no egress.** |
| Full-diff review | No malicious code. ~6,000 of the 8,444 added lines are the 11 new i18n locale files, verified structurally to be pure string data. Three functional areas touch the trust boundary — see below. |
| Tests | **1150/1151 pass** (11 skipped). The one failure is an **upstream test bug, not a code defect** — diagnosed in full below. |
| Build | `build:main` (tsc), `vite build`, and `typecheck` all clean. |
| Lint | Errors **unchanged at 16** vs. the 1.1.0 baseline (pre-existing `no-empty` / `no-control-regex` debt). No new file contributes an error. |
| `verify:resources` | Green with no action needed this sync — the merge's auto-merge of `resources/cli/wmux.js` landed byte-identical to our own `dist/cli` output. Rebuilt and re-checked rather than assumed. |

## What this range actually is

Four releases: **1.1.1** (crash-guard diagnostics for #150), **1.2.0** (safe crash reports, #174),
**1.3.0/1.3.1** (App Execution Alias resolution #172/#173, terminal recovery #175, NSIS install
scope #158/#167, shell-path memoization #176), and **1.4.0** (11 bundled UI languages, #178).

## The three areas that needed verifying, not reasoning about

**1. `wmux crash-report` (new, #174) — reads the Windows Event Log and shells out twice.**
The highest-scrutiny item, because it collects machine data and its entire purpose is to be pasted
into a public issue. It holds up:

- **Nothing leaves the machine.** No network call anywhere in the path; it prints to stdout.
- **Both spawns use absolute `System32` paths** via a `system32()` helper — `reg.exe` and
  `WindowsPowerShell\v1.0\powershell.exe`. Explicitly so a writable PATH entry cannot get a
  substitute in front of the one command a user runs *because* something already went wrong. The
  same range also changed the pre-existing `wslinfo` probe from a bare name to `/usr/bin/wslinfo`
  for the same reason — a **hardening of code we already shipped**.
- **The PowerShell script interpolates exactly two values**, and neither is injectable: `EXE` is the
  hardcoded literal `wmux.exe`, and `limit` is `Math.max(1, parseInt(...) || 5)` — a number by
  construction, so `--events "5;calc"` yields `5`.
- **PII is avoided by design, and the design is correct.** It reads the event's positional
  `Properties` rather than the rendered message, and reads only indices `0,1,3,6,7,12` (Application
  Error) and `2,13,19` (WER). Verified against the documented Application Error 1000 layout:
  indices **10 and 11 are the faulting application path and module path** — the fields carrying the
  home directory, and on a work machine usually a real name — and they are **never read**. Reading
  positionally also fixes a real correctness bug (a localised French Windows broke message parsing).
- `describeWerConfig` proactively warns when local crash dumps are enabled, which is the opposite of
  a data-collection posture.

**2. `pty-manager.ts` shell resolution (#172/#173/#176) — new filesystem probing before spawn.**

- `firstExistingOnPath` still resolves `where`/`which` through PATH, unchanged from before this
  range. Worth naming, but it is **pre-existing behaviour**, runs in the main process under the
  user's own PATH, and a hostile PATH entry there is already arbitrary code execution independent
  of wmux. Not a regression.
- `findStorePwsh` does a read-only listing of `%ProgramFiles%\WindowsApps` and falls back silently
  on an ACL-denied read. No writes.
- `getShellType` now takes the **basename** rather than the whole path. This is a genuine
  **security-relevant fix**: because #172 made `resolveShell` return an absolute path, a shell at
  `C:\tools\cmder\bin\bash.exe` would previously have classified as `cmd` and had cmd's shell
  integration injected into a bash session.
- Memoization (#176) caches negatives too; the stated cost is that installing a shell mid-session
  needs a restart, matching how `cachedDefaultShell` / `cachedWsl` already behaved.

**3. `crash-diagnostics.ts` (new) — an on-disk log.**
Not telemetry, and scoped so it needs no part of the #132 consent gate: it writes only inside wmux's
own `%APPDATA%\wmux\logs\main.log`, capped at 256 KB with truncate-not-rotate, and records process
lifecycle only — start, teardown, PTY count, crash-guard state. No pane contents, no cwds, no
command lines, no environment. Failures are swallowed so a diagnostic can never fail a launch.

## The one test failure — upstream bug, verified on this machine

`tests/unit/pty-manager.test.ts > resolveExistingShellPath > skips WindowsApps aliases and finds a
real file for pwsh` fails here. It is **not** a defect in the shipped code.

```
where pwsh
  C:\Program Files\WindowsApps\Microsoft.PowerShell_7.6.5.0_x64__8wekyb3d8bbwe\pwsh.exe
  C:\Users\toddw\AppData\Local\Microsoft\WindowsApps\pwsh.exe
```

Checked rather than assumed:

| Path | `fs.existsSync` | Size | What it is |
|---|---|---|---|
| `...\WindowsApps\Microsoft.PowerShell_7.6.5.0_x64__...\pwsh.exe` | `true` | 301,368 B | the **real** Store-package exe |
| `...\Local\Microsoft\WindowsApps\pwsh.exe` | `false` (EACCES) | — | the App Execution **alias** |

`resolveExistingShellPath('pwsh.exe')` correctly skips the alias and returns the real exe, which
spawns and reports `7.6.5`. The failing assertion is
`expect(resolved.includes('WindowsApps')).toBe(false)`, which treats "under WindowsApps" as
synonymous with "is an alias". On a machine where PowerShell 7 is installed **only from the Store**
— this one — the genuine binary also lives under `WindowsApps`, so the assertion is over-specified.
Upstream presumably has a non-Store `C:\Program Files\PowerShell\7` install that wins the `where`
ordering.

**Consequence for this fork:** `npm test` will fail this one assertion on every local release from
this machine until it is fixed. Behaviour is correct; only the test is wrong. Good upstream-PR
candidate (`feature/wmux-*` off `master`) — not fixed here, because a sync is not the place to
change upstream's tests.

## The i18n bulk (11 new locales, ~6,000 lines)

Not read line by line; verified structurally instead, which is the check that actually matters for
a data-only contribution:

- Zero occurrences of `import(`, `require`, `eval`, `Function`, `fetch`, `process.`, `window.`,
  `document.`, arrow functions, or `${}` template interpolation across all 11 files.
- Every file is a comment header plus a flat `'key': 'string'` map; the lines that did not match a
  strict single-line pattern were sampled and are all two-line key/value wraps.
- `en.ts` remains the key authority — upstream's own comment notes that adding a key absent from
  `en.ts` is a compile error, and `typecheck` passes.

## Inert in this fork

- `build/installer.nsh` (#158/#167) pins the NSIS install scope to whatever is already on disk.
  Sound, but we ship a portable zip with the updater disabled, so it never executes here.

## Merge

```
git checkout master && git merge --ff-only upstream/master     # 34478dc..37500c7
git checkout production/local && git merge master
```

Only two conflicts, both the long-standing version divergence:

| File | Resolution |
|---|---|
| `package.json`, `package-lock.json` | Version → `1.4.0-local.1` (new upstream base, so the local counter resets to 1). Upstream's `verify:resources` script entry preserved. |

`README.md` auto-merged clean this time. Fork-local carry-forward confirmed intact: the `a2a`
command survived upstream's further `src/cli/wmux.ts` growth (13 references across the handler and
`COMMAND_SPECS`).
