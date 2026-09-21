#!/usr/bin/env bash
set -euo pipefail

DEST="app/src/main/assets/web/assets/audio/minshawy"
mkdir -p "$DEST"

# 64 kbps Minshawy Murattal, one MP3 per ayah.
# Audio is generated during CI and is intentionally not committed to Git.
BASE="https://cdn.islamic.network/quran/audio/64/ar.minshawi"

AYAH_COUNTS=(7 286 200 176 120 165 206 75 129 109 123 111 43 52 99 128 111 110 98 135 112 78 118 64 77 227 93 88 69 60 34 30 73 54 45 83 182 88 75 85 54 53 89 59 37 35 38 29 18 45 60 49 62 55 78 96 29 22 24 13 14 11 11 18 12 12 30 52 52 44 28 28 20 56 40 31 50 40 46 42 29 19 36 25 22 17 19 26 30 20 15 21 11 8 8 19 5 8 8 11 11 8 3 9 5 4 7 3 6 5 4 6)

offset=0
for s in $(seq 1 114); do
  count=${AYAH_COUNTS[$((s-1))]}
  for a in $(seq 1 "$count"); do
    global=$((offset+a))
    out=$(printf "%03d%03d.mp3" "$s" "$a")
    url="$BASE/$global.mp3"
    if [ ! -s "$DEST/$out" ]; then
      curl -fL --retry 4 --retry-delay 1 --connect-timeout 20 --max-time 120 -sS "$url" -o "$DEST/$out"
    fi
  done
  offset=$((offset+count))
  echo "Downloaded surah $s/114"
done

test "$offset" -eq 6236

for s in $(seq 1 114); do
  count=${AYAH_COUNTS[$((s-1))]}
  for a in $(seq 1 "$count"); do
    f="$DEST/$(printf "%03d%03d.mp3" "$s" "$a")"
    test -s "$f"
  done
done

echo "Offline Minshawy audio verified: 6236 ayah files."
