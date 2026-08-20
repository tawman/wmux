# Upstream Sync Manifest — 1.5.1 → 1.6.0 (2026-08-20)

**Range:** `cba4f56..71e89a0` (`amirlehmam/wmux` master) — 10 commits, one upstream release
(1.6.0), 29 files, +2459 / −99 lines.

## Verdict: ✅ CLEAN — merged into `production/local` as `1.6.0-local.1`

| Gate step | Result |
|---|---|
| Dependency diff | **Zero** new/changed packages. The `package-lock.json` diff is four lines, all the version field (1.5.1 → 1.6.0). No advisory can originate in this range. |
| `npm audit` delta | **Nothing attributable.** 10 advisories (8 high / 2 moderate) — the same dev-toolchain set as the 1.5.1 baseline (`undici` via `node-gyp`, `tar`, et al.). Identical dependency tree ⇒ identical audit. |
| Main-process surface | **Untouched.** `git diff --stat cba4f56..71e89a0 -- src/main src/cli src/preload` is **empty**. Every hot spot the fork's gate names — `claude-context.ts`, `updater.ts`, `cdp-proxy.ts`, `pty-manager.ts` — is byte-identical to what we already ship. |
| gitleaks / semgrep / trivy | Not installed on this machine. Substituted a pattern sweep of every added line for `fetch(` / `http(s)://` / `ws(s)://` / `child_process` / `exec*` / `spawn(` / `eval(` / `Invoke-WebRequest` / `Invoke-Expression` / `Start-Process` / `curl` / `iwr` / `shell.openExternal`, plus a secret-shape sweep (`api_key`, `secret`, `token =`, `BEGIN … PRIVATE KEY`, `ghp_`, `github_pat_`, `sk-…`). **One hit total, benign:** `execFileSync` in a new *test* file. Zero secret matches. |
| Full-diff review | No malicious code. The functional change is confined to the renderer plus the PowerShell shell-integration script — see below. |
| Binary assets | **None.** No image, archive, or binary blob added or changed in this range. |
| Tests | **1241/1248 pass** (6 skipped). One failure, pre-existing and environmental — see below. |
| Build | `build:main` (tsc) and `vite build` both clean. |
| `verify:resources` | **Green.** Upstream changed `src/shell-integration/wmux-powershell-integration.ps1` and its `resources/` copy identically, so no drift. |

## What this range actually is

One release, **1.6.0**, carrying two PRs plus loose fixes:

- **PR #183 — saved workspace layouts.** Capture a live workspace's pane geometry (plus each
  pane's shell / cwd / startupCommands) as a named preset, apply it on demand or as the default
  for every new workspace. New `SavedLayout` type, `savedLayouts` in the settings slice
  (localStorage-persisted), `instantiateLayout()` in `split-utils.ts`, UI in `WorkspaceSettings`
  and two new Command Palette entries.
- **PR #182 — the PR badge stops getting stuck.** Casing fix in `PrStatusIcon`, ownership-gated
  `report_pr`/`clear_pr` handling extracted into a new pure `pr-metadata.ts`, and a substantially
  rewritten PowerShell PR poller.
- Loose: `matchesBinding` exported for testing, an `onClick`→`onMouseDown` popup fix, a dropped
  unused `uuid` import.

## The changes that needed verifying

**1. `wmux-powershell-integration.ps1` — +255 lines, the largest single change and the only one
touching code that runs outside the renderer sandbox.** Read in full. It is a genuine bug fix, not
a payload:

- The PR poller runs in a `Start-Job` child runspace, which keeps the location it was created in
  forever — so a pane that `cd`s into another repo kept being answered for the first one. The fix
  is a **shell-to-shell hand-off file**, `<temp>\wmux\cwd-<surfaceId>.txt`, written by the prompt
  and read by the poller each tick. Same directory `wmux-bash-integration.sh` already uses.
- **Where it writes:** `[System.IO.Path]::GetTempPath()\wmux` only. No writes outside temp, no
  registry, no profile modification.
- **What it sends:** the same V1 pipe line as before (`report_pr …`, now also `clear_pr …`), over
  the same local `NamedPipeClientStream(".", "wmux")` with the same `auth $pipeToken` prefix.
  **No new destination, no network, no new external process.** The only commands invoked remain
  `git rev-parse` and `gh pr view --json number,state,title` — unchanged from before.
- Stale hand-off files (from panes that were killed rather than closed) are swept by
  `Remove-StaleWmuxCwdFiles`, filtered to `cwd-*.txt` under that one directory and to files older
  than a day. Bounded, no recursion, no user-supplied path.
