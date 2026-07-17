#!/usr/bin/env python3
"""Build one self-contained HTML file from the Gravity UI bundle and JSON data."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DEFAULT_TEMPLATE = ROOT / "gravity-app" / "dist" / "index.html"
DEFAULT_DATA = ROOT / "gravity-app" / "public" / "report-data.json"
DEFAULT_OUTPUT = ROOT / "gravity-standalone.html"
APP_MODES = ("viewer", "constructor")
APP_MODE_META_PATTERN = re.compile(
    r"<meta\b(?=[^>]*\bname\s*=\s*([\"'])dd-app-mode\1)[^>]*>",
    flags=re.IGNORECASE,
)
HEAD_PATTERN = re.compile(r"<head(?:\s[^>]*)?>", flags=re.IGNORECASE)


def set_app_mode(template: str, mode: str) -> str:
    if mode not in APP_MODES:
        raise ValueError(f"Unsupported app mode: {mode!r}")

    marker = f'<meta name="dd-app-mode" content="{mode}" />'
    template, marker_count = APP_MODE_META_PATTERN.subn(marker, template)
    if marker_count:
        return template

    template, head_count = HEAD_PATTERN.subn(
        lambda match: f"{match.group(0)}\n    {marker}",
        template,
        count=1,
    )
    if head_count == 0:
        raise ValueError("The template does not contain a <head> element for the app mode marker")
    return template


def build(
    template_path: Path,
    data_path: Path,
    output_path: Path,
    mode: str = "viewer",
) -> None:
    template = template_path.read_text(encoding="utf-8")
    data = json.dumps(
        json.loads(data_path.read_text(encoding="utf-8")),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    data = (
        data.replace("&", "\\u0026")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )
    replacement = (
        "Promise.resolve({ok: true, status: 200, "
        f"json: () => Promise.resolve({data})}})"
    )

    fetch_pattern = re.compile(
        r"fetch\(([\"'])\./report-data\.json\1(?:\s*,\s*\{\s*cache\s*:\s*([\"'])no-store\2\s*\})?\)"
    )
    template, replacement_count = fetch_pattern.subn(lambda _match: replacement, template)

    if replacement_count == 0:
        raise ValueError("The bundle does not contain the report-data fetch marker")

    template = set_app_mode(template, mode)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(template, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build standalone Gravity UI HTML")
    parser.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--mode", choices=APP_MODES, default="viewer")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    build(args.template, args.data, args.output, mode=args.mode)
    print(args.output)


if __name__ == "__main__":
    main()
