#!/usr/bin/env python3
"""Build the Gravity UI report from the upload workbook."""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "flat_table.xlsx"
DEFAULT_LEGACY_OUTPUT = ROOT / "final_report_from_excel.html"
DEFAULT_DATA_OUTPUT = ROOT / "gravity-app" / "public" / "report-data.json"
DEFAULT_BACKLOG_INPUT = ROOT / "sbertrack_all_full_history_to_export.xlsx"
DEFAULT_BACKLOG_DATA = ROOT / "gravity-app" / "public" / "backlog-data.json"
DEFAULT_INITIATIVES_DATA = ROOT / "gravity-app" / "public" / "initiatives-backlog.json"
DEFAULT_STANDALONE_OUTPUT = ROOT / "gravity-standalone.html"
DEFAULT_CROSSSELL_EXPORT = ROOT / "crosssell_export.json"
DEFAULT_HTML_REPORTS_DIRECTORY = ROOT / "source-html-reports" / "downloaded"
NPM_COMMAND = shutil.which("npm.cmd") or shutil.which("npm") or "npm"
DEFAULT_NODE_HEAP_MB = 8192
NODE_HEAP_FLAG = re.compile(
    r"(?:^|\s)--max[-_]old[-_]space[-_]size(?:=|\s)",
    flags=re.IGNORECASE,
)


def configured_path(variable: str, default: Path) -> Path:
    value = os.getenv(variable, "").strip()
    if not value:
        return default
    path = Path(value).expanduser()
    return path if path.is_absolute() else ROOT / path


def enabled_environment_flag(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes"}


def downloaded_html_reports_enabled() -> bool:
    if enabled_environment_flag(os.getenv("AI_HTML_BUILD_FROM_FILES", "")):
        return True
    return bool(
        os.getenv("AI_HTML_API_BASE_URL", "").strip()
        and os.getenv("AI_HTML_TOKEN", "").strip()
    )


def run(
    command: list[str],
    cwd: Path = ROOT,
    environment: dict[str, str] | None = None,
) -> None:
    subprocess.run(command, cwd=cwd, check=True, env=environment)


def frontend_environment() -> dict[str, str]:
    environment = os.environ.copy()
    node_options = environment.get("NODE_OPTIONS", "").strip()
    if NODE_HEAP_FLAG.search(node_options):
        return environment

    configured_heap = environment.get(
        "HTML_BUILD_NODE_HEAP_MB",
        str(DEFAULT_NODE_HEAP_MB),
    ).strip()
    try:
        heap_mb = int(configured_heap)
    except ValueError as error:
        raise ValueError("HTML_BUILD_NODE_HEAP_MB must be a positive integer") from error
    if heap_mb <= 0:
        raise ValueError("HTML_BUILD_NODE_HEAP_MB must be a positive integer")

    heap_option = f"--max-old-space-size={heap_mb}"
    environment["NODE_OPTIONS"] = (
        f"{node_options} {heap_option}" if node_options else heap_option
    )
    return environment


def build(args: argparse.Namespace) -> None:
    npm_command = os.getenv("NPM", "").strip() or NPM_COMMAND
    if not args.backlog_input.is_file():
        raise FileNotFoundError(f"Backlog source not found: {args.backlog_input}")
    report_command = [
        sys.executable,
        str(ROOT / "build_calc_report.py"),
        "--input",
        str(args.input),
        "--period",
        args.period,
        "--output",
        str(args.legacy_output),
        "--json-output",
        str(args.data_output),
        "--crosssell-json",
        str(args.crosssell_json),
    ]
    if args.no_ai_skills:
        report_command.append("--no-ai-skills")
    report_command.append("--crosssell")
    if args.no_update_crosssell:
        report_command.append("--no-update-crosssell")

    run(report_command)
    run(
        [
            sys.executable,
            str(ROOT / "build_backlog_data.py"),
            "--input",
            str(args.backlog_input),
            "--output",
            str(args.backlog_data),
        ]
    )
    if args.data_only:
        return

    npm_environment = frontend_environment()
    run(
        [npm_command, "run", "build:clickstream"],
        cwd=ROOT / "gravity-app",
        environment=npm_environment,
    )
    run(
        [npm_command, "run", "build"],
        cwd=ROOT / "gravity-app",
        environment=npm_environment,
    )
    standalone_command = [
        sys.executable,
        str(ROOT / "build_gravity_standalone.py"),
        "--data",
        str(args.data_output),
        "--output",
        str(args.standalone_output),
    ]
    if downloaded_html_reports_enabled():
        standalone_command.extend([
            "--html-page-root",
            str(configured_path("AI_HTML_REPORTS_DIR", DEFAULT_HTML_REPORTS_DIRECTORY)),
        ])
    standalone_command.extend(["--backlog-data", str(args.backlog_data)])
    standalone_command.extend(["--initiatives-data", str(args.initiatives_data)])
    run(standalone_command)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build report-data.json and the Gravity UI standalone report from "
            "flat_table.xlsx"
        )
    )
    parser.add_argument(
        "--input", type=Path, default=configured_path("INPUT_FILE", DEFAULT_INPUT)
    )
    parser.add_argument("--period", default=os.getenv("PERIOD", "II кв. 2026"))
    parser.add_argument(
        "--legacy-output",
        type=Path,
        default=configured_path("LEGACY_HTML", DEFAULT_LEGACY_OUTPUT),
    )
    parser.add_argument(
        "--data-output",
        type=Path,
        default=configured_path("REPORT_JSON", DEFAULT_DATA_OUTPUT),
    )
    parser.add_argument("--backlog-input", type=Path, default=DEFAULT_BACKLOG_INPUT)
    parser.add_argument("--backlog-data", type=Path, default=DEFAULT_BACKLOG_DATA)
    parser.add_argument("--initiatives-data", type=Path, default=DEFAULT_INITIATIVES_DATA)
    parser.add_argument(
        "--standalone-output",
        type=Path,
        default=configured_path("STANDALONE_HTML", DEFAULT_STANDALONE_OUTPUT),
    )
    parser.add_argument("--crosssell-json", type=Path, default=DEFAULT_CROSSSELL_EXPORT)
    parser.add_argument(
        "--no-ai-skills",
        action="store_true",
        help="Exclude AI skills and Cross-sell",
    )
    parser.add_argument(
        "--no-update-crosssell",
        action="store_true",
        help="Use the local Product Lens cache without a network request",
    )
    parser.add_argument(
        "--data-only",
        action="store_true",
        help="Generate report HTML and JSON without rebuilding the Gravity UI bundle",
    )
    return parser.parse_args(argv)


def main() -> None:
    build(parse_args())


if __name__ == "__main__":
    main()
