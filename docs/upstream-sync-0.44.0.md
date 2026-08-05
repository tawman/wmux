# Upstream Sync Manifest — 0.38.0 → 0.44.0 (2026-08-05)

**Range:** `7882751..bd0aff0` (`amirlehmam/wmux` master) — 39 commits, 115 files, +10,123 / −1,128 lines.

## Verdict: ✅ CLEAN — merged into `production/local` as `0.44.0-local.1`

| Gate step | Result |
|---|---|
| Dependency diff | **Zero** new/changed packages — lockfile diff is the version field only. No supply-chain surface. |
| `npm audit` delta | Identical to prior baseline (8 pre-existing advisories, all undici under node-gyp dev toolchain). Nothing newly introduced. |
| gitleaks (39 commits) | **No leaks found.** |
| Full-diff review | No malicious code, no new network egress, no eval/obfuscation. Only new `child_process` use: `execFile('git', args)` in the rewritten diff-provider (no shell), and the orphan reaper's `powershell.exe`/`taskkill.exe` resolved by **absolute System32 path** (PATH-shadowing considered and defended). New `build/installer.nsh` only runs `ie4uinit.exe` for icon-cache refresh (we don't ship NSIS). |
| Tests | master: 754/754 pass. Merged `production/local`: **761/761 pass**, `build:main` clean. |

## What's coming in (functional manifest)

### Major features
- **Declared agent state + back-channel** (#128): panes report blocked/working/idle over the pipe (`report-agent`, `report-metadata`, `report-session`, `release-agent`, `agent-state`); `answer-agent` replies to a blocked pane from outside it. Security posture is strong: answer requires the pipe auth token (test pinned upstream), refuses non-blocked panes, only relays payloads the agent itself declared, choices consumed on use, `blocked` never cleared optimistically. Claude Code drives it with zero install via the existing four hooks (`agent-hook-bridge.ts`).
- **Consent gate for home-directory writes** (#132, `agent-integration.ts`): first-launch prompt before writing `~/.claude/CLAUDE.md`, `~/.claude/settings.json`, plugin cache, `~/.config/opencode`; "Never" removes prior writes; per-feature toggles in Settings. Corrupt consent record falls back to *asking*, not granting. **This addresses a finding from our own fork audit.**
- **PTY orphan reaping across crashes** (#139/#140, `pty-ledger.ts`): spawn-time PID ledger; next launch tree-kills what a crashed instance left. PID-reuse safe — image name + creation time must both match, any probe failure reaps nothing, live-owner check prevents killing another running instance's terminals.
- **CLI caller scoping + flag validation** (#141/#143/#144): commands answer about the calling shell's workspace; unknown flags rejected before any byte reaches the pipe (`wmux split --help` no longer splits a pane).
- **i18n**: full renderer audit; Spanish/Italian/Chinese locales added (#129/#136).
- **Key remaps** (#146): `[keys]` section in `~/.wmux/config.toml`, parsed in main with errors surfaced at load.

### Fixes we care about
- Diff pane: git repo probe cached (a third of the git processes in #141), bounded snapshot walk, no self-restarting poll, responsive on non-git cwds (#133/#135/#138/#142).
- Session: update backup now carries browserUrl/browserWidth/pinned and all windows (#145); mid-run windows no longer clone a named session and attach to live PTYs (#143).
- Hook helper process lifetime ~1049ms → ~101ms (timer held + socket drained).
- Multi-size `.ico` window icon (#137); OSC 9 ConEmu subcommand noise silenced (#127); sidebar resize drag coalesced per frame (#131).

## Fork-side merge notes
- Conflicts: README (kept fork pointer), package.json/package-lock (version → `0.44.0-local.1`).
- Follow-up commit required: register fork-local `a2a` in the new exhaustive CLI `COMMAND_SPECS` table (upstream #143 made the command record exhaustive; `passthrough: true` since a2a's payload is free-form JSON/text).
- Released: https://github.com/tawman/wmux/releases/tag/v0.44.0-local.1 — staged at `C:\tools\wmux-build-20260805103659`, awaiting `swap-wmux.cmd`.
