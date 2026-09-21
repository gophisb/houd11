#!/usr/bin/env bash
set -euo pipefail

DEST="app/src/main/assets/web/assets/audio/minshawy"
mkdir -p "$DEST"

# 64 kbps Minshawy Murattal, one MP3 per ayah.
# Audio is generated during CI and is intentionally not committed to Git.
BASE="https://cdn.islamic.network/quran/audio/64/ar.minshawi"

# Generate the exact 6236-file manifest without relying on shell array indexing.
python3 - "$DEST" > /tmp/minshawy-manifest.tsv <<'PY'
import sys
dest = sys.argv[1]
counts = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6]
assert len(counts) == 114 and sum(counts) == 6236
global_ayah = 0
for surah, count in enumerate(counts, 1):
    for ayah in range(1, count + 1):
        global_ayah += 1
        filename = f"{surah:03d}{ayah:03d}.mp3"
        print(global_ayah, filename)
PY

download_one() {
  global="$1"
  out="$2"
  if [ ! -s "$DEST/$out" ]; then
    curl -fL --retry 4 --retry-delay 1 --connect-timeout 20 --max-time 120 -sS       "$BASE/$global.mp3" -o "$DEST/$out"
  fi
  test -s "$DEST/$out"
}
export BASE DEST
export -f download_one

echo "Downloading bundled Minshawy audio (6236 ayahs)..."
xargs -n2 -P12 bash -c 'download_one "$0" "$1"' < /tmp/minshawy-manifest.tsv

count="$(find "$DEST" -type f -name '*.mp3' | wc -l)"
test "$count" -eq 6236

echo "Offline Minshawy audio verified: $count ayah files."
