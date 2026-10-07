#!/usr/bin/env python3
"""Собрать prolongation.html, вшив в неё страницу дерева оттоков.

Рекомендации на плашке открывают не соседний файл, а тот же самый документ:
дерево и лист «Коммуникации по пролонгации» лежат внутри страницы строкой
JSON и подставляются в iframe. Сборка мирроит build_outflow_v3.py.
"""

from __future__ import annotations

import argparse
import base64
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_TEMPLATE = ROOT / "prolongation.template.html"
DEFAULT_OUTPUT = ROOT / "prolongation.html"
DEFAULT_TREE = ROOT / "outflow-tree-v3.html"

PLACEHOLDER = "__TREE_PAGE__"
DATA_PLACEHOLDER = "__REPORT_DATA__"
DEFAULT_DATA = ROOT / "prolongation-data.json"
CHART_STYLESHEET = ROOT / "charts-dist" / "dd-charts.css"
CHART_SCRIPT = ROOT / "charts-dist" / "dd-charts.js"
JOURNEY_ANALYSIS = ROOT / "losshunter-закрытие-продуктов.html"
JOURNEY_LINK = 'href="./losshunter-закрытие-продуктов.html"'
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


def inline_assets(page: str) -> str:
    """Keep the generated report usable inside a standalone srcdoc iframe."""
    assets = (
        ('<link rel="stylesheet" href="./charts-dist/dd-charts.css">',
         CHART_STYLESHEET, "style"),
        ('<script src="./charts-dist/dd-charts.js"></script>',
         CHART_SCRIPT, "script"),
    )
    for marker, path, tag in assets:
        if marker not in page:
            raise SystemExit(f"В шаблоне нет подключения {path.name}")
        content = read_text(path, path.name)
        content = "\n".join(line.rstrip() for line in content.split("\n"))
        content = re.sub(rf"</{tag}", rf"<\\/{tag}", content, flags=re.IGNORECASE)
        page = page.replace(marker, f"<{tag}>{content}</{tag}>", 1)
    return page


def inline_journey_analysis(page: str) -> str:
    """Make the visible full-analysis link work from a single HTML file."""
    if JOURNEY_LINK not in page:
        raise SystemExit("В шаблоне нет ссылки на полную аналитику пути")
    analysis = read_text(JOURNEY_ANALYSIS, "полная аналитика пути")
    analysis = analysis.replace("<head>", '<head><base href="https://losshunter.ru/">', 1)
    encoded = base64.b64encode(analysis.encode("utf-8")).decode("ascii")
    script = (
        '<script type="application/octet-stream" id="journey-analysis-html">'
        f"{encoded}</script>\n"
        "<script>(function(){"
        "const link=document.querySelector('.journey-footer a');"
        "const source=document.getElementById('journey-analysis-html');"
        "if(!link||!source)return;"
        "const bytes=Uint8Array.from(atob(source.textContent),c=>c.charCodeAt(0));"
        "link.href=URL.createObjectURL(new Blob([bytes],{type:'text/html;charset=utf-8'}));"
        "link.target='_blank';link.rel='noopener';"
        "})();</script>"
    )
    return page.replace("</body>", f"{script}\n</body>", 1)


def build(template: Path, output: Path, tree: Path, data: Path) -> int:
    page = read_text(template, "шаблон")
    for name in (PLACEHOLDER, DATA_PLACEHOLDER):
        if name not in page:
            raise SystemExit(f"В шаблоне нет плейсхолдера {name}")

    page = inline_assets(page)
    page = inline_journey_analysis(page)
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
