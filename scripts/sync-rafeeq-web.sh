#!/usr/bin/env bash
set -euo pipefail

REF="59eddc62f183e3aebefb6036095aa75b8c9b8873"

rm -rf app/src/main/assets/web
mkdir -p app/src/main/assets

# Stable offline content/data baseline.
git clone --quiet https://github.com/gophisb/ar-rafeeq3.git /tmp/ar-rafeeq3
cd /tmp/ar-rafeeq3
git checkout --quiet "$REF"
rm -rf .git .github
cd -

cp -a /tmp/ar-rafeeq3 app/src/main/assets/web

# Rafeeq 4 application core overlay.
# The Android shell remains in houd11; this overlay restores the Rafeeq 4
# application layer without replacing the underlying local content baseline.
cp -a vendor/rafeeq4-core/. app/src/main/assets/web/
