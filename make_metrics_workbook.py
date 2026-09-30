#!/usr/bin/env python3
"""Создать книгу метрик отчёта по оттоку — шаблон под ручное наполнение.

Один файл держит все цифры отчёта и всегда в двух разрезах: клиенты (_clnt)
и деньги (_rur). Разрез выбирается на странице отчёта, поэтому обе колонки
обязательны у каждой метрики — иначе переключатель упрётся в пустоту.

Реальные данные на сегодня: лист «Дерево», колонки B:H, строки 2026-04-30 …
2026-06-30. Всё остальное — синтетика под формат, её и надо заменить.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent
DEFAULT_OUTPUT = ROOT / "outflow-report-metrics.xlsx"

FONT = "Arial"
INK = Font(name=FONT, size=10)
INPUT_INK = Font(name=FONT, size=10, color="0000FF")      # синий — руками
FORMULA_INK = Font(name=FONT, size=10)                    # чёрный — формула
HEAD_INK = Font(name=FONT, size=10, bold=True, color="FFFFFF")
TITLE_INK = Font(name=FONT, size=12, bold=True)
NOTE_INK = Font(name=FONT, size=9, color="808080")
HEAD_FILL = PatternFill("solid", fgColor="35516B")
CHECK_FILL = PatternFill("solid", fgColor="FFF7E0")
REAL_FILL = PatternFill("solid", fgColor="EAF3EA")
THIN = Side(style="thin", color="D9D9D9")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

RUR = "#,##0"
CLNT = "#,##0"
PCT = "0.00%"

# ── периоды ───────────────────────────────────────────────────────────────
PERIODS = [
    "2025-07-31", "2025-08-31", "2025-09-30", "2025-10-31", "2025-11-30", "2025-12-31",
    "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30",
]
REAL_FROM = "2026-04-30"

# ── дерево: рубли ─────────────────────────────────────────────────────────
# Три последних месяца — выгрузка tree_portfolio_*. Девять предыдущих собраны
# синтетически по тем же пропорциям, чтобы спарклайны и светофор было на чём
# проверить. Значения в млрд, в книгу уходят в рублях.
PORTFOLIO_BN = [17420, 17610, 17820, 18010, 18190, 18480, 18560, 18610, 18655,
                18642.1287930121811, 18461.5337593156729, 18423.1680462625521]
PROLONG_BN = [3980, 4120, 4260, 4390, 4510, 5120, 4780, 4520, 4660,
              4909.2620396530009, 4073.7160170643042, 4432.3913916598566]
NOT_PROLONG_BN = [198, 206, 214, 224, 232, 268, 252, 238, 246,
                  230.5680533323185, 312.1086828182544, 240.5126324982322]
PROLONG_EROSION_BN = [18.9, 19.6, 20.4, 21.3, 22.1, 25.8, 24.1, 22.7, 23.5,
                      22.647214628, 29.924086407, 31.834114941]
# Доля выведенного за 30 дней от прошедших пролонгацию.
LEFT30_SHARE = [0.235, 0.232, 0.228, 0.225, 0.221, 0.240, 0.233, 0.227, 0.223,
                0.21618, 0.15969, 0.14247]
# Остаток «прошли − осело − вывели за 30 дней»: в выгрузке он не нулевой.
RESIDUAL_SHARE = [0.0130, 0.0128, 0.0126, 0.0124, 0.0122, 0.0135, 0.0128, 0.0124, 0.0120,
                  0.01388, 0.00996, 0.00658]

# Средний чек по узлу, ₽ — только чтобы получить клиентский разрез синтетики.
TICKET = {
    "portfolio": 365_000, "prolong": 920_000, "not_prolong_errosion": 1_100_000,
    "prolong_erosion": 1_400_000, "prolong_left_after_30d": 545_000,
    "prolong_settlement": 1_020_000,
}

TREE_RUR_COLUMNS = [
    "tree_portfolio_rur", "tree_portfolio_prolong_rur",
    "tree_portfolio_not_prolong_errosion_rur", "tree_portfolio_prolong_erosion_rur",
    "tree_portfolio_prolong_passed_rur", "tree_portfolio_prolong_left_after_30d_rur",
    "tree_portfolio_prolong_settlement_rur",
]
TREE_CLNT_COLUMNS = [name[:-4] + "_clnt" for name in TREE_RUR_COLUMNS]

# ── воронки ───────────────────────────────────────────────────────────────
FUNNELS = [
    {"id": "base", "name": "Отток обычный", "note": "Когорта без промо-коммуникации",
     "share": 0.65, "ticket": 1.00,
     "ratios": {"prolonged": 0.952, "closed_after": 0.372, "net_outflow": 0.695, "not_waited": 0.048}},
    {"id": "promo", "name": "Отток с промо", "note": "Когорта с промо-коммуникацией",
     "share": 0.35, "ticket": 1.12,
     "ratios": {"prolonged": 0.974, "closed_after": 0.281, "net_outflow": 0.601, "not_waited": 0.026}},
]
STEPS = [
    {"no": 1, "id": "expected", "name": "Клиенты с ожидаемой пролонгацией", "kind": "level", "ticket": 920_000},
    {"no": 2, "id": "prolonged", "name": "Клиенты со случившейся пролонгацией", "kind": "level", "ticket": 930_000},
    {"no": 3, "id": "closed_after", "name": "Пролонгировали и закрыли", "kind": "level", "ticket": 880_000},
    {"no": 4, "id": "net_outflow", "name": "Чистый отток", "kind": "level", "ticket": 760_000},
    {"no": 0, "id": "not_waited", "name": "Закрыли и не дождались пролонгации", "kind": "leak", "ticket": 1_100_000},
]

BENCHMARK = [
    ("2026-03", "rur", "net_outflow_share", 0.0060, "Forbes",
     "https://www.forbes.ru/finansy/563868-v-rossii-zafiksirovali-rekordnyj-v-2026-godu-ottok-deneg-so-srocnyh-depozitov-grazdan",
     "−288,1 млрд ₽ со срочных вкладов, первый чистый отток с октября 2022"),
    ("2026-05", "rur", "net_outflow_share", 0.0094, "Brobank",
     "https://brobank.ru/majskij-ottok-vkladov-2026-goda/",
     "−627,1 млрд ₽, портфель 66,7 → 66,07 трлн ₽"),
    ("2026-07", "rur", "net_outflow_share", 0.0000, "KuCoin / ЦБ РФ",
     "https://www.cbr.ru/statistics/avgprocstav/",
     "+234 млрд ₽ (+0,3%) по остаткам физлиц, но 152 банка в минусе по срочным"),
    ("2026", "rur", "benchmark_owner", None, "Frank RG",
     "https://frankrg.com/research/vklady-i-nakopitelnye-scheta-v-rossii-2026",
     "Бенчмарк «Вклады и накопительные счета в России 2026» — оседаемость и пролонгация"),
]


def tree_rows() -> list[dict[str, float]]:
    rows = []
    for index, report_dt in enumerate(PERIODS):
        portfolio = PORTFOLIO_BN[index] * 1e9
        prolong = PROLONG_BN[index] * 1e9
        not_prolong = NOT_PROLONG_BN[index] * 1e9
        erosion = PROLONG_EROSION_BN[index] * 1e9
        passed = prolong - erosion
        left30 = passed * LEFT30_SHARE[index]
        settlement = passed - left30 - passed * RESIDUAL_SHARE[index]

        rur = dict(zip(TREE_RUR_COLUMNS,
                       [portfolio, prolong, not_prolong, erosion, passed, left30, settlement]))
        # Клиентский разрез: считаем через средний чек, но «прошли пролонгацию»
        # выводим структурно, иначе проверка «ожидается − прошли − ушли» не сойдётся.
        prolong_clnt = round(prolong / TICKET["prolong"])
        erosion_clnt = round(erosion / TICKET["prolong_erosion"])
        clnt = {
            "tree_portfolio_clnt": round(portfolio / TICKET["portfolio"]),
            "tree_portfolio_prolong_clnt": prolong_clnt,
            "tree_portfolio_not_prolong_errosion_clnt": round(not_prolong / TICKET["not_prolong_errosion"]),
            "tree_portfolio_prolong_erosion_clnt": erosion_clnt,
            "tree_portfolio_prolong_passed_clnt": prolong_clnt - erosion_clnt,
            "tree_portfolio_prolong_left_after_30d_clnt": round(left30 / TICKET["prolong_left_after_30d"]),
            "tree_portfolio_prolong_settlement_clnt": round(settlement / TICKET["prolong_settlement"]),
        }
        rows.append({"report_dt": report_dt, **rur, **clnt})
    return rows


def funnel_rows(tree: list[dict[str, float]]) -> list[tuple]:
    rows = []
    for index, source in enumerate(tree):
        cohort = source["tree_portfolio_prolong_clnt"]
        # Лёгкий помесячный дрейф, чтобы конверсии не были константой.
        drift = 1 + (index - len(tree) / 2) * 0.004
        for funnel in FUNNELS:
            expected = round(cohort * funnel["share"])
            ratios = funnel["ratios"]
            prolonged = round(expected * ratios["prolonged"] * drift)
            closed_after = round(prolonged * ratios["closed_after"] * drift)
            net_outflow = round(closed_after * ratios["net_outflow"] * drift)
            not_waited = round(expected * ratios["not_waited"] * drift)
            values = {"expected": expected, "prolonged": prolonged, "closed_after": closed_after,
                      "net_outflow": net_outflow, "not_waited": not_waited}
            for step in STEPS:
                clients = values[step["id"]]
                amount = round(clients * step["ticket"] * funnel["ticket"])
                rows.append((source["report_dt"], funnel["id"], step["id"], clients, amount))
    return rows


def head(sheet, titles: list[str], row: int = 1) -> None:
    for column, title in enumerate(titles, start=1):
        cell = sheet.cell(row=row, column=column, value=title)
        cell.font = HEAD_INK
        cell.fill = HEAD_FILL
        cell.border = BOX
        cell.alignment = Alignment(vertical="center", wrap_text=True)
    sheet.row_dimensions[row].height = 42
    sheet.freeze_panes = sheet.cell(row=row + 1, column=2)


def widths(sheet, sizes: dict[int, int]) -> None:
    for column, size in sizes.items():
        sheet.column_dimensions[get_column_letter(column)].width = size


def build_guide(sheet) -> None:
    sheet.sheet_view.showGridLines = False
    widths(sheet, {1: 30, 2: 96})
    lines = [
        ("Книга метрик отчёта «Воронка оттока»", None),
        ("", None),
        ("Правило номер один",
         "Каждая метрика живёт в двух разрезах: _clnt — клиенты, _rur — рубли. "
         "Отчёт переключается между ними, поэтому пустая колонка ломает половину страницы."),
        ("Ключ везде одинаковый",
         "report_dt — последний календарный день месяца, формат ГГГГ-ММ-ДД, текстом. "
         "Добавить месяц = дописать строки с новым report_dt на каждый лист."),
        ("", None),
        ("Что где", None),
        ("Дерево",
         "Дерево оттоков: 7 метрик × 2 разреза на месяц. Колонки B:H — ваша выгрузка "
         "tree_portfolio_*_rur, колонки I:O — те же метрики в клиентах."),
        ("Структура воронок",
         "Справочник: какие воронки и из каких шагов состоят. Меняется редко, "
         "по месяцам не дублируется. row_kind = level — ступень воронки, leak — боковая карточка."),
        ("Воронки",
         "Цифры воронок: строка на связку report_dt + funnel_id + step_id, два разреза в колонках D и E."),
        ("Бенчмарк",
         "Рыночные ориентиры для блока AI Benchmark. value_pct — долей (0,0094 = 0,94%)."),
        ("", None),
        ("Цвет ячейки", None),
        ("Синий текст", "Ввод руками — это и есть данные."),
        ("Чёрный текст", "Формула, считается сама. Не перезаписывайте."),
        ("Жёлтая заливка", "Проверки. Должны сойтись, см. заголовок колонки."),
        ("Зелёная заливка", "Реальная выгрузка."),
        ("", None),
        ("Что здесь настоящее", None),
        ("Реальные данные",
         "Лист «Дерево», колонки B:H, строки с 2026-04-30 по 2026-06-30 — выгрузка tree_portfolio_*."),
        ("Синтетика",
         "Всё остальное: девять месяцев до апреля 2026, весь клиентский разрез, обе воронки. "
         "Пропорции правдоподобные, цифры выдуманные — заменить."),
    ]
    for index, (label, text) in enumerate(lines, start=1):
        left = sheet.cell(row=index, column=1, value=label)
        left.font = TITLE_INK if text is None and label else Font(name=FONT, size=10, bold=True)
        left.alignment = Alignment(vertical="top")
        if text:
            right = sheet.cell(row=index, column=2, value=text)
            right.font = INK
            right.alignment = Alignment(vertical="top", wrap_text=True)
            sheet.row_dimensions[index].height = 30


def build_tree(sheet, rows: list[dict[str, float]]) -> None:
    titles = (["report_dt"] + TREE_RUR_COLUMNS + TREE_CLNT_COLUMNS
              + ["Проверка ₽: ожидается − прошли − ушли (=0)",
                 "Остаток ₽: прошли − осело − вывели за 30 дней",
                 "Проверка клиенты: ожидается − прошли − ушли (=0)",
                 "Остаток клиенты: прошли − осело − вывели за 30 дней"])
    head(sheet, titles)
    widths(sheet, {1: 12, **{column: 17 for column in range(2, 16)},
                   **{column: 21 for column in range(16, 20)}})

    for index, row in enumerate(rows, start=2):
        real = row["report_dt"] >= REAL_FROM
        key = sheet.cell(row=index, column=1, value=row["report_dt"])
        key.font = INPUT_INK
        key.border = BOX

        for offset, name in enumerate(TREE_RUR_COLUMNS + TREE_CLNT_COLUMNS):
            cell = sheet.cell(row=index, column=2 + offset, value=row[name])
            cell.font = INPUT_INK
            cell.number_format = RUR if name.endswith("_rur") else CLNT
            cell.border = BOX
            if real and name.endswith("_rur"):
                cell.fill = REAL_FILL

        for column, formula in [
            (16, f"=C{index}-F{index}-E{index}"),
            (17, f"=F{index}-H{index}-G{index}"),
            (18, f"=J{index}-M{index}-L{index}"),
            (19, f"=M{index}-O{index}-N{index}"),
        ]:
            cell = sheet.cell(row=index, column=column, value=formula)
            cell.font = FORMULA_INK
            cell.number_format = RUR
            cell.fill = CHECK_FILL
            cell.border = BOX

    note = sheet.cell(row=len(rows) + 3, column=1,
                      value="Колонки P и R должны быть нулём. Q и S — остаток выгрузки "
                            "(прошли пролонгацию больше суммы «осело» и «вывели за 30 дней» "
                            "на 0,7–1,4%); отдельной метрики под него в выгрузке нет.")
    note.font = NOTE_INK
    sheet.cell(row=2, column=2).comment = Comment(
        "Зелёная заливка — реальная выгрузка tree_portfolio_*_rur.\n"
        "Клиентский разрез (I:O) синтетический: посчитан через средний чек.", "DD")


def build_structure(sheet) -> None:
    head(sheet, ["funnel_id", "funnel_name", "funnel_note", "step_no", "step_id", "step_name", "row_kind"])
    widths(sheet, {1: 12, 2: 22, 3: 34, 4: 9, 5: 15, 6: 38, 7: 11})
    row = 2
    for funnel in FUNNELS:
        for step in STEPS:
            values = [funnel["id"], funnel["name"], funnel["note"],
                      step["no"], step["id"], step["name"], step["kind"]]
            for column, value in enumerate(values, start=1):
                cell = sheet.cell(row=row, column=column, value=value)
                cell.font = INPUT_INK
                cell.border = BOX
            row += 1
    note = sheet.cell(row=row + 1, column=1,
                      value="row_kind = level — ступень воронки (step_no задаёт порядок сверху вниз); "
                            "leak — боковая карточка рядом с воронкой, в ступени не входит.")
    note.font = NOTE_INK


def build_funnels(sheet, rows: list[tuple]) -> None:
    head(sheet, ["report_dt", "funnel_id", "step_id", "clnt", "rur",
                 "Конверсия от 1-го шага, клиенты", "Конверсия от 1-го шага, ₽"])
    widths(sheet, {1: 12, 2: 12, 3: 15, 4: 14, 5: 18, 6: 15, 7: 15})
    for index, (report_dt, funnel_id, step_id, clients, amount) in enumerate(rows, start=2):
        for column, value in [(1, report_dt), (2, funnel_id), (3, step_id)]:
            cell = sheet.cell(row=index, column=column, value=value)
            cell.font = INPUT_INK
            cell.border = BOX
        for column, value, fmt in [(4, clients, CLNT), (5, amount, RUR)]:
            cell = sheet.cell(row=index, column=column, value=value)
            cell.font = INPUT_INK
            cell.number_format = fmt
            cell.border = BOX
        for column, source in [(6, "D"), (7, "E")]:
            cell = sheet.cell(row=index, column=column, value=(
                f'=IFERROR({source}{index}/SUMIFS(${source}:${source},$A:$A,$A{index},'
                f'$B:$B,$B{index},$C:$C,"expected"),"")'))
            cell.font = FORMULA_INK
            cell.number_format = PCT
            cell.border = BOX


def build_benchmark(sheet) -> None:
    head(sheet, ["period", "measure", "metric_id", "value_pct", "source_name", "url", "note"])
    widths(sheet, {1: 11, 2: 10, 3: 20, 4: 12, 5: 16, 6: 52, 7: 64})
    for index, row in enumerate(BENCHMARK, start=2):
        for column, value in enumerate(row, start=1):
            cell = sheet.cell(row=index, column=column, value=value)
            cell.font = INPUT_INK
            cell.border = BOX
            cell.alignment = Alignment(vertical="top", wrap_text=column == 7)
            if column == 4:
                cell.number_format = PCT
    note = sheet.cell(row=len(BENCHMARK) + 3, column=1,
                      value="value_pct — доля портфеля за месяц, долей единицы: 0,0094 = 0,94%. "
                            "Строка без value_pct описывает источник бенчмарка, а не точку.")
    note.font = NOTE_INK


def build(output: Path) -> Path:
    tree = tree_rows()
    book = Workbook()
    build_guide(book.active)
    book.active.title = "Справка"
    build_tree(book.create_sheet("Дерево"), tree)
    build_structure(book.create_sheet("Структура воронок"))
    build_funnels(book.create_sheet("Воронки"), funnel_rows(tree))
    build_benchmark(book.create_sheet("Бенчмарк"))
    book.properties.creator = "DD-dev"
    book.properties.created = datetime.now()
    book.save(output)
    return output


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    path = build(args.output)
    print(f"{path}: {path.stat().st_size / 1024:.0f} КБ")


if __name__ == "__main__":
    sys.exit(main())
