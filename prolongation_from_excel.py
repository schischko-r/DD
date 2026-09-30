#!/usr/bin/env python3
"""Excel → prolongation.html одной командой.

    python prolongation_from_excel.py                      # prolong.xlsx рядом
    python prolongation_from_excel.py ~/Downloads/prolong.xlsx
    python prolongation_from_excel.py prolong.xlsx -o report.html

Прогоняет по очереди три сборки: данные из выгрузки (build_report_data),
страницу дерева (build_outflow_v3) и итоговую страницу (build_prolongation).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import build_outflow_v3
import build_prolongation
import build_report_data


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("workbook", nargs="?", type=Path, default=build_report_data.DEFAULT_WORKBOOK,
                        help="выгрузка prolong.xlsx (по умолчанию — рядом со скриптом)")
    parser.add_argument("-o", "--output", type=Path, default=build_prolongation.DEFAULT_OUTPUT,
                        help="куда положить HTML (по умолчанию prolongation.html)")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)

    print("1/3 данные из выгрузки")
    build_report_data.build(args.workbook.expanduser(), build_report_data.DEFAULT_TREE,
                            build_report_data.DEFAULT_PAGE, build_report_data.DEFAULT_BENCHMARK)

    print("2/3 дерево оттоков")
    build_outflow_v3.build(build_outflow_v3.DEFAULT_TEMPLATE, build_outflow_v3.DEFAULT_OUTPUT,
                           build_outflow_v3.DEFAULT_GRAPH, build_outflow_v3.DEFAULT_CUBE,
                           build_outflow_v3.DEFAULT_CHARTS_JS, build_outflow_v3.DEFAULT_CHARTS_CSS)

    print("3/3 страница пролонгации")
    output = args.output.expanduser()
    size = build_prolongation.build(build_prolongation.DEFAULT_TEMPLATE, output,
                                    build_prolongation.DEFAULT_TREE, build_prolongation.DEFAULT_DATA)
    print(f"Готово: {output.resolve()} ({size / 1024 / 1024:.2f} МБ)")


if __name__ == "__main__":
    sys.exit(main())
