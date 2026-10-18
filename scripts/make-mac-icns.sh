#!/usr/bin/env bash
# Build assets/icons/icon.icns from assets/icons/icon.png with Apple's own tools.
#
# Why: electron-builder converts a PNG to .icns with its Go-based encoder. The
# resulting PNG streams decode fine almost everywhere, but macOS 26/27 System
# Settings → Login Items renders them as colourful noise. PNGs re-encoded by
# sips and packed with iconutil render correctly, so the .icns is committed and
# electron-builder is pointed at it (build.mac.icon). Re-run after changing
# icon.png. macOS only (sips, iconutil).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=assets/icons/icon.png
OUT=assets/icons/icon.icns
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
SET="$TMP/icon.iconset"
mkdir -p "$SET"
for size in 16 32 128 256 512; do
  sips -s format png -z "$size" "$size" "$SRC" --out "$SET/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -s format png -z "$double" "$double" "$SRC" --out "$SET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o "$OUT"
echo "wrote $OUT ($(wc -c < "$OUT" | tr -d " ") bytes)"
