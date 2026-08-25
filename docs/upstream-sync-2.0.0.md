# Upstream Sync Manifest — 1.14.0 → 2.0.0 (2026-08-25)

**Range:** `9cd6177..31deabb` (`amirlehmam/wmux` master) — 10 commits, one upstream
release (2.0.0), 68 files, +5867 / −62 lines.

## Verdict: ✅ CLEAN — merged into `production/local` as `2.0.0-local.1`

| Gate step | Result |
|---|---|
| Dependency diff | **None.** The only `package.json` / `package-lock.json` change in the range is the `1.14.0 → 2.0.0` version bump. No dependency added, removed, or bumped — the lock diff is four lines, all version strings. |
| `npm audit` delta | **Passes by inspection.** The dependency tree is byte-identical to the 1.14.0 baseline, so `npm audit` cannot surface any advisory not already present. |
| Main-process surface | **Additive.** The audit's hot spots — `claude-context.ts`, `updater.ts`, `cdp-proxy.ts`, `pty-manager.ts` — are all outside the diff. New files (`agent-argv.ts`, `agent-identity.ts`, `detection-rpc.ts`, `detection-store.ts`, `user-manifests.ts`) plus edits to `index.ts`, `ipc-handlers.ts`, `agent-state*.ts`, `ssh-detect.ts`. |
| Egress / exec / eval sweep | gitleaks / semgrep / trivy not installed on this machine. Substituted a pattern sweep of the whole `src/main` + `src/shared` + `src/cli` + `src/preload` diff for `child_process` / `exec` / `eval` / `fetch` / `http` / `net.request` / `WebSocket` / `writeFile` / `shell.openExternal`. **One benign hit:** `process.env.WMUX_SURFACE_ID` in the CLI. Zero network egress, zero process spawning, zero eval, zero fs writes outside wmux's own userData. |
| `ssh-detect.ts` (security boundary, +109) | Additive only. Classifies coding-agent processes off the **process name** while piggybacking the existing `Win32_Process` PowerShell sweep — no new spawn, the ~550ms probe is shared. Honors the documented precedence rule (the probe may only corroborate an authoritative layer, never establish one) and explicitly refuses foreground guesses (Windows has no `tpgid`). |
| `user-manifests.ts` (new, +199) | Reads only `*.json` from wmux's own `app.getPath('userData')/agent-detection`. No writes, no exec. User-supplied detection regex is bounded by `LIMITS` and screened through `isSafeRegexSource` (ReDoS guard) in `src/shared/detection/engine.ts`. |
| Preload / IPC surface | New bridges are **read-only** (`agentState.list`, `agentIdentity.onUpdate/list`, `agentDetection.report/manifests`, `window.flash`). Sensitive data stays in main by design: the derived agent KIND crosses to the renderer, but the **command line never leaves main**, and screen text is classified renderer-side and only the **verdict** is reported back. |
| Binary assets | **None.** All 68 files are `.ts` / `.tsx` / `.css` / `.md` / `.txt` fixtures. |
| Tests | **1768 pass** (6 skipped). Three full-run failures, none merge-caused: the `pty-manager` `resolveExistingShellPath('pwsh.exe')` test is the same pre-existing environmental failure recorded in the 1.14.0 manifest (pwsh not resolvable in this shell's PATH); the two `orchestration-status-vocab` failures pass when the file is run in isolation (TMPDIR state contention under full-suite parallelism). All **212** new detection/agent tests pass. |
| Build | `build:main` (tsc) clean; `verify:resources` green (upstream shipped a matching `resources/cli/wmux.js`; the only local diff vs `dist/cli` is CRLF, which the check normalizes). |
| `verify:resources` | **Green.** Upstream touched `src/cli/wmux.ts` this range but kept `resources/cli/wmux.js` in step, so no fork resync was required. |

## What this range actually is

One major feature release: **agent visibility (2.0.0)**. wmux stops being a passive
multiplexer and becomes aware of which coding agent runs where and what it is doing.

- **Cross-workspace agent roster + navigator** — a banner and a jump-to-blocked
  navigator so a user with many panes can find the agent waiting on them
  (`AgentRosterBanner.tsx`, `AgentNavigator.tsx`, `agent-rollup.ts`, `focus-agent.ts`).
- **Per-pane agent identity** — which agent (claude / codex / opencode) occupies each
  pane, derived in main (`agent-identity.ts`, `agent-argv.ts`) and surfaced on the tab
  bar and workspace rows. The command line stays in main; only the derived kind crosses.
- **Screen detection** — a manifest-driven engine (`src/shared/detection/`) that reads
  each pane's xterm buffer renderer-side and reports a working/idle/blocked verdict for
  agents that don't self-report state. User-extensible via JSON manifests in wmux's
  userData, bounded and ReDoS-guarded.
- **Blocked alert** — taskbar flash + sidebar signal when an agent starts waiting
  (`blocked-alert.ts`, `useBlockedAlert.ts`, `window.flash`).

New shared surface: `src/shared/detection/{engine,types,manifests/*}` and 22 lines added
to `src/shared/types.ts` (new IPC channels for agent-state/identity/detection).

## Fork resolution notes

- **Version:** upstream base changed to `2.0.0`, so the `-local.N` counter reset to `1`
  → `2.0.0-local.1`. Resolved the version-line conflicts in `package.json` /
  `package-lock.json`; `CLAUDE.md`'s `**Version**:` auto-merged to `2.0.0`.
- **README.md:** kept the fork's slimmed pointer README (`--ours`) rather than
  re-absorbing upstream's full feature-list README, which the fork intentionally
  replaced with a link to the upstream README.
