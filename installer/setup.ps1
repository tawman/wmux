<#
.SYNOPSIS
  Installs the `wmux` CLI shims into ~/.local/bin so Claude Code (and any agent
  in a wmux pane) can drive wmux from a shell.

.DESCRIPTION
  This ZIP ships a self-contained GUI (wmux.exe) plus a Node-based CLI at
  resources\cli\wmux.js. The GUI and the CLI both want the command name `wmux`,
  and that collides: on PATH, `wmux.exe` (.EXE) always wins over a `wmux.cmd`
  (.CMD) because of PATHEXT ordering. So you CANNOT expose the CLI by adding the
  install folder to PATH — doing that makes `wmux <command>` launch the GUI
  instead of running the CLI.

  This script avoids the collision the way the maintainer's machine does: it
  installs two tiny shims — `wmux` (bash) and `wmux.cmd` (cmd) — into
  ~/.local/bin, a directory with NO wmux.exe to shadow them. Each shim just runs
  `node <wmux.js>`, preferring $WMUX_CLI (which wmux sets inside its own panes)
  and falling back to this install. It then ensures ~/.local/bin is on your user
  PATH.

  Do NOT add the wmux install directory to PATH. Add ~/.local/bin instead — this
  script does that for you.

  Requires Node.js on PATH: the CLI is a Node script, not a compiled exe. (The
  GUI does not need Node.)

.EXAMPLE
  # From the extracted wmux folder (next to wmux.exe):
  powershell -ExecutionPolicy Bypass -File .\setup.ps1
#>
[CmdletBinding()]
param(
  [string]$BinDir = (Join-Path $HOME '.local\bin')
)
$ErrorActionPreference = 'Stop'

# The install directory is wherever this script lives (zip root, next to wmux.exe).
$installDir = $PSScriptRoot
$cliJs = Join-Path $installDir 'resources\cli\wmux.js'
if (-not (Test-Path $cliJs)) {
  Write-Error "wmux CLI not found at `"$cliJs`". Run setup.ps1 from the extracted wmux folder (the one containing wmux.exe)."
  exit 1
}
$cliWin  = (Resolve-Path $cliJs).Path        # C:\...\resources\cli\wmux.js
$cliUnix = $cliWin -replace '\\', '/'         # C:/.../resources/cli/wmux.js  (for the bash shim)

Write-Host "wmux install : $installDir"
Write-Host "CLI target   : $cliWin"
Write-Host "Shim dir     : $BinDir"
Write-Host ""

# Node.js is required — both shims shell out to `node`.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Warning "Node.js is not on PATH. The wmux CLI needs Node to run (the GUI does not). Install Node.js, then re-run this script or just ensure `node` is on PATH."
}

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# 1. bash shim (Git Bash / WSL-style shells, and Claude Code's Bash tool). LF endings.
$bash = (@'
#!/usr/bin/env bash
# wmux CLI shim (installed by setup.ps1). Runs the wmux pipe client via Node.
# Prefers $WMUX_CLI (set by wmux inside its own panes); else falls back to this install.
CLI="${WMUX_CLI:-__CLI_UNIX__}"
exec node "$CLI" "$@"
'@).Replace('__CLI_UNIX__', $cliUnix).Replace("`r`n", "`n")
[System.IO.File]::WriteAllText((Join-Path $BinDir 'wmux'), $bash, $utf8NoBom)

# 2. cmd shim (cmd.exe / PowerShell outside a wmux pane). CRLF endings.
$cmd = (@'
@echo off
REM wmux CLI shim (installed by setup.ps1). Runs the wmux pipe client via Node.
if defined WMUX_CLI (
  node "%WMUX_CLI%" %*
) else (
  node "__CLI_WIN__" %*
)
'@).Replace('__CLI_WIN__', $cliWin).Replace("`n", "`r`n")
[System.IO.File]::WriteAllText((Join-Path $BinDir 'wmux.cmd'), $cmd, $utf8NoBom)

# 3. Ensure ~/.local/bin is on the USER PATH — never the install dir.
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$already  = ($userPath -split ';') -contains $BinDir
if (-not $already) {
  $newPath = if ([string]::IsNullOrEmpty($userPath)) { $BinDir } else { "$userPath;$BinDir" }
  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
  Write-Host "Added $BinDir to your user PATH." -ForegroundColor Green
  Write-Host "Open a NEW terminal for it to take effect." -ForegroundColor Yellow
} else {
  Write-Host "$BinDir is already on your user PATH." -ForegroundColor Green
}

Write-Host ""
Write-Host "Installed wmux CLI shims:" -ForegroundColor Cyan
Write-Host "  $BinDir\wmux      (bash / Git Bash)"
Write-Host "  $BinDir\wmux.cmd  (cmd / PowerShell)"
Write-Host ""
Write-Host "IMPORTANT: do NOT add the wmux install folder to PATH — wmux.exe would" -ForegroundColor Yellow
Write-Host "shadow the CLI, so `wmux <command>` would launch the GUI instead of running" -ForegroundColor Yellow
Write-Host "the pipe client. The shims above live in a folder with no wmux.exe." -ForegroundColor Yellow
Write-Host ""
Write-Host "Verify in a new terminal (with wmux running):  wmux ping" -ForegroundColor Cyan
