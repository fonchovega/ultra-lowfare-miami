#!/usr/bin/env bash
set -euo pipefail

git config pull.rebase true
git config rebase.autoStash true
git config fetch.prune true

git config user.name "fonchovega"
git config user.email "github-actions[bot]@users.noreply.github.com"

git config core.autocrlf input
git config --global --add safe.directory "$(pwd)"

echo "[OK] Git configurado para sincronizaciones limpias."
