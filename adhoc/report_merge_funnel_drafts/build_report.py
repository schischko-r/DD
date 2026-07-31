#!/usr/bin/env python3
"""Build a standalone report by joining drafts and clickstream exports."""

from __future__ import annotations

import argparse
import html
import json
import re
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = BASE_DIR / "report_merge_funnel_drafts.html"
DEFAULT_COPY_OUTPUT = BASE_DIR / "report_merge_funnel_drafts_copy_paste.html"
LOCAL_DDI_OUTPUT = BASE_DIR.parent.parent / "report_merge_funnel_drafts.html"
LOCAL_DDI_COPY_OUTPUT = (
    BASE_DIR.parent.parent / "report_merge_funnel_drafts_copy_paste.html"
)
DEFAULT_MAPPING = BASE_DIR / "mapping.json"

INPUT_NAMES = {
    "drafts": "Черновики_все_продукты_zeroed.html",
    "clickstream": "Кликстрим_Месячный_все_воронки (1)_zeroed(1).html",
    "product_mapping": "ai_product_mapping.xlsx",
    "losshunter": "Рекомендации по коммуникациям с брошенными корзинами · Купить ОСАГО · СберБанк Онлайн · ios.htm",
}

ASSIGNMENTS = {
    "drafts": ("var _ALL_DATA = ",),
    "clickstream": ("var _ALL_DATA = ",),
}

PLATFORM_PREFIX_RE = re.compile(r"^[a-zA-Z][\w\s]* / ")
PLATFORM_EVENT_TOKENS = {"android", "ios"}
CELL_COLUMN_RE = re.compile(r"^([A-Z]+)")
SPREADSHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


class ReportBuildError(RuntimeError):
    """A source report cannot be parsed or mapped."""


@dataclass(frozen=True)
class SourcePaths:
    drafts: Path
    clickstream: Path


def extract_embedded_json(path: Path, assignments: Iterable[str]) -> dict[str, Any]:
    """Extract the JSON literal assigned to the first matching JS variable."""

    text = path.read_text(encoding="utf-8")
    for assignment in assignments:
        index = text.find(assignment)
        if index < 0:
            continue
        start = index + len(assignment)
        try:
            value, _ = json.JSONDecoder().raw_decode(text[start:])
        except json.JSONDecodeError as exc:
            raise ReportBuildError(
                f"Некорректный JSON после {assignment!r} в {path}: {exc}"
            ) from exc
        if not isinstance(value, dict):
            raise ReportBuildError(f"_ALL_DATA в {path} должен быть объектом")
        return value
    markers = ", ".join(repr(item) for item in assignments)
    raise ReportBuildError(f"В {path} не найдено присваивание _ALL_DATA: {markers}")


def locate_input(explicit: str | None, filename: str) -> Path:
    """Resolve a source file without modifying or depending on the repository root."""

    if explicit:
        path = Path(explicit).expanduser().resolve()
        if not path.is_file():
            raise ReportBuildError(f"Файл не найден: {path}")
        return path

    candidates = [
        BASE_DIR / "input" / filename,
        BASE_DIR / filename,
        BASE_DIR.parent.parent / filename,
        Path.home() / "Documents" / "Codex" / "DD-dev" / filename,
        Path.home() / "Downloads" / filename,
    ]
    for path in candidates:
        if path.is_file():
            return path.resolve()
    checked = "\n  - ".join(str(path) for path in candidates)
    raise ReportBuildError(f"Не найден входной файл {filename!r}. Проверено:\n  - {checked}")


def locate_losshunter(explicit: str | None) -> Path:
    """Resolve the saved LossHunter recommendation report despite Unicode variants."""

    if explicit:
        path = Path(explicit).expanduser().resolve()
        if not path.is_file():
            raise ReportBuildError(f"Файл LossHunter не найден: {path}")
        return path

    roots = [
        BASE_DIR / "input",
        BASE_DIR,
        BASE_DIR.parent.parent,
        Path.home() / "Documents" / "Codex" / "DD-dev",
        Path.home() / "Downloads",
    ]
    pattern = "Рекомендации по коммуникациям с брошенными корзинами*.htm*"
    matches = [path for root in roots for path in root.glob(pattern) if path.is_file()]
    if not matches:
        checked = "\n  - ".join(str(root / pattern) for root in roots)
        raise ReportBuildError(
            f"Не найден локальный отчёт LossHunter. Проверено:\n  - {checked}"
        )
    return matches[0].resolve()


