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
DEFAULT_INITIATIVES_DATA = ROOT / "gravity-app" / "public" / "initiatives-backlog.json"
DEFAULT_CJXPLORER_SUMMARY_DATA = ROOT / "gravity-app" / "public" / "cjxplorer-summary.json"
DEFAULT_CJXPLORER_CREDIT_CARD_DATA = ROOT / "gravity-app" / "public" / "cjxplorer-credit-card.json"
DEFAULT_CJXPLORER_PRODUCT_DETAILS_DATA = ROOT / "gravity-app" / "public" / "cjxplorer-product-details.json"
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


def _embed_json_fetch(template: str, data_path: Path, filename: str) -> str:
    replacement = _replacement(_load_json(data_path))
    fetch_pattern = re.compile(
        rf"fetch\(([\"'])\./{re.escape(filename)}\1(?:\s*,\s*\{{\s*cache\s*:\s*([\"'])no-store\2\s*\}})?\)"
    )
    template, replacement_count = fetch_pattern.subn(lambda _match: replacement, template)
    if replacement_count == 0:
        raise ValueError(
            f"The bundle does not contain the {filename.removesuffix('.json')} fetch marker"
        )
    return template


def build(
    template_path: Path,
    data_path: Path,
    output_path: Path,
    html_page_root: Path = ROOT,
    backlog_data_path: Path | None = None,
    initiatives_data_path: Path | None = None,
    cjxplorer_summary_data_path: Path | None = None,
    cjxplorer_credit_card_data_path: Path | None = None,
    cjxplorer_product_details_data_path: Path | None = None,
) -> None:
    template = template_path.read_text(encoding="utf-8")
    template = _embed_json_fetch(template, data_path, "report-data.json")

    if backlog_data_path is not None:
        template = _embed_json_fetch(template, backlog_data_path, "backlog-data.json")
    if initiatives_data_path is not None:
        template = _embed_json_fetch(
            template,
            initiatives_data_path,
            "initiatives-backlog.json",
        )

    for data_path, filename in (
        (cjxplorer_summary_data_path, "cjxplorer-summary.json"),
        (cjxplorer_credit_card_data_path, "cjxplorer-credit-card.json"),
        (cjxplorer_product_details_data_path, "cjxplorer-product-details.json"),
    ):
        if data_path is not None:
            template = _embed_json_fetch(template, data_path, filename)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    _embed_html_pages_incrementally(template, output_path, html_page_root)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build standalone Gravity UI HTML")
    parser.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--backlog-data", type=Path)
    parser.add_argument("--initiatives-data", type=Path, default=DEFAULT_INITIATIVES_DATA)
    parser.add_argument("--cjxplorer-summary-data", type=Path, default=DEFAULT_CJXPLORER_SUMMARY_DATA)
    parser.add_argument("--cjxplorer-credit-card-data", type=Path, default=DEFAULT_CJXPLORER_CREDIT_CARD_DATA)
    parser.add_argument("--cjxplorer-product-details-data", type=Path, default=DEFAULT_CJXPLORER_PRODUCT_DETAILS_DATA)
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
        initiatives_data_path=args.initiatives_data,
        cjxplorer_summary_data_path=args.cjxplorer_summary_data,
        cjxplorer_credit_card_data_path=args.cjxplorer_credit_card_data,
        cjxplorer_product_details_data_path=args.cjxplorer_product_details_data,
    )
    print(args.output)


if __name__ == "__main__":
    main()
