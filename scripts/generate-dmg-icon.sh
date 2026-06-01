#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SOURCE="${DMG_ICON_SOURCE:-$ROOT/build/dmg-icon-source.png}"
ICONSET="$ROOT/build/dmg.iconset"
ICNS="$ROOT/build/dmg-volume.icns"
ICON_PNG="$ROOT/build/dmg-icon.png"
TRIMMED="$ROOT/build/dmg-icon-trimmed.png"

if [[ ! -f "$SOURCE" ]]; then
  echo "Missing DMG icon source. Place build/dmg-icon-source.png first." >&2
  exit 1
fi

mkdir -p "$ICONSET"

python3 <<PY
from PIL import Image

source = "$SOURCE"
trimmed = "$TRIMMED"
icon_png = "$ICON_PNG"
iconset = "$ICONSET"

img = Image.open(source).convert("RGBA")
px = img.load()
width, height = img.size

for y in range(height):
    for x in range(width):
        r, g, b, a = px[x, y]
        brightness = (r + g + b) / 3
        if brightness < 35:
            px[x, y] = (r, g, b, 0)
        elif brightness < 55:
            alpha = int((brightness - 35) / 20 * 255)
            px[x, y] = (r, g, b, alpha)

bbox = img.getbbox()
if not bbox:
    raise SystemExit("Could not find visible artwork in DMG icon source.")

img = img.crop(bbox)
img.save(trimmed)

def fit_on_square(source_img, side):
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    src_w, src_h = source_img.size
    scale = min(side / src_w, side / src_h)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    resized = source_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    offset = ((side - new_w) // 2, (side - new_h) // 2)
    canvas.paste(resized, offset, resized)
    return canvas

file_max = 512
file_scale = min(file_max / img.width, file_max / img.height)
file_size = (
    max(1, int(round(img.width * file_scale))),
    max(1, int(round(img.height * file_scale))),
)
file_icon = img.resize(file_size, Image.Resampling.LANCZOS)
file_icon.save(icon_png)

for size in (16, 32, 128, 256, 512):
    fit_on_square(img, size).save(f"{iconset}/icon_{size}x{size}.png")
    fit_on_square(img, size * 2).save(f"{iconset}/icon_{size}x{size}@2x.png")
PY

iconutil -c icns "$ICONSET" -o "$ICNS"
echo "Generated $ICNS"
