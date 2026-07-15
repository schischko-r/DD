#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON:-python3}"
NPM_BIN="${NPM:-npm}"
INPUT_FILE="${INPUT_FILE:-flat_table.xlsx}"
PERIOD="${PERIOD:-II кв. 2026}"
AI_DIGEST_FILE="${AI_DIGEST_FILE:-ai_skill_digest_export.xlsx}"
AI_PRODUCT_MAP_FILE="${AI_PRODUCT_MAP_FILE:-ai_product_mapping.xlsx}"
LEGACY_HTML="${LEGACY_HTML:-final_report_from_excel.html}"
REPORT_JSON="${REPORT_JSON:-gravity-app/public/report-data.json}"
STANDALONE_HTML="${STANDALONE_HTML:-gravity-standalone.html}"

for required_file in "$INPUT_FILE" "$AI_DIGEST_FILE" "$AI_PRODUCT_MAP_FILE"; do
  if [[ ! -f "$required_file" ]]; then
    printf 'Required file not found: %s\n' "$required_file" >&2
    exit 1
  fi
done

if [[ ! -f .env ]]; then
  printf 'Missing .env. Add GIGACHAT_TOKEN and GIGACHAT_AUTH_URL.\n' >&2
  exit 1
fi

"$PYTHON_BIN" - <<'PY'
try:
    from langchain_gigachat.chat_models.gigachat import GigaChat  # noqa: F401
except ModuleNotFoundError:
    raise SystemExit(
        "Missing Python package: run `python3 -m pip install langchain-gigachat`."
    )

import build_calc_report as report

if not report.gigachat_is_configured():
    raise SystemExit(
        "GigaChat is not configured. Set GIGACHAT_TOKEN and "
        "GIGACHAT_AUTH_URL in .env."
    )
PY

"$PYTHON_BIN" build_calc_report.py \
  --input "$INPUT_FILE" \
  --period "$PERIOD" \
  --output "$LEGACY_HTML" \
  --json-output "$REPORT_JSON" \
  --ai-digest-xlsx "$AI_DIGEST_FILE" \
  --ai-product-map "$AI_PRODUCT_MAP_FILE" \
  --no-update-ai-digest \
  --update-llm-summary \
  --llm-log

if [[ ! -d gravity-app/node_modules ]]; then
  "$NPM_BIN" --prefix gravity-app ci
fi

"$NPM_BIN" --prefix gravity-app run build

"$PYTHON_BIN" build_gravity_standalone.py \
  --data "$REPORT_JSON" \
  --output "$STANDALONE_HTML"

printf 'LLM report built: %s\n' "$ROOT_DIR/$STANDALONE_HTML"
