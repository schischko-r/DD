#!/usr/bin/env python3
"""Build the data maturity layer for the B2C dashboard from the unit workbook."""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "Книга1.xlsx"
DEFAULT_OUTPUT = ROOT / "gravity-app" / "public" / "data-maturity.json"
DATA_SHEET = "Данные"
CURRENT_PERIOD = "2Q2026"
PREVIOUS_PERIOD = "1Q2026"

# Workbook unit -> the Data-Driven unit code it reports for.
UNIT_MAPPING = {
    "Data": ("Data", "Data"),
    "CX": ("CX", "CX"),
    "УБ": ("УБ", "УБ"),
    "Core": ("CBP", "Core Banking"),
    "Daily": ("DB", "Daily Banking"),
    "СС": ("PC", "PH (CC)"),
    "Digital": ("DP", "Digital (DC)"),
    "Домклик": ("ДомКлик", "ДомКлик"),
}

# The workbook spells one category two ways; both mean the same thing.
CATEGORY_ALIASES = {"Потребленияе": "Потребление"}

# Categories whose metrics improve as the number goes down.
LOWER_IS_BETTER_CATEGORIES = {"Скорость", "Надежность"}

CATEGORY_ORDER = (
    "Инструмент",
    "Потребление",
    "Качество данных",
    "Скорость",
    "Надежность",
)

# Stable short keys; a metric outside this table falls back to a slug of its name.
METRIC_KEYS = {
    "Новые витрины на B2C SQL": "b2c-sql-marts",
    "Использование базовых витрин ЕПКАП": "epkap-marts-usage",
    "Покрытие проверками качества данных критичных процессов": "dq-coverage",
    "Скорость поставки данных Банка в Фабрику данных": "bank-delivery-speed",
    "Плотность инцидентов": "incident-density",
    "Доля ИОР в инцидентах": "ior-share",
    "Доля данных АС, загруженных в Фабрику данных": "as-data-share",
    "Скорость поставки внешних данных в Фабрику данных": "external-delivery-speed",
}


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value)).strip() if value is not None else ""


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", clean_text(value)).lower()
    slug = re.sub(r"[^a-z0-9а-яё]+", "-", normalized).strip("-")
    return slug or "metric"


def parse_number(value: Any) -> float | None:
    """Return the numeric reading, or None when the cell carries no measurement."""

    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = clean_text(value).replace(",", ".")
    if not text or text == "-":
        return None
    match = re.fullmatch(r"-?\d+(?:\.\d+)?", text)
    return float(match.group(0)) if match else None


def plan_label(plan: str, plan_value: float | None, measure: str) -> str:
    """Render the norm the way the fact next to it is rendered."""

    if plan_value is None:
        # "Мониторинг New <40" and friends already read as a norm; drop the noise word and
        # the New / CR marker, which names the row rather than the threshold.
        cleaned = re.sub(r"\b(?:мониторинг|new|cr)\b", "", plan, flags=re.IGNORECASE)
        cleaned = re.sub(r"^[\s\-–—%]+|[\s\-–—]+$", "", cleaned)
        return re.sub(r"\s+", " ", cleaned).strip()
    if measure == "%":
        percent = plan_value * 100
        return f"{percent:.10g}%"
    return f"{plan_value:.10g}"


def plan_target(plan: str, measure: str, lower_is_better: bool) -> tuple[float | None, str]:
    """Read the threshold a norm sets and the side of it the metric must land on."""

    match = re.search(r"(<=|>=|<|>)?\s*(\d+(?:[.,]\d+)?)\s*(%)?", plan)
    if not match:
        return None, ""

    operator, number, percent = match.group(1), match.group(2), match.group(3)
    target = float(number.replace(",", "."))
    if percent and measure == "%":
        target /= 100

    if operator in {"<", "<="}:
        comparison = "max"
    elif operator in {">", ">="}:
        comparison = "min"
    else:
        comparison = "max" if lower_is_better else "min"
    return target, comparison


def meets_plan(value: float | None, target: float | None, comparison: str) -> bool | None:
    if value is None or target is None or not comparison:
        return None
    return value <= target if comparison == "max" else value >= target


def absence_note(*values: Any) -> str:
    """Explain a missing reading when the workbook says why it is missing."""

    for value in values:
        text = clean_text(value)
        if text and text != "-" and parse_number(value) is None:
            return text
    return ""


def read_rows(path: Path) -> list[dict[str, Any]]:
    if path.name.startswith("~$"):
        raise ValueError("Временный Excel-файл Office нельзя использовать как источник")

    workbook = load_workbook(path, read_only=True, data_only=True)
    if DATA_SHEET not in workbook.sheetnames:
        raise ValueError(f"В книге нет листа {DATA_SHEET!r}: {path}")

    sheet = workbook[DATA_SHEET]
    rows = sheet.iter_rows(values_only=True)
    header = [clean_text(cell) for cell in next(rows)]
    required = ("Юнит", "Метрика", "Категория", "План", CURRENT_PERIOD, PREVIOUS_PERIOD)
    missing = [column for column in required if column not in header]
    if missing:
        raise ValueError("В листе нет обязательных колонок: " + ", ".join(missing))

    index = {name: position for position, name in enumerate(header)}
    records = []
    for row in rows:
        if not any(cell is not None for cell in row):
            continue
        records.append({name: row[position] for name, position in index.items()})
    return records


