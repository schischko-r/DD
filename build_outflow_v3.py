#!/usr/bin/env python3
"""Собрать outflow-tree-v3.html одним самодостаточным файлом.

В шаблон подставляются четыре куска: дерево оттоков, куб коммуникаций,
стили и бандл Gravity Charts. На выходе страница, которой не нужны ни
соседние файлы, ни сервер — её можно открыть с диска или залить как есть.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_TEMPLATE = ROOT / "outflow-tree-v3.template.html"
DEFAULT_OUTPUT = ROOT / "outflow-tree-v3.html"
DEFAULT_GRAPH = ROOT / "outflow-tree-graph.json"
DEFAULT_CUBE = ROOT / "prolongation-communications.json"
DEFAULT_CHARTS_JS = ROOT / "charts-dist" / "dd-charts.js"
DEFAULT_CHARTS_CSS = ROOT / "charts-dist" / "dd-charts.css"

PLACEHOLDERS = ("__GRAPH__", "__CUBE_JSON__", "/*__CHARTS_CSS__*/", "/*__CHARTS_JS__*/")


def read_text(path: Path, what: str) -> str:
    if not path.is_file():
        raise SystemExit(f"Не найден {what}: {path}")
    return path.read_text(encoding="utf-8")


def inline_json(path: Path, what: str) -> str:
    """Вернуть JSON одной строкой, безопасной внутри <script>."""
    payload = json.loads(read_text(path, what))
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    # Последовательность </ закрыла бы тег раньше времени.
    return text.replace("<", "\\u003c")


def build(template: Path, output: Path, graph: Path, cube: Path, charts_js: Path, charts_css: Path) -> int:
    page = read_text(template, "шаблон")
    missing = [name for name in PLACEHOLDERS if name not in page]
    if missing:
        raise SystemExit("В шаблоне нет плейсхолдеров: " + ", ".join(missing))

    page = page.replace("__GRAPH__", inline_json(graph, "дерево оттоков"), 1)
    page = page.replace("__CUBE_JSON__", inline_json(cube, "куб коммуникаций"), 1)
    page = page.replace("/*__CHARTS_CSS__*/", read_text(charts_css, "стили графиков"), 1)
    page = page.replace("/*__CHARTS_JS__*/", read_text(charts_js, "бандл графиков"), 1)

    output.write_text(page, encoding="utf-8")
    return len(page)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--graph", type=Path, default=DEFAULT_GRAPH)
    parser.add_argument("--cube", type=Path, default=DEFAULT_CUBE)
    parser.add_argument("--charts-js", type=Path, default=DEFAULT_CHARTS_JS)
    parser.add_argument("--charts-css", type=Path, default=DEFAULT_CHARTS_CSS)
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    size = build(args.template, args.output, args.graph, args.cube, args.charts_js, args.charts_css)
    print(f"{args.output}: {size / 1024 / 1024:.2f} МБ, внешних зависимостей нет")


if __name__ == "__main__":
    sys.exit(main())
