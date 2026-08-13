# Upstream Sync Manifest — 0.48.0 → 0.50.0 (2026-08-13)

**Range:** `fae21a5..8122b69` (`amirlehmam/wmux` master) — 6 commits (5 functional + release bump),
21 files, +1,270 / −49 lines.

## Verdict: ✅ CLEAN — merged into `production/local` as `0.50.0-local.1`

| Gate step | Result |
|---|---|
| Dependency diff | **Zero** new/changed packages — `package-lock.json` diff is the version field only (0.48.0 → 0.50.0); dependency tree byte-identical. No supply-chain surface. |
| `npm audit` delta | **Nothing attributable.** 10 advisories (8 high / 2 moderate) across the same ten dev-toolchain packages as the 0.48.0 baseline — unchanged set, and with an identical lockfile no advisory can originate here. |
| gitleaks / semgrep / trivy | Not installed. Substituted a full hand-read of the diff plus a pattern sweep of every added line for `fetch`/`http(s)`/`WebSocket`/`child_process`/`exec*`/`eval`/`Function()`/`shell.openExternal` **and the PowerShell-specific forms** (`Invoke-Expression`, `iex`, `Invoke-WebRequest`, `DownloadString`, `Set-ExecutionPolicy`, `Add-MpPreference`), secret shapes, and external URLs. One hit total: a legitimate `import { execFile }` in `powershell-shim.ts`, reviewed below. No secrets, no external URLs. |
| Full-diff review | No malicious code, no new network egress, no obfuscation. Two changes carry real user-facing risk and were verified against this machine rather than reasoned about — see below. |
| Tests | 887/888. The single failure is the **same known flake** as the 0.48.0 sync (`orchestration-status-vocab`, 15 s timeout under parallel load); **passes 9/9 in isolation**. |
| Build | `build:main` (tsc) and `vite build` clean. |
| Lint | Errors **unchanged at 17** vs. the 0.48.0 baseline (pre-existing `no-empty` / `no-control-regex` debt). +1 warning: a redundant `eslint-disable no-var-requires` in the new `powershell-shim.ts`, the same benign pattern already in five other main-process files. |

### The two changes that needed verifying, not reasoning about

**1. `powershell-shim.ts` (new) — spawns PowerShell and strips a Windows safety marker.**
The only new process-spawning code in the range, so it got the closest read. What it does is
narrow and, notably, errs *toward* the safe side:

- `execFile('powershell.exe' | 'pwsh.exe', ['-NoProfile','-NonInteractive','-File', <script>])` —
  array args, no shell string, and the script path is wmux's own shipped
  `cli-bin-ps/wmux-shim-probe.ps1`, never user input. The probe body is one line:
  `Write-Output 'wmux-shim-ok'`.
- It does **not** pass `-ExecutionPolicy Bypass`. It goes further and *deletes*
  `PSExecutionPolicyPreference` from the probe's environment, specifically so an inherited Bypass
  (wmux's own panes run under one) cannot make the probe pass on a machine where a fresh
  PowerShell would refuse the shim. That is the conservative direction.
- `stripMarkOfTheWeb` removes the `:Zone.Identifier` NTFS stream — **a genuine, if narrow,
  reduction of a Windows safety marker**, and the one item here worth stating plainly. It is
  hard-scoped to the two files wmux itself ships (`wmux.ps1`, `wmux-shim-probe.ps1`) in wmux's own
  resources dir; it takes no path from a caller and cannot reach user files. Equivalent to the
  `Unblock-File` step our own release checklist already tells the user to run on the whole install.
- The shim dir is prepended to spawned shells' PATH **only** if every installed PowerShell host
  runs the probe successfully; any refusal, or no host at all, leaves it off and PowerShell keeps
  resolving `wmux.cmd` as before.
- `wmux.ps1` itself uses the call operator with `@args` splatting — no `Invoke-Expression`, no
  string interpolation into a command line.

**2. `claude-context.ts` `stripLegacyBlocks` — deletes sections from the user's global CLAUDE.md.**
The highest-consequence change for the operator, because it is destructive on a file wmux does not
own: it removes any marker-less `# wmux` / `# smux` H1 section whose body matches one of wmux's own
signature sentences. Checked against this machine's `~/.claude/CLAUDE.md` (88 lines) instead of
assuming:

- The file **already carries markers** (`wmux:start` at line 3, `wmux:end` at line 73), and
  `stripLegacyBlocks` excludes the managed span from the scan entirely — so the `# wmux` H1 at
  line 5, which does match `LEGACY_SIGNATURES`, is protected by being inside it.
- The operator's own hand-written `# wmux orchestration & multi-pane work` (line 77, outside the
  markers) does **not** match `LEGACY_HEADING` (`/^#\s+[ws]mux\s*$/` requires nothing after the
  name), so it survives.
