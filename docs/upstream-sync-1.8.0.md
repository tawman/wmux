# Upstream Sync Manifest — 1.6.0 → 1.8.0 (2026-08-21)

**Range:** `71e89a0..514c373` (`amirlehmam/wmux` master) — 14 commits, three upstream releases
(1.7.0, 1.7.1, 1.8.0), 50 files, +1954 / −427 lines.

## Verdict: ✅ CLEAN — merged into `production/local` as `1.8.0-local.1`

| Gate step | Result |
|---|---|
| Dependency diff | **Zero** new/changed packages. The `package-lock.json` diff is four lines, all the version field (1.6.0 → 1.8.0). No advisory can originate in this range. |
| `npm audit` delta | **Nothing attributable.** 10 advisories (8 high / 2 moderate) — the same dev-toolchain set as the 1.6.0 baseline (`undici` via `node-gyp`, `tar`, `shell-quote` via `concurrently`). Identical dependency tree ⇒ identical audit. |
| Main-process surface | **Substantially changed** — 775 added lines across 7 files, including a brand-new privileged module (`zip-updater.ts`). Reviewed line by line; see below. This is the first sync in a while where the gate did real work rather than confirming an empty diff. |
| gitleaks / semgrep / trivy | Not installed on this machine. Substituted a pattern sweep of every added line for `eval(` / `new Function` / `child_process` / `exec*` / `fetch(` / `require('http` / `new WebSocket` / `net.request` / `shell.openExternal`, plus a secret-shape sweep (`api_key`, `secret`, `token =`, `password`, `BEGIN … PRIVATE KEY`, `ghp_`, `sk-`). **Five hits, all inside `zip-updater.ts` and all accounted for below. Zero secret matches.** |
| Full-diff review | No malicious code. The two changes that matter are the portable-zip self-updater and Claude session resume; both are reviewed in detail below. |
| Binary assets | **None.** The one added asset, `docs/assets/windows-download.svg`, is text. |
| Tests | **1290/1298 pass** (6 skipped, 2 failed). Both failures accounted for — see below. |
| Build | `build:main` (tsc) and `vite build` both clean. |
| `verify:resources` | **Green.** Upstream resynced `resources/cli/wmux-hook.js` against its `src/cli/wmux-hook.ts` change in the same range, so no drift for us to repair this time. |

## What this range actually is

Three releases carrying two substantial features:

- **PR #184 (1.7.0) — in-place updates for portable zip installs.** New `src/main/zip-updater.ts`
  (+340) plus a rework of `updater.ts` to route by install layout. Fixes issue #96: a zip extract
  has no NSIS uninstaller, so `NsisUpdater` downloaded and then no-op'd forever.
- **#186 (1.8.0) — resume Claude Code sessions on workspace restore.** New `src/main/claude-resume.ts`
  and `src/renderer/hooks/claude-resume-command.ts`, wired through `wmux-hook.ts` → `agent-state.ts`
  → `session-persistence`. Behind `workspacePrefs.restoreClaudeSessions`, **default off**.
- Loose: TRACE sidebar row density, update-button i18n, zh-TW translation of the 18 Saved Layouts
  keys, a README download button, dropping the orchestrator plugin card from the landing page.

## The changes that needed verifying

### 1. `zip-updater.ts` — new privileged module: network download + `child_process` + overwriting the install root

Every flagged pattern in the sweep lives here. Read in full. It is a legitimate updater, and it is
defensively written:

- **Download** is `electron.net.request` to `asset.browser_download_url`, taken from the GitHub
  releases API response — not from any user, pipe, or file input. No curl, no `Invoke-WebRequest`,
  no new runtime dependency.
- **Integrity is actually checked.** `verifyDownload()` enforces both the advertised byte size and,
  when GitHub supplies `asset.digest`, a SHA-256 comparison; a mismatch deletes the partial file and
  rejects. This is stronger than the NSIS path it sits beside.
- **Extraction** shells out only to absolute `%SystemRoot%\System32` paths — `tar.exe`, falling back
  to `WindowsPowerShell\v1.0\powershell.exe -NoProfile -NonInteractive`. `system32()` pins every
  helper, so PATH cannot be hijacked. The one interpolated PowerShell command escapes single quotes
  in both paths.
