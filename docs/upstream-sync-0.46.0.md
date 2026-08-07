# Upstream Sync Manifest — 0.44.0 → 0.46.0 (2026-08-07)

**Range:** `bd0aff0..9fdf052` (`amirlehmam/wmux` master) — 2 commits, 22 files, +1,488 / −28 lines.

## Verdict: ✅ CLEAN — merged into `production/local` as `0.46.0-local.1`

| Gate step | Result |
|---|---|
| Dependency diff | **Zero** new/changed packages — lockfile diff is the version field only (0.44.0 → 0.46.0). No supply-chain surface. |
| `npm audit` delta | Identical to prior baseline (9 pre-existing advisories, all undici under node-gyp dev toolchain). Nothing newly introduced. |
| gitleaks | Not installed on this machine; full 2-commit diff hand-read instead — no secrets. |
| Full-diff review | No malicious code, no new network egress, no eval/exec/obfuscation. No hot-spot files touched (`claude-context.ts`, `updater.ts`, `cdp-proxy.ts`, `pty-manager.ts`, `agent-integration.ts` all unchanged). New `user-locales.ts` reads only `~/.wmux/locales/*.json` with defensive ceilings (50 files, 1 MB each, base-tag filename regex, per-file error isolation); renderer merge drops keys not present in the English dictionary, so user JSON can only supply plain strings for known keys, rendered as React text nodes. New sync IPC channel (`locales:get-all-sync`) and pipe method (`locales.get`) are read-only. |
| Tests | master: 792/794 first run (2 timeouts under parallel load, both pass in isolation — pty-manager, orchestration-status-vocab; pre-existing flakes, unrelated to the diff). Merged `production/local`: **800/801, the 1 timeout passes in isolation**; `build:main` + `vite build` clean. |

## What's coming in (functional manifest)

- **Korean (한국어) bundled locale** (#147): full 550-key translation, registered in the i18n table.
- **Community translation files** (#147): drop `<code>.json` into `~/.wmux/locales/` to add a
  language or override individual strings of a bundled one; live-applies on `wmux reload-config`.
  New CLI: `wmux locales [list|reload|path]` reports what loaded and why files were rejected.
  Settings → General now points at the directory. Registry rebuilds are total (bundled languages
  can never be removed by a broken user file); persisted-language guard now validates against the
  merged registry so a user-defined language survives restart.

## Fork-side merge notes
- Conflicts: package.json/package-lock only (version → `0.46.0-local.1`).
- No fork-local follow-up needed — the new `locales` CLI command slots into `COMMAND_SPECS`
  upstream; fork-local `a2a` registration untouched.
- Released: https://github.com/tawman/wmux/releases/tag/v0.46.0-local.1
