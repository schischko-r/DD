#!/usr/bin/env python3
"""Build the Gravity UI report from the upload workbook."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "flat_table.xlsx"
DEFAULT_LEGACY_OUTPUT = ROOT / "final_report_from_excel.html"
DEFAULT_DATA_OUTPUT = ROOT / "gravity-app" / "public" / "report-data.json"
DEFAULT_STANDALONE_OUTPUT = ROOT / "gravity-standalone.html"
DEFAULT_AI_DIGEST = ROOT / "ai_skill_digest_export.xlsx"
DEFAULT_AI_PRODUCT_MAP = ROOT / "ai_product_mapping.xlsx"
DEFAULT_CROSSSELL_EXPORT = ROOT / "crosssell_export.json"
NPM_COMMAND = shutil.which("npm.cmd") or shutil.which("npm") or "npm"


def run(command: list[str], cwd: Path = ROOT) -> None:
    subprocess.run(command, cwd=cwd, check=True)


def build(args: argparse.Namespace) -> None:
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
        "--ai-digest-xlsx",
        str(args.ai_digest_xlsx),
        "--ai-product-map",
        str(args.ai_product_map),
        "--crosssell-json",
        str(args.crosssell_json),
        "--no-update-ai-digest",
        "--no-update-llm-summary",
        "--no-llm-log",
    ]
    if args.no_ai_skills:
        report_command.append("--no-ai-skills")
    elif args.skip_ai_digest:
        report_command.append("--skip-ai-digest")
    if args.skip_crosssell:
        report_command.append("--skip-crosssell")
    elif args.no_update_crosssell:
        report_command.append("--no-update-crosssell")

    run(report_command)
    if args.data_only:
        return

    run([NPM_COMMAND, "run", "build"], cwd=ROOT / "gravity-app")
    run(
        [
            sys.executable,
            str(ROOT / "build_gravity_standalone.py"),
            "--data",
            str(args.data_output),
            "--output",
            str(args.standalone_output),
        ]
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build report-data.json and the Gravity UI standalone report from "
            "flat_table.xlsx"
        )
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--period", default="II кв. 2026")
    parser.add_argument("--legacy-output", type=Path, default=DEFAULT_LEGACY_OUTPUT)
    parser.add_argument("--data-output", type=Path, default=DEFAULT_DATA_OUTPUT)
    parser.add_argument("--standalone-output", type=Path, default=DEFAULT_STANDALONE_OUTPUT)
    parser.add_argument("--ai-digest-xlsx", type=Path, default=DEFAULT_AI_DIGEST)
    parser.add_argument("--ai-product-map", type=Path, default=DEFAULT_AI_PRODUCT_MAP)
    parser.add_argument("--crosssell-json", type=Path, default=DEFAULT_CROSSSELL_EXPORT)
    parser.add_argument(
        "--skip-ai-digest",
        action="store_true",
        help="Build AI skill shells without enriching them from the local digest",
    )
    parser.add_argument(
        "--no-ai-skills",
        action="store_true",
        help="Exclude AI skills and do not read AI digest or product mapping files",
    )
    parser.add_argument(
        "--skip-crosssell",
        action="store_true",
        help="Exclude Product Lens cross-sell recommendations",
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
    return parser.parse_args()


def main() -> None:
    build(parse_args())


if __name__ == "__main__":
    main()
