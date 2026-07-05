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
cp -r resources/themes "$APPDIR/resources/themes"
cp -r resources/sounds "$APPDIR/resources/sounds"
mkdir -p "$APPDIR/resources/shell-integration"; cp -r src/shell-integration/. "$APPDIR/resources/shell-integration/"
cp -r resources/wmux-orchestrator "$APPDIR/resources/wmux-orchestrator"
cp -r resources/claude-instructions "$APPDIR/resources/claude-instructions"
cp resources/claude-instructions.md "$APPDIR/resources/claude-instructions.md"
cp -r resources/opencode-plugin "$APPDIR/resources/opencode-plugin"
mkdir -p "$APPDIR/resources/cli"; cp dist/cli/wmux.js "$APPDIR/resources/cli/wmux.js"

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
