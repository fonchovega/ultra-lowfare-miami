#!/usr/bin/env bash
set -euo pipefail

mkdir -p docs/data
cp -f data/*.json docs/data/ || true

./scripts/git_sync.sh push "pages: mirror data to docs/data"