def clean_html_text(value: str) -> str:
    """Convert a small trusted HTML fragment into compact plain text."""

    value = re.sub(r"<(?:br|/p|/li|/div)\b[^>]*>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    return " ".join(html.unescape(value).split())


def selected_filter_text(fragment: str, condition: str | None = None) -> str:
    """Read the visible default value from a LossHunter filter-table cell."""

    without_labels = re.sub(
        r'<span class="ft-tag">.*?</span>', "", fragment, flags=re.S
    )
    if condition:
        match = re.search(
            rf'<span class="ft-var" data-ft-when="{re.escape(condition)}">(.*?)</span>',
            without_labels,
            flags=re.S,
        )
        if not match:
            raise ReportBuildError(
                f"LossHunter: в таблице нет варианта {condition!r}"
            )
        return clean_html_text(match.group(1))
    return clean_html_text(without_labels)


def parse_losshunter_outreach_table(source: str) -> dict[str, dict[str, str]]:
    """Extract the concise day × 25–60 recommendation shown in the source table."""

    section_match = re.search(
        r'<section class="block-section section-filter_table">.*?'
        r"<table>.*?<tbody>(.*?)</tbody>.*?</table>",
        source,
        flags=re.S,
    )
    if not section_match:
        raise ReportBuildError("LossHunter: не найдена таблица рекомендаций")
    rows = re.findall(r"<tr>(.*?)</tr>", section_match.group(1), flags=re.S)
    if len(rows) != 9:
        raise ReportBuildError(
            f"LossHunter: ожидалось 9 строк рекомендаций, найдено {len(rows)}"
        )
    result: dict[str, dict[str, str]] = {}
    for row in rows:
        cells = re.findall(r"<td>(.*?)</td>", row, flags=re.S)
        if len(cells) != 7:
            raise ReportBuildError(
                f"LossHunter: в строке рекомендаций ожидалось 7 ячеек, найдено {len(cells)}"
            )
        stage = clean_html_text(cells[0])
        result[stage] = {
            "when": selected_filter_text(cells[1], "daytime=day"),
            "primary_channel": selected_filter_text(cells[2]),
            "fallback_channel": selected_filter_text(cells[3]),
            "what_to_say": selected_filter_text(cells[4], "age=core"),
            "upsell": selected_filter_text(cells[5]),
            "rationale": selected_filter_text(cells[6], "daytime=day"),
        }
    return result


def parse_losshunter_report(path: Path) -> dict[str, Any]:
    """Read exact outreach cards and provenance from a saved LossHunter report."""

    source = path.read_text(encoding="utf-8")
    title_match = re.search(r"<title>(.*?)</title>", source, flags=re.S | re.I)
    lead_match = re.search(
        r'<p class=lead>Путь «(.*?)», прогон <code>(.*?)</code>',
        source,
        flags=re.S,
    )
    warning_match = re.search(r"<div class=warn>(.*?)</div>", source, flags=re.S)
    plan_match = re.search(
        r'<h3>План проверки</h3><div class="callout callout-warn">(.*?)</div>',
        source,
        flags=re.S,
    )
    gaps_match = re.search(r"<p class=gaps>(.*?)</p>", source, flags=re.S)
    recommendation_block_match = re.search(
        r'<section class="block-section section-filter_table">.*?</section>',
        source,
        flags=re.S,
    )
    page_style_match = re.search(r"<style>(.*?)</style>", source, flags=re.S)
    raw_card_matches = re.findall(
        r'<details class="dt-item">.*?</details>', source, flags=re.S
    )
    outreach_by_stage = parse_losshunter_outreach_table(source)
    if (
        not title_match
        or not lead_match
        or not warning_match
        or not plan_match
        or not recommendation_block_match
        or not page_style_match
    ):
        raise ReportBuildError(
            f"LossHunter {path}: не найдены обязательные метаданные отчёта"
        )
    if len(raw_card_matches) != 9:
        raise ReportBuildError(
            f"LossHunter {path}: ожидалось 9 карточек, найдено {len(raw_card_matches)}"
        )
    required_fields = (
        "Триггер",
        "Событие в реестре",
        "Сегмент",
        "Время отправки",
        "Канал основной",
        "Запасной канал и правило",
        "Текст сообщения",
        "Up-sell",
        "Обоснование",
        "Метрика успеха",
        "Шаблон ТЗ",
    )
    cards: list[dict[str, str]] = []
    for source_html in raw_card_matches:
        card_match = re.fullmatch(
            r'<details class="dt-item"><summary><b>(.*?)</b>.*?</summary>'
            r'<dl class="dt-fields">(.*?)</dl></details>',
            source_html,
            flags=re.S,
        )
        if not card_match:
            raise ReportBuildError(
                f"LossHunter {path}: не удалось разобрать исходный HTML карточки"
            )
        raw_stage, body = card_match.groups()
        fields = {
            clean_html_text(key): clean_html_text(value)
            for key, value in re.findall(
                r"<dt>(.*?)</dt><dd>(.*?)</dd>", body, flags=re.S
            )
        }
        missing = [field for field in required_fields if not fields.get(field)]
        if missing:
            raise ReportBuildError(
                f"LossHunter {path}: этап {clean_html_text(raw_stage)!r}, "
                f"нет полей: {', '.join(missing)}"
            )
        cards.append(
            {
                "stage": clean_html_text(raw_stage),
                "trigger": fields["Триггер"],
                "event_registry": fields["Событие в реестре"],
                "segment": fields["Сегмент"],
                "send_time": fields["Время отправки"],
                "primary_channel": fields["Канал основной"],
                "fallback_channel": fields["Запасной канал и правило"],
                "message": fields["Текст сообщения"],
                "upsell": fields["Up-sell"],
                "rationale": fields["Обоснование"],
                "success_metric": fields["Метрика успеха"],
                "brief_template": fields["Шаблон ТЗ"],
                "outreach": outreach_by_stage.get(clean_html_text(raw_stage), {}),
            }
        )
    missing_outreach = [card["stage"] for card in cards if not card["outreach"]]
    if missing_outreach:
        raise ReportBuildError(
            "LossHunter: карточки не найдены в таблице рекомендаций: "
            + ", ".join(missing_outreach)
        )
    return {
        "title": clean_html_text(title_match.group(1)),
        "path": clean_html_text(lead_match.group(1)),
        "run_id": clean_html_text(lead_match.group(2)),
        "source_note": clean_html_text(warning_match.group(1)),
        "verification_plan": clean_html_text(plan_match.group(1)),
        "missing_inputs": clean_html_text(gaps_match.group(1)) if gaps_match else "",
        # Copy-paste версия показывает основной читательский блок рекомендаций,
        # а не расположенную ниже техническую секцию «Заготовка ТЗ».
        "copy_block_html": recommendation_block_match.group(0),
        "copy_page_style": page_style_match.group(1),
        "cards": cards,
    }


def locate_ddi_data(explicit: str | None) -> Path:
    if explicit:
        path = Path(explicit).expanduser().resolve()
        if not path.is_file():
            raise ReportBuildError(f"Файл DDI не найден: {path}")
        return path
    candidates = [
        BASE_DIR / "input" / "report-data.json",
        BASE_DIR.parent.parent / "gravity-app" / "public" / "report-data.json",
        BASE_DIR.parent.parent / "gravity-app" / "dist" / "report-data.json",
    ]
    for path in candidates:
        if path.is_file():
            return path.resolve()
    checked = "\n  - ".join(str(path) for path in candidates)
    raise ReportBuildError(
        f"Не найден DDI report-data.json. Проверено:\n  - {checked}"
    )


def normalized_name(value: str) -> str:
    return " ".join(value.casefold().replace("ё", "е").split())


def build_ddi_product_lineup(
    ddi_data: dict[str, Any],
    reports: list[dict[str, Any]],
    excluded_products: list[dict[str, str]],
) -> list[dict[str, Any]]:
    products = ddi_data.get("products")
    if not isinstance(products, list):
        raise ReportBuildError("DDI report-data.json: products должен быть списком")
    excluded = {
        normalized_name(item["dd_product"]): item["reason"]
        for item in excluded_products
        if item.get("dd_product") and item.get("reason")
    }
    result: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    seen_names: set[str] = set()
    for item in products:
        if item.get("type") != "Продукт":
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        product_id = str(item.get("id") or name)
        name_key = normalized_name(name)
        if product_id in seen_ids:
            raise ReportBuildError(
                f"DDI report-data.json: повтор product id {product_id!r}"
            )
        if name_key in seen_names:
            raise ReportBuildError(
                f"DDI report-data.json: повтор имени продукта {name!r}"
            )
        seen_ids.add(product_id)
        seen_names.add(name_key)
        matched = [
            report["label"]
            for report in reports
            if name_key
            in {
                normalized_name(report["label"]),
                normalized_name(report["mapping"]["dd_product"]),
            }
        ]
        result.append(
            {
                "id": product_id,
                "name": name,
                "type": "Продукт",
                "unit": str(item.get("unit") or ""),
                "tribe": str(item.get("tribe") or ""),
                "report_labels": matched,
                "available": bool(matched),
                "unavailable_reason": ""
                if matched
                else excluded.get(
                    name_key,
                    "Для продукта пока нет полного соответствия черновики → кликстрим за общий период.",
                ),
            }
        )
    return sorted(result, key=lambda item: normalized_name(item["name"]))


def spreadsheet_column_index(cell_reference: str) -> int:
    match = CELL_COLUMN_RE.match(cell_reference)
    if not match:
        raise ReportBuildError(f"Некорректная ссылка на ячейку: {cell_reference!r}")
    value = 0
    for character in match.group(1):
        value = value * 26 + ord(character) - ord("A") + 1
    return value - 1


def read_product_mapping(path: Path) -> set[tuple[str, str, str]]:
    """Read and deduplicate mapping triples from the first XLSX worksheet."""

    namespace = {"x": SPREADSHEET_NS}
    try:
        with ZipFile(path) as archive:
            shared_strings: list[str] = []
            if "xl/sharedStrings.xml" in archive.namelist():
                root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
                shared_strings = [
                    "".join(
                        node.text or ""
                        for node in item.iter(f"{{{SPREADSHEET_NS}}}t")
                    )
                    for item in root.findall("x:si", namespace)
                ]
            sheet = ElementTree.fromstring(
                archive.read("xl/worksheets/sheet1.xml")
            )
    except (BadZipFile, KeyError, ElementTree.ParseError) as exc:
        raise ReportBuildError(f"Не удалось прочитать XLSX-маппинг {path}: {exc}") from exc

    rows: list[list[str]] = []
    for row in sheet.findall(".//x:sheetData/x:row", namespace):
        values: dict[int, str] = {}
        for cell in row.findall("x:c", namespace):
            index = spreadsheet_column_index(cell.get("r", ""))
            cell_type = cell.get("t")
            value_node = cell.find("x:v", namespace)
            value = "" if value_node is None else value_node.text or ""
            if cell_type == "s" and value:
                value = shared_strings[int(value)]
            elif cell_type == "inlineStr":
                value = "".join(
                    node.text or ""
                    for node in cell.iter(f"{{{SPREADSHEET_NS}}}t")
                )
            values[index] = value
        if values:
            rows.append([values.get(index, "") for index in range(max(values) + 1)])

    expected = ["dd_product", "ai_tool_key", "ai_tool_product name"]
    if not rows or rows[0][:3] != expected:
        actual = rows[0][:3] if rows else []
        raise ReportBuildError(
            f"XLSX-маппинг: ожидались колонки {expected!r}, получено {actual!r}"
        )
    return {
        (row[0].strip(), row[1].strip(), row[2].strip())
        for row in rows[1:]
        if len(row) >= 3 and all(value.strip() for value in row[:3])
    }


def strip_platform_prefix(value: str) -> str:
    return PLATFORM_PREFIX_RE.sub("", value).strip()


def percent(value: Any) -> float | None:
    if value is None:
        return None
    return round(float(value) * 100, 1)


def numeric_delta(current: Any, previous: Any) -> float | int | None:
    if current is None or previous is None:
        return None
    return current - previous


def sorted_step_items(steps: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    return sorted(steps.items(), key=lambda item: int(item[0]))


def newest_clickstream_period(
    clickstream: dict[str, Any], funnel_id: str
) -> tuple[str, dict[str, Any]]:
    available = clickstream.get("data", {}).get(funnel_id, {})
    for period in clickstream.get("periods", []):
        key = f"{period['date_from']}|{period['date_to']}"
        if key in available:
            return key, available[key]
    if available:
        key = sorted(available)[-1]
        return key, available[key]
    raise ReportBuildError(f"Нет данных кликстрима для воронки {funnel_id}")


def newest_draft_entry(
    drafts: dict[str, Any], product: str
) -> tuple[str, dict[str, Any]]:
    group = drafts.get("data", {}).get(product)
    if not group:
        raise ReportBuildError(f"Нет данных черновиков для продукта {product!r}")
    periods = group.get("periods", [])
    data = group.get("data", {})
    for period in reversed(periods):
        if period in data:
            return period, data[period]
    raise ReportBuildError(f"Нет периодов черновиков для продукта {product!r}")


def common_month_entries(
    *,
    drafts: dict[str, Any],
    draft_product: str,
    clickstream: dict[str, Any],
    funnel_id: str,
) -> tuple[str, str, dict[str, Any], str, dict[str, Any]]:
    """Select the newest month available in drafts and clickstream."""

    draft_group = drafts.get("data", {}).get(draft_product) or {}
    draft_data = draft_group.get("data") or {}
    draft_months = {
        month for month in draft_group.get("periods", []) if month in draft_data
    }

    click_data = clickstream.get("data", {}).get(funnel_id) or {}
    click_periods: dict[str, str] = {}
    for period in clickstream.get("periods", []):
        key = f"{period['date_from']}|{period['date_to']}"
        if key in click_data:
            click_periods[period["date_from"][:7]] = key

    common = draft_months & set(click_periods)
    if not common:
        raise ReportBuildError(
            "Нет общего периода для маппинга "
            f"{draft_product!r} → {funnel_id!r}"
        )
    month = max(common)
    click_period = click_periods[month]
    return (
        month,
        month,
        draft_data[month],
        click_period,
        click_data[click_period],
    )


def coverage_for_step(
    row: dict[str, Any], nrt_groups: list[dict[str, Any]]
) -> dict[str, Any]:
    """Match NRT originals to clickstream event groups by exact normalized event text."""

    token_groups = row.get("event_token_groups") or []
    if not token_groups:
        fallback_tokens = row.get("event_match_tokens") or []
        if isinstance(fallback_tokens, list) and fallback_tokens:
            if all(isinstance(item, list) for item in fallback_tokens):
                token_groups = fallback_tokens
            else:
                # Some production exports expose only the flattened token set.
                # Bound every non-platform token separately. This is conservative:
                # one matching event cannot mark an ungrouped multi-event step full.
                token_groups = [
                    [token]
                    for token in fallback_tokens
                    if str(token).strip().casefold() not in PLATFORM_EVENT_TOKENS
                ]
    nrt_events: set[str] = set()
    nrt_products: list[str] = []
    for group in nrt_groups:
        product = group.get("product")
        if product and product not in nrt_products:
            nrt_products.append(product)
        for event in group.get("events") or []:
            original = event.get("original")
            if original:
                nrt_events.add(strip_platform_prefix(str(original)))

    event_coverage = []
    for tokens in token_groups:
        normalized_tokens = [str(token).strip() for token in tokens]
        matched_tokens = [token for token in normalized_tokens if token in nrt_events]
        event_coverage.append(
            {
                "tokens": normalized_tokens,
                "covered": bool(matched_tokens),
                "matched_tokens": matched_tokens,
            }
        )
    total = len(token_groups)
    covered = sum(group["covered"] for group in event_coverage)
    if not total:
        status = "not_applicable"
    elif covered == total:
        status = "full"
    elif covered:
        status = "partial"
    else:
        status = "none"
    return {
        "status": status,
        "covered": covered,
        "total": total,
        "nrt_products": nrt_products,
        "event_coverage": event_coverage,
    }


def build_steps(click_entry: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    funnel = click_entry.get("funnel") or {}
    previous = click_entry.get("prev_funnel") or {}
    nrt_matches = click_entry.get("nrt_matches") or {}
    result: list[dict[str, Any]] = []

    for step_number, row in sorted_step_items(funnel):
        previous_row = previous.get(step_number, {})
        coverage = coverage_for_step(row, nrt_matches.get(step_number, []))
        result.append(
            {
                "number": int(step_number),
                "name": row.get("step_name") or f"Шаг {step_number}",
                "count": row.get("count"),
                "delta": numeric_delta(row.get("count"), previous_row.get("count")),
                "conversion_previous": percent(row.get("conv_from_prev")),
                "conversion_start": percent(row.get("conv_from_start")),
                **coverage,
            }
        )

    summary = {
        "total": sum(item["status"] != "not_applicable" for item in result),
        "full": sum(item["status"] == "full" for item in result),
        "partial": sum(item["status"] == "partial" for item in result),
        "none": sum(item["status"] == "none" for item in result),
        "event_total": sum(item["total"] for item in result),
        "event_covered": sum(item["covered"] for item in result),
        "full_event_total": sum(
            item["total"] for item in result if item["status"] == "full"
        ),
        "full_event_covered": sum(
            item["covered"] for item in result if item["status"] == "full"
        ),
        "partial_event_total": sum(
            item["total"] for item in result if item["status"] == "partial"
        ),
        "partial_event_covered": sum(
            item["covered"] for item in result if item["status"] == "partial"
        ),
        "none_event_total": sum(
            item["total"] for item in result if item["status"] == "none"
        ),
    }
    return result, summary


def build_recommendations(
    *,
    product_name: str,
    steps: list[dict[str, Any]],
    summary: dict[str, Any],
    losshunter: dict[str, Any],
) -> dict[str, Any]:
    """Keep exact LossHunter evidence scoped to ОСАГО; transfer only its schema."""

    aggregate_nrt = (
        f"В сквозном отчёте NRT покрывает {summary['event_covered']} из "
        f"{summary['event_total']} событий на {summary['total']} этапах."
    )
    if normalized_name(product_name) == "осаго":
        cards = []
        for source_card in losshunter["cards"]:
            card = dict(source_card)
            card.update(
                {
                    "source_scope": "exact_osago_path",
                    "scope_label": "ОСАГО · точный CJX",
                    "display_context": "День · 25–60 · исходная рекомендация LossHunter",
                    "nrt_link": (
                        f"{aggregate_nrt} Этапы технической воронки и этапы CJX "
                        "имеют разную таксономию; прямое соответствие не доказано. "
                        "Перед запуском связать триггер с событием в реестре NRT/CJ."
                    ),
                }
            )
            cards.append(card)
        return {
            "scope": "exact_osago_path",
            "scope_label": "ОСАГО · точный CJX",
            "source_html": losshunter["copy_block_html"],
            "source_page_style": losshunter["copy_page_style"],
            "note": (
                f"Точный источник: путь «{losshunter['path']}», прогон "
                f"{losshunter['run_id']}. Девять карточек перенесены без "
                "домысливания. Значения «· путь» и «· анкета» — исходные данные; "
                "«· гипотеза» требует проверки; «нужен ввод» не заполнен."
            ),
            "items": cards,
        }

    missing_or_partial = sorted(
        (
            item
            for item in steps
            if item["status"] in {"none", "partial"}
        ),
        key=lambda item: (item["status"] != "none", item["number"]),
    )
    candidates = missing_or_partial or [
        item for item in steps if item["status"] != "not_applicable"
    ]
    cards = []
    for step in candidates[:3]:
        nrt_state = {
            "none": "нет покрытия",
            "partial": "частичное покрытие",
            "full": "полное покрытие",
        }.get(step["status"], "нет событий")
        cards.append(
            {
                "stage": step["name"],
                "source_scope": "schema_only",
                "scope_label": "Шаблон · нужен ввод",
                "display_context": "Нужен продуктовый CJX-прогон и анкета владельца",
                "trigger": (
                    f"Обрыв на техническом этапе «{step['name']}» · сквозной "
                    "отчёт. Причина ухода — нужен ввод: продуктовый CJX-путь."
                ),
                "event_registry": (
                    f"NRT: {nrt_state}, {step['covered']} из {step['total']} "
                    "групп событий · сквозной отчёт. Триггерное событие — нужен "
                    "ввод: реестр NRT/CJ."
                ),
                "segment": "нужен ввод: сегмент из анкеты владельца продукта",
                "send_time": "нужен ввод: срочность барьера и правила тихих часов",
                "primary_channel": "нужен ввод: доступность контактов, разрешённые каналы и стоимость",
                "fallback_channel": "нужен ввод: запасной канал и условие его включения",
                "message": "нужен ввод: доказанная причина ухода, тон и сохранённый следующий шаг",
                "upsell": "нужен ввод: правила стимула и допустимый предел",
                "rationale": (
                    f"{aggregate_nrt} Для «{product_name}» нет отдельного "
                    "LossHunter-прогона и анкеты, поэтому ОСАГО-факты, каналы, "
                    "тайминги и тексты сюда не перенесены."
                ),
                "success_metric": losshunter["verification_plan"],
                "brief_template": "нужен ввод: внутренний шаблон ТЗ команды NRT/CJ",
                "nrt_link": (
                    "Сначала подтвердить связь технического этапа с CJX-этапом "
                    "и зарегистрировать устойчивое событие; только затем карточка "
                    "становится рекомендацией к запуску."
                ),
                "outreach": {
                    "when": "Срок не назначен: нужна срочность барьера и правила тихих часов.",
                    "primary_channel": "Канал не выбран: нужны доступность контактов, разрешения и стоимость.",
                    "fallback_channel": "Запасной канал не выбран: нужно правило переключения.",
                    "what_to_say": (
                        "Текст пока не формируется. Сначала нужен продуктовый "
                        "CJX-прогон с доказанной причиной ухода; переносить сообщение "
                        "из ОСАГО нельзя."
                    ),
                    "upsell": "Стимул не назначен: нужны правила продукта и допустимый предел.",
                    "rationale": (
                        f"Технический этап «{step['name']}» имеет {nrt_state}: "
                        f"{step['covered']} из {step['total']} групп событий. | "
                        "Причина ухода, доступные контакты и реакция на стимул в "
                        "сквозном отчёте не наблюдаются."
                    ),
                },
            }
        )
    return {
        "scope": "schema_only",
        "scope_label": "Схема LossHunter · нужен продуктовый прогон",
        "source_html": "",
        "source_page_style": "",
        "note": (
            f"LossHunter-источник относится только к пути «{losshunter['path']}». "
            f"Для «{product_name}» перенесена структура ТЗ; факты ОСАГО не переиспользуются. "
            "Поля «нужен ввод» надо заполнить из продуктового CJX-прогона, анкеты "
            "владельца и реестра триггерных событий."
        ),
        "items": cards,
    }


def merge_product(
    mapping: dict[str, Any],
    drafts: dict[str, Any],
    clickstream: dict[str, Any],
    funnel_names: dict[str, str],
    zeroed_mode: bool,
    losshunter: dict[str, Any],
) -> dict[str, Any]:
    funnel_id = str(mapping["clickstream_funnel_id"])
    (
        common_month,
        draft_period,
        draft_entry,
        click_period,
        click_entry,
    ) = common_month_entries(
        drafts=drafts,
        draft_product=mapping["draft_product"],
        clickstream=clickstream,
        funnel_id=funnel_id,
    )
    steps, summary = build_steps(click_entry)
    metrics = draft_entry.get("metrics") or {}
    previous_metrics = draft_entry.get("prev_metrics") or {}
    metric_keys = ("potential_sht", "coverage_sht", "coverage_pct")

    return {
        "label": mapping["label"],
        "mapping": {
            "dd_product": mapping["dd_product"],
            "draft_product": mapping["draft_product"],
            "clickstream_funnel_id": funnel_id,
            "clickstream_funnel": funnel_names[funnel_id],
        },
        "periods": {
            "common_month": common_month,
            "drafts": draft_period,
            "clickstream": click_period.replace("|", " — "),
        },
        "metrics": {
            key: {
                "value": metrics.get(key),
                "delta": numeric_delta(metrics.get(key), previous_metrics.get(key)),
            }
            for key in metric_keys
        },
        "steps": steps,
        "summary": summary,
        "recommendations": build_recommendations(
            product_name=mapping["dd_product"],
            steps=steps,
            summary=summary,
            losshunter=losshunter,
        ),
    }


def validate_mapping(
    config: dict[str, Any],
    drafts: dict[str, Any],
    clickstream: dict[str, Any],
    product_mapping: set[tuple[str, str, str]],
) -> dict[str, str]:
    products = config.get("products")
    if not isinstance(products, list) or not products:
        raise ReportBuildError("mapping.json: products должен быть непустым списком")

    funnel_names = {
        str(item["funnel_id"]): str(item["funnel_name"])
        for item in clickstream.get("funnels", [])
    }
    labels: set[str] = set()
    for index, item in enumerate(products, start=1):
        required = (
            "label",
            "dd_product",
            "draft_product",
            "clickstream_funnel_id",
        )
        missing = [key for key in required if not item.get(key)]
        if missing:
            raise ReportBuildError(
                f"mapping.json: products[{index}] — нет полей: {', '.join(missing)}"
            )
        if item["label"] in labels:
            raise ReportBuildError(f"mapping.json: повтор label {item['label']!r}")
        labels.add(item["label"])
        if item["draft_product"] not in drafts.get("data", {}):
            raise ReportBuildError(
                f"mapping.json: неизвестный draft_product {item['draft_product']!r}"
            )
        funnel_id = str(item["clickstream_funnel_id"])
        if funnel_id not in funnel_names:
            raise ReportBuildError(
                f"mapping.json: неизвестный clickstream_funnel_id {funnel_id!r}"
            )
        mapping_checks = (
            ("drafts", item["draft_product"]),
            ("clickstream_funnel", funnel_names[funnel_id]),
        )
        for tool_key, product_name in mapping_checks:
            triple = (item["dd_product"], tool_key, product_name)
            if triple not in product_mapping:
                raise ReportBuildError(
                    "mapping.json: соответствие отсутствует в "
                    f"ai_product_mapping.xlsx: {triple!r}"
                )
    if config.get("default_product") not in labels:
        raise ReportBuildError("mapping.json: default_product отсутствует среди products")
    return funnel_names


def build_payload(
    paths: SourcePaths,
    mapping_path: Path,
    product_mapping_path: Path,
    ddi_data_path: Path,
    losshunter_path: Path | None = None,
) -> dict[str, Any]:
    drafts = extract_embedded_json(paths.drafts, ASSIGNMENTS["drafts"])
    clickstream = extract_embedded_json(paths.clickstream, ASSIGNMENTS["clickstream"])
    product_mapping = read_product_mapping(product_mapping_path)
    resolved_losshunter_path = losshunter_path or locate_losshunter(None)
    losshunter = parse_losshunter_report(resolved_losshunter_path)
    config = json.loads(mapping_path.read_text(encoding="utf-8"))
    funnel_names = validate_mapping(config, drafts, clickstream, product_mapping)
    zeroed_mode = all(
        "_zeroed" in path.name
        for path in (paths.drafts, paths.clickstream)
    )
    products = [
        merge_product(
            item,
            drafts,
            clickstream,
            funnel_names,
            zeroed_mode,
            losshunter,
        )
        for item in config["products"]
    ]
    ddi_data = json.loads(ddi_data_path.read_text(encoding="utf-8"))
    ddi_products = build_ddi_product_lineup(
        ddi_data, products, config.get("excluded_products", [])
    )
    return {
        "default_product": config["default_product"],
        "products": products,
        "ddi_products": ddi_products,
        "meta": {
            "source_files": {
                "drafts": paths.drafts.name,
                "clickstream": paths.clickstream.name,
                "product_mapping": product_mapping_path.name,
                "ddi_data": ddi_data_path.name,
                "losshunter": resolved_losshunter_path.name,
            },
            "coverage_rule": (
                "NRT original после удаления платформенного префикса "
                "точно совпадает с одним из tokens исходной группы события."
            ),
            "zeroed_mode": zeroed_mode,
            "excluded_products": config.get("excluded_products", []),
            "recommendation_source": {
                "title": losshunter["title"],
                "path": losshunter["path"],
                "run_id": losshunter["run_id"],
                "source_note": losshunter["source_note"],
                "verification_plan": losshunter["verification_plan"],
                "missing_inputs": losshunter["missing_inputs"],
            },
        },
    }


HTML_TEMPLATE = r"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DDI · Черновики и оформление в СБОЛ</title>
<style>
:root{
  --ddi-canvas:#f3f5f7;--ddi-surface:#fff;--ddi-surface-muted:#f7f8fa;--ddi-surface-inset:#eef1f4;
  --ddi-line:rgba(26,29,31,.10);--ddi-line-strong:rgba(26,29,31,.18);
  --ddi-ink:#181b1e;--ddi-ink-secondary:#5f666d;--ddi-ink-tertiary:#858b91;--ddi-ink-muted:#a6abb0;
  --ddi-event-ink:#454b50;--ddi-evidence-ink:#315473;--ddi-row-hover:#f9fcfe;
  --ddi-signal:#239ee2;--ddi-signal-strong:#147fb9;--ddi-signal-soft:rgba(35,158,226,.10);
  --ddi-positive:#267a3e;--ddi-positive-soft:#e9f5ec;
  --ddi-warning:#8a6109;--ddi-warning-soft:#fff4d7;
  --ddi-danger:#a93a32;--ddi-danger-soft:#fcebea;
  --ddi-radius-control:6px;--ddi-radius-surface:8px;
  --ddi-font:"SB Sans Text","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;
  --ddi-font-display:"SB Sans Display","SB Sans Text","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif
}
*{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-font-smoothing:antialiased}
body{margin:0;min-width:320px;background:var(--ddi-canvas);color:var(--ddi-ink);font:14px/1.45 var(--ddi-font)}
button,input{font:inherit}
button{cursor:pointer}
button:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid rgba(35,158,226,.38);outline-offset:2px}
.ddi-topbar{height:56px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;background:var(--ddi-surface);border-bottom:1px solid var(--ddi-line)}
.ddi-brand{display:flex;align-items:center;gap:10px;font-weight:600}
.ddi-logo{width:28px;height:28px;display:grid;place-items:center;border-radius:6px;background:var(--ddi-signal);color:#fff;font-size:12px;font-weight:700}
.ddi-context{display:flex;align-items:center;gap:8px;color:var(--ddi-ink-secondary);font-size:12px}
.ddi-context-dot{width:6px;height:6px;border-radius:50%;background:var(--ddi-positive)}
.page{width:100%;max-width:1480px;margin:auto;padding:32px 48px 72px}
.context-bar{position:relative;z-index:20;display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,500px);align-items:end;gap:24px;margin-bottom:24px}
.breadcrumbs{display:flex;align-items:center;gap:8px;margin-bottom:12px;color:var(--ddi-ink-tertiary);font-size:11px}
.breadcrumbs span+span:before{content:"/";margin-right:8px;color:var(--ddi-ink-muted)}
.hero h1{max-width:900px;margin:0;font:600 clamp(28px,3vw,38px)/1.08 var(--ddi-font-display);letter-spacing:-.025em;text-wrap:balance}
.hero-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px;color:var(--ddi-ink-secondary);font-size:12px}
.zeroed-note,.meta-pill{display:inline-flex;align-items:center;min-height:24px;padding:3px 8px;border-radius:4px;background:var(--ddi-surface-inset);color:var(--ddi-ink-secondary);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.zeroed-note:before{content:"";width:6px;height:6px;margin-right:6px;border-radius:50%;background:var(--ddi-warning)}
.toolbar{display:grid;gap:8px}
.product-picker{position:relative}
.product-trigger{width:100%;min-height:64px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid var(--ddi-line);border-radius:var(--ddi-radius-surface);background:var(--ddi-surface);color:var(--ddi-ink);text-align:left;transition:border-color .16s,background .16s}
.product-trigger:hover{border-color:var(--ddi-line-strong);background:var(--ddi-surface-muted)}
.product-trigger:focus-visible{border-color:var(--ddi-signal)}
.product-trigger small{display:block;margin-bottom:4px;color:var(--ddi-ink-tertiary);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
.product-trigger b{display:block;font-size:14px;font-weight:600}
.product-trigger-chevron{color:var(--ddi-ink-tertiary);font-size:16px;transition:transform .18s cubic-bezier(.23,1,.32,1)}
.product-trigger[aria-expanded=true] .product-trigger-chevron{transform:rotate(180deg)}
.product-menu{position:absolute;top:calc(100% + 6px);left:0;right:0;padding:8px;border:1px solid var(--ddi-line);border-radius:var(--ddi-radius-surface);background:var(--ddi-surface);box-shadow:0 0 0 1px rgba(0,0,0,.03),0 8px 24px rgba(24,27,30,.12)}
.product-search{width:100%;height:40px;padding:0 12px;border:1px solid transparent;border-radius:var(--ddi-radius-control);background:var(--ddi-surface-inset);color:var(--ddi-ink)}
.product-search::placeholder{color:var(--ddi-ink-tertiary)}
.product-search:focus{border-color:var(--ddi-signal);background:var(--ddi-surface);outline:2px solid rgba(35,158,226,.14)}
.product-menu-meta{display:flex;justify-content:space-between;gap:12px;padding:10px 10px 6px;color:var(--ddi-ink-tertiary);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.product-options{max-height:360px;overflow:auto;display:grid;gap:2px}
.product-option{width:100%;min-height:48px;padding:8px 10px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;border:0;border-radius:var(--ddi-radius-control);background:transparent;color:var(--ddi-ink);text-align:left;transition:background .12s}
.product-option:hover,.product-option:focus-visible{background:var(--ddi-signal-soft);outline:none}
.product-option[aria-selected=true]{background:var(--ddi-signal-soft);box-shadow:inset 3px 0 var(--ddi-signal)}
.product-option b,.product-option small{display:block}
.product-option b{font-size:13px;font-weight:600}
.product-option small{margin-top:2px;color:var(--ddi-ink-tertiary);font-size:11px}
.option-state{padding:3px 6px;border-radius:4px;background:var(--ddi-positive-soft);color:var(--ddi-positive);font-size:10px;font-weight:600;white-space:nowrap}
.option-state.unavailable{background:var(--ddi-surface-inset);color:var(--ddi-ink-tertiary)}
.periods,.variant-tabs{display:flex;gap:6px;flex-wrap:wrap}
.periods span,.variant-button{min-height:28px;padding:5px 8px;border:1px solid var(--ddi-line);border-radius:var(--ddi-radius-control);background:var(--ddi-surface);color:var(--ddi-ink-secondary);font-size:11px}
.variant-tabs:empty,.periods:empty{display:none}
.variant-button:hover,.variant-button.is-active{border-color:rgba(35,158,226,.30);background:var(--ddi-signal-soft);color:var(--ddi-signal-strong)}
.variant-button.is-active{font-weight:600}
.journey,.panel,.empty-state{background:var(--ddi-surface);border:1px solid var(--ddi-line);border-radius:var(--ddi-radius-surface)}
.journey{overflow:hidden}
.panel-head{min-height:72px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid var(--ddi-line)}
.eyebrow{color:var(--ddi-ink-tertiary);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.055em}
.panel h2,.journey h2{margin:3px 0 0;font:600 17px/1.25 var(--ddi-font-display);letter-spacing:-.01em}
.section-sub{color:var(--ddi-ink-tertiary);font-size:11px}
.journey-grid{display:grid;grid-template-columns:1fr 48px 1fr 48px 1.12fr;align-items:stretch;padding:8px}
.journey-stage{min-height:152px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;border-radius:6px;background:var(--ddi-surface-muted)}
.journey-stage.is-focal{background:var(--ddi-signal-soft)}
.stage-kicker{display:flex;align-items:center;gap:8px;color:var(--ddi-ink-secondary);font-size:11px;font-weight:600}
.stage-number{width:22px;height:22px;display:grid;place-items:center;border-radius:50%;background:var(--ddi-surface);color:var(--ddi-ink-tertiary);font-size:10px;font-variant-numeric:tabular-nums}
.journey-value{margin-top:12px;color:var(--ddi-ink);font:600 30px/1 var(--ddi-font-display);letter-spacing:-.025em;font-variant-numeric:tabular-nums}
.journey-value.is-redacted{font-size:16px;letter-spacing:0}
.journey-stage.is-focal .journey-value{color:var(--ddi-signal-strong)}
.delta{margin-top:7px;color:var(--ddi-ink-tertiary);font-size:11px}
.journey-connector{display:grid;place-items:center;color:var(--ddi-ink-muted);font-size:18px}
.coverage-track{height:5px;margin-top:14px;overflow:hidden;border-radius:3px;background:rgba(35,158,226,.15)}
.coverage-track span{display:block;width:0;height:100%;border-radius:inherit;background:var(--ddi-signal);transition:width .24s cubic-bezier(.23,1,.32,1)}
.workspace{display:grid;gap:16px;margin-top:16px}
.panel{overflow:hidden}
.panel-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.chips{display:flex;gap:4px;flex-wrap:wrap}
.chip,.badge{display:inline-flex;align-items:center;min-height:24px;padding:3px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap}
.chip{background:var(--ddi-surface-inset);color:var(--ddi-ink-secondary)}
.coverage-overview{min-height:58px;padding:0 20px;display:flex;align-items:stretch;border-bottom:1px solid var(--ddi-line);background:var(--ddi-surface)}
.summary-card{min-width:0;padding:10px 14px;display:flex;align-items:center;gap:9px;flex:1;border-right:1px solid var(--ddi-line)}
.summary-card:last-child{border-right:0}
.summary-card.is-overall{flex:1.3;background:var(--ddi-signal-soft)}
.summary-card b{color:var(--ddi-ink);font:600 18px/1 var(--ddi-font-display);font-variant-numeric:tabular-nums;white-space:nowrap}
.summary-card.is-overall b{color:var(--ddi-signal-strong)}
.summary-card span{min-width:0;color:var(--ddi-ink-secondary);font-size:10px;line-height:1.25;text-wrap:pretty}
.table-wrap{overflow:auto;scrollbar-gutter:stable}
table{width:100%;border-collapse:collapse;min-width:1060px}
thead th{position:sticky;top:0;z-index:3;height:42px;background:var(--ddi-surface-muted);color:var(--ddi-ink-tertiary);font-size:10px;font-weight:600;text-align:left;text-transform:uppercase;letter-spacing:.035em}
th,td{padding:10px 12px;border-bottom:1px solid var(--ddi-line);vertical-align:middle}
tbody tr:last-child td,tbody tr:last-child th{border-bottom:0}
tbody tr{transition:background .12s}
tbody tr:hover{background:rgba(35,158,226,.035)}
.num{position:sticky;left:0;z-index:2;width:44px;background:var(--ddi-surface);color:var(--ddi-ink-tertiary);font-size:11px;font-weight:600}
.step-name{position:sticky;left:44px;z-index:2;min-width:210px;background:var(--ddi-surface);color:var(--ddi-ink);font-size:12px;font-weight:600;text-align:left;text-transform:none;letter-spacing:0}
thead .num,thead .step-name{z-index:4;background:var(--ddi-surface-muted)}
tbody tr:hover .num,tbody tr:hover .step-name{background:var(--ddi-row-hover)}
.value{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.event-disclosure{min-width:220px}
.event-disclosure summary{min-height:32px;display:flex;align-items:center;gap:7px;color:var(--ddi-ink-secondary);font-size:11px;font-weight:600;cursor:pointer;list-style:none}
.event-disclosure summary::-webkit-details-marker{display:none}
.event-disclosure summary:before{content:"›";color:var(--ddi-ink-tertiary);font-size:16px;transition:transform .16s}
.event-disclosure[open] summary:before{transform:rotate(90deg)}
.event-list{width:min(520px,45vw);padding:4px 0 8px 22px;display:grid;gap:3px}
.event-row{min-height:30px;padding:5px 7px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;border-radius:4px;background:var(--ddi-surface-muted)}
.event{color:var(--ddi-event-ink);font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
.event-state{color:var(--ddi-ink-tertiary);font-size:9px;font-weight:600;text-transform:uppercase;white-space:nowrap}
.event-row.is-covered{background:var(--ddi-positive-soft)}
.event-row.is-covered .event-state{color:var(--ddi-positive)}
.full{background:var(--ddi-positive-soft);color:var(--ddi-positive)}
.partial{background:var(--ddi-warning-soft);color:var(--ddi-warning)}
.none,.not_applicable{background:var(--ddi-surface-inset);color:var(--ddi-ink-secondary)}
.recs{display:grid;gap:8px;padding:0 20px 20px}
.rec{overflow:hidden;border:1px solid var(--ddi-line);border-radius:var(--ddi-radius-surface);background:var(--ddi-surface)}
.rec>summary{min-height:58px;padding:12px 14px;display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:10px;cursor:pointer;list-style:none}
.rec>summary::-webkit-details-marker{display:none}
.rec>summary:after{content:"›";color:var(--ddi-ink-tertiary);font-size:18px;transition:transform .16s}
.rec[open]>summary:after{transform:rotate(90deg)}
.rec-index{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:var(--ddi-surface-inset);color:var(--ddi-ink-tertiary);font-size:11px;font-weight:600;font-variant-numeric:tabular-nums}
.rec-heading b,.rec-heading small{display:block}.rec-heading b{font-size:13px}.rec-heading small{margin-top:3px;color:var(--ddi-ink-tertiary);font-size:10px}
.rec-priority{width:fit-content;padding:4px 6px;border-radius:4px;background:var(--ddi-signal-soft);color:var(--ddi-signal-strong);font-size:10px;font-weight:600;white-space:nowrap}
.rec-priority.schema_only{background:var(--ddi-warning-soft);color:var(--ddi-warning)}
.rec-body{padding:0 14px 14px 56px;border-top:1px solid var(--ddi-line)}
.rec-route{display:grid;grid-template-columns:.8fr 1fr 1.35fr;gap:1px;background:var(--ddi-line)}
.rec-route-item{min-height:76px;padding:12px;background:var(--ddi-surface-muted)}
.rec-title{margin-bottom:5px;color:var(--ddi-ink-tertiary);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.rec p{margin:0;color:var(--ddi-ink-secondary);font-size:12px;text-wrap:pretty;overflow-wrap:anywhere}
.rec-route-item p{color:var(--ddi-ink);font-weight:500}
.rec-copy{margin-top:12px;padding:16px;border-radius:6px;background:var(--ddi-signal-soft)}
.rec-guidance{margin-bottom:10px!important;color:var(--ddi-evidence-ink)!important}
.rec-copy blockquote{margin:0;color:var(--ddi-ink);font:500 16px/1.5 var(--ddi-font-display);letter-spacing:-.005em;text-wrap:pretty}
.rec-upsell{margin-top:8px;padding:10px 12px;display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;border-radius:6px;background:var(--ddi-surface-muted)}
.rec-upsell .rec-title{margin:1px 0 0}.rec-upsell p{color:var(--ddi-ink)}
.rec-disclosures{margin-top:10px;border-top:1px solid var(--ddi-line)}
.rec-detail{border-bottom:1px solid var(--ddi-line)}
.rec-detail:last-child{border-bottom:0}
.rec-detail>summary{min-height:44px;display:flex;align-items:center;gap:8px;color:var(--ddi-ink-secondary);font-size:11px;font-weight:600;cursor:pointer;list-style:none}
.rec-detail>summary::-webkit-details-marker{display:none}
.rec-detail>summary:before{content:"›";color:var(--ddi-ink-tertiary);font-size:16px;transition:transform .16s}
.rec-detail[open]>summary:before{transform:rotate(90deg)}
.rec-reasons{margin:0;padding:0 0 12px 20px;display:grid;gap:7px;color:var(--ddi-ink-secondary);font-size:12px}
.rec-tech-grid{padding:0 0 12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.rec-tech-field{padding:10px 12px;border-radius:6px;background:var(--ddi-surface-muted)}
.rec-tech-field.is-wide{grid-column:1/-1}
.copy-all{min-height:40px;padding:8px 12px;border:1px solid rgba(35,158,226,.28);border-radius:var(--ddi-radius-control);background:var(--ddi-signal-soft);color:var(--ddi-signal-strong);font-size:11px;font-weight:600;transition:background .14s,border-color .14s,transform .12s}
.copy-all:hover{border-color:rgba(35,158,226,.45);background:rgba(35,158,226,.15)}
.copy-all:active,.copy-button:active{transform:scale(.97)}
.copy-paste-mode .recs{gap:10px}
.copy-card{overflow:hidden;border:1px solid var(--ddi-line);border-radius:var(--ddi-radius-surface);background:var(--ddi-surface)}
.copy-card-head{min-height:58px;padding:10px 12px 10px 14px;display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid var(--ddi-line)}
.copy-card-title b,.copy-card-title span{display:block}.copy-card-title b{font-size:13px}.copy-card-title span{margin-top:3px;color:var(--ddi-ink-tertiary);font-size:10px}
.copy-button{min-width:112px;min-height:40px;padding:7px 10px;border:1px solid var(--ddi-line-strong);border-radius:var(--ddi-radius-control);background:var(--ddi-surface);color:var(--ddi-ink-secondary);font-size:11px;font-weight:600;transition:background .14s,border-color .14s,color .14s,transform .12s}
.copy-button:hover{border-color:rgba(35,158,226,.35);background:var(--ddi-signal-soft);color:var(--ddi-signal-strong)}
.copy-button.is-copied,.copy-all.is-copied{border-color:rgba(38,122,62,.25);background:var(--ddi-positive-soft);color:var(--ddi-positive)}
.source-copy-fragment{padding:10px 14px 14px;color:var(--ddi-ink);font-size:15px;line-height:1.55}
.copy-empty{padding:20px;border:1px solid var(--ddi-line);border-radius:var(--ddi-radius-surface);background:var(--ddi-surface-muted);color:var(--ddi-ink-secondary);font-size:13px}
.copy-source{padding:8px 14px;border-top:1px solid var(--ddi-line);color:var(--ddi-ink-tertiary);font-size:10px}
.method{margin:16px 20px;padding:12px 14px;border-radius:6px;background:var(--ddi-signal-soft);color:var(--ddi-evidence-ink);font-size:12px}
.method b{display:block;margin-bottom:4px;color:var(--ddi-signal-strong)}
.method a{color:var(--ddi-signal-strong)}
.mapping{margin:0 20px 18px;padding-top:12px;border-top:1px solid var(--ddi-line);color:var(--ddi-ink-secondary);font-size:12px}
.mapping summary{min-height:40px;display:flex;align-items:center;cursor:pointer;font-weight:600}
.empty-state{min-height:340px;padding:56px 32px;display:grid;place-items:center;text-align:center}
.empty-icon{width:44px;height:44px;margin:auto;display:grid;place-items:center;border-radius:50%;background:var(--ddi-signal-soft);color:var(--ddi-signal);font-weight:700}
.empty-state h2{margin:16px 0 8px;font:600 20px/1.25 var(--ddi-font-display)}
.empty-state p{max-width:600px;margin:0;color:var(--ddi-ink-secondary);text-wrap:pretty}
.empty-meta{margin-top:16px;color:var(--ddi-signal-strong);font-size:11px;font-weight:600}
.footer{margin-top:20px;color:var(--ddi-ink-tertiary);font-size:10px;text-align:center}
.visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.is-embedded .ddi-topbar{display:none}
.is-embedded .page{padding-top:24px}
@media(max-width:1000px){.page{padding:28px 24px 56px}.context-bar{grid-template-columns:1fr}.toolbar{max-width:none}.journey-grid{grid-template-columns:1fr 32px 1fr 32px 1.12fr}}
@media(max-width:700px){.ddi-topbar{padding:0 14px}.ddi-context span:last-child{display:none}.page{padding:22px 12px 44px}.context-bar{margin-bottom:20px}.hero h1{font-size:28px}.product-menu{position:fixed;z-index:50;top:auto;right:12px;bottom:12px;left:12px;max-height:70dvh}.product-options{max-height:calc(70dvh - 92px)}.journey-grid{grid-template-columns:1fr;padding:8px}.journey-stage{min-height:116px}.journey-connector{height:28px;transform:rotate(90deg)}.coverage-overview{padding:0;flex-wrap:wrap}.summary-card,.summary-card.is-overall{min-height:52px;flex:1 1 50%}.summary-card:nth-child(2){border-right:0}.summary-card:nth-child(-n+2){border-bottom:1px solid var(--ddi-line)}.panel-head{align-items:flex-start;flex-direction:column}.panel-head-actions{justify-content:flex-start}.recs{padding:0 12px 12px}.rec>summary{grid-template-columns:32px minmax(0,1fr)}.rec>summary:after{display:none}.rec-priority{grid-column:2}.rec-body{padding:0 10px 10px}.rec-route{grid-template-columns:1fr}.rec-route-item{min-height:0}.rec-copy{padding:14px}.rec-copy blockquote{font-size:15px}.rec-upsell{grid-template-columns:1fr;gap:4px}.rec-tech-grid{grid-template-columns:1fr}.rec-tech-field.is-wide{grid-column:auto}.copy-card-head{align-items:flex-start}.copy-button{min-width:96px}.source-copy-fragment{padding:8px 10px 12px;font-size:13px}.source-copy-fragment .dt-fields{grid-template-columns:1fr}.product-option{grid-template-columns:1fr}.option-state{width:fit-content}.event-list{width:min(520px,70vw)}}
@page{size:A4 landscape;margin:10mm}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;transition:none!important}}
@media print{body{background:#fff}.ddi-topbar,.toolbar{display:none}.page{max-width:none;padding:0}.journey{break-inside:avoid}.panel{overflow:visible}table{min-width:0;font-size:9px}thead{display:table-header-group}thead th,.num,.step-name{position:static}.event-disclosure .event-list{display:none}.rec{break-inside:avoid}.event{font-size:8px}}
</style>
</head>
<body>
<header class="ddi-topbar">
  <div class="ddi-brand"><span class="ddi-logo">DD</span><span>Data-Driven Index</span></div>
  <div class="ddi-context"><span class="ddi-context-dot" aria-hidden="true"></span><span>Сквозная аналитика · СБОЛ</span></div>
</header>
<main class="page">
  <div class="visually-hidden" aria-hidden="true">
    <label for="exp-product">Продукт</label><select id="exp-product" tabindex="-1"></select>
    <label for="exp-period">Период</label><select id="exp-period" tabindex="-1"></select>
    <button id="exp-show" type="button" tabindex="-1">Показать</button>
  </div>
  <section class="context-bar">
    <header class="hero">
      <nav class="breadcrumbs" aria-label="Путь отчёта"><span>DDI</span><span>Продукты</span><span>Оформление в СБОЛ</span></nav>
      <h1 id="report-title" aria-live="polite">Черновики и оформление в СБОЛ</h1>
      <div class="hero-meta">
        <span id="hero-meta">Черновики → коммуникации → NRT</span>
        <span class="zeroed-note" id="zeroed-note">Обезличенные данные</span>
      </div>
    </header>
    <div class="toolbar">
      <div class="product-picker" id="product-picker">
        <button class="product-trigger" id="product-trigger" type="button" aria-haspopup="listbox" aria-controls="product-menu" aria-expanded="false">
          <span><small>Продукт DDI</small><b id="product-trigger-label">Выберите продукт</b></span>
          <span class="product-trigger-chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="product-menu" id="product-menu" hidden>
          <input class="product-search" id="product-search" type="search" placeholder="Поиск по продукту, юниту или трайбу" autocomplete="off" role="combobox" aria-label="Поиск по продуктовой линейке DDI" aria-autocomplete="list" aria-controls="product-options" aria-expanded="false">
          <div class="product-menu-meta" id="product-menu-meta"></div>
          <div class="product-options" id="product-options" role="listbox" aria-label="Продуктовая линейка DDI"></div>
        </div>
      </div>
      <div class="variant-tabs" id="variant-tabs" aria-label="Варианты сквозного отчёта"></div>
      <div class="periods" id="periods"></div>
    </div>
  </section>

  <section class="empty-state" id="empty-state" hidden>
    <div>
      <div class="empty-icon" aria-hidden="true">i</div>
      <h2 id="empty-title"></h2>
      <p id="empty-reason"></p>
      <div class="empty-meta" id="empty-meta"></div>
    </div>
  </section>

  <div id="report-content">
    <section class="journey" aria-labelledby="journey-title">
      <div class="panel-head">
        <div><div class="eyebrow">Линия покрытия</div><h2 id="journey-title">От черновика до коммуникации</h2></div>
        <span class="meta-pill" id="journey-status">Срез формируется</span>
      </div>
      <div class="journey-grid">
        <article class="journey-stage">
          <div class="stage-kicker"><span class="stage-number">01</span><span>Брошенные корзины</span></div>
          <div><div class="journey-value" id="potential">—</div><div class="delta" id="potential-delta"></div></div>
        </article>
        <div class="journey-connector" aria-hidden="true">→</div>
        <article class="journey-stage">
          <div class="stage-kicker"><span class="stage-number">02</span><span>Покрыто коммуникациями</span></div>
          <div><div class="journey-value" id="coverage">—</div><div class="delta" id="coverage-delta"></div></div>
        </article>
        <div class="journey-connector" aria-hidden="true">→</div>
        <article class="journey-stage is-focal">
          <div class="stage-kicker"><span class="stage-number">03</span><span>Доля покрытия</span></div>
          <div>
            <div class="journey-value" id="coverage-pct">—</div>
            <div class="delta" id="coverage-pct-delta"></div>
            <div class="coverage-track" aria-hidden="true"><span id="coverage-track-value"></span></div>
          </div>
        </article>
      </div>
    </section>

    <div class="workspace">
    <section class="panel">
      <div class="panel-head">
        <div><div class="eyebrow">Оформление в СБОЛ</div><h2>Этапы воронки и NRT</h2><div class="section-sub" id="funnel-name"></div></div>
      </div>
      <div class="coverage-overview" id="micro"></div>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Таблица этапов воронки; на узком экране прокручивается горизонтально">
        <table>
          <caption class="visually-hidden">Этапы оформления в СБОЛ, события и покрытие NRT</caption>
          <thead><tr><th class="num" scope="col">#</th><th class="step-name" scope="col">Этап</th><th scope="col">NRT</th><th class="value" scope="col">Кол-во</th><th class="value" scope="col">Δ к пред.</th><th class="value" scope="col">CR к пред.</th><th class="value" scope="col">CR от начала</th><th scope="col">События</th></tr></thead>
          <tbody id="steps"></tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div><div class="eyebrow" id="recommendations-eyebrow">Следующие действия</div><h2 id="recommendations-title">Рекомендации по настройке</h2></div>
        <div class="panel-head-actions"><span class="meta-pill" id="recommendation-count"></span><button class="copy-all" id="copy-all" type="button" hidden>Копировать все исходные блоки</button></div>
      </div>
      <div class="method"><b id="recommendation-source-label">Источник LossHunter</b><span id="recommendation-source-note"></span> <a href="https://losshunter.ru/showcase/cjx/outreach/" target="_blank" rel="noopener noreferrer">Методика</a></div>
      <div class="recs" id="recommendations"></div>
      <details class="mapping"><summary>Маппинг и правило NRT</summary><p id="mapping"></p><p><code id="coverage-rule"></code></p><p id="exclusions"></p></details>
    </section>
    </div>
  </div>
  <footer class="footer" id="footer"></footer>
</main>
<script>
const REPORT = __REPORT_DATA__;
const REPORT_VARIANT = "__REPORT_VARIANT__";
const byId = id => document.getElementById(id);
const fmt = value => value == null ? "—" : new Intl.NumberFormat("ru-RU",{maximumFractionDigits:1}).format(value);
const signed = value => value == null ? "нет сравнения" : `${value > 0 ? "+" : ""}${fmt(value)} к предыдущему периоду`;
const countWord = (value,one,few,many) => {
  const mod100=value%100,mod10=value%10;
  return mod100>=11&&mod100<=14?many:mod10===1?one:mod10>=2&&mod10<=4?few:many;
};
const metric = (product,key,unit="") => {
  const valueId=key==="potential_sht"?"potential":key==="coverage_sht"?"coverage":"coverage-pct";
  const item=product.metrics[key];
  byId(valueId).classList.toggle("is-redacted",REPORT.meta.zeroed_mode);
  byId(valueId).textContent=REPORT.meta.zeroed_mode?"Обезличено":item.value==null?"—":`${fmt(item.value)}${unit}`;
  byId(`${valueId}-delta`).textContent=REPORT.meta.zeroed_mode?"Количественная метрика скрыта":signed(item.delta)+(item.delta==null?"":unit);
};
function element(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!=null)el.textContent=text;return el}
function sourceCopyParts(value){const marker="; пример: ",index=value.indexOf(marker);return index<0?{guidance:"",example:value}:{guidance:value.slice(0,index),example:value.slice(index+marker.length)}}
function sourceBlockText(sourceHtml){const template=document.createElement("template");template.innerHTML=sourceHtml;return template.content.textContent.trim()}
function mountSourceBlock(container,sourceHtml,pageStyle){
  const root=container.attachShadow({mode:"open"});root.innerHTML=`<style>${pageStyle}</style>${sourceHtml}`;
  for(const previous of root.querySelectorAll("script")){const script=document.createElement("script");for(const attribute of previous.attributes)script.setAttribute(attribute.name,attribute.value);script.textContent=previous.textContent;previous.replaceWith(script)}
}
async function copyText(value){
  if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(value);return}
  const area=element("textarea");area.value=value;area.setAttribute("readonly","");area.style.position="fixed";area.style.opacity="0";document.body.append(area);area.select();const copied=document.execCommand("copy");area.remove();if(!copied)throw new Error("copy rejected");
}
async function copySourceHtml(sourceHtml){
  const plain=sourceBlockText(sourceHtml);
  if(navigator.clipboard?.write&&window.isSecureContext&&typeof ClipboardItem!=="undefined"){
    await navigator.clipboard.write([new ClipboardItem({"text/html":new Blob([sourceHtml],{type:"text/html"}),"text/plain":new Blob([plain],{type:"text/plain"})})]);return;
  }
  const area=element("div");area.innerHTML=sourceHtml;area.contentEditable="true";area.style.position="fixed";area.style.left="-10000px";area.style.top="0";document.body.append(area);
  const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(area);selection.removeAllRanges();selection.addRange(range);const copied=document.execCommand("copy");selection.removeAllRanges();area.remove();if(!copied)await copyText(plain);
}
function flashCopied(button,label){const original=label||button.textContent;button.textContent="Скопировано";button.classList.add("is-copied");window.setTimeout(()=>{button.textContent=original;button.classList.remove("is-copied")},1600)}
function reportForLabel(label){return REPORT.products.find(item=>item.label===label)}
const coverageLabel = status => ({full:"Полностью",partial:"Частично",none:"Нет покрытия",not_applicable:"Нет событий"})[status]||status;
const normalizeText = value => String(value||"").toLocaleLowerCase("ru-RU").replaceAll("ё","е").trim().replace(/\s+/g," ");
function ddiContextForValue(value){
  const normalized=normalizeText(value);
  if(!normalized)return null;
  for(const product of REPORT.ddi_products){
    if(product.id===value||normalizeText(product.name)===normalized)return {product,reportLabel:null};
    const reportLabel=product.report_labels.find(label=>normalizeText(label)===normalized);
    if(reportLabel)return {product,reportLabel};
  }
  return null;
}
function syncDdiAdapter(product,report,reportLabel=null){
  byId("exp-product").value=reportLabel?`report:${reportLabel}`:product.id;
  const period=byId("exp-period");period.replaceChildren();
  if(report){const option=element("option","",report.periods.common_month);option.value=report.periods.common_month;period.append(option)}
  try{const url=new URL(window.location.href);url.searchParams.set("product",reportLabel||product.id);history.replaceState(null,"",url)}catch(error){}
}
let activeCopyBlocks=[];
function renderReport(product){
  byId("report-content").hidden=false;byId("empty-state").hidden=true;
  byId("report-title").textContent=product.mapping.dd_product;
  document.title=`DDI · ${product.mapping.dd_product} · ${REPORT_VARIANT==="copy_paste"?"Copy-paste коммуникаций":"Оформление в СБОЛ"}`;
  byId("hero-meta").textContent=`${product.label} · общий срез ${product.periods.common_month}`;
  byId("periods").replaceChildren(
    element("span","",`Черновики · ${product.periods.drafts}`),
    element("span","",`Кликстрим · ${product.periods.clickstream}`)
  );
  metric(product,"potential_sht"," шт.");metric(product,"coverage_sht"," шт.");metric(product,"coverage_pct","%");
  const coverageValue=product.metrics.coverage_pct.value;
  byId("coverage-track-value").style.width=`${REPORT.meta.zeroed_mode||coverageValue==null?0:Math.max(0,Math.min(100,coverageValue))}%`;
  byId("funnel-name").textContent=`${product.mapping.clickstream_funnel} · funnel_id ${product.mapping.clickstream_funnel_id}`;
  const tbody=byId("steps");tbody.replaceChildren();
  for(const step of product.steps){
    const eventGroups=step.event_coverage||[];
    const tr=document.createElement("tr");tr.dataset.coverage=step.status;
    const rowHeader=element("th","step-name",step.name);rowHeader.scope="row";
    tr.append(element("td","num",step.number),rowHeader);
    const nrtText=step.status==="not_applicable"?coverageLabel(step.status):`${coverageLabel(step.status)} · ${step.covered}/${step.total}`;
    const nrt=document.createElement("td");nrt.append(element("span",`badge ${step.status}`,nrtText));tr.append(nrt);
    const numericValues=REPORT.meta.zeroed_mode?["—","—","—","—"]:[fmt(step.count),step.delta==null?"—":`${step.delta>0?"+":""}${fmt(step.delta)}`,step.conversion_previous==null?"—":`${fmt(step.conversion_previous)}%`,step.conversion_start==null?"—":`${fmt(step.conversion_start)}%`];
    for(const value of numericValues)tr.append(element("td","value",value));
    const eventTd=document.createElement("td");
    if(eventGroups.length){
      const details=element("details","event-disclosure"),summary=element("summary","",`${eventGroups.length} ${countWord(eventGroups.length,"событие","события","событий")}`),list=element("div","event-list");
      details.append(summary,list);eventTd.append(details);
      let populated=false;
      details.addEventListener("toggle",()=>{
        if(!details.open||populated)return;
        for(const group of eventGroups){
          const row=element("div",`event-row${group.covered?" is-covered":""}`),tokens=element("div","event",group.tokens.join(" / ")),state=element("span","event-state",group.covered?"Покрыто":"Нет NRT");
          row.append(tokens,state);list.append(row);
        }
        populated=true;
      });
    }else eventTd.append(element("span","section-sub","Нет событий"));
    tr.append(eventTd);
    tbody.append(tr);
  }
  const s=product.summary;
  byId("journey-status").textContent=`NRT ${s.event_covered} из ${s.event_total} событий`;
  const cards=[[`${s.event_covered}/${s.event_total}`,`NRT-событий покрыто · ${s.total} ${countWord(s.total,"этап","этапа","этапов")}`,"is-overall"],[s.full,`полностью · ${s.full_event_covered}/${s.full_event_total}`,"is-full"],[s.partial,`частично · ${s.partial_event_covered}/${s.partial_event_total}`,"is-partial"],[s.none,`без покрытия · 0/${s.none_event_total}`,"is-none"]];
  byId("micro").replaceChildren(...cards.map(([value,label,state])=>{const card=element("article",`summary-card ${state}`);card.append(element("b","",value),element("span","",label));return card}));
  const recs=byId("recommendations");recs.replaceChildren();
  const recommendationSet=product.recommendations,recommendationItems=recommendationSet.items;
  byId("recommendation-source-label").textContent=recommendationSet.scope_label;
  byId("recommendation-source-note").textContent=recommendationSet.note;
  const copyMode=REPORT_VARIANT==="copy_paste",readyToSend=copyMode&&recommendationSet.scope==="exact_osago_path";
  const sourceHtml=readyToSend?recommendationSet.source_html:"";
  byId("recommendation-count").textContent=copyMode?`${sourceHtml?1:0} исходный блок`:`${recommendationItems.length} ${countWord(recommendationItems.length,"сценарий","сценария","сценариев")}`;
  byId("copy-all").hidden=true;
  byId("recommendations-eyebrow").textContent=copyMode?"Прямой перенос из HTML":"Следующие действия";
  byId("recommendations-title").textContent=copyMode?(readyToSend?"Клиент оборвал на этапе — что, когда и куда отправлять":"В исходном HTML нет блока для этого продукта"):"Рекомендации по настройке";
  activeCopyBlocks=sourceHtml?[sourceHtml]:[];
  if(copyMode){
    if(!readyToSend){
      recs.append(element("article","copy-empty","Copy-paste версия показывает только HTML-блоки, которые действительно присутствуют во входных отчётах. Для выбранного продукта такого исходного блока нет — синтетический шаблон не создаётся."));
    }else{
      const actionLabel="Копировать исходный блок",card=element("article","copy-card"),head=element("div","copy-card-head"),title=element("div","copy-card-title"),button=element("button","copy-button",actionLabel),block=element("div","source-copy-fragment"),source=element("div","copy-source","Источник: локальный HTML LossHunter · section-filter_table перенесён без изменений");
      title.append(element("b","","Исходный блок рекомендаций"),element("span","","Таблица, фильтры и формулировки из входного HTML"));mountSourceBlock(block,sourceHtml,recommendationSet.source_page_style);button.type="button";button.setAttribute("aria-label","Копировать исходный блок рекомендаций");button.addEventListener("click",async()=>{try{await copySourceHtml(sourceHtml);flashCopied(button,actionLabel)}catch(error){button.textContent="Не скопировано";window.setTimeout(()=>button.textContent=actionLabel,1600)}});head.append(title,button);card.append(head,block,source);recs.append(card);
    }
  }else recommendationItems.forEach((rec,index)=>{
      const card=element("details","rec"),summary=document.createElement("summary"),number=element("div","rec-index",String(index+1).padStart(2,"0")),heading=element("div","rec-heading"),priority=element("span",`rec-priority ${rec.source_scope}`,rec.scope_label),body=element("div","rec-body"),route=element("div","rec-route");
      heading.append(element("b","",rec.stage),element("small","",rec.display_context));summary.append(number,heading,priority);card.append(summary);card.open=index===0;
      for(const [title,textValue] of [["Когда",rec.outreach.when],["Основной канал",rec.outreach.primary_channel],["Если не сработало",rec.outreach.fallback_channel]]){const item=element("div","rec-route-item");item.append(element("div","rec-title",title),element("p","",textValue));route.append(item)}
      const copy=element("div","rec-copy"),copyParts=sourceCopyParts(rec.outreach.what_to_say);copy.append(element("div","rec-title","Что сказать"));if(copyParts.guidance)copy.append(element("p","rec-guidance",copyParts.guidance));copy.append(element("blockquote","",copyParts.example));
      const upsell=element("div","rec-upsell");upsell.append(element("div","rec-title","Up-sell"),element("p","",rec.outreach.upsell));
      const disclosures=element("div","rec-disclosures"),why=element("details","rec-detail"),whySummary=element("summary","","Почему такой сценарий"),reasonList=element("ul","rec-reasons");
      for(const reason of rec.outreach.rationale.split(" | "))reasonList.append(element("li","",reason));why.append(whySummary,reasonList);
      const tech=element("details","rec-detail"),techSummary=element("summary","","Условия запуска и проверка"),techGrid=element("div","rec-tech-grid");
      for(const [title,textValue,wide] of [["Триггер",rec.trigger,false],["Событие / NRT",rec.event_registry,false],["Связь со сквозным отчётом",rec.nrt_link,true],["Как проверить",rec.success_metric,true],["Шаблон ТЗ",rec.brief_template,true]]){const field=element("div",`rec-tech-field${wide?" is-wide":""}`);field.append(element("div","rec-title",title),element("p","",textValue));techGrid.append(field)}
      tech.append(techSummary,techGrid);disclosures.append(why,tech);body.append(route,copy,upsell,disclosures);card.append(body);recs.append(card);
    });
  const m=product.mapping;byId("mapping").textContent=`DDI «${m.dd_product}»: черновики «${m.draft_product}» → кликстрим #${m.clickstream_funnel_id} «${m.clickstream_funnel}».`;
}
function renderVariants(ddiProduct,activeLabel){
  const tabs=byId("variant-tabs");tabs.replaceChildren();
  if(ddiProduct.report_labels.length<2)return;
  tabs.append(element("span","eyebrow","Вариант"));
  for(const label of ddiProduct.report_labels){
    const button=element("button",`variant-button${label===activeLabel?" is-active":""}`,label);
    button.type="button";button.setAttribute("aria-pressed",String(label===activeLabel));button.addEventListener("click",()=>selectDdiProduct(ddiProduct,label));
    tabs.append(button);
  }
}
function renderUnavailable(product){
  byId("report-content").hidden=true;byId("empty-state").hidden=false;byId("variant-tabs").replaceChildren();byId("periods").replaceChildren();
  byId("report-title").textContent=product.name;
  document.title=`DDI · ${product.name} · Нет полного среза`;
  byId("hero-meta").textContent=[product.type,product.unit,product.tribe].filter(Boolean).join(" · ");
  byId("empty-title").textContent=`Для «${product.name}» сквозной отчёт пока недоступен`;
  byId("empty-reason").textContent=product.unavailable_reason;
  byId("empty-meta").textContent=[product.type,product.unit,product.tribe].filter(Boolean).join(" · ");
}
let activeDdiProduct=null;
function selectDdiProduct(product,preferredLabel=null){
  const restoreFocus=byId("product-menu").contains(document.activeElement);
  activeDdiProduct=product;byId("product-trigger-label").textContent=product.name;byId("product-search").value="";closeProductMenu();renderProductOptions();
  if(product.available){
    const label=product.report_labels.includes(preferredLabel)?preferredLabel:product.report_labels[0],report=reportForLabel(label);renderReport(report);renderVariants(product,label);syncDdiAdapter(product,report,preferredLabel?label:null);
  }else{renderUnavailable(product);syncDdiAdapter(product,null)}
  if(restoreFocus)byId("product-trigger").focus();
}
function openProductMenu(){byId("product-menu").hidden=false;byId("product-trigger").setAttribute("aria-expanded","true");byId("product-search").setAttribute("aria-expanded","true");byId("product-search").focus()}
function closeProductMenu(){byId("product-menu").hidden=true;byId("product-trigger").setAttribute("aria-expanded","false");byId("product-search").setAttribute("aria-expanded","false")}
function renderProductOptions(query=""){
  const normalized=normalizeText(query);
  const items=REPORT.ddi_products.filter(item=>[item.name,item.unit,item.tribe,...item.report_labels].some(value=>normalizeText(value).includes(normalized)));
  const available=items.filter(item=>item.available).length;
  byId("product-menu-meta").textContent=`Показано ${items.length} из ${REPORT.ddi_products.length} · с отчётом ${available}`;
  const options=byId("product-options");options.replaceChildren();
  for(const item of items){
    const button=element("button","product-option");button.type="button";button.dataset.productId=item.id;button.setAttribute("role","option");button.setAttribute("aria-selected",String(activeDdiProduct?.id===item.id));button.setAttribute("aria-current",activeDdiProduct?.id===item.id?"true":"false");
    const copy=document.createElement("span");copy.append(element("b","",item.name),element("small","",[item.unit,item.tribe].filter(Boolean).join(" · ")));
    button.append(copy,element("span",`option-state${item.available?"":" unavailable"}`,item.available?"Отчёт доступен":"Нет полного среза"));
    button.addEventListener("click",()=>selectDdiProduct(item));options.append(button);
  }
  if(!items.length)options.append(element("div","product-menu-meta","Продукт не найден"));
}
byId("product-trigger").addEventListener("click",()=>byId("product-menu").hidden?openProductMenu():closeProductMenu());
byId("product-search").addEventListener("input",event=>renderProductOptions(event.target.value));
byId("product-picker").addEventListener("keydown",event=>{
  if(event.key==="Escape"){closeProductMenu();byId("product-trigger").focus();return}
  if(!["ArrowDown","ArrowUp","Home","End"].includes(event.key))return;
  event.preventDefault();
  if(byId("product-menu").hidden)openProductMenu();
  const options=[...byId("product-options").querySelectorAll(".product-option")];
  if(!options.length)return;
  if(event.key==="Home"){options[0].focus();return}
  if(event.key==="End"){options.at(-1).focus();return}
  const current=options.indexOf(document.activeElement),direction=event.key==="ArrowDown"?1:-1;
  options[current<0?(direction>0?0:options.length-1):(current+direction+options.length)%options.length].focus();
});
byId("product-search").addEventListener("keydown",event=>{
  if(event.key!=="Enter")return;
  const first=byId("product-options").querySelector(".product-option");
  if(first){event.preventDefault();first.click()}
});
document.addEventListener("pointerdown",event=>{if(!byId("product-picker").contains(event.target))closeProductMenu()});
const adapterOptions=REPORT.ddi_products.flatMap(item=>{
  const primary=element("option","",item.name);primary.value=item.id;
  const aliases=item.report_labels.filter(label=>normalizeText(label)!==normalizeText(item.name)).map(label=>{const option=element("option","",label);option.value=`report:${label}`;return option});
  return [primary,...aliases];
});
byId("exp-product").replaceChildren(...adapterOptions);
function selectAdapterValue(){
  const control=byId("exp-product"),selected=control.options[control.selectedIndex];
  const context=ddiContextForValue(selected?.textContent||control.value);
  if(context)selectDdiProduct(context.product,context.reportLabel);
}
byId("exp-product").addEventListener("change",selectAdapterValue);
byId("exp-show").addEventListener("click",selectAdapterValue);
byId("coverage-rule").textContent=REPORT.meta.coverage_rule;
byId("zeroed-note").hidden=!REPORT.meta.zeroed_mode;
byId("exclusions").textContent=REPORT.meta.excluded_products.length?`Исключено из общего среза: ${REPORT.meta.excluded_products.map(item=>`${item.dd_product} — ${item.reason}`).join("; ")}`:"";
byId("footer").textContent=`Источники: ${Object.values(REPORT.meta.source_files).join(" · ")}`;
document.body.classList.toggle("copy-paste-mode",REPORT_VARIANT==="copy_paste");
byId("copy-all").addEventListener("click",async event=>{if(!activeCopyBlocks.length)return;const button=event.currentTarget;try{await copySourceHtml(activeCopyBlocks.join(""));flashCopied(button,"Копировать все исходные блоки")}catch(error){button.textContent="Не скопировано";window.setTimeout(()=>button.textContent="Копировать все исходные блоки",1600)}});
try{if(window.self!==window.top)document.body.classList.add("is-embedded")}catch(error){document.body.classList.add("is-embedded")}
renderProductOptions();
const requestedId=new URL(window.location.href).searchParams.get("product");
const defaultValue=REPORT_VARIANT==="copy_paste"?"ОСАГО":REPORT.default_product;
const defaultContext=ddiContextForValue(requestedId)||ddiContextForValue(defaultValue)||{product:REPORT.ddi_products[0],reportLabel:null};
selectDdiProduct(defaultContext.product,defaultContext.reportLabel);
</script>
</body>
</html>
"""


def render_html(payload: dict[str, Any], variant: str = "analytical") -> str:
    if variant not in {"analytical", "copy_paste"}:
        raise ReportBuildError(f"Неизвестный вариант HTML: {variant!r}")
    render_payload = payload
    if variant == "copy_paste":
        render_payload = deepcopy(payload)
        for product in render_payload.get("products", []):
            # Вторая версия содержит только исходный читательский блок
            # section-filter_table. Технические карточки section-details нужны
            # аналитической версии, но не должны даже попадать в payload copy-paste.
            product.get("recommendations", {})["items"] = []
    serialized = json.dumps(
        render_payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).replace("<", "\\u003c")
    return HTML_TEMPLATE.replace("__REPORT_DATA__", serialized).replace(
        "__REPORT_VARIANT__", variant
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--drafts", help="HTML отчёта по черновикам")
    parser.add_argument("--clickstream", help="HTML отчёта кликстрима")
    parser.add_argument("--product-mapping", help="XLSX-маппинг продуктов")
    parser.add_argument("--ddi-data", help="DDI report-data.json")
    parser.add_argument("--losshunter", help="Локальный HTML рекомендаций LossHunter")
    parser.add_argument("--mapping", default=str(DEFAULT_MAPPING), help="JSON-маппинг")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Итоговый HTML")
    parser.add_argument(
        "--copy-output",
        default=str(DEFAULT_COPY_OUTPUT),
        help="HTML с copy-paste блоками",
    )
    parser.add_argument(
        "--local-output",
        default=str(LOCAL_DDI_OUTPUT),
        help="Локальная аналитическая версия для DDI",
    )
    parser.add_argument(
        "--local-copy-output",
        default=str(LOCAL_DDI_COPY_OUTPUT),
        help="Локальная copy-paste версия для DDI",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    paths = SourcePaths(
        drafts=locate_input(args.drafts, INPUT_NAMES["drafts"]),
        clickstream=locate_input(args.clickstream, INPUT_NAMES["clickstream"]),
    )
    mapping_path = Path(args.mapping).expanduser().resolve()
    if not mapping_path.is_file():
        raise ReportBuildError(f"Файл маппинга не найден: {mapping_path}")
    product_mapping_path = locate_input(
        args.product_mapping, INPUT_NAMES["product_mapping"]
    )
    ddi_data_path = locate_ddi_data(args.ddi_data)
    losshunter_path = locate_losshunter(args.losshunter)
    output = Path(args.output).expanduser().resolve()
    copy_output = Path(args.copy_output).expanduser().resolve()
    local_output = Path(args.local_output).expanduser().resolve()
    local_copy_output = Path(args.local_copy_output).expanduser().resolve()
    payload = build_payload(
        paths,
        mapping_path,
        product_mapping_path,
        ddi_data_path,
        losshunter_path,
    )
    analytical_html = render_html(payload, "analytical")
    copy_html = render_html(payload, "copy_paste")
    output_variants = {
        output: analytical_html,
        copy_output: copy_html,
        local_output: analytical_html,
        local_copy_output: copy_html,
    }
    if len(output_variants) != 4:
        raise ReportBuildError("Пути четырёх выходных HTML должны различаться")
    for destination, content in output_variants.items():
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(content, encoding="utf-8")
        print(f"Готово: {destination}")
    available = sum(item["available"] for item in payload["ddi_products"])
    print(f"Отчётов: {len(payload['products'])}")
    print(
        f"Продуктов DDI: {len(payload['ddi_products'])} "
        f"(доступно: {available})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
