# Upstream Sync Manifest — 2.7.1 → 2.9.0 (2026-09-02)

**Range:** `1a4af37..e95c2a3` (`amirlehmam/wmux` master) — 9 commits, two upstream
releases (2.8.0 on 2026-09-01, 2.9.0 on 2026-09-02), 56 files, +3457 / −282 lines.

## Verdict: ✅ CLEAN — merged into `production/local` as `2.9.0-local.1`

| Gate step | Result |
|---|---|
| Dependency diff | **None.** The only `package.json` / `package-lock.json` change in the range is the `2.7.1 → 2.9.0` version bump (lock diff is four lines, all version strings). No dependency added, removed, or bumped. |
| `npm audit` delta | **Zero new advisories.** `npm ci && npm audit` on the fast-forwarded `master`: 1 moderate (`@xmldom/xmldom`, dev toolchain), which is the pre-existing baseline — the tree is byte-identical to 2.7.1's. |
| New network egress | **One, reviewed and accepted.** `src/main/changelog.ts` (#211) does a `net.request` GET to `https://api.github.com/repos/amirlehmam/wmux/releases` **only when the user opens Settings → Changelog** (component mounts on tab select; nothing at startup). No `Authorization` header, no token plumbing, repo owner/name are constants — the renderer passes only a `refresh` boolean over IPC, so a compromised renderer cannot redirect it. Response is cached to `%APPDATA%\wmux\cache\releases.json` (inside wmux's own dir — outside the #132 consent gate by design). Bodies capped at 40k chars, drafts filtered. |
| Rendering of fetched notes | Goes through the existing `renderMarkdown` → **DOMPurify** boundary (`FORBID_TAGS: style/form/input/button/textarea/select`, `FORBID_ATTR: style`), same path MarkdownPane uses. "Open on GitHub" routes through `openInWmuxBrowser` (panel or `system.openExternal`), not a raw anchor. The pre-existing `UPDATE_OPEN_RELEASE` handler still whitelists `https://github.com/`. |
| Process spawning | **No new spawn sites in main.** `agent-manager.ts` now hands the agent command to `ptyManager.create({ startupCommands })` instead of typing it after a sniffed prompt; the fallback sniffer regex was widened to tolerate OSC 133 / CSI trailers. Same PTY, same command, different delivery. |
| `claude-context.ts` (config injection) | Only change: `async: true` added to the PreToolUse / PostToolUse / UserPromptSubmit hook entries wmux writes into `~/.claude/settings.json`. Commands are unchanged (`node "<hook>" …`). SessionStart/Stop/SessionEnd stay synchronous. |
| `pipe-server.ts` | Refactor of the same auth/parse logic into `stripAuthPrefix` / `parseV1Args` (byte-for-byte same rules: `ping` public, everything else needs the per-instance token). Behavioural change is transport-only: replies now `socket.destroy()` after the write to dodge libuv's 50 ms named-pipe `eof_timeout`. Pending-request counter guards against closing on a chunk that carried two lines. |
| `pty-manager.ts` | `resolveSpawnCwd` never returns `undefined` any more; the no-directory case falls to `%USERPROFILE%` instead of inheriting wmux.exe's cwd (`C:\Windows\system32` after an OS relaunch). |
| `quit-sequence.ts` (new) + `index.ts` will-quit | Pure decision function + handler: hold quit ~250 ms after `killAll()` so ConPTY exit callbacks land, then `app.exit(0)`. Adds a `process.on('uncaughtExceptionMonitor')` logger (observe-only; message truncated to 200 chars, no stack, so no paths/usernames reach `main.log`). |
| `session-persistence.ts` | `saveSession` now does a single `renameSync` over the live file (libuv uses `MOVEFILE_REPLACE_EXISTING`), with the old unlink-then-rename as fallback on a sharing violation. Closes the "no session.json on disk" window. |
| `user-config.ts` | New `[workspace] panes/layout` (clamped 1–8) and `[browser] default-url` (scheme required; `about:` allowed). Validation-only, no I/O change. |
| Shell integration (`.ps1` +233, `.sh` +31) | Git report collapsed to one `git --no-optional-locks status --porcelain=v2 --branch`. PowerShell runs it on an in-process runspace worker; git resolved to `$env:ProgramFiles\Git\mingw64\bin\git.exe` when present (absolute path under Program Files), else bare `git`. Worker script is built from the session's own function bodies; no new network, no new files. `resources/shell-integration/` mirror verified byte-identical to `src/`. |
| Orchestrator plugin | `on-tool-use.sh` now exits before sourcing anything unless `WMUX_AGENT_ID` is set. Plugin 0.1.3. |
| Preload / IPC surface | One new channel, `changelog:get`, read-only, takes `{refresh?: boolean}`. |
| Secrets scan | gitleaks / semgrep / trivy not installed. Substituted a pattern sweep of every added line under `src/` + `resources/` for `fetch(` / `http(s)://` / `net.request` / `WebSocket` / `child_process` / `exec` / `spawn(` / `eval(` / `new Function` / `shell.openExternal` / `require(` / `import(`. Hits: the changelog GET above, and `http://localhost:3000` placeholder/hint strings. Nothing else. |
| Binary assets | **None.** |
| Tests | **2677 pass** (6 skipped) on the fast-forwarded `master`, full suite. Seven failures in three files, none merge-caused: the `pty-manager` `resolveExistingShellPath('pwsh.exe')` test is the pre-existing environmental failure recorded in every manifest since 1.14.0 (WindowsApps pwsh alias); the three `orchestration-status-vocab` failures and the three **new** `pipe-client-latency` failures (a 45 ms exit budget measured at ~279 ms under full-suite parallelism) both pass when their file is run in isolation — TMPDIR contention and CPU contention respectively. A first cold run showed two extra transient timeouts that did not recur. All other new tests in the range (`changelog`, `quit-sequence`, `workspace-defaults`, `user-config`, `git-branch-report`, `pipe-server`, `session-persistence`, `explorer-show-hidden`, `agent-manager`) pass. |
| Build | `build:main` (tsc) clean; `verify:resources` green (upstream refreshed `resources/cli/wmux.js` in `b1be37f`, so no fork resync was needed). `scripts/pack-local.sh` → `release/wmux/` + `release/wmux-2.9.0-local.1-win-x64.zip`; app.asar **35M** (34M at 2.4.0), node-pty prebuilds unpacked, rcedit `FileVersion 2.9.0`. Markers grep-confirmed inside the packed asar: `planQuit`, `uncaughtExceptionMonitor`, `CHANGELOG_GET`, `PTY_EXIT_DRAIN_MS`, `api.github.com/repos` (main); `settings.changelog.*`, `explorerShowHidden`, `newWorkspacePanes`, `defaultUrl` (renderer); `async: true` in `claude-context.js`; `client.destroy()` ×4 in `resources/cli/wmux.js`; the `WMUX_AGENT_ID` early exit in `on-tool-use.sh`; `porcelain=v2` in the PowerShell integration. Staged for install as `C:\tools\wmux-build-20260902112932` (swap with `C:\tools\swap-wmux.cmd` after fully exiting wmux). |

## What this range actually is — the inbound release notes, condensed

### 2.8.0 (2026-09-01)

- **The `0xc0000409` abort is a shutdown race, not a runtime crash (#214).** All six
  reported aborts sat on a `will-quit` line in the reporter's own `main.log`. Cause:
  `killAll()` fires one node-pty ConPTY exit callback per pane and the process walks
  straight into Node's environment teardown; whichever callback loses throws into
  `__fastfail(7)`. Mitigation: quit drains ~250 ms then leaves via `app.exit()`. Root
  cause is upstream in node-pty (microsoft/node-pty#954); wmux ships prebuilts and
  cannot fix it downstream.
- **Three things that made #214 worse, fixed:** panes no longer start in
  `C:\Windows\system32` after an OS relaunch (Claude Code was filing transcripts there,
  so `claude --continue` found nothing); `session.json` is never absent from disk
  during a save (sessions stopped coming back with fresh ids and lost tab names);
  `wmux crash-report` now prints `during: shutdown` with the delta.
- **Configurable new-workspace shape (#212).** `[workspace] panes = 1-8`,
  `layout = grid|columns|rows|left|down|single`, also in Settings → Workspace.
  `grid` at 3 is the T that always shipped, so the sidebar `+` is unchanged.
  **Behaviour change:** `wmux new-workspace` now opens 3 panes, not 1 — use
  `--panes 1` in scripts that depended on one.
- **Browser start page (#212).** `[browser] default-url`, also in Settings → Browser.
  Scheme required. Also fixes restored workspaces opening a blank browser panel.
- **Settings → Changelog (#211).** Release notes in the app, cached for offline,
  installed version marked. (On the fork the "installed" badge will not light up:
  `2.9.0-local.1` ≠ any upstream tag. Cosmetic.)
- **Explorer hidden-file toggle persists per workspace (#213).**

### 2.9.0 (2026-09-02) — performance

Started from "why is Claude Code in a PowerShell pane slower than WSL": a `true`
through the Bash tool measured 1557 ms, of which the shell was 57 ms. The rest was
dead waiting, each piece fixed with its number:

- **60 ms of pure timer off every pipe round trip.** Clients used `end()`, the server
  never closed, libuv on Windows arms a 50 ms `eof_timeout` on a half-closed named
  pipe. Now write-then-destroy server-side, destroy-on-first-reply client-side.
  `wmux ping` 96 → 40 ms; a hook process 95 → 33 ms. The server change reaches every
  already-installed client.
- **wmux's per-tool-call hooks are `async: true`.** Claude Code was waiting 125-145 ms
  per hook on the critical path of every tool call for observers that never block.
  Ordering safety was already there (#151 wall-clock dedupe). Picked up on next launch.
- **PowerShell prompt 55 → 1.4 ms per Enter.** One git spawn instead of two, on a
  runspace worker, `--no-optional-locks` so a background status never leaves
  `.git/index.lock` in front of your `git commit`. bash 64 → 34 ms.
- **`wmux agent spawn` no longer waits 1.5 s.** The prompt sniffer had silently stopped
  matching since OSC 133 landed in 2.4.0; the command now rides the startup-commands
  path. First output 1.71 → 0.56 s.
- **Orchestrator PostToolUse hook** leaves before sourcing anything unless
  `WMUX_AGENT_ID` is set (was 133 ms on every tool call of every session).
- **Checked and deliberately NOT changed:** Defender exclusions, leaving OneDrive / Dev
  Drive, `core.fsmonitor`, PS 5.1 / `-NoProfile` — none moved a tool call. Floor of a
  Bash tool call on native Windows is 26-36 ms + 13-15 ms per extra process (MSYS2
  fork). If sessions still feel slow, look at third-party synchronous hooks and an
  `npx`-based statusline in `~/.claude/settings.json`.
- Test-only follow-up: pipe exit budget pinned at 45 ms, below libuv's 50 ms.

## Fork resolution notes

- **Version:** upstream base changed to `2.9.0`, so the `-local.N` counter reset to `1`
  → `2.9.0-local.1`. Resolved the version-line conflicts in `package.json` /
  `package-lock.json` (the only conflicts). `CLAUDE.md` auto-merged.
- **`resources/cli/*.js`:** auto-merged cleanly; `verify:resources` confirms the checked-in copies match a fresh `dist/cli` build, so no fork resync commit this time.
- **Things to know after installing:** the async hook flag lands in
  `~/.claude/settings.json` on next launch; `wmux new-workspace` now opens 3 panes.
