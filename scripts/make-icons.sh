#!/bin/bash
# ============================================================
# 水印框 · 生成三平台图标
#   源文件：src-tauri/icons/icon.svg
#   产出：  src-tauri/icons/{32x32.png,128x128.png,128x128@2x.png,
#                          icon.png,icon-512.png,icon.icns,icon.ico}
#   依赖：  Google Chrome（把 SVG 渲染成 PNG）、sips / iconutil（macOS 自带）、python3
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src-tauri/icons/icon.svg"
OUT="$ROOT/src-tauri/icons"
TMP="/tmp/wm_icon_build"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

if [ ! -x "$CHROME" ]; then
  echo "找不到 Chrome：$CHROME（可用 CHROME=... 指定路径）" >&2
  exit 1
fi

rm -rf "$TMP"
mkdir -p "$TMP/icon.iconset"

# SVG → 1024 PNG（无头 Chrome 渲染，背景透明）
{
  echo '<!DOCTYPE html><html><head><meta charset="utf-8">'
  echo '<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>'
  echo '</head><body>'
  cat "$SRC"
  echo '</body></html>'
} > "$TMP/icon.html"

"$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --default-background-color=00000000 --window-size=1024,1024 \
  --screenshot="$TMP/icon_1024.png" "file://$TMP/icon.html" >/dev/null 2>&1

for s in 16 32 48 64 128 256 512 1024; do
  sips -z "$s" "$s" "$TMP/icon_1024.png" --out "$TMP/icon_$s.png" >/dev/null
done

# PNG（Linux / 通用）
cp "$TMP/icon_32.png"   "$OUT/32x32.png"
cp "$TMP/icon_128.png"  "$OUT/128x128.png"
cp "$TMP/icon_256.png"  "$OUT/128x128@2x.png"
cp "$TMP/icon_512.png"  "$OUT/icon-512.png"
cp "$TMP/icon_1024.png" "$OUT/icon.png"

# ICNS（macOS）
cp "$TMP/icon_16.png"   "$TMP/icon.iconset/icon_16x16.png"
cp "$TMP/icon_32.png"   "$TMP/icon.iconset/icon_16x16@2x.png"
cp "$TMP/icon_32.png"   "$TMP/icon.iconset/icon_32x32.png"
cp "$TMP/icon_64.png"   "$TMP/icon.iconset/icon_32x32@2x.png"
cp "$TMP/icon_128.png"  "$TMP/icon.iconset/icon_128x128.png"
cp "$TMP/icon_256.png"  "$TMP/icon.iconset/icon_128x128@2x.png"
cp "$TMP/icon_256.png"  "$TMP/icon.iconset/icon_256x256.png"
cp "$TMP/icon_512.png"  "$TMP/icon.iconset/icon_256x256@2x.png"
cp "$TMP/icon_512.png"  "$TMP/icon.iconset/icon_512x512.png"
cp "$TMP/icon_1024.png" "$TMP/icon.iconset/icon_512x512@2x.png"
iconutil -c icns "$TMP/icon.iconset" -o "$OUT/icon.icns"

# ICO（Windows）：多尺寸内嵌 PNG
python3 "$ROOT/scripts/png2ico.py" "$OUT/icon.ico" \
  "$TMP/icon_16.png" "$TMP/icon_32.png" "$TMP/icon_48.png" \
  "$TMP/icon_64.png" "$TMP/icon_128.png" "$TMP/icon_256.png"

echo "图标已生成到 $OUT"
ls -1 "$OUT"
