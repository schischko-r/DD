#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "${1:-}" in
  "")
    ;;
  --rebuild)
    python3.11 "$REPOSITORY_DIR/adhoc/report_merge_funnel_drafts/build_report.py"
    ;;
  *)
    echo "Usage: $0 [--rebuild]" >&2
    exit 2
    ;;
esac

cd "$REPOSITORY_DIR/gravity-app"
if [[ ! -x node_modules/.bin/vite ]]; then
  npm ci
fi

exec npm run dev
