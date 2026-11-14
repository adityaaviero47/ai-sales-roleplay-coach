#!/usr/bin/env bash
# Downloads the CaSiNo dataset (CC BY 4.0) at a pinned commit and checks its SHA-256.
set -euo pipefail
COMMIT=2f6ed4a6a55110152a7699fbaa8150d6036314be
EXPECTED=4f2c4560a0070906ed018c3f0766e35f8f8f31b36274ebf35b608621915744ab
TMP=$(mktemp -d)
git clone -q https://github.com/kushalchawla/CaSiNo "$TMP/CaSiNo"
git -C "$TMP/CaSiNo" checkout -q "$COMMIT"
mkdir -p data
cp "$TMP/CaSiNo/data/casino.json" data/casino.json
cp "$TMP/CaSiNo/data/split/casino_test.json" data/casino_test.json
ACTUAL=$(sha256sum data/casino.json | cut -d' ' -f1)
if [ "$ACTUAL" != "$EXPECTED" ]; then echo "Checksum mismatch: $ACTUAL"; exit 1; fi
rm -rf "$TMP"
echo "Data ready: data/casino.json (checksum OK)"
