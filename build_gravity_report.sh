#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GRAVITY_APP_DIR="$REPOSITORY_DIR/gravity-app"
DEFAULT_UPLOAD_URL="https://oko-qs.sigma.sbrf.ru/prom/qrs/extension/45678_3_test_/uploadfile?externalpath=45678_3_test_.html&overwrite=true&xrfkey=NcxqOXsi37K3IXAO"

load_env() {
  local env_file=""

  if [[ -n "${DD_ENV_FILE:-}" ]]; then
    env_file="$DD_ENV_FILE"
    if [[ ! -f "$env_file" ]]; then
      echo "Environment file not found: $env_file" >&2
      exit 1
    fi
  elif [[ -f "$REPOSITORY_DIR/.env" ]]; then
    env_file="$REPOSITORY_DIR/.env"
  elif [[ -n "${HOME:-}" && -f "$HOME/Documents/Codex/DD-dev/.env" ]]; then
    env_file="$HOME/Documents/Codex/DD-dev/.env"
  fi

  if [[ -n "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
    echo "Loaded environment: $env_file"
  fi
}

DATA_ONLY=0
UPLOAD_ENABLED=1
STANDALONE_OUTPUT="$REPOSITORY_DIR/gravity-standalone.html"
FORWARD_ARGS=()
while (($# > 0)); do
  case "$1" in
    --data-only)
      DATA_ONLY=1
      FORWARD_ARGS+=("$1")
      shift
      ;;
    --no-upload)
      UPLOAD_ENABLED=0
      shift
      ;;
    --standalone-output)
      if (($# < 2)); then
        echo "--standalone-output requires a path." >&2
        exit 2
      fi
      STANDALONE_OUTPUT="$2"
      FORWARD_ARGS+=("$1" "$2")
      shift 2
      ;;
    --standalone-output=*)
      STANDALONE_OUTPUT="${1#*=}"
      FORWARD_ARGS+=("$1")
      shift
      ;;
    *)
      FORWARD_ARGS+=("$1")
      shift
      ;;
  esac
done

if ((DATA_ONLY == 1)); then
  UPLOAD_ENABLED=0
fi

load_env

UPLOAD_URL="${HTML_UPLOAD_URL:-$DEFAULT_UPLOAD_URL}"
UPLOAD_CERTIFICATE_PATH="${HTML_UPLOAD_CERT_PATH:-${HOME:+$HOME/Sandbox/certs/21090527.p12}}"
UPLOAD_CA_BUNDLE="${HTML_UPLOAD_CA_BUNDLE:-${HOME:+$HOME/Sandbox/certs/sberca-chain.pem}}"
UPLOAD_TIMEOUT="${HTML_UPLOAD_TIMEOUT:-120}"
UPLOAD_INSECURE=0
if [[ "${HTML_UPLOAD_INSECURE_TLS:-}" =~ ^(1|true|yes)$ ]]; then
  UPLOAD_INSECURE=1
fi

if ((UPLOAD_ENABLED == 1)); then
  if [[ -z "${HTML_UPLOAD_CERT_PASSWORD:-}" ]]; then
    echo "Set HTML_UPLOAD_CERT_PASSWORD or run with --no-upload." >&2
    exit 1
  fi
  if [[ -z "$UPLOAD_CERTIFICATE_PATH" || ! -f "$UPLOAD_CERTIFICATE_PATH" ]]; then
    echo "Upload certificate not found: ${UPLOAD_CERTIFICATE_PATH:-not configured}" >&2
    exit 1
  fi
  if ((UPLOAD_INSECURE == 0)) && [[ -n "$UPLOAD_CA_BUNDLE" && ! -f "$UPLOAD_CA_BUNDLE" ]]; then
    echo "Upload CA bundle not found: $UPLOAD_CA_BUNDLE" >&2
    exit 1
  fi
  if [[ ! "$UPLOAD_TIMEOUT" =~ ^[1-9][0-9]*$ ]]; then
    echo "HTML_UPLOAD_TIMEOUT must be a positive integer." >&2
    exit 1
  fi
fi

if ((DATA_ONLY == 0)); then
  if ! command -v npm >/dev/null 2>&1; then
    echo "npm is required for a full Gravity UI build." >&2
    exit 1
  fi

  if [[ ! -x "$GRAVITY_APP_DIR/node_modules/.bin/vite" ]]; then
    echo "Installing frontend dependencies..."
    (cd "$GRAVITY_APP_DIR" && npm ci)
  fi
fi

cd "$REPOSITORY_DIR"

run_builder() {
  if command -v uv >/dev/null 2>&1; then
    if ((${#FORWARD_ARGS[@]} > 0)); then
      uv run --python 3.11 --with pandas --with openpyxl \
        python build_gravity_report.py "${FORWARD_ARGS[@]}"
    else
      uv run --python 3.11 --with pandas --with openpyxl \
        python build_gravity_report.py
    fi
    return
  fi

  if command -v python3.11 >/dev/null 2>&1; then
    if ((${#FORWARD_ARGS[@]} > 0)); then
      python3.11 build_gravity_report.py "${FORWARD_ARGS[@]}"
    else
      python3.11 build_gravity_report.py
    fi
    return
  fi

  echo "Install uv or Python 3.11 to build the report." >&2
  exit 1
}

run_uploader() {
  local upload_args

  if [[ "$STANDALONE_OUTPUT" != /* ]]; then
    STANDALONE_OUTPUT="$REPOSITORY_DIR/$STANDALONE_OUTPUT"
  fi
  if [[ ! -f "$STANDALONE_OUTPUT" ]]; then
    echo "Standalone report not found: $STANDALONE_OUTPUT" >&2
    exit 1
  fi

  upload_args=(
    "$STANDALONE_OUTPUT"
    "$UPLOAD_URL"
    --cert-path "$UPLOAD_CERTIFICATE_PATH"
    --timeout "$UPLOAD_TIMEOUT"
  )
  if [[ -n "$UPLOAD_CA_BUNDLE" ]]; then
    upload_args+=(--ca-bundle "$UPLOAD_CA_BUNDLE")
  fi
  if ((UPLOAD_INSECURE == 1)); then
    upload_args+=(--insecure)
  fi

  if command -v uv >/dev/null 2>&1; then
    uv run --python 3.11 --with cryptography --with requests \
      python upload_html.py "${upload_args[@]}"
    return
  fi

  python3.11 upload_html.py "${upload_args[@]}"
}

run_builder
if ((UPLOAD_ENABLED == 1)); then
  run_uploader
fi
