#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SOURCE="${ICON_SOURCE:-$ROOT/build/icon-crop.png}"
if [[ ! -f "$SOURCE" ]]; then
  SOURCE="$ROOT/build/icon-source.png"
fi
if [[ ! -f "$SOURCE" ]]; then
  SOURCE="$ROOT/public/dad-v2-logo-transparent.png"
fi

ICONSET="$ROOT/build/icon.iconset"
OUTPUT="$ROOT/build/icon.icns"
MASTER="$ROOT/build/icon-1024.png"
PUBLIC_ICON="$ROOT/public/app-icon.png"

if [[ ! -f "$SOURCE" ]]; then
  echo "Missing icon source. Add build/icon-crop.png or build/icon-source.png." >&2
  exit 1
fi

mkdir -p "$ICONSET"

python3 <<PY
from pathlib import Path
from PIL import Image

source = Path("$SOURCE")
master = Path("$MASTER")
public_icon = Path("$PUBLIC_ICON")
iconset = Path("$ICONSET")

img = Image.open(source).convert("RGBA")
px = img.load()
width, height = img.size

def is_yellow_artifact(r, g, b, a):
    if a < 8:
        return False
    # Compression fringe / stray mark in the diagonal slash (not brand purple-blue)
    if r > 200 and g > 165 and b < 140:
        return True
    if r > 175 and g > 130 and b < 95 and (r + g) > b * 2.2:
        return True
    return False

for y in range(height):
    for x in range(width):
        r, g, b, a = px[x, y]
        if is_yellow_artifact(r, g, b, a):
            px[x, y] = (0, 0, 0, 0)
        elif a > 0 and (r + g + b) > 720 and max(r, g, b) - min(r, g, b) < 25:
            # Near-white pad from JPEG — make transparent for macOS icon
            px[x, y] = (0, 0, 0, 0)

bbox = img.getbbox()
if not bbox:
    raise SystemExit("No visible artwork in icon source.")

mark = img.crop(bbox)

def fit_on_square(source_img, side, inset=0.12):
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    usable = int(side * (1 - inset * 2))
    src_w, src_h = source_img.size
    scale = min(usable / src_w, usable / src_h)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    resized = source_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    offset = ((side - new_w) // 2, (side - new_h) // 2)
    canvas.paste(resized, offset, resized)
    return canvas

square = fit_on_square(mark, 1024)
square.save(master)
fit_on_square(mark, 512, inset=0.12).convert("RGB").save(public_icon)

for size in (16, 32, 128, 256, 512):
    fit_on_square(mark, size, inset=0.1).save(iconset / f"icon_{size}x{size}.png")
    fit_on_square(mark, size * 2, inset=0.1).save(iconset / f"icon_{size}x{size}@2x.png")
PY

iconutil -c icns "$ICONSET" -o "$OUTPUT"
echo "Generated $OUTPUT (yellow fringe removed, transparent canvas)"
