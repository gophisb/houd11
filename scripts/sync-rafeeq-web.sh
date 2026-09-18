#!/usr/bin/env bash
set -euo pipefail
REF="59eddc62f183e3aebefb6036095aa75b8c9b8873"
rm -rf app/src/main/assets/web
mkdir -p app/src/main/assets
git clone --quiet https://github.com/gophisb/ar-rafeeq3.git /tmp/ar-rafeeq3
cd /tmp/ar-rafeeq3
git checkout --quiet "$REF"
rm -rf .git .github
cd -
cp -a /tmp/ar-rafeeq3 app/src/main/assets/web
