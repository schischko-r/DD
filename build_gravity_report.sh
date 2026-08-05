#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GRAVITY_APP_DIR="${GRAVITY_APP_DIR:-$REPOSITORY_DIR/gravity-app}"
NPM_BIN="${NPM:-npm}"
DEFAULT_UPLOAD_URL="https://oko-qs.sigma.sbrf.ru/prom/qrs/extension/45678_3_test_/uploadfile?externalpath=45678_3_test_.html&overwrite=true&xrfkey=NcxqOXsi37K3IXAO"

load_dotenv_file() {
  local env_file="$1"
  local line=""
  local key=""
  local value=""

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" != *=* ]] && continue

    key="${line%%=*}"
    value="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if ((${#value} >= 2)); then
      if [[ "${value:0:1}" == '"' && "${value:$((${#value} - 1)):1}" == '"' ]]; then
        value="${value:1:$((${#value} - 2))}"
      elif [[ "${value:0:1}" == "'" && "${value:$((${#value} - 1)):1}" == "'" ]]; then
        value="${value:1:$((${#value} - 2))}"
      fi
    fi
    if ! printenv "$key" >/dev/null 2>&1; then
      export "$key=$value"
    fi
  done < "$env_file"
}

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
    load_dotenv_file "$env_file"
    echo "Loaded environment: $env_file"
  fi
}

DATA_ONLY=0
UPLOAD_ENABLED=1
STANDALONE_OUTPUT="$REPOSITORY_DIR/gravity-standalone.html"
STANDALONE_OUTPUT_SET=0
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
    --upload)
      UPLOAD_ENABLED=1
      shift
      ;;
    --standalone-output)
      if (($# < 2)); then
        echo "--standalone-output requires a path." >&2
        exit 2
      fi
      STANDALONE_OUTPUT="$2"
      STANDALONE_OUTPUT_SET=1
      FORWARD_ARGS+=("$1" "$2")
      shift 2
      ;;
    --standalone-output=*)
      STANDALONE_OUTPUT="${1#*=}"
      STANDALONE_OUTPUT_SET=1
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

select_python() {
  if [[ -n "${PYTHON:-}" ]]; then
    PYTHON_BIN="$PYTHON"
    PYTHON_RUNTIME_SOURCE="PYTHON"
  else
    PYTHON_BIN="python3"
    PYTHON_RUNTIME_SOURCE="python3"
  fi

  if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
    echo "Python executable not found: $PYTHON_BIN" >&2
    exit 1
  fi

  echo "Python runtime: $PYTHON_BIN ($PYTHON_RUNTIME_SOURCE)"
}

select_python
NPM_BIN="${NPM:-$NPM_BIN}"
if ((STANDALONE_OUTPUT_SET == 0)) && [[ -n "${STANDALONE_HTML:-}" ]]; then
  STANDALONE_OUTPUT="$STANDALONE_HTML"
fi

UPLOAD_URL="${HTML_UPLOAD_URL:-$DEFAULT_UPLOAD_URL}"
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
  if [[ ! "$UPLOAD_TIMEOUT" =~ ^[1-9][0-9]*$ ]]; then
    echo "HTML_UPLOAD_TIMEOUT must be a positive integer." >&2
    exit 1
  fi
fi

if ((DATA_ONLY == 0)); then
  if ! command -v "$NPM_BIN" >/dev/null 2>&1; then
    echo "npm executable not found: $NPM_BIN" >&2
    exit 1
  fi

  if [[ ! -x "$GRAVITY_APP_DIR/node_modules/.bin/vite" ]]; then
    echo "Installing frontend dependencies..."
    (cd "$GRAVITY_APP_DIR" && "$NPM_BIN" ci)
  fi
fi

cd "$REPOSITORY_DIR"

run_builder() {
  if ((${#FORWARD_ARGS[@]} > 0)); then
    "$PYTHON_BIN" build_gravity_report.py "${FORWARD_ARGS[@]}"
  else
    "$PYTHON_BIN" build_gravity_report.py
  fi
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
    --timeout "$UPLOAD_TIMEOUT"
  )
  if [[ -n "${HTML_UPLOAD_CERT_PATH:-}" ]]; then
    upload_args+=(--cert-path "$HTML_UPLOAD_CERT_PATH")
  fi
  if [[ -n "${HTML_UPLOAD_CA_BUNDLE:-}" ]]; then
    upload_args+=(--ca-bundle "$HTML_UPLOAD_CA_BUNDLE")
  fi
  if ((UPLOAD_INSECURE == 1)); then
    upload_args+=(--insecure)
  fi

  "$PYTHON_BIN" upload_html.py "${upload_args[@]}"
}

run_builder
if ((UPLOAD_ENABLED == 1)); then
  run_uploader
fi
