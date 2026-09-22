#!/usr/bin/env bash
# Regenerates every branded icon asset in resources/ from the SVG masters
# in this directory. Requires: rsvg-convert, ImageMagick 7 (magick), node.
#
#   walker-badge.svg / walker-badge-sm.svg    app icon (small = simplified for <=24px)
#   walker-tile.svg                           full-bleed tile (Windows tiles, PWA)
#   walker-sessions.svg / -sm.svg             Agents window icon (inverted palette)
set -euo pipefail
cd "$(dirname "$0")"

RES=$(cd .. && pwd)
B=.build
SIZES="16 20 24 32 40 48 64 70 128 150 192 256 512 1024"
mkdir -p "$B"

render() {
  for s in $SIZES; do rsvg-convert -w "$s" -h "$s" "$1.svg" -o "$B/$2-$s.png"; done
}
render walker-badge badge
render walker-tile tile
render walker-sessions sess
for s in 16 20 24; do
  rsvg-convert -w "$s" -h "$s" walker-badge-sm.svg -o "$B/badge-$s.png"
  rsvg-convert -w "$s" -h "$s" walker-sessions-sm.svg -o "$B/sess-$s.png"
done

# --- containers (entry sets mirror the originals exactly) ---
magick "$B/badge-16.png" "$B/badge-32.png" "$B/badge-128.png" "$B/badge-256.png" "$RES/win32/code.ico"
magick "$B/badge-16.png" "$B/badge-24.png" "$B/badge-32.png" "$B/badge-48.png" "$B/badge-64.png" "$RES/server/favicon.ico"
magick "$B/sess-16.png" "$B/sess-20.png" "$B/sess-24.png" "$B/sess-32.png" "$B/sess-40.png" "$B/sess-48.png" "$B/sess-64.png" "$B/sess-128.png" "$B/sess-256.png" "$RES/win32/sessions.ico"
node mkicns.mjs "$B" "$RES/darwin/code.icns"

# --- plain PNGs ---
cp "$B/badge-1024.png" "$RES/linux/code.png"
cp "$B/tile-150.png" "$RES/win32/code_150x150.png"
cp "$B/tile-70.png" "$RES/win32/code_70x70.png"
cp "$B/tile-192.png" "$RES/server/code-192.png"
cp "$B/tile-512.png" "$RES/server/code-512.png"

# --- Inno Setup installer bitmaps (exact per-DPI dimensions required) ---
inno() { # width height output badge-scale source
  local n
  n=$(python3 -c "print(int(min($1, $2) * $4))")
  magick -size "${1}x${2}" xc:'#FFFFFF' \( "$5" -resize "${n}x${n}" \) \
    -gravity center -composite -units PixelsPerInch -density 96 -type TrueColor "BMP3:$3"
}
I="$RES/win32"
inno 164 314 "$I/inno-big-100.bmp" 0.52 "$B/badge-512.png"
inno 192 386 "$I/inno-big-125.bmp" 0.52 "$B/badge-512.png"
inno 246 459 "$I/inno-big-150.bmp" 0.52 "$B/badge-512.png"
inno 273 556 "$I/inno-big-175.bmp" 0.52 "$B/badge-512.png"
inno 328 604 "$I/inno-big-200.bmp" 0.52 "$B/badge-512.png"
inno 355 700 "$I/inno-big-225.bmp" 0.52 "$B/badge-512.png"
inno 410 797 "$I/inno-big-250.bmp" 0.52 "$B/badge-512.png"
inno 55 55 "$I/inno-small-100.bmp" 0.78 "$B/badge-256.png"
inno 64 68 "$I/inno-small-125.bmp" 0.78 "$B/badge-256.png"
inno 83 80 "$I/inno-small-150.bmp" 0.78 "$B/badge-256.png"
inno 92 97 "$I/inno-small-175.bmp" 0.78 "$B/badge-256.png"
inno 110 106 "$I/inno-small-200.bmp" 0.78 "$B/badge-256.png"
inno 119 123 "$I/inno-small-225.bmp" 0.78 "$B/badge-256.png"
inno 138 140 "$I/inno-small-250.bmp" 0.78 "$B/badge-256.png"

echo "walker icon assets regenerated from $(ls *.svg | tr '\n' ' ')"
