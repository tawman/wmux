#!/usr/bin/env bash
# Reproducible LOCAL release packager for the tawman/wmux fork (production/local).
#
# Produces a full Electron runtime, NOT an app.asar-only overlay. The staging
# base is node_modules/electron/dist — i.e. whatever Electron major is currently
# installed — so this correctly handles Electron *major* upgrades where the old
# release zip is the wrong base (e.g. 33->43 adds dxcompiler.dll / dxil.dll and a
# different electron.exe). Do NOT reuse a previous release zip as the base.
#
# Outputs (both under ./release/, which is gitignored):
#   release/wmux/                      folder to install via C:\tools\swap-wmux.cmd
#   release/wmux-<version>-win-x64.zip artifact to attach to the gh release
#
# Run from anywhere: bash scripts/pack-local.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VER=$(node -p "require('./package.json').version")   # e.g. 0.15.2-local.2
BASEVER="${VER%%-*}"                                 # e.g. 0.15.2 (rcedit is numeric-only)
ASAR="$ROOT/node_modules/.bin/asar"
OUT="$ROOT/release"
APPDIR="$OUT/wmux"
ZIP="$OUT/wmux-$VER-win-x64.zip"

echo "== pack-local: $VER  (rcedit base $BASEVER) =="

echo "-- [1/6] build (tsc main + vite renderer)"
npm run build:main
npx vite build >/dev/null

echo "-- [2/6] ASAR staging (prod deps only)"
rm -rf .asar-staging build-out "$APPDIR" "$OUT"/wmux-*.zip
mkdir -p .asar-staging build-out "$APPDIR"
cp -r dist .asar-staging/dist
cp package.json .asar-staging/package.json
( cd .asar-staging && npm install --omit=dev --ignore-scripts >/dev/null 2>&1 )
rm -rf .asar-staging/node_modules/node-pty/build   # force prebuilds load path (conpty.dll)

echo "-- [3/6] pack ASAR (unpack node-pty prebuilds)"
"$ASAR" pack .asar-staging build-out/app.asar --unpack-dir node_modules/node-pty/prebuilds

echo "-- [4/6] assemble Electron runtime (base = node_modules/electron/dist)"
cp -r node_modules/electron/dist/. "$APPDIR/"
mv "$APPDIR/electron.exe" "$APPDIR/wmux.exe"
rm -f "$APPDIR/resources/default_app.asar"
cp build-out/app.asar "$APPDIR/resources/app.asar"
cp -r build-out/app.asar.unpacked "$APPDIR/resources/app.asar.unpacked"
cp resources/icon.png "$APPDIR/resources/"
# getAppIcon() prefers resourcesPath/icon.ico over the png — a multi-size ICO is a
# crisp mark at the 16/20/24px slots the shell actually draws, where a downscaled
# 512px png smudges. The Electron dist base carries no icon.ico, so without this the
# packaged build silently took the png fallback path on every local release.
cp resources/icons/icon.ico "$APPDIR/resources/icon.ico"
cp -r resources/themes "$APPDIR/resources/themes"
cp -r resources/sounds "$APPDIR/resources/sounds"
mkdir -p "$APPDIR/resources/shell-integration"; cp -r src/shell-integration/. "$APPDIR/resources/shell-integration/"
cp -r resources/wmux-orchestrator "$APPDIR/resources/wmux-orchestrator"
# resources/claude-instructions.md is the canonical text; the packaged build reads
# the DIRECTORY copy (agent-instructions.ts resolves resourcesPath/claude-instructions/
# claude-instructions.md in production, and the root file only in dev). The tracked
# resources/claude-instructions/claude-instructions.md is a duplicate that stopped
# being updated at 4498cf1 — 43 lines against the canonical 108, missing the #152/#158
# "check whether wmux is actually here" gate. Copying it verbatim therefore shipped a
# build whose agent instructions were two fixes behind, silently. Derive the dir copy
# from the canonical file instead, so the duplicate cannot drift into a release again.
mkdir -p "$APPDIR/resources/claude-instructions"
cp resources/claude-instructions.md "$APPDIR/resources/claude-instructions/claude-instructions.md"
cp resources/claude-instructions.md "$APPDIR/resources/claude-instructions.md"
cp -r resources/opencode-plugin "$APPDIR/resources/opencode-plugin"
mkdir -p "$APPDIR/resources/cli"; cp dist/cli/wmux.js "$APPDIR/resources/cli/wmux.js"
cp dist/cli/wmux-hook.js "$APPDIR/resources/cli/wmux-hook.js"   # Claude Code hooks run this via bare `node`, which cannot read app.asar — packaged builds resolve it at resourcesPath/cli/wmux-hook.js (issue #81)
mkdir -p "$APPDIR/resources/cli-bin"; cp -r src/cli-bin/. "$APPDIR/resources/cli-bin/"   # wmux/wmux.cmd shims — pty-manager prepends this dir to PATH so bare `wmux` works in agent shells
mkdir -p "$APPDIR/resources/cli-bin-ps"; cp -r src/cli-bin-ps/. "$APPDIR/resources/cli-bin-ps/"   # wmux.ps1 + its probe — powershell-shim.ts probes this dir and only then puts it on PATH, keeping cmd.exe's parser out of PowerShell (issue #154)

