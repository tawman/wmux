# Upstream Sync Manifest — 1.8.0 → 1.13.0 (2026-08-24)

**Range:** `514c373..73a2196` (`amirlehmam/wmux` master) — 44 commits, six upstream releases
(1.9.0, 1.10.0, 1.11.0, 1.12.0, 1.12.1, 1.13.0), 97 files, +7966 / −318 lines.

## Verdict: ✅ CLEAN — merged into `production/local` as `1.13.0-local.1`

| Gate step | Result |
|---|---|
| Dependency diff | **One runtime bump, one dev addition.** `dompurify` 3.4.11 → **3.4.14** (security-relevant, and it hardens the markdown boundary we depend on), `js-yaml` 4.3.0 → 4.3.1 (GHSA-5p4m-2wfm-xmqj, commit `26b60db`), `concurrently` 10.0.3 → 10.0.5. The only *new* dependency is **`jsdom` 29.1.1 as a devDependency** (test-only, for the markdown-sanitize suite); every one of the ~34 added lockfile entries is a jsdom transitive. No new runtime dependency. |
| `npm audit` delta | **0 vulnerabilities** after `npm ci` — an improvement on the 1.8.0 baseline's 10 advisories (8 high / 2 moderate, the `undici`/`tar`/`shell-quote` dev-toolchain set). Nothing newly introduced. |
| Main-process surface | **Heavily changed** — 8 new privileged modules (`ssh-detect.ts`, `ssh-argv.ts`, `remote-upload.ts`, `remote-insert.ts`, `node-runtime.ts`, `win32-process.ts`, `system32.ts`, `shell-quote.ts`) plus +213 in `ipc-handlers.ts` and +231 in `window-manager.ts`. Reviewed; see below. |
| gitleaks / semgrep / trivy | Not installed on this machine. Substituted a pattern sweep of every added line for `eval(` / `new Function` / `child_process` / `exec*` / `spawn(` / `fetch(` / `http(s)://` / `net.request` / `WebSocket` / `shell.openExternal`, plus a secret-shape sweep (`api_key`, `secret`, `password`, `token =`, `BEGIN … PRIVATE KEY`, `ghp_`, `sk-`). **Six exec hits, all `execFile` in the new SSH/runtime modules and all accounted for below. Zero secret matches** (the four text hits are comments and a test fixture path). |
| Full-diff review | No malicious code. No new network egress: nothing in this range opens an HTTP/WS connection. The only new outbound traffic is **scp/ssh to the host the user's own pane is already connected to**. |
| Binary assets | **None.** `git diff --numstat` reports no binary paths in the range. |
| Tests | **1563/1570 pass** (6 skipped, 1 failed). The single failure is environmental and pre-existing — see below. |
| Build | `build:main` (tsc) and `npx vite build` both clean. |
| `verify:resources` | **Green.** Upstream resynced `resources/cli/wmux.js` in the same range (`52f2411`). The byte-level diff against our `dist/cli/` is line endings only (`.gitattributes` normalisation), not drift. |

## What this range actually is

Six releases carrying three substantial features:

