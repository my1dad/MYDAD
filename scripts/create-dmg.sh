#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/mac/Over Drive OS.app"
DMG_ICON="$ROOT/build/dmg-volume.icns"
ICON_PNG="$ROOT/build/dmg-icon.png"
DMG="$ROOT/Over Drive OS-1.0.0.dmg"
STAGING="$ROOT/.dmg-staging"
DMG_RW="$ROOT/.dmg-staging-rw.dmg"
VOLNAME="Over Drive OS"

if [[ ! -d "$APP" ]]; then
  echo "Missing packaged app at: $APP" >&2
  echo "Run: npm run electron:pack" >&2
  exit 1
fi

bash "$ROOT/scripts/generate-dmg-icon.sh"

if [[ ! -f "$DMG_ICON" || ! -f "$ICON_PNG" ]]; then
  echo "Missing DMG icon assets." >&2
  exit 1
fi

rm -rf "$STAGING"
mkdir -p "$STAGING"
cp -R "$APP" "$STAGING/"
ln -s /Applications "$STAGING/Applications"
cp "$DMG_ICON" "$STAGING/.VolumeIcon.icns"

rm -f "$DMG" "$DMG_RW"

# Build a read-write image first so we can enable the custom volume icon.
STAGING_MB=$(( $(du -sm "$STAGING" | awk '{print $1}') + 32 ))
hdiutil create \
  -srcfolder "$STAGING" \
  -volname "$VOLNAME" \
  -fs HFS+ \
  -format UDRW \
  -size "${STAGING_MB}m" \
  -ov \
  "$DMG_RW" >/dev/null

ATTACH_OUTPUT="$(hdiutil attach -readwrite -noverify -noautofsck "$DMG_RW")"
DEVICE="$(echo "$ATTACH_OUTPUT" | awk '/^\/dev\// {print $1; exit}')"
MOUNT="/Volumes/$VOLNAME"

if [[ -z "${DEVICE:-}" || ! -d "$MOUNT" ]]; then
  echo "Could not mount DMG for icon customization." >&2
  echo "$ATTACH_OUTPUT" >&2
  exit 1
fi

cleanup() {
  hdiutil detach "$DEVICE" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cp "$DMG_ICON" "$MOUNT/.VolumeIcon.icns"
SetFile -a C "$MOUNT"

hdiutil detach "$DEVICE" >/dev/null
trap - EXIT

hdiutil convert "$DMG_RW" -format UDZO -imagekey zlib-level=9 -o "$DMG" >/dev/null
rm -f "$DMG_RW"
rm -rf "$STAGING"

# Apply the installer artwork to the .dmg file itself in Finder.
/usr/bin/osascript <<EOF >/dev/null
use framework "Cocoa"

set sourcePath to "$ICON_PNG"
set destPath to "$DMG"

set sourceImage to (current application's NSImage's alloc()'s initWithContentsOfFile:sourcePath)
set imageSize to sourceImage's |size|()
set imageWidth to (width of imageSize) as real
set imageHeight to (height of imageSize) as real
set canvasSide to imageWidth
if imageHeight > canvasSide then set canvasSide to imageHeight
set drawWidth to imageWidth
set drawHeight to imageHeight
set drawOriginX to (canvasSide - drawWidth) / 2
set drawOriginY to (canvasSide - drawHeight) / 2

set squareImage to (current application's NSImage's alloc()'s initWithSize:{width:canvasSide, height:canvasSide})
squareImage's lockFocus()
current application's NSColor's clearColor()'s |set|()
current application's NSRectFill(current application's NSMakeRect(0, 0, canvasSide, canvasSide))
sourceImage's drawInRect:(current application's NSMakeRect(drawOriginX, drawOriginY, drawWidth, drawHeight)) fromRect:(current application's NSZeroRect) operation:(current application's NSCompositingOperationSourceOver) fraction:1.0
squareImage's unlockFocus()

(current application's NSWorkspace's sharedWorkspace()'s setIcon:squareImage forFile:destPath options:2)
EOF

echo "Created $DMG"
