#!/usr/bin/env bash
set -euo pipefail
TMP="build/quran-audio"
DEST="$TMP/audio"
DIST="dist"
API="https://api.alquran.cloud/v1/quran/ar.minshawi"
rm -rf "$TMP" "$DIST"; mkdir -p "$DEST" "$DIST"

# Fetch the official API manifest once. It supplies the current CDN URL for every ayah.
curl -fL --retry 4 --connect-timeout 20 --max-time 180 -sS "$API" -o "$TMP/edition.json"

python3 > /tmp/minshawy.tsv <<'PY'
import json
data=json.load(open("build/quran-audio/edition.json"))
ayahs=data["data"]["surahs"]
rows=[]
for surah in ayahs:
    for ayah in surah["ayahs"]:
        n=ayah["numberInSurah"]
        s=surah["number"]
        g=ayah["number"]
        url=ayah["audio"]
        rows.append((g, f"{s:03d}{n:03d}", url))
assert len(rows)==6236, len(rows)
for g,n,url in rows:
    print(g,n,url)
PY

download(){
  g="$1"; n="$2"; url="$3"; mp3="$TMP/$n.mp3"; ogg="$DEST/$n.ogg"
  curl -fL --retry 4 --connect-timeout 20 --max-time 120 -sS "$url" -o "$mp3"
  test -s "$mp3"
  ffmpeg -loglevel error -y -i "$mp3" -ac 1 -c:a libopus -b:a 48k -vbr on "$ogg"
  test -s "$ogg"
  rm -f "$mp3"
}
export -f download; export TMP DEST
xargs -n3 -P6 bash -c 'download "$0" "$1" "$2"' < /tmp/minshawy.tsv

test "$(find "$DEST" -type f -name '*.ogg' | wc -l)" -eq 6236
cat > "$TMP/manifest.json" <<EOF
{"format":"houd-quran-audio","version":1,"reciter":"Minshawy Murattal","source":"AlQuran.cloud API/CDN","codec":"Opus/Ogg","bitrate":"48kbps","files":6236}
EOF
cp "$TMP/manifest.json" "$DIST/manifest.json"
(cd "$TMP" && zip -0 -q -r "../quran-audio-pack.zip" manifest.json audio)
mv build/quran-audio-pack.zip "$DIST/quran-audio-pack.zip"
ls -lh "$DIST/quran-audio-pack.zip"