def norm_marker(plan: str) -> str:
    """The New / CR norm that splits one metric into two rows."""

    match = re.search(r"\b(New|CR)\b", plan, re.IGNORECASE)
    return match.group(1).upper() if match else ""


def metric_key(record: dict[str, Any], seen: dict[str, int]) -> str:
    """Give the two delivery-speed norms of one metric distinct keys."""

    name = clean_text(record["Метрика"])
    base = METRIC_KEYS.get(name, slugify(name))
    marker = norm_marker(clean_text(record["План"]))
    if marker:
        return f"{base}-{marker.lower()}"
    count = seen.get(base, 0)
    seen[base] = count + 1
    return base if count == 0 else f"{base}-{count + 1}"


def build_metric(record: dict[str, Any]) -> dict[str, Any]:
    category = CATEGORY_ALIASES.get(clean_text(record["Категория"]), clean_text(record["Категория"]))
    value = parse_number(record[CURRENT_PERIOD])
    previous = parse_number(record[PREVIOUS_PERIOD])
    lower_is_better = category in LOWER_IS_BETTER_CATEGORIES
    delta = None if value is None or previous is None else round(value - previous, 6)

    if delta is None:
        trend = "unknown"
    elif delta == 0:
        trend = "flat"
    elif (delta < 0) == lower_is_better:
        trend = "positive"
    else:
        trend = "negative"

    norm = clean_text(record["План"])
    marker = norm_marker(norm)
    name = clean_text(record["Метрика"])
    measure = clean_text(record["Ед.измерения"])
    plan_value = parse_number(norm)
    target, comparison = plan_target(norm, measure, lower_is_better)
    return {
        # The two delivery-speed norms keep separate keys, but the norm shown under the
        # fact ("New <40" / "CR <15") already tells the rows apart on screen.
        "label": name,
        "description": clean_text(record["Описание"]),
        "category": category,
        "measure": measure,
        "plan": norm,
        "planLabel": plan_label(norm, plan_value, measure),
        "planValue": plan_value,
        "planTarget": target,
        "planComparison": comparison,
        "meetsPlan": meets_plan(value, target, comparison),
        "betterDirection": "down" if lower_is_better else "up",
        "value": value,
        "previousValue": previous,
        "delta": delta,
        "trend": trend,
        "note": absence_note(record[CURRENT_PERIOD], record[PREVIOUS_PERIOD]),
    }


def build_payload(records: list[dict[str, Any]]) -> dict[str, Any]:
    by_unit: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        source_unit = clean_text(record["Юнит"])
        if source_unit not in UNIT_MAPPING:
            continue
        by_unit.setdefault(source_unit, []).append(record)

    missing_units = [unit for unit in UNIT_MAPPING if unit not in by_unit]
    if missing_units:
        raise ValueError("В книге нет данных по юнитам: " + ", ".join(missing_units))

    units = []
    for source_unit, (unit_key, unit_label) in UNIT_MAPPING.items():
        seen: dict[str, int] = {}
        metrics = []
        for record in by_unit[source_unit]:
            metric = build_metric(record)
            metric["key"] = metric_key(record, seen)
            metrics.append(metric)

        categories = []
        for label in CATEGORY_ORDER:
            items = [metric for metric in metrics if metric["category"] == label]
            if items:
                categories.append({"key": slugify(label), "label": label, "metrics": items})
        unknown = sorted({metric["category"] for metric in metrics} - set(CATEGORY_ORDER))
        for label in unknown:
            items = [metric for metric in metrics if metric["category"] == label]
            categories.append({"key": slugify(label), "label": label, "metrics": items})

        measured = [metric for metric in metrics if metric["value"] is not None]
        judged = [metric for metric in metrics if metric["meetsPlan"] is not None]
        met = [metric for metric in judged if metric["meetsPlan"]]
        units.append({
            "key": unit_key,
            "label": unit_label,
            "sourceUnit": source_unit,
            "metricCount": len(metrics),
            "measuredCount": len(measured),
            "score": round(len(met) / len(judged) * 100) if judged else None,
            "metCount": len(met),
            "judgedCount": len(judged),
            "categories": categories,
        })

    scored = [unit["score"] for unit in units if unit["score"] is not None]
    return {
        "meta": {
            "source": DEFAULT_INPUT.name,
            "period": CURRENT_PERIOD,
            "previousPeriod": PREVIOUS_PERIOD,
            "unitCount": len(units),
            "label": "Данные",
            "scoreDefinition": "Доля метрик юнита, выполняющих свой норматив, среди метрик с замером и нормативом",
            "averageScore": round(sum(scored) / len(scored)) if scored else None,
        },
        "units": units,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Path to source .xlsx")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output JSON path")
    arguments = parser.parse_args()

    payload = build_payload(read_rows(arguments.input))
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    measured = sum(unit["measuredCount"] for unit in payload["units"])
    total = sum(unit["metricCount"] for unit in payload["units"])
    print(f"{arguments.output}: {payload['meta']['unitCount']} units, {measured}/{total} metrics measured")


if __name__ == "__main__":
    main()
