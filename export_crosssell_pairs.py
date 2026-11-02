#!/usr/bin/env python3
"""Выгрузить все кросс-связки из crosssell_export.json в таблицу.

Пары собираются из трёх мест выгрузки Product Lens:

  market_items_response[*].candidates — рыночное исследование, у каждой пары
      свой вердикт: already | wait | rejected | audrej.
  products_response[*].judgements — что увидели в продукте: seen | reco | market.
      Здесь полный список замеченных связок с доказательством из видео; в pairs
      их лежит лишь часть, поэтому судить об «окнули» надо по judgements.
  products_response[*].pairs    — те же предложения, но с conf/confirm/why.
  products_response[*].sc_rows  — разборы экранов: work | friction | propose.

Статус пары:
  был        — вердикт already либо наблюдение seen/work/friction;
  отклонено  — вердикт rejected/audrej и никаких наблюдений;
  предлагаем — всё остальное.

«Окнули на платформе» для предложений — нашли ли ту же пару среди реализованных
или наблюдаемых. Вердикт исследования и наблюдение разведены по разным колонкам:
одно говорит, что решили, другое — что видно в продукте.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill
from openpyxl.styles.borders import Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent
DEFAULT_EXPORT = ROOT / "crosssell_export.json"
DEFAULT_OUTPUT = ROOT / "crosssell-pairs.xlsx"

FONT = "Arial"
INK = Font(name=FONT, size=10)
HEAD_INK = Font(name=FONT, size=10, bold=True, color="FFFFFF")
NOTE_INK = Font(name=FONT, size=9, color="808080")
TITLE_INK = Font(name=FONT, size=12, bold=True)
HEAD_FILL = PatternFill("solid", fgColor="35516B")
ALERT_FILL = PatternFill("solid", fgColor="FDE7EC")
WAS_FILL = PatternFill("solid", fgColor="EAF3EA")
OFF_FILL = PatternFill("solid", fgColor="F2F2F2")
THIN = Side(style="thin", color="D9D9D9")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

VERDICTS = {
    "already": "Уже реализовано",
    "wait": "Ждёт решения",
    "rejected": "Решено · не будем предлагать",
    "audrej": "Решено · снято проверкой данных",
}
OBSERVED_MARKS = {("jud", "seen"), ("sc", "work"), ("sc", "friction"), ("pair", "seen")}
MARK_LABELS = {
    ("jud", "seen"): "видели в продукте",
    ("jud", "market"): "есть у конкурентов",
    ("jud", "reco"): "рекомендация",
    ("sc", "work"): "связка работает",
    ("sc", "friction"): "связка есть, но мешает",
    ("sc", "propose"): "предложено в разборе",
    ("pair", "seen"): "видели в продукте",
    ("pair", "market"): "есть у конкурентов",
    ("pair", "reco"): "рекомендация",
}
# Цели вне каталога приходят с этим префиксом — режем его, но помечаем строку.
OUT_OF_CATALOG = "ВНЕ КАТАЛОГА:"

COLUMNS = [
    ("Продукт 1", 26), ("Продукт 2", 26), ("Вне каталога", 11), ("Статус", 12),
    ("Окнули на платформе", 12), ("Вердикт исследования", 22),
    ("Наблюдали на платформе", 13), ("Что видели", 30),
    ("Где на платформе", 42), ("Обратная связка", 12),
    ("Решено", 12), ("Уверенность", 11), ("Подтверждение", 13),
    ("Юнит", 10), ("Группа продукта", 15), ("Почему", 80),
]


def norm(value) -> str:
    return unicodedata.normalize("NFC", str(value or "")).strip().casefold()


def tokens(value) -> list[str]:
    return [token for token in re.split(r"[^\w]+", norm(value)) if token]


def split_step(value) -> tuple[str, str, bool]:
    """«ВНЕ КАТАЛОГА: ОСАГО · Оформление» → («ОСАГО», «Оформление», True)."""
    text = str(value or "").strip()
    outside = text.startswith(OUT_OF_CATALOG)
    if outside:
        text = text[len(OUT_OF_CATALOG):].strip()
    for separator in (" · ", "·"):
        if separator in text:
            head, _, tail = text.partition(separator)
            return head.strip(), tail.strip(), outside
    return text, "", outside


def make_resolver(products: list[dict]):
    """Свести написание к каталогу: «Потреб. кредит» → «Потребительский кредит».

    Сокращения матчим по префиксам токенов при совпадающем их числе — этого
    хватает на все расхождения в выгрузке и не склеивает разные продукты.
    """
    catalog = {norm(item["name"]): item["name"] for item in products if item.get("name")}

    def resolve(raw) -> str:
        key = norm(raw)
        if key in catalog:
            return catalog[key]
        want = tokens(raw)
        if not want:
            return str(raw or "").strip()
        hits = [name for name in catalog.values()
                if len(tokens(name)) == len(want)
                and all(have.startswith(need) or need.startswith(have)
                        for need, have in zip(want, tokens(name)))]
        return hits[0] if len(hits) == 1 else str(raw or "").strip()

    return resolve


def collect(payload: dict) -> dict[tuple[str, str], dict]:
    products = payload.get("products_response", {}).get("products") or []
    market_items = payload.get("market_items_response") or {}
    resolve = make_resolver(products)

    rows: dict[tuple[str, str], dict] = defaultdict(lambda: {
        "verdict": "", "decided": "", "marks": set(), "where": [], "why": "",
        "conf": "", "confirm": "", "unit": "", "group": "", "outside": False,
    })

    # 1. Рыночное исследование — основной источник вердиктов.
    for item in market_items.values():
        for candidate in ((item or {}).get("candidates") or []):
            source, _, out_from = split_step(candidate.get("from"))
            target, _, out_to = split_step(candidate.get("to"))
            first, second = resolve(source), resolve(target)
            if not first or not second:
                continue
            row = rows[(first, second)]
            row["outside"] = row["outside"] or out_from or out_to
            # already перебивает wait: пара могла прийти из разных продуктов.
            if candidate.get("status") == "already" or not row["verdict"]:
                row["verdict"] = candidate.get("status") or ""
            row["decided"] = row["decided"] or (candidate.get("decided_at") or "")
            if candidate.get("why") and not row["why"]:
                row["why"] = candidate["why"]

    # 2. Предложения и наблюдения по продуктам.
    for product in products:
        first = resolve(product.get("name") or product.get("key"))
        if not first:
            continue
        unit, group = product.get("unit") or "", product.get("group") or ""

        for judgement in product.get("judgements") or []:
            target, _, outside = split_step(judgement.get("t"))
            second = resolve(target)
            if not second:
                continue
            row = rows[(first, second)]
            row["marks"].add(("jud", judgement.get("k")))
            row["outside"] = row["outside"] or outside
            row["unit"] = row["unit"] or unit
            row["group"] = row["group"] or group
            for entry in (judgement.get("ev") or []):
                place = entry.get("i")
                if place and place not in row["where"]:
                    row["where"].append(place)
            why = (judgement.get("an") or {}).get("why")
            if why and not row["why"]:
                row["why"] = why

        for pair in product.get("pairs") or []:
            target, _, outside = split_step(pair.get("target"))
            second = resolve(target)
            if not second:
                continue
            row = rows[(first, second)]
            row["marks"].add(("pair", pair.get("status")))
            row["outside"] = row["outside"] or outside
            row["unit"] = row["unit"] or unit
            row["group"] = row["group"] or group
            row["conf"] = row["conf"] or (pair.get("conf") or "")
            row["confirm"] = row["confirm"] or (pair.get("confirm") or "")
            if pair.get("seen_where") and pair["seen_where"] not in row["where"]:
                row["where"].append(pair["seen_where"])
            if pair.get("why") and not row["why"]:
                row["why"] = pair["why"]

        for sc in product.get("sc_rows") or []:
            source, step, out_from = split_step(sc.get("from"))
            target, _, out_to = split_step(sc.get("to"))
            source, target = resolve(source), resolve(target)
            if not source or not target:
                continue
            row = rows[(source, target)]
            row["marks"].add(("sc", sc.get("group")))
            row["outside"] = row["outside"] or out_from or out_to
            row["unit"] = row["unit"] or unit
            row["group"] = row["group"] or group
            if step and f"шаг «{step}»" not in row["where"]:
                row["where"].append(f"шаг «{step}»")
            if not row["why"]:
                evidence = [entry.get("i") for entry in (sc.get("ev") or []) if entry.get("i")]
                if evidence:
                    row["why"] = evidence[0]
    return rows


def build_table(rows: dict[tuple[str, str], dict]) -> list[list]:
    def is_was(row):
        return row["verdict"] == "already" or bool(row["marks"] & OBSERVED_MARKS)

    existing = {(norm(a), norm(b)) for (a, b), row in rows.items() if is_was(row)}

    table = []
    for (first, second), row in rows.items():
        observed = bool(row["marks"] & OBSERVED_MARKS)
        if is_was(row):
            status, on_platform = "был", ""
        elif row["verdict"] in ("rejected", "audrej"):
            status, on_platform = "отклонено", ""
        else:
            status = "предлагаем"
            on_platform = "да" if (norm(first), norm(second)) in existing else "нет"

        seen_marks = "; ".join(sorted(
            MARK_LABELS.get(mark, f"{mark[0]}:{mark[1]}") for mark in row["marks"]))
        table.append([
            first, second, "да" if row["outside"] else "", status, on_platform,
            VERDICTS.get(row["verdict"], "нет в исследовании"),
            "да" if observed else "нет", seen_marks,
            " · ".join(row["where"]),
            "да" if (norm(second), norm(first)) in existing else "нет",
            row["decided"], row["conf"], row["confirm"],
            row["unit"], row["group"], row["why"],
        ])

    rank = {"предлагаем": 1, "был": 2, "отклонено": 3}

    def order(item):
        first_rank = 0 if (item[3] == "предлагаем" and item[4] == "да") else rank[item[3]]
        return (first_rank, item[0].casefold(), item[1].casefold())

    table.sort(key=order)
    return table


def write_guide(sheet, table: list[list], payload: dict) -> None:
    sheet.sheet_view.showGridLines = False
    sheet.column_dimensions["A"].width = 34
    sheet.column_dimensions["B"].width = 96

    observed = sum(1 for row in table if row[6] == "да")
    meta = payload.get("products_response", {}).get("meta") or {}
    market_items = payload.get("market_items_response") or {}
    snapshots = Counter((item or {}).get("market", {}).get("snapshot_date")
                        for item in market_items.values())
    fresh = ", ".join(f"{date} — {count}" for date, count in snapshots.most_common(3) if date)
    counts = Counter((row[3], row[4]) for row in table)
    proposed = counts[("предлагаем", "да")] + counts[("предлагаем", "нет")]

    lines = [
        ("Кросс-связки: выгрузка", None),
        ("", None),
        ("Раунд Product Lens", f"{meta.get('round_id', '—')}, собран {meta.get('generated_at', '—')}"),
        ("Срез исследования", f"snapshot_date по продуктам: {fresh or '—'}"),
        ("Строк в таблице", f"{len(table)} уникальных направленных пар «продукт 1 → продукт 2»"),
        ("", None),
        ("Откуда берутся пары", None),
        ("candidates", "Рыночное исследование, market_items_response[*].candidates. "
                       "Вердикты: already — уже реализовано, wait — ждёт решения, "
                       "rejected — не будем предлагать, audrej — снято проверкой данных."),
        ("pairs", "Предложения по продукту: seen — видели на платформе, "
                  "market — есть у конкурентов, reco — рекомендация."),
        ("sc_rows", "Наблюдения в разборах: work — связка работает, "
                    "friction — связка есть, но мешает, propose — предложено в разборе."),
        ("", None),
        ("Как считается статус", None),
        ("был", "Вердикт already либо наблюдение seen / work / friction. "
                f"Таких пар {counts[('был', '')]}, из них видно в продукте {observed}."),
        ("предлагаем", f"Всё прочее, где нет отказа. Таких пар {proposed}."),
        ("отклонено", "Вердикт rejected или audrej и ни одного наблюдения. "
                      f"Таких пар {counts[('отклонено', '')]}."),
        ("", None),
        ("Окнули на платформе",
         "Для предложений: нашли ли ту же пару среди реализованных или наблюдаемых. "
         f"«да» — {counts[('предлагаем', 'да')]}, «нет» — {counts[('предлагаем', 'нет')]}."),
        ("Вердикт и наблюдение разведены",
         "«Вердикт исследования» — что решили по паре. «Наблюдали на платформе» — что "
         "видно в продукте по разборам и видео. Это разные вещи, и они расходятся."),
        ("Обратная связка",
         "Есть ли «продукт 2 → продукт 1» среди реализованных. Направление не схлопывается: "
         "«А → Б» и «Б → А» — разные кроссы и разные строки."),
        ("", None),
        ("Цвет строки", None),
        ("Зелёная", "Связка уже есть."),
        ("Серая", "Отклонена."),
        ("Розовая", "Предлагаем то, что уже есть на платформе."),
    ]
    for index, (label, text) in enumerate(lines, start=1):
        cell = sheet.cell(row=index, column=1, value=label)
        cell.font = TITLE_INK if text is None and label else Font(name=FONT, size=10, bold=True)
        cell.alignment = Alignment(vertical="top")
        if text:
            right = sheet.cell(row=index, column=2, value=text)
            right.font = INK
            right.alignment = Alignment(vertical="top", wrap_text=True)
            sheet.row_dimensions[index].height = 30


def write_pairs(sheet, table: list[list]) -> None:
    for column, (title, width) in enumerate(COLUMNS, start=1):
        cell = sheet.cell(row=1, column=column, value=title)
        cell.font = HEAD_INK
        cell.fill = HEAD_FILL
        cell.border = BOX
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        sheet.column_dimensions[get_column_letter(column)].width = width
    sheet.row_dimensions[1].height = 34
    sheet.freeze_panes = "C2"
    sheet.auto_filter.ref = f"A1:{get_column_letter(len(COLUMNS))}{len(table) + 1}"

    wrap_columns = {8, 9, 16}
    for index, row in enumerate(table, start=2):
        fill = None
        if row[3] == "предлагаем" and row[4] == "да":
            fill = ALERT_FILL
        elif row[3] == "был":
            fill = WAS_FILL
        elif row[3] == "отклонено":
            fill = OFF_FILL
        for column, value in enumerate(row, start=1):
            cell = sheet.cell(row=index, column=column, value=value)
            cell.font = INK
            cell.border = BOX
            cell.alignment = Alignment(vertical="top", wrap_text=column in wrap_columns)
            if fill:
                cell.fill = fill

    note = sheet.cell(row=len(table) + 3, column=1,
                      value="Правила статусов и словарь вердиктов — на листе «Справка».")
    note.font = NOTE_INK


def build(export: Path, output: Path) -> list[list]:
    if not export.is_file():
        raise SystemExit(f"Не найден экспорт: {export}")
    payload = json.loads(export.read_text(encoding="utf-8"))
    if not (payload.get("products_response", {}).get("products")):
        raise SystemExit("В экспорте нет продуктов — обновите crosssell_export.json")

    table = build_table(collect(payload))
    book = Workbook()
    write_guide(book.active, table, payload)
    book.active.title = "Справка"
    write_pairs(book.create_sheet("Кроссы"), table)
    book.save(output)
    return table


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--export", type=Path, default=DEFAULT_EXPORT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    table = build(args.export, args.output)
    counts = Counter((row[3], row[4]) for row in table)
    verdicts = Counter(row[5] for row in table)
    print(f"{args.output}: {len(table)} пар")
    for key in sorted(counts):
        label = key[0] + (f", на платформе {key[1]}" if key[1] else "")
        print(f"  {label:<32}{counts[key]}")
    print("  вердикты:", dict(verdicts))


if __name__ == "__main__":
    sys.exit(main())
