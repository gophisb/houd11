#!/usr/bin/env bash
set -euo pipefail
TMP="build/quran-audio"
DEST="$TMP/audio"
DIST="dist"
BASE="https://cdn.islamic.network/quran/audio/64/ar.minshawi"
rm -rf "$TMP" "$DIST"; mkdir -p "$DEST" "$DIST"
python3 > /tmp/minshawy.tsv <<'PY'
counts=[7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6]
assert len(counts)==114 and sum(counts)==6236
g=0
for s,c in enumerate(counts,1):
 for a in range(1,c+1):
  g+=1; print(g,f"{s:03d}{a:03d}")
PY
download(){
 g="$1"; n="$2"; mp3="$TMP/$n.mp3"; ogg="$DEST/$n.ogg"
 curl -fL --retry 4 --connect-timeout 20 --max-time 120 -sS "$BASE/$g.mp3" -o "$mp3"
 ffmpeg -loglevel error -y -i "$mp3" -ac 1 -c:a libopus -b:a 48k -vbr on "$ogg"
 rm -f "$mp3"
}
export -f download; export BASE TMP DEST
xargs -n2 -P6 bash -c 'download "$0" "$1"' < /tmp/minshawy.tsv
test "$(find "$DEST" -type f -name '*.ogg' | wc -l)" -eq 6236
cat > "$TMP/manifest.json" <<EOF
{"format":"houd11-quran-audio","version":1,"reciter":"Minshawy Murattal","codec":"Opus/Ogg","bitrate":"48kbps","files":6236}
EOF
cp "$TMP/manifest.json" "$DIST/manifest.json"
(cd "$TMP" && zip -0 -q -r "../quran-audio-pack.zip" manifest.json audio)
mv build/quran-audio-pack.zip "$DIST/quran-audio-pack.zip"
ls -lh "$DIST/quran-audio-pack.zip"
