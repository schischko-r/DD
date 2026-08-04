#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GRAVITY_APP_DIR="$REPOSITORY_DIR/gravity-app"

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
for argument in "$@"; do
  if [[ "$argument" == "--data-only" ]]; then
    DATA_ONLY=1
    break
  fi
done

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

load_env
cd "$REPOSITORY_DIR"

if command -v uv >/dev/null 2>&1; then
  exec uv run --python 3.11 --with pandas --with openpyxl \
    python build_gravity_report.py "$@"
fi

if command -v python3.11 >/dev/null 2>&1; then
  exec python3.11 build_gravity_report.py "$@"
fi

echo "Install uv or Python 3.11 to build the report." >&2
exit 1