- **Real window transparency (#192, 1.11.0)** — Win11 acrylic/mica backdrop materials plus a
  frameless "Clear" mode, new `usePaneFill`/`useWindowTransparency` hooks, renderer-drawn caption
  buttons, and a reachable Windows Terminal / Ghostty config import.
- **SSH-aware panes (#196–#198, 1.12.0)** — wmux now *detects* that a pane has ssh'd somewhere
  (preexec hook + a throttled process-tree probe) and, on paste or drop, **scp's the file to that
  host** and types the remote path instead of an unusable local Windows path.
- **`wmux current-workspace` / `whoami` (#200, 1.13.0)** and an `openLinksExternally` setting
  (#201) whose Ctrl/Cmd modifier now *inverts* the default rather than forcing external.
- Loose: OpenCode plugin fixes (#187–#191), a `js-yaml` advisory bump, markdown sanitize extracted
  and pinned by tests, `pty-ledger`/`pty-manager` shell-spec fixes.

## The changes that needed verifying

### 1. `remote-upload.ts` — new module that copies local files to a remote host

The highest-risk addition in the range, and it is defensively written:

- **No shell anywhere.** Every invocation is `execFile(sshOrScp, argvArray)` — arguments are a real
  argv, never a command string. The one place a remote *script* is composed (`mkdir`, `rm -f`,
  `rm -rf`) runs each path through `posixShellQuote()`, which single-quotes and escapes embedded
  quotes; there is no interpolation of an unquoted value.
- **The binary is pinned, not resolved from PATH.** `toolForSession()` prefers the `scp`/`ssh`
  sitting beside the executable the pane actually connected with, otherwise `opensshPath()` →
  `%SystemRoot%\System32\OpenSSH` (or the `%ProgramFiles%\OpenSSH` standalone). PATH cannot be
  hijacked into it.
- **The destination is not attacker-chosen.** It is the destination of the ssh session the pane is
  already inside, parsed from that process's own command line. There is no code path that uploads to
  a host the user has not themselves connected to.
- **`BatchMode=yes` + `ClearAllForwardings=yes` + a filtered `-o` replay.** `RemoteCommand`,
  `RequestTTY`, `LocalCommand`, `SetEnv` and friends are explicitly stripped
  (`UNSAFE_FOR_TRANSFER`) before the user's own ssh options are replayed onto the transfer.
- **Remote files land in a private per-batch dir** — `umask 077 && mkdir -m 700 /tmp/wmux-drop-<uuid>`,
  one uuid per file, extension whitelisted by `/^\.[A-Za-z0-9]{1,16}$/`. All-or-nothing with a
  best-effort `rm -rf` rollback. Concurrency capped at 4, 45 s per file.

### 2. The preload boundary for drop — upstream got this right ⭐

`remote.resolveDrop` **resolves paths inside preload** via `webUtils.getPathForFile(file)` and
refuses to accept path strings from the renderer. Upstream's own comment states the reason:
accepting renderer-supplied paths "would turn this into an arbitrary local-file upload capability if
renderer content were ever compromised." Main additionally gates every call on
`ownsLiveSurface()` — the surface must have a live PTY **and** be owned by the calling
`webContents`. Pinned by `tests/unit/remote-preload-boundary.test.ts`.

### 3. `report_command` — the full command line now crosses the pipe ⚠️→✅

The preexec hooks report a command line to the V1 pipe so the detector can see `ssh host` the
instant it is submitted. Two mitigations, both present:

- The shell integrations **only report when the command's basename is `ssh`/`ssh.exe`** (bash `case`,
  PowerShell regex). Nothing else is transmitted.
- `src/main/index.ts` **explicitly does not forward `report_command` to any renderer** — upstream's
  comment names the risk (`curl -H 'Authorization: …'`, a psql URL with a password) and returns
  before the broadcast. The value is consumed in-process by the detector only.

This is a **net privacy improvement** in shape over what a naive implementation would have been, and
the payload stays on the local named pipe.

### 4. Markdown sanitize extracted to `markdown-utils.renderMarkdown()`

Moved out of the component so the policy is unit-testable (`tests/unit/markdown-sanitize.test.ts`,
the reason jsdom was added). Same policy as before — `USE_PROFILES: {html:true}`,
`FORBID_TAGS: style/form/input/button/textarea/select`, `FORBID_ATTR: style` — now pinned by tests
and running on a **newer DOMPurify**. Strictly better than 1.8.0. `shell.openExternal` in main still
refuses anything that is not `http://` / `https://`.

### 5. Window transparency / frameless

No `webPreferences` weakening: `nodeIntegration`, `contextIsolation`, `sandbox`, `webSecurity` and
`webviewTag` are untouched. The additions are `transparent`, `frame:false` and `backgroundColor`,
plus `WINDOW_CLOSE_SELF` / `WINDOW_RELAUNCH` IPC for the renderer-drawn caption buttons — both
scoped to the sender's own window (`BrowserWindow.fromWebContents(e.sender)`).

### 6. `node-runtime.ts` / `system32.ts` / cli-bin shims

Resolve a JS runtime for the CLI instead of assuming bare `node` on PATH (#187). Candidate
directories are derived from `%ProgramFiles%` / `%LOCALAPPDATA%` / `%USERPROFILE%` and joined with
`path.join` — no PATH search, no shell. `system32()` pins `%SystemRoot%\System32`, the same pattern
the 1.7.0 zip-updater review already accepted.

## Fork-specific risk carried forward ⚠️

**The portable-zip self-updater still points at `amirlehmam/wmux`, and `C:\tools\wmux` is a portable
zip extract.** Unchanged from the 1.8.0 manifest:

- Still **inert today**: `compareVersions('1.13.0', '1.13.0-local.1')` → `[1,13,0]` vs `[1,13,0,1]`
  is ≤ 0, so `resolvePortableZipTarget()` throws `NO_UPDATE`. It stops being inert the moment
  upstream ships **1.14.0**.
- **`WMUX_DISABLE_UPDATER=1` is still set at neither User nor Machine scope on this machine**
  (re-checked during this sync). `CLAUDE.md` records the updater as disabled; it is not.
  **Recommended, again:** set it as a User environment variable.

## Behaviour change worth knowing about

`remote.uploadOnPaste` and `remote.uploadOnDrop` default to **true**. Pasting a screenshot or
dropping a file into a pane that is inside `ssh` now silently scp's it to that host (into
`/tmp/wmux-drop-…`, mode 700) rather than typing a local Windows path. Hold Shift on a drop to
invert per-drop, or set either key to `false` under `[remote]` in the user config to restore the old
behaviour.

## Test failures (environmental, not from this range)

1. `pty-manager.test.ts › resolveExistingShellPath › skips WindowsApps aliases and finds a real file
   for pwsh` — **environmental.** This machine has only the WindowsApps `pwsh.exe` alias
   (`%LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe`) and no real PowerShell 7 install, so the
   function correctly skips the alias and finds nothing. **Reproduced identically on `master` at
   `73a2196` before the merge.** The 1.8.0 sync recorded the same failure.

## Conflicts resolved during the merge

| File | Resolution |
|---|---|
| `README.md` | **Ours.** The fork deliberately replaces upstream's full README body with a pointer to it; upstream's changes in this range land inside the region we removed. |
| `package.json` / `package-lock.json` | Version set to `1.13.0-local.1` — new upstream base, so `N` resets to 1. |
