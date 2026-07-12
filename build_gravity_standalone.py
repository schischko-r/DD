#!/usr/bin/env python3
"""Build one self-contained HTML file from the Gravity UI bundle and JSON data."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DEFAULT_TEMPLATE = ROOT / "gravity-app" / "dist" / "index.html"
DEFAULT_DATA = ROOT / "gravity-app" / "public" / "report-data.json"
DEFAULT_OUTPUT = ROOT / "gravity-standalone.html"


def build(template_path: Path, data_path: Path, output_path: Path) -> None:
    template = template_path.read_text(encoding="utf-8")
    data = json.dumps(
        json.loads(data_path.read_text(encoding="utf-8")),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    replacement = f"Promise.resolve({{json: () => Promise.resolve({data})}})"

    markers = ('fetch("./report-data.json")', "fetch('./report-data.json')")
    for marker in markers:
        template = template.replace(marker, replacement)

    if template == template_path.read_text(encoding="utf-8"):
        raise ValueError("The bundle does not contain the report-data fetch marker")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(template, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build standalone Gravity UI HTML")
    parser.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    build(args.template, args.data, args.output)
    print(args.output)


if __name__ == "__main__":
    main()