- `Resolve-WmuxPaneCwd` refuses anything doubtful (missing/empty/unreadable file, or a path that
  is not a real directory) rather than falling back to a stale guess.
- The decision functions are shipped into the job via `[scriptblock]::Create(...)` interpolating
  `${function:...}` — string-built code, which the sweep flags on shape. It composes **only**
  this file's own three function bodies, no external or attacker-controlled input, and exists
  because a job runspace sees none of the session's functions. Legitimate.

**2. `pr-metadata.ts` (new) — ownership gating.** Every PowerShell pane in a workspace polls and
they all write the same workspace-scoped fields, so `ws.prSurfaceId` now records who owns the row
and a `clear_pr` is honoured only from that surface. Pure, fully unit-tested, no I/O.

**3. `split-utils.ts` / `workspace-slice.ts` / `surface-slice.ts` — layout instantiation.**
`instantiateLayout()` re-mints every pane/surface id when a saved layout is applied, which is
required: a persisted `splitTree`'s ids are stale the instant it is saved, and two workspaces
sharing a surface id would break PTY re-attachment (PTY ID = Surface ID). Reviewed and correct.

**4. `useTerminal.ts` — `clearPrForSurface(id)` on `pty:exit`.** Three lines, alongside the
existing stuck-badge and stuck-progress heals. Ownership-gated inside, so it is a no-op for any
pane that wasn't holding the badge. This is deliberately where the badge is dropped rather than in
a shell exit handler, because a pane killed with Ctrl+W runs no exit handler at all.

**5. `SavedLayout` persistence.** Saved layouts land in `localStorage` under
`wmux-saved-layouts` and capture each pane's shell, cwd, and startupCommands. That is the feature
working as designed, but worth recording: **a saved layout is a plaintext record of local paths
and any startup commands configured on those panes.** No credential surface, nothing transmitted.

## The one test failure — pre-existing, environmental, not a regression

`tests/unit/pty-manager.test.ts > resolveExistingShellPath > skips WindowsApps aliases and finds a
real file for pwsh` fails at `expect(resolved).toBeTruthy()` — **exactly as recorded in the 1.5.1
manifest**, for exactly the same reason.

Provably not this merge:

```
$ git diff --stat cba4f56..71e89a0 -- src/main/pty-manager.ts tests/unit/pty-manager.test.ts
(empty)
```

Both the code under test and the test itself are byte-identical across the range. The cause is
unchanged machine state: `where pwsh.exe` returns only
`C:\Users\toddw\AppData\Local\Microsoft\WindowsApps\pwsh.exe` (the Store alias, `existsSync` false
under EACCES), and `%ProgramFiles%\WindowsApps` is not enumerable unelevated, so `findStorePwsh`
returns `undefined` and resolution comes back empty. See the 1.5.1 manifest for the full trace.

**Consequence, unchanged:** `getDefaultShell()` falls through to `powershell.exe`, so a default
pane on this machine gets Windows PowerShell 5.1 rather than pwsh 7 unless a shell is configured
explicitly.

The upstream-PR follow-up noted in the 1.5.1 manifest — make the test skip when no non-Store
`pwsh` is on PATH *and* `%ProgramFiles%\WindowsApps` is not enumerable — **is still open**.

## Merge

```
git checkout master && git merge --ff-only upstream/master     # cba4f56..71e89a0
git checkout production/local && git merge master
```

| File | Resolution |
|---|---|
| `package.json`, `package-lock.json` | Version → `1.6.0-local.1` (new upstream base, so the local counter resets to 1). Both root `version` fields only — verified the lockfile diff is exactly those two lines and no dependency entry was touched. |

`CLAUDE.md` auto-merged, taking upstream's `**Version**: 1.6.0` line while keeping the fork's
"Fork Build on production/local" section intact. No `README.md` conflict this time.

**Lockfile caution worth recording:** resolving the version conflict with a blind
`"version": "1.6.0"` → `"1.6.0-local.1"` substitution across `package-lock.json` also rewrote two
*dependency* entries that happened to be at 1.6.0 (`get-east-asian-width`, `sax`). Caught by
reading the diff before committing. Edit the two root `version` fields specifically, then confirm
the lockfile diff is exactly two lines.

## Packaging

No new runtime resource in this range, so the step-4 resource guard in `pack-local.sh` needed no
additions — the three defects fixed during the 1.5.1 sync (stale agent instructions, missing
`icon.ico`, incomplete `resources/cli/` closure) stay fixed and are re-asserted by the packer on
every run.