# Fail loudly on a missing runtime resource. Every entry here is loaded by path at
# runtime, so omitting one produces a build that starts fine and is quietly broken
# — how wmux-hook.js went missing for two releases (issue #81 all over again).
for f in resources/app.asar resources/cli/wmux.js resources/cli/wmux-hook.js \
         resources/cli-bin/wmux.cmd resources/cli-bin-ps/wmux.ps1 \
         resources/cli-bin-ps/wmux-shim-probe.ps1 resources/opencode-plugin/wmux.js \
         resources/claude-instructions.md resources/icon.png resources/icon.ico \
         resources/claude-instructions/claude-instructions.md \
         resources/app.asar.unpacked/node_modules/node-pty/prebuilds/win32-x64/pty.node; do
  [ -e "$APPDIR/$f" ] || { echo "FATAL: packaged build is missing $f" >&2; exit 1; }
done

echo "-- [5/6] rcedit wmux.exe (icon + bare version $BASEVER)"
STAGE_EXE="$APPDIR/wmux.exe" VER_BASE="$BASEVER" node -e "
const { rcedit } = require('rcedit');
rcedit(process.env.STAGE_EXE, {
  icon: 'resources/icons/icon.ico',
  'version-string': { ProductName:'wmux', FileDescription:'wmux', CompanyName:'wmux', InternalName:'wmux', OriginalFilename:'wmux.exe', LegalCopyright:'Copyright (c) 2026 wmux' },
  'file-version': process.env.VER_BASE, 'product-version': process.env.VER_BASE,
}).then(()=>console.log('   rcedit done'), e=>{ console.error(e); process.exit(1); });
"

echo "-- [6/6] zip -> $ZIP"
powershell.exe -NoProfile -Command "Compress-Archive -Path '$(cygpath -w "$APPDIR")\\*' -DestinationPath '$(cygpath -w "$ZIP")' -Force -CompressionLevel Optimal"

rm -rf .asar-staging build-out
echo ""
echo "app.asar: $(du -h "$APPDIR/resources/app.asar" | cut -f1) | wmux.exe: $(du -h "$APPDIR/wmux.exe" | cut -f1) | zip: $(du -h "$ZIP" | cut -f1)"
echo "prebuilds: $(ls "$APPDIR/resources/app.asar.unpacked/node_modules/node-pty/prebuilds/win32-x64/" | tr '\n' ' ')"
echo "APPDIR: $APPDIR"
echo "ZIP:    $ZIP"