- Net effect on this machine: **blank-line normalisation only** (`collapse` squashes runs of 3+
  newlines). No content loss. On a machine that had accumulated pre-marker copies, it would remove
  them — which is the intent.

Remaining hot spots: `cdp-bridge.ts` adds dead-target pruning and re-attaches a debugger to a
still-live guest (same trust boundary as before — wmux already owns those webContents);
`pty-manager.ts` only changes which dirs it prepends to PATH; `resources/claude-instructions.md`
now tells agents to *check* `wmux ping` rather than assert wmux is present, which narrows the
injected instructions' claims rather than widening them.

## What's coming in (functional manifest)

- **PowerShell no longer mangles CLI arguments** (#154). `wmux` resolved to `wmux.cmd`, putting
  cmd.exe's parser in the path: `wmux browser eval "document.title.length>0"` silently redirected
  its own output into a file named `0` — exit 0, no output, no warning. Fixed with a probed `.ps1`
  shim (see above).
- **Browser commands outwait the server** (#153). The CLI's flat 5 s deadline was shorter than the
  main process's own budgets (30 s navigate, 10 s wait), so slow-but-successful commands reported
  `timeout` and the server's real diagnosis was discarded unread. Deadlines now derive from each
  verb's server-side budget, and timeout text names the method and the elapsed time.
- **A dead browser renderer no longer wedges a pane** (#155). A crashed guest left a stale CDP
  target that kept matching by surface id and answered `browser_not_open` forever.
- **Group commands print usage** (#156) — `wmux browser` answered `Unknown browser command:
  undefined`.
- **Agents check for wmux instead of asserting it** (#152) — the injected block is global, so it
  loaded into sessions with no wmux at all; it now leads with `wmux ping`. Also cleans up
  marker-less copies left by pre-marker versions.
- **`wmux browser <verb> --surface <id>`** — drive a specific pane's browser.

## Fork-side merge notes
- Conflicts: `package.json` / `package-lock.json` version fields only → `0.50.0-local.1`.
- `CLAUDE.md`, `src/cli/wmux.ts` and `src/main/index.ts` auto-merged cleanly; the fork-only
  "Fork Build on production/local" section is intact.
- **Packer updated in step with upstream:** `electron-builder.json` gained
  `src/cli-bin-ps → cli-bin-ps`, so `scripts/pack-local.sh` now copies it and both shim files were
  added to the fail-loud resource manifest. Without that the PowerShell fix — the headline change —
  would have been absent from local builds, exactly how `wmux-hook.js` went missing for two
  releases (see the 0.48.0 manifest).
- ASAR verified post-pack: `powershell-shim.js` present and wired into `pty-manager` + `index`,
  `pruneDead` in `cdp-bridge`, `stripLegacyBlocks` in both context files, new CLI timeout and
  usage strings in `wmux.js`, `resources/cli-bin-ps/` shipped, `wmux.exe` stamped `0.50.0`.
- Released: https://github.com/tawman/wmux/releases/tag/v0.50.0-local.1