- **The apply helper is a static string.** `buildApplyUpdateCmd()` takes no parameters; the pid,
  payload dir, install dir and exe all arrive as `%1`–`%4` at invocation. A hostile extract therefore
  cannot rewrite the helper's body — the upstream comment says exactly this, and the code matches.
  Its `robocopy` / `tasklist` / `timeout` / `findstr` calls are likewise System32-pinned.
- **No unattended path.** `runPortableZipUpdate` is reachable only from `requestUpdateNow()`, i.e. a
  badge/Help-button click, and the pre-existing confirmation dialog still fires before the swap.
  `initAutoUpdater()` returns early for portable installs rather than arming anything.
- The unconditional relaunch after a failed copy is deliberate and documented; it fails toward
  "wmux still starts, on the old build".

### 2. Claude session resume — a session id that reaches a command line

The one genuinely security-relevant data flow in this range: `session_id` now travels
Claude hook → named pipe (**a public interface**) → `agent-state.ts` → `session.json` → a restored
pane's `startupCommands`. Upstream treats it as a boundary and validates at **three** points:

1. `reportAgentSession()` — validates at the door via `isValidClaudeSessionId`, storing `null`
   rather than deferring sanitisation to a later caller.
2. `CLAUDE_SESSION_ID_RE = /^[A-Za-z0-9_-]{8,128}$/` — admits no space, quote, `;`, `&`, `|`, `$`,
   backtick or path separator, so the value cannot be anything but a single shell token.
3. `withClaudeResume()` re-validates renderer-side, correctly reasoning that the value round-tripped
   through `session.json`, which is a user-editable file on disk.

`pruneDeadClaudeSessions()` additionally drops any id with no transcript under `~/.claude/projects`
before restore, and treats an unreadable projects dir as "keep everything" rather than "drop
everything". Default-off. **No injection path found.**

### 3. `wmux-hook.ts` / `agent-state.ts`

Refactor plus the one new forwarded field (`session_id`). `parsePayload()` is extraction only —
no new transport, no new destination, same pipe and same auth prefix.

## Fork-specific risk introduced by this range ⚠️

**The portable-zip updater points at `amirlehmam/wmux`, and our install is a portable zip extract.**
`update-checker.ts` hardcodes `REPO_OWNER = 'amirlehmam'`, and `C:\tools\wmux` matches
`isPortableZipInstall()` exactly (`wmux.exe` present, no `Uninstall wmux.exe`). Before this range a
zip install could not be replaced at all — `NsisUpdater` no-op'd, which is issue #96. **It can now.**
A click on the update badge would download upstream's zip and robocopy it over the install root,
replacing our fork build in place.

- **Today this is inert.** `compareVersions('1.8.0', '1.8.0-local.1')` parses to `[1,8,0]` vs
  `[1,8,0,1]` and returns ≤ 0, so `resolvePortableZipTarget()` throws `NO_UPDATE`. Our `-local.N`
  suffix happens to sort *above* the upstream base it derives from.
- **It stops being inert the moment upstream ships 1.9.0.**
- **The documented mitigation is not actually in effect.** `CLAUDE.md` records the updater as
  disabled via `WMUX_DISABLE_UPDATER=1`, but that variable is set at neither User nor Machine scope
  on this machine, and `wmux.exe` is launched directly with no wrapper script. `canSelfUpdate()` —
  which `requestUpdateNow()` checks first — is therefore currently returning true.
- **Recommended:** set `WMUX_DISABLE_UPDATER=1` as a User environment variable, restoring the
  behaviour the fork already believes it has.

## Test failures (both pre-existing / environmental, neither from this range)

`git diff --stat 71e89a0..master` touches **neither** failing test nor its subject.

1. `pty-manager.test.ts › resolveExistingShellPath › skips WindowsApps aliases and finds a real file
   for pwsh` — **environmental.** This machine has only the WindowsApps `pwsh.exe` alias, which the
   function correctly skips, leaving nothing to resolve. Reproduced at the pre-merge commit
   (`d2112cb`) in a clean worktree: **fails identically there.**
2. `orchestration-status-vocab.test.ts › marks a successful agent "exited"` — **flaky under
   full-suite parallel load** (a bash-script test that took 52 s in the full run). Passes in
   isolation on the merged tree, and passed pre-merge.

## Conflicts resolved during the merge

| File | Resolution |
|---|---|
| `README.md` | **Ours.** The fork deliberately replaces upstream's full README body with a pointer to it; upstream added a download button inside the region we removed. |
| `package.json` / `package-lock.json` | Version set to `1.8.0-local.1` — new upstream base, so `N` resets to 1. |
