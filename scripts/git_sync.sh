#!/usr/bin/env bash
set -euo pipefail

BRANCH="main"
REMOTE="origin"

cmd="${1:-help}"

case "$cmd" in
  status)
    echo "== Estado =="
    git remote -v
    git status -sb
    echo
    echo "Commits locales no subidos:"
    git log --oneline ${REMOTE}/${BRANCH}..HEAD || true
    echo
    echo "Commits remotos no bajados:"
    git log --oneline HEAD..${REMOTE}/${BRANCH} || true
    ;;
  pull)
    echo "== PULL (rebase + auto-stash) =="
    git fetch ${REMOTE} ${BRANCH}
    git stash push -u -m "sync:autostash $(date -u +%FT%TZ)" || true
    git pull --rebase ${REMOTE} ${BRANCH} || {
      echo "Conflictos. Resuélvelos y 'git rebase --continue'." >&2
      exit 1
    }
    if git stash list | grep -q "sync:autostash"; then
      git stash pop || true
    fi
    echo "[OK] Pull terminado."
    ;;
  force-pull)
    echo "== FORCE PULL (RESET DURO A REMOTO) =="
    git fetch ${REMOTE} ${BRANCH}
    git reset --hard ${REMOTE}/${BRANCH}
    git clean -fd
    echo "[OK] Working tree igual al remoto."
    ;;
  push)
    msg="${2:-sync: update $(date -u +%FT%TZ)}"
    echo "== PUSH (rebase-safe) =="
    git add -A
    git commit -m "${msg}" || echo "Nada que commitear."
    git fetch ${REMOTE} ${BRANCH}
    git pull --rebase ${REMOTE} ${BRANCH} || {
      echo "Conflictos en rebase antes de subir. Resuélvelos." >&2
      exit 1
    }
    git push ${REMOTE} ${BRANCH}
    echo "[OK] Push terminado."
    ;;
  force-push)
    msg="${2:-sync(force): $(date -u +%FT%TZ)}"
    echo "== FORCE PUSH WITH LEASE =="
    git add -A
    git commit -m "${msg}" || echo "Nada que commitear."
    git fetch ${REMOTE} ${BRANCH}
    git push --force-with-lease ${REMOTE} ${BRANCH}
    echo "[OK] Force-push terminado."
    ;;
  *)
    echo "Uso:"
    echo "  $0 status"
    echo "  $0 pull"
    echo "  $0 push \"mensaje\""
    echo "  $0 force-pull"
    echo "  $0 force-push \"mensaje\""
    ;;
esac
