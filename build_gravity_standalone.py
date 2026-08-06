#!/usr/bin/env python3
"""Build one self-contained HTML file from the Gravity UI bundle and JSON data."""

from __future__ import annotations

import argparse
import base64
import html
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DEFAULT_TEMPLATE = ROOT / "gravity-app" / "dist" / "index.html"
DEFAULT_DATA = ROOT / "gravity-app" / "public" / "report-data.json"
DEFAULT_BACKLOG_DATA = ROOT / "gravity-app" / "public" / "backlog-data.json"
DEFAULT_OUTPUT = ROOT / "gravity-standalone.html"
HTML_PAGE_MANIFEST_PATTERN = re.compile(
    r'<script\b'
    r'(?=[^>]*\bid=["\']ddi-html-page-manifest["\'])'
    r'(?=[^>]*\btype=["\']application/json["\'])'
    r'[^>]*>(?P<manifest>.*?)</script>',
    re.DOTALL,
)
BASE64_CHUNK_SIZE = 3 * 1024 * 1024


def _adjacent_html_page_path(value: object) -> Path | None:
    if not isinstance(value, str) or not value:
        return None
    if "/" in value or "\\" in value or not value.lower().endswith(".html"):
        return None
    path = Path(value)
    if path.is_absolute() or path.name != value:
        return None
    return path


def _write_base64(source_path: Path, output) -> None:
    with source_path.open("rb") as source:
        while chunk := source.read(BASE64_CHUNK_SIZE):
            output.write(base64.b64encode(chunk))


def _embed_html_pages_incrementally(
    template: str,
    output_path: Path,
    html_page_root: Path,
) -> None:
    manifest_match = HTML_PAGE_MANIFEST_PATTERN.search(template)
    if not manifest_match:
        output_path.write_text(template, encoding="utf-8")
        return

    manifest = json.loads(manifest_match.group("manifest"))
    if not isinstance(manifest, dict):
        raise ValueError("The HTML page manifest must be a JSON object")

    with output_path.open("wb") as output:
        output.write(template[: manifest_match.start()].encode("utf-8"))
        for page_id, configured_path in manifest.items():
            relative_path = _adjacent_html_page_path(configured_path)
            if not isinstance(page_id, str) or relative_path is None:
                raise ValueError("The HTML page manifest contains an invalid entry")
            source_path = html_page_root / relative_path
            if not source_path.is_file():
                continue
            escaped_id = html.escape(page_id, quote=True)
            output.write(
                (
                    '<script type="application/octet-stream" '
                    f'data-ddi-html-page-id="{escaped_id}">'
                ).encode("utf-8")
            )
            _write_base64(source_path, output)
            output.write(b"</script>")
        output.write(template[manifest_match.end() :].encode("utf-8"))


def _load_json(path: Path) -> str:
    data = json.dumps(
        json.loads(path.read_text(encoding="utf-8")),
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
    return data


def _replacement(data: str) -> str:
    return f"Promise.resolve({{ok: true, json: () => Promise.resolve({data})}})"


def build(
    template_path: Path,
    data_path: Path,
    output_path: Path,
    html_page_root: Path = ROOT,
    backlog_data_path: Path | None = None,
) -> None:
    template = template_path.read_text(encoding="utf-8")
    replacement = _replacement(_load_json(data_path))

    fetch_pattern = re.compile(
        r"fetch\(([\"'])\./report-data\.json\1(?:\s*,\s*\{\s*cache\s*:\s*([\"'])no-store\2\s*\})?\)"
    )
    template, replacement_count = fetch_pattern.subn(lambda _match: replacement, template)

    if replacement_count == 0:
        raise ValueError("The bundle does not contain the report-data fetch marker")

    if backlog_data_path is not None:
        backlog_replacement = _replacement(_load_json(backlog_data_path))
        backlog_fetch_pattern = re.compile(
            r"fetch\(([\"'])\./backlog-data\.json\1(?:\s*,\s*\{\s*cache\s*:\s*([\"'])no-store\2\s*\})?\)"
        )
        template, backlog_replacement_count = backlog_fetch_pattern.subn(
            lambda _match: backlog_replacement, template
        )
        if backlog_replacement_count == 0:
            raise ValueError("The bundle does not contain the backlog-data fetch marker")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    _embed_html_pages_incrementally(template, output_path, html_page_root)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build standalone Gravity UI HTML")
    parser.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--backlog-data", type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--html-page-root", type=Path, default=ROOT)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    build(
        args.template,
        args.data,
        args.output,
        html_page_root=args.html_page_root,
        backlog_data_path=args.backlog_data,
    )
    print(args.output)


if __name__ == "__main__":
    main()
