# Upstream Sync Manifest — 1.0.0 → 1.1.0 (2026-08-14)

**Range:** `7baf230..34478dc` (`amirlehmam/wmux` master) — 19 commits (18 functional + release bump),
46 files, +4,558 / −548 lines.

## Verdict: ✅ CLEAN — merged into `production/local` as `1.1.0-local.1`

| Gate step | Result |
|---|---|
| Dependency diff | **Zero** new/changed packages. The `package-lock.json` diff is four lines, all of them the version field (1.0.0 → 1.1.0); the dependency tree is byte-identical. No supply-chain surface in this range. |
| `npm audit` delta | **Nothing attributable.** 10 advisories (8 high / 2 moderate) across `brace-expansion, concurrently, dompurify, fast-uri, js-yaml, nanoid, postcss, shell-quote, tar, undici` — the same dev-toolchain set as the 1.0.0 baseline. With an identical lockfile no advisory *can* originate here; this is the standing debt, not a regression. |
| gitleaks / semgrep / trivy | Not installed. Substituted a full hand-read of the diff plus a pattern sweep of every added line for `eval` / `new Function` / `child_process` / `exec*` / `spawn` / `fetch` / `http(s).request` / `WebSocket` / `XMLHttpRequest` / `shell.openExternal` and the download forms (`curl`, `wget`, `Invoke-WebRequest`, `iwr`, `DownloadString`), plus secret shapes (`ghp_`, `github_pat_`, `AKIA…`, `xox[baprs]-`, `sk-…`, PEM headers). Hits: the three reviewed below. **No secrets, no obfuscation, no unexplained egress.** |
| Full-diff review | No malicious code. This range is one feature (devcontainer support, issue #19) plus an updater fix (#167) and a packaging invariant (#168/#169). Three items touch the trust boundary and were verified rather than reasoned about — see below. |
| Tests | **1061/1061 pass** on the merged tree (11 skipped). On the pre-merge upstream tree one file (`omp-context`) timed out at 15 s because the fresh `npm ci` had install scripts blocked and the test triggered a lazy Electron binary download; it passes 12/12 in isolation and in the merged run. |
| Build | `build:main` (tsc), `vite build`, and `typecheck` all clean. |
| Lint | Errors **unchanged at 16** vs. the 1.0.0 baseline (pre-existing `no-empty` / `no-control-regex` debt in `useTerminal.ts`, `cdp-proxy.ts`, `App.tsx:247`, `mouse-modes.ts`). None of the four new files (`wsl-network.ts`, `transport-deadline.ts`, and the `wmux.ts` / `wmux-hook.ts` additions) contribute an error. |
| `verify:resources` | New CI gate in this range. Fails on a fresh sync **by design for this fork**: `resources/cli/wmux.js` is a checked-in build artifact, and our `src/cli/wmux.ts` carries the fork-local `a2a` command. Regenerated from our own `dist/cli` in a follow-up commit; gate green after. |

## What this range actually is

Issue #19 — **drive wmux from a devcontainer**. Claude Code running inside a Linux container needs to
reach a wmux on the Windows host. The existing `wmux bridge` (issue #78) already exposes the pipe over
TCP; this range makes it reachable from a container and fixes the hooks and shell integration that
silently no-op'd there. Plus #167 (updater elevation) and #168/#169 (packaging invariants).

## The three changes that needed verifying, not reasoning about

**1. `wsl-network.ts` (new) — when `wmux bridge` may bind `0.0.0.0`.**
The highest-consequence change in the range, and it moves in the **safe** direction. Previously
`--host <anything>` bound with a printed warning and nothing else. Now:

- The new `--wsl` flag wants `0.0.0.0` so a container can reach a bridge inside WSL2. It only picks
  that address after confirming, at runtime, that the distro runs **NAT** networking (`wslinfo
  --networking-mode`), where `0.0.0.0` is the WSL2 namespace — a private 172.x eth0 plus the distro's
  loopback — and not the LAN.
- Under **mirrored** networking the distro shares the Windows host's real interfaces, so `0.0.0.0`
  would be a bind on the corporate LAN and any VPN adapter, gated only by the Hyper-V firewall.
  `--wsl` **refuses to start** there rather than binding.
- `unknown` (WSL older than 2.0.5, `wslinfo` missing, non-zero exit, unrecognised word) is likewise a
  **refusal**, not folded into the NAT default. Failing closed on an unproven answer is the correct
  direction and is explicitly reasoned about in the file's header comment.
- An explicit `--host 0.0.0.0` is still honoured under every mode — a stated choice, warned about but
  not overruled. Unchanged from before.
- Default with no flags is still `127.0.0.1`.
- The bridge grants nothing by itself: the per-instance pipe token still authenticates every V1 and V2
  request end to end (`pipe-server.ts` is unchanged on that path).

Verified on this machine: `--wsl` is opt-in, is never implied by any other flag, and nothing in
startup or the shell integration invokes `wmux bridge`.

**2. `connectViaNpiperelay()` in `wmux.ts` — the CLI spawns a Windows binary from inside WSL2.**
The only new process spawn in the range.

- Gated on `WSL_DISTRO_NAME || WSLENV` being set, and reached only after `--remote` and the
  Unix-socket path are ruled out. On native Windows the selector falls through to the named pipe
  exactly as before — **no behaviour change for our build**, which is the one we ship.
- `spawn(bin, ['-ei', '-s', <pipePath>], …)` — array args, no shell string. The only interpolated
  value is `PIPE_PATH` (wmux's own, or `WMUX_PIPE`), backslash-to-forward-slash normalised.
- `findNpiperelay()` resolves `npiperelay.exe` off `PATH`, then `~/.local/bin`, `/usr/local/bin`,
  `/usr/bin`. **PATH-order resolution of an executable is worth naming**, but it is inside a WSL
  distro the operator controls, running as that operator, and a hostile entry on that PATH is already
  arbitrary code execution independent of wmux. Not exercised by this fork's Windows-side use.
- `scripts/install-npiperelay.sh` is **run by hand, never from startup or a hook** — nothing in
  `src/main/` references it. Its download is properly pinned: it verifies the checksums file against a
  hard-coded SHA-256 *before* trusting it, confirms the pinned binary hash is listed in that file, and
  re-verifies the downloaded binary. Fails closed at each step under `set -euo pipefail`.

**3. `report_startup_command` — a shell declares a command that runs on session restore.**
A V1 verb that stores a string on a surface, later fed to `pty-manager`'s existing `startupCommands`.
Command execution reachable over the pipe deserves the check; the answer is that it grants nothing new:

- V1 is **token-gated**. `pipe-server.ts` writes `unauthorized` and drops any V1 line without a valid
  `auth <token>` prefix, and `report_startup_command` sits in that same guarded switch. Confirmed by
  reading the handler, not inferred from the commit message.
- Anyone holding the per-instance token already has `surface.send_text`, i.e. the ability to type
  anything into any pane. This is not an escalation, it is the same authority spelled differently.
- `startupCommands` is a pre-existing mechanism (quick-launch profiles); this only adds a per-surface
  writer for it.
- Relatedly, `raw-v1` — the new CLI passthrough that lets a containerised shell reach V1 — is
  **allowlisted to six verbs** (`report_pwd`, `report_git_branch`, `clear_git_branch`,
  `report_shell_state`, `ports_kick`, `report_startup_command`) rather than being a generic side door.
  A generic passthrough was explicitly considered and rejected upstream; the restriction is tested
  (`raw-v1-allowlist.test.ts`).

## Remaining hot spots, cleared

- **`updater.ts` (#167)** — adds a write probe of the install root to warn, before download, that
  installing will need admin rights. Creates and removes `.wmux-write-probe-<pid>` in the install dir.
  No new network calls; the updater stays disabled in this fork (`WMUX_DISABLE_UPDATER=1`).
- **`pty-manager.ts`** — appends `WMUX_REMOTE` / `WMUX_REMOTE_TOKEN` to the `WSLENV` passthrough list
  so a devcontainer inherits them. Both are unset in our build, and WSLENV skips valueless variables,
  so this is inert here. Worth noting it means the **pipe token can now cross into WSL** when the
  remote vars are set — already true of `WMUX_PIPE_TOKEN`, which has been on that list for releases.
- **`claude-context.ts`, `cdp-proxy.ts`, `agent-integration.ts`** — **untouched** in this range.
- **`resources/cli/*.js`, `resources/shell-integration/*`** — verified byte-identical to their `src/`
  sources after the resync (that is what #168/#169 and the new `verify:resources` gate enforce).

## Merge

```
git checkout master && git merge --ff-only upstream/master     # 7baf230..34478dc
git checkout production/local && git merge master
```

Conflicts, both trivial and both long-standing fork divergences:

| File | Resolution |
|---|---|
| `README.md` | Kept the fork README, which deliberately defers to upstream's for the full docs. Upstream's 11 added lines are devcontainer usage, already covered by `docs/DEVCONTAINER.md`, which merged in clean. |
| `package.json`, `package-lock.json` | Version → `1.1.0-local.1` (new upstream base, so `<N>` resets to 1). Upstream's `verify:resources` script entry preserved. |

Fork-local carry-forward confirmed intact after the merge: the `a2a` command survived upstream's
large `src/cli/wmux.ts` rewrite (`a2a.send` / `a2a.poll` / `a2a.status` present in both the handler
and `COMMAND_SPECS`).
