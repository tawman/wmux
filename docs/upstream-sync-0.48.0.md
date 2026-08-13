# Upstream Sync Manifest — 0.46.0 → 0.48.0 (2026-08-12)

**Range:** `9fdf052..fae21a5` (`amirlehmam/wmux` master) — 2 commits, 27 files, +1,156 / −59 lines.

## Verdict: ✅ CLEAN — merged into `production/local` as `0.48.0-local.1`

| Gate step | Result |
|---|---|
| Dependency diff | **Zero** new/changed packages — the `package-lock.json` diff is the version field only (0.46.0 → 0.48.0); the dependency tree is byte-identical. No supply-chain surface. |
| `npm audit` delta | **Nothing attributable to this sync.** Current tree: 10 advisories (8 high / 2 moderate) across `brace-expansion`, `concurrently`, `dompurify`, `fast-uri`, `js-yaml`, `nanoid`, `postcss`, `shell-quote`, `tar`, `undici` — all dev-toolchain. The rise from the 0.46.0 baseline (9) is **advisory-database drift against a frozen lockfile**, not new code: with an identical dependency tree, no advisory here can originate in this diff. |
| gitleaks / semgrep / trivy | Not installed on this machine. Substituted a hand-read of the full 2-commit diff plus a pattern sweep of every added line for `fetch`/`http(s)`/`ws`/`child_process`/`exec*`/`eval`/`Function()`/`shell.openExternal`, secret shapes (`api_key`, `sk-…`, `ghp_`, `AKIA…`, PEM headers) and external URLs — **zero hits in all three categories**. |
| Full-diff review | No malicious code, no new network egress, no obfuscation. Hot spots reviewed individually — see below. |
| Tests | 841/842. The single failure (`orchestration-status-vocab`) is the **known pre-existing flake** recorded in the 0.46.0 manifest — a 15 s timeout under parallel load; **passes 9/9 in isolation**. |
| Build | `build:main` (tsc) and `vite build` both clean. |
| Lint | Errors **unchanged at 17** vs. the pre-merge tree (all pre-existing `no-empty` / `no-control-regex` debt in `App.tsx` / `useTerminal.ts`). Merge adds 2 warnings only: redundant `eslint-disable @typescript-eslint/no-var-requires` directives in the two new files, matching the identical pattern already in `claude-context.ts`, `opencode-context.ts`, `pty-manager.ts`, `theme-loader.ts`. |

### Hot-spot findings (all four touched this round — none benign by default)

- **`claude-context.ts`** — registers **four additional Claude Code hooks** (`SessionStart`,
  `UserPromptSubmit`, `PreToolUse`, `SessionEnd`) in `~/.claude/settings.json`, taking wmux from 4
  to 8. All invoke the same local `wmux-hook.js` over the named pipe; `WMUX_HOOK_EVENTS` was
  extended in step with them, so `removeWmuxHooks` still reaches every one (no #132 orphans).
  Reviewed for exfiltration specifically because `UserPromptSubmit` fires on every human message:
  the helper only ever forwards `event` / `tool` / `file` / `message` / `at`, and Claude Code's
  `UserPromptSubmit` payload carries the prompt in `prompt`, **not** `message` — so prompt text is
  never read or transmitted. `PreToolUse` is registered matcher-less and reads `tool_name` off
  stdin. Destination is `\\.\pipe\wmux` only.
- **`kiro-context.ts` (new)** — writes `~/.kiro/steering/wmux.md`, a third home-directory write
  path. Gated behind the existing `instructions` consent feature, marker-guarded on both write and
  delete (a user-authored `wmux.md` is left alone), content sourced from the same local
  `claude-instructions.md`. No network, no hooks (deliberately — Kiro's are per-project). Note it
  creates `~/.kiro/steering/` even when Kiro is not installed.
- **`pty-manager.ts` / `pty-crash-guard.ts` (new)** — pure robustness hardening for #150.
  Monkey-patches node-pty's `WindowsPtyAgent.prototype._$onProcessExit` in a try/catch and attaches
  `error` listeners so node-pty stops re-throwing out of libuv. Local `require` of a bundled module;
  no I/O of any kind. It does swallow PTY errors by design — the documented trade against the prior
  behaviour, which was the whole window vanishing with no dialog.
- **`ipc-handlers.ts`** — `noteHumanInput` now inspects **every keystroke** on `PTY_WRITE`. Read
  closely for keylogging: `isAnsweringInput` only *classifies* the chunk (strips CSI/SS3, asks
  "printable or Enter?"), and `noteHumanInput` only flips `awaitingHuman`/clears `blockedReason`.
  Keystroke content is never stored, logged, or forwarded.
- **`electron-builder.json`** — adds `resources/opencode-plugin` to `extraResources`. That file is
  unchanged in this range (added in an earlier sync) but was never actually shipped, so this makes
  it effective for the first time; re-read it as newly-live code — it `execFile`s only the local
  wmux CLI and no-ops entirely when `WMUX !== '1'`.

## What's coming in (functional manifest)

- **Agent state reports work *starting*, not only ending** (#151). The original four hooks were all
  terminal, so the stretch from Enter to the first completed tool read `idle` — most of any turn
  that thinks or runs one long command. Adds the opening half of the lifecycle, plus three fixes:
  `SubagentStop` no longer decrements (subagents share the parent's `WMUX_SURFACE_ID`, so the first
  one to finish drained the refcount to 0 while siblings ran); hook reports are ordered by a
  process-start wall-clock stamp (`at`) instead of pipe-arrival, since each hook is its own racing
  process; and typing into a blocked pane clears the block, covering the one case hooks cannot —
  approving a permission prompt for a tool that then runs for minutes with no hook in between.
- **PTY errors no longer kill the app** (#150). 12 silent disappearances between 2026-06-27 and
  2026-08-04, all `0xc0000409` / `FAST_FAIL_FATAL_APP_EXIT`, traced by minidump to a `Napi::Error`
  thrown out of `conpty.node`'s exit callback. Both routes closed.
- **Kiro CLI support** (#148) — `~/.kiro/steering/wmux.md`, consent-gated and removable.
- **`opencode-plugin` actually ships** (#149) — absent from every zip until 0.47.0, so the OpenCode
  integration was silently missing in installs.

## Fork-side merge notes
- Conflicts: `package.json` / `package-lock.json` version fields only → `0.48.0-local.1`.
- `CLAUDE.md` and `src/main/index.ts` auto-merged cleanly; the fork-only "Fork Build on
  production/local" section and the fork's `index.ts` customisations are intact.
- No fork-local follow-up needed: `scripts/pack-local.sh` already copied
  `resources/opencode-plugin` (line 56), so upstream's new packaging requirement was
  satisfied before it arrived.
- ASAR verified post-pack: `kiro-context.js` + `pty-crash-guard.js` present, crash guard wired into
  `pty-manager`, all four new hook events in `claude-context.js`, `noteHumanInput` in
  `agent-state`/`ipc-handlers`, native prebuilds unpacked, `wmux.exe` stamped `0.48.0`.
- Released: https://github.com/tawman/wmux/releases/tag/v0.48.0-local.1
