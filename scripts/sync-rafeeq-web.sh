#!/usr/bin/env bash
set -euo pipefail

REF="48e5658925650a94cd516078723cb6c2e6dd51ee"

rm -rf app/src/main/assets/web
mkdir -p app/src/main/assets

# Ar-Rafeeq 4 is the source of truth for the Android web layer.
git clone --quiet https://github.com/gophisb/ar-rafeeq4.git /tmp/ar-rafeeq4
cd /tmp/ar-rafeeq4
git checkout --quiet "$REF"
rm -rf .git .github
cd -

cp -a /tmp/ar-rafeeq4/. app/src/main/assets/web/

# Keep the native Android shell in houd11; the web application comes from
# the verified Ar-Rafeeq 4 source above.
