#!/usr/bin/env sh
set -eu

REPO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUTPUT_DIR="$REPO_DIR/public/downloads"
ARCHIVE="$OUTPUT_DIR/fitcrm-access-bridge.zip"

mkdir -p "$OUTPUT_DIR"
rm -f "$ARCHIVE" "$ARCHIVE.sha256"

cd "$REPO_DIR"
zip -X -q -r "$ARCHIVE" bridge \
  -x 'bridge/test/*' \
     'bridge/data/*' \
     'bridge/config.json' \
     'bridge/.DS_Store'

cd "$OUTPUT_DIR"
shasum -a 256 "$(basename "$ARCHIVE")" > "$(basename "$ARCHIVE").sha256"
