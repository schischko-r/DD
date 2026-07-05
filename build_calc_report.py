#!/usr/bin/env python3
"""Build one standalone Data-Driven report from Расчет_список(1).xlsx."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from build_dd_from_excel import DEFAULT_PERIOD, build_report_data
from build_dd_json2 import build_embedded_html
from build_title_from_excel import build_payload as build_title_payload
from build_title_from_excel import read_rows as read_title_rows


DEFAULT_INPUT = Path("Расчет_список(1).xlsx")
DEFAULT_TITLE_SHEET = "титул"
DEFAULT_DETAIL_SHEET = "деталка"
DEFAULT_OUTPUT = Path("final_report_from_excel.html")


def build_combined_data(
    input_path: Path,
    title_sheet: str,
    detail_sheet: str,
    period: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    title_rows = read_title_rows(input_path, title_sheet)
    title_payload = build_title_payload(title_rows)
    detail_data, detail_summary = build_report_data(input_path, detail_sheet, period)

    combined = {
        **detail_data,
        "title": title_payload,
    }
    summary = {
        **detail_summary,
        "title_rows": len(title_rows),
        "title_units": len(title_payload["units"]),
        "title_types": len(title_payload["types"]),
    }
    return combined, summary


def write_html(data: dict[str, Any], output_path: Path) -> None:
    output_path.write_text(
        build_embedded_html(data, "Data-Driven Index - отчет из Расчет"),
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate one standalone Data-Driven title+detail HTML from Расчет_список(1).xlsx",
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Path to source .xlsx")
    parser.add_argument("--title-sheet", default=DEFAULT_TITLE_SHEET, help="Title sheet name")
    parser.add_argument("--detail-sheet", default=DEFAULT_DETAIL_SHEET, help="Detail sheet name")
    parser.add_argument("--period", default=DEFAULT_PERIOD, help="Period label")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output standalone HTML path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data, summary = build_combined_data(
        args.input,
        args.title_sheet,
        args.detail_sheet,
        args.period,
    )
    write_html(data, args.output)
    print(json.dumps({"html": str(args.output), **summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
