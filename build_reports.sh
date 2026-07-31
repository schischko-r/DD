#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILDER="$REPOSITORY_DIR/adhoc/report_merge_funnel_drafts/build_report.py"

usage() {
  cat >&2 <<'USAGE'
Usage:
  ./build_reports.sh
  ./build_reports.sh DRAFTS_HTML CLICKSTREAM_HTML LOSSHUNTER_HTML

Without arguments, the builder searches its standard input locations.
With arguments, pass the three source reports in this order:
  1. Черновики_все_продукты_zeroed.html
  2. Кликстрим_Месячный_все_воронки (1)_zeroed(1).html
  3. Рекомендации по коммуникациям с брошенными корзинами · ... .htm
USAGE
}

case "$#" in
  0)
    exec python3.11 "$BUILDER"
    ;;
  3)
    for source_path in "$@"; do
      if [[ ! -f "$source_path" ]]; then
        echo "Source report not found: $source_path" >&2
        exit 1
      fi
    done
    exec python3.11 "$BUILDER" \
      --drafts "$1" \
      --clickstream "$2" \
      --losshunter "$3"
    ;;
  *)
    usage
    exit 2
    ;;
esac
