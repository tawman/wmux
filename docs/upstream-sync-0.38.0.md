# Upstream Sync Manifest — 0.24.0 → 0.38.0 (2026-07-28)

**Range:** `13c70a4..7882751` (`amirlehmam/wmux` master) — 83 commits (68 non-merge), 144 files, +11,086 / −1,114 lines.
**Authors:** Amir (51), Dhyan Soni (4), Connor Robinson (4), Todd A. Wood (3 — our PRs #93/#94 merged upstream), simplyBarbe (2), AvoChang (2), mike (1), Rajveer Vadnal (1).

## Verdict: ✅ CLEAN — merged into `production/local` as `0.38.0-local.1`

| Gate step | Result |
|---|---|
| Dependency diff | **Zero** new/changed packages — only the version field. No supply-chain surface. |
| `npm audit` delta | N/A — dependency tree unchanged, no new advisories possible. |
| gitleaks (67 commits) | **No leaks found.** |
| Full-diff review (3 parallel reviewers) | No malicious code, no new network egress, no eval/obfuscation. Findings below. |
| Tests | master: 511/511 pass. Merged `production/local`: **518/518 pass**, `build:main` clean. |

## What's coming in (functional manifest)

### Major features
- **Markdown edit & save in place** (#116, F3): preview/source/edit modes, Ctrl+S, Save As, drag-drop, mtime conflict detection. New main-process guard layer `markdown-file.ts` + `markdown-grants.ts` (see security notes — unusually careful code).
- **Sidebar agent visibility**: per-agent sub-lines under workspace rows, SubagentStop hook, Workflow-tool agents surfaced, per-surface Claude session tracking (fixes stuck-"Running" with 2 claude panes), agent-exit broadcast (no more ghost running lines). Cap of 32 tracked agents.
- **TRACE mode**: opt-in live "circuit-board" sidebar visualization.
- **"Open in wmux" Explorer verb**: HKCU-only registry entries via `reg.exe` args-array; opt-in in Settings. Win11 shows it under "Show more options".
- **i18n overhaul**: one file per locale typed against English; adds Italian; OS display language default (#114).
- **Per-window session persistence** (#118): multi-window auto-save no longer clobbers itself; auto-backup of session layout before clearing on update (#113); max 8 restored windows.
- **In-app update flow** (#125): titlebar badge → download → confirm → install. *(Inert here: `WMUX_DISABLE_UPDATER=1`.)*
- **Scale-aware icon set** rebuilt from vector; `build-icons.mjs` local rasterizer.
- **Browser fixes**: popup/`target="_blank"` bridge (#126, well-hardened, http/https only), bare `eN` ref resolution (#121/#123), configurable dev-server ports + auto-open opt-out (#115).
- **CLI additions**: `markdown get`, `markdown set --title`, `rename-surface`, V1 latency fix.

### Fixes we care about
- Shift+Enter double-newline; PTY resize crash on exited pty; cwd error-267 fallback (**our** #94); orchestration state.json shape-validation (**our** #93); sidebar TDZ launch crash (0.35.0); session auto-save races.

### Removals
- `git-poller.ts` and `pr-poller.ts` **deleted** — removes the recurring `gh pr view` child process and its network egress. Net posture improvement.
- CI: portable-zip-only → NSIS installer + zip (fixes #96 endless update loop). Manual local releases now ship **without** `latest.yml`.

## Security findings (all reviewers)

**Nothing malicious.** Ranked findings:

1. **Medium (upstream-only, inert for this fork)** — Auto-update Authenticode pin removed. `electron-builder.json` drops the `publisherName: ["SignPath Foundation"]` pin and CI signature verification is now warn-and-ship; update integrity rests solely on `latest.yml` sha512 from the same GitHub release. A compromised upstream repo/release = code exec for auto-updating users. Honestly documented (SignPath fell back to self-signed, stranding updates). **Neutralized here**: updater disabled, manual releases, no feed. Re-review if we ever re-enable updates.
2. **Low** — Badge-click update bypasses the quarantine window (deliberate, still needs confirm dialog). Inert here.
3. **Low** — Renderer can toggle the Explorer verb via IPC (`SYSTEM_SET_CONTEXT_MENU`); mitigations real: HKCU only, `execFileSync` System32 `reg.exe` args-array, command fixed to `process.execPath`.
4. **Low** — Markdown save is the first renderer→disk write path, but well-guarded: per-webContents grants minted only by native dialogs / token-gated pipe, extension whitelist on read *and* write (`.md/.markdown/.mdx/.txt/.text/.rst`), lstat symlink refusal, 5 MB cap, atomic tmp+rename. Residual: lstat→write TOCTOU (needs local FS attacker — negligible); pipe `markdown.load_file` also mints a write grant for that file.
5. **Low/Info** — `MARKDOWN_OPEN_IN_APP` uses `shell.openPath` gated only by the extension whitelist (can't launch programs — ShellExecute by association). `MARKDOWN_READ_FILE` lets the renderer read whitelisted-extension files ≤5 MB (same posture the pipe already had). Preload newly exposes `os.homedir()` string.

## Merge record

- `master` fast-forwarded `13c70a4` → `7882751` (mirror clean).
- Merged into `production/local` (`ec60960`); conflicts resolved: README (kept fork pointer), `package.json`/lock (→ `0.38.0-local.1`), `src/main/index.ts` (union: fork a2a import + upstream markdown/shell-context-menu imports).
- Fork-only delta retained on top: a2a messaging, xterm 6.0, `--replace-tab`, cli-bin PATH shim, Electron 43 pin, security hardening (F-9/F-10), fork docs/release tooling.
- Release: `v0.38.0-local.1` via `scripts/pack-local.sh` → `gh release create` on `tawman/wmux`.
