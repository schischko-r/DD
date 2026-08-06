#!/usr/bin/env python3
"""Build the Gravity UI report from the upload workbook."""

from __future__ import annotations

import argparse
import os
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
DEFAULT_STANDALONE_OUTPUT = ROOT / "gravity-standalone.html"
DEFAULT_CROSSSELL_EXPORT = ROOT / "crosssell_export.json"
NPM_COMMAND = shutil.which("npm.cmd") or shutil.which("npm") or "npm"


def configured_path(variable: str, default: Path) -> Path:
    value = os.getenv(variable, "").strip()
    if not value:
        return default
    path = Path(value).expanduser()
    return path if path.is_absolute() else ROOT / path


def run(
    command: list[str],
    cwd: Path = ROOT,
    environment: dict[str, str] | None = None,
) -> None:
    subprocess.run(command, cwd=cwd, check=True, env=environment)


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

    run([npm_command, "run", "build:clickstream"], cwd=ROOT / "gravity-app")
    run(
        [npm_command, "run", "build"],
        cwd=ROOT / "gravity-app",
    )
    standalone_command = [
        sys.executable,
        str(ROOT / "build_gravity_standalone.py"),
        "--data",
        str(args.data_output),
        "--output",
        str(args.standalone_output),
    ]
    standalone_command.extend(["--backlog-data", str(args.backlog_data)])
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
