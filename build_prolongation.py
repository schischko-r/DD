#!/usr/bin/env python3
"""Собрать prolongation.html, вшив в неё страницу дерева оттоков.

Рекомендации на плашке открывают не соседний файл, а тот же самый документ:
дерево и лист «Коммуникации по пролонгации» лежат внутри страницы строкой
JSON и подставляются в iframe. Сборка мирроит build_outflow_v3.py.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_TEMPLATE = ROOT / "prolongation.template.html"
DEFAULT_OUTPUT = ROOT / "prolongation.html"
DEFAULT_TREE = ROOT / "outflow-tree-v3.html"

PLACEHOLDER = "__TREE_PAGE__"
DATA_PLACEHOLDER = "__REPORT_DATA__"
DEFAULT_DATA = ROOT / "prolongation-data.json"
# Литерал, который встраивающая страница подменяет на нужный вид дерева.
VIEW_MARK = "/*__INITIAL_VIEW__*/null"


def read_text(path: Path, what: str) -> str:
    if not path.is_file():
        raise SystemExit(f"Не найден {what}: {path}")
    return path.read_text(encoding="utf-8")


def inline_page(text: str) -> str:
    """Вернуть HTML строкой JSON, безопасной внутри <script>."""
    # Экранируем каждый «<»: иначе «</script» закроет тег раньше времени.
    return json.dumps(text, ensure_ascii=False).replace("<", "\\u003c")


def inline_json(text: str) -> str:
    """Вернуть готовый JSON одной строкой — страница читает его объектом.

    Отличается от inline_page: там строка с HTML, здесь сам документ.
    """
    payload = json.loads(text)
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def build(template: Path, output: Path, tree: Path, data: Path) -> int:
    page = read_text(template, "шаблон")
    for name in (PLACEHOLDER, DATA_PLACEHOLDER):
        if name not in page:
            raise SystemExit(f"В шаблоне нет плейсхолдера {name}")

    page = page.replace(DATA_PLACEHOLDER, inline_json(read_text(data, "данные отчёта")), 1)

    tree_html = read_text(tree, "страница дерева")
    if tree_html.count(VIEW_MARK) != 1:
        raise SystemExit(
            f"В {tree.name} ожидался ровно один {VIEW_MARK} — "
            "пересоберите дерево через build_outflow_v3.py"
        )

    page = page.replace(PLACEHOLDER, inline_page(tree_html), 1)
    output.write_text(page, encoding="utf-8")
    return len(page)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--tree", type=Path, default=DEFAULT_TREE)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    size = build(args.template, args.output, args.tree, args.data)
    print(f"{args.output}: {size / 1024 / 1024:.2f} МБ, дерево и данные вшиты")


if __name__ == "__main__":
    sys.exit(main())
