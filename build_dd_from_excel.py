#!/usr/bin/env python3
"""Build standalone DD HTML from the source Excel workbook.

Pipeline:
1. Read Office Open XML spreadsheet.xlsx.
2. Keep only rows with non-empty metric_group.
3. Drop template rows without product/unit/value data.
4. Strip "Привлечение." and "Отток." prefixes from metric_name.
5. Collect product-level link rows from metric_name/max_value.
6. Aggregate duplicate metric rows per product/block/metric.
7. Embed the generated data into a standalone HTML report.
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import uuid
from pathlib import Path
from typing import Any

import pandas as pd


DEFAULT_INPUT = Path("Book 5.xlsx")
DEFAULT_OUTPUT = Path("final_report_from_excel.html")
DEFAULT_PERIOD = "II кв. 2026"

PRODUCT_NAMESPACE = uuid.UUID("4ac579f8-1f47-4f86-ae23-01b8f67ddf60")
DEFAULT_ENTITY_TYPE = "Продукт"
ENTITY_TYPE_COLUMNS = ("type", "Тип", "entity_type", "Тип сущности")

UNIT_GOALS_DASHBOARD_LINKS: dict[str, str] = {
    "CBP": "https://navigator.sigma.sbrf.ru/gdash/1000002550",
    "PC": "https://navigator.sigma.sbrf.ru/gdash/1000003084?period_name=3",
    "ДомКлик": "https://navigator.sigma.sbrf.ru/gdash/1000002323",
    "УБ": "https://navigator.sigma.sbrf.ru/gdash/1000003899",
    "CX": 'https://navigator.sigma.sbrf.ru/gdash/1000003450',
    'DB': 'https://navigator.sigma.sbrf.ru/gdash/1000003127',
    'DP': 'https://navigator.sigma.sbrf.ru/gdash/1000003252',
    'Data': 'https://navigator.sigma.sbrf.ru/gdash/1000003149',
    "default": "https://navigator.sigma.sbrf.ru/gdash/1000002723/1000025096",
}

COMMON_BUTTONS: dict[str, dict[str, str]] = {
    "general_mau_report": {
        "type": "footer",
        "label": 'Отчет "MAU & Активные клиенты"',
        "link": 'https://navigator.sigma.sbrf.ru/gdash/12215/1000034254',
    },
    "attract_pilot_campaigns": {
        "type": "footer",
        "label": 'Отчет "Пилотные кампании"',
        "link": 'https://navigator.sigma.sbrf.ru/gdash/1000003057',
    },
    "attract_comm_to_sale": {
        "type": "footer",
        "label": 'Отчет "Воронки из коммуникации в продажу"',
        "link": 'https://navigator.sigma.sbrf.ru/gdash/1000000687',
    },
    "hyp_library": {
        "type": "metric",
        "label": "Открыть библиотеку решений",
        "link": 'https://confluence.sberbank.ru/pages/viewpage.action?pageId=15315863819',
    },
    "hyp_backlog_excel": {
        "type": "metric",
        "label": "Посмотреть бэклог",
        "link": 'https://sbertrack.sberbank.ru',
    },
    "hyp_drafts": {
        "type": "footer",
        "label": 'Отчет "Черновики"',
        "link": 'https://navigator.sigma.sbrf.ru/gdash/1000003969',
    },
    "cx_score": {
        "type": "metric",
        "label": "Открыть CX Score",
        "link": 'https://navigator.sigma.sbrf.ru/gdash/1000001746',
    },
    "ux_score": {
        "type": "metric",
        "label": "UX Score",
        "link": 'https://uxscore.sigma.sbrf.ru/',
    },
    "loss_hunter_analysis": {
        "type": "metric",
        "label": "Провести анализ",
        "link": 'https://losshunter.ru',
    },
}

AI_SKILL_BUTTONS: dict[str, dict[str, str]] = {
    "general": {"type": "general", "label": "Перейти", "link": "https://google.com/search?q=dd-ai-key-metrics"},
    "goals": {"type": "general", "label": "Перейти", "link": ""},
    "alerts": {"type": "general", "label": "Перейти", "link": "https://google.com/search?q=dd-alerts-instruction"},
    "cx": {"type": "general", "label": "Перейти", "link": "https://google.com/search?q=dd-ai-cx-score"},
    "attract": {"type": "general", "label": "Перейти", "link": "https://google.com/search?q=dd-ai-attraction"},
    "attract_checkout_funnel": {
        "type": "general",
        "label": "Перейти",
        "link": "https://navigator.sigma.sbrf.ru/gdash/1000005903/1000050768",
    },
    "churn": {"type": "general", "label": "TBD", "link": ""},
}

ATTRACT_SKILL_STAGES: list[dict[str, Any]] = [
    {
        "stage": "Ф",
        "name": "Воронка кампейнинга",
        "button": AI_SKILL_BUTTONS["attract_checkout_funnel"],
    },
    {
        "stage": "На базе данных Clickstream",
        "name": "Воронка оформления",
        "button": AI_SKILL_BUTTONS["attract_checkout_funnel"],
    },
]

TOOL_BUTTONS: dict[str, dict[str, str]] = {
    "general": AI_SKILL_BUTTONS["general"],
    "goals": AI_SKILL_BUTTONS["goals"],
    "alerts": AI_SKILL_BUTTONS["alerts"],
    "cx": AI_SKILL_BUTTONS["cx"],
    "attract": AI_SKILL_BUTTONS["attract"],
    "churn": AI_SKILL_BUTTONS["churn"],
}

METRIC_BUTTONS: dict[str, dict[str, str]] = {
    "cx.score": COMMON_BUTTONS["cx_score"],
}

METRIC_EXTRA_BUTTONS: dict[str, list[dict[str, str]]] = {
    "cx.score": [COMMON_BUTTONS["ux_score"]],
}

ZERO_METRIC_BUTTONS: dict[str, dict[str, str]] = {
    "attract.campaign_launches": {
        "type": "metric",
        "label": "Запустить первый пилот Self-Service",
        "link": 'https://mapp.sberbank.ru/raspredelennyicampaigning/page/94034',
    },
}

TBD_METRIC_CODES = {"hyp.ab_tests"}

LOSS_HUNTER_ANALYTICS_BY_PRODUCT: dict[str, int | float] = {}
LOSS_HUNTER_DEFAULT_COUNT = 0

REQUIRED_COLUMNS = {
    "Юнит",
    "Продукт",
    "metric",
    "metric_name",
    "value",
    "max_value",
    "metric_group",
    "metric_footer",
    "recommendation",
    "recommendation_group",
}

BLOCKS = {
    "Самооценка знания продуктовых метрик": ("general", "Самооценка знания продуктовых метрик"),
    "Цели": ("goals", "Цели"),
    "Алерты": ("alerts", "Алерты"),
    "Клиентский опыт": ("cx", "Клиентский опыт"),
    "Воронка привлечения": ("attract", "Воронка привлечения"),
    "Воронка оттока": ("churn", "Воронка оттока"),
    "Гипотезы и инициативы": ("hyp", "Гипотезы и инициативы"),
}

TOOLS_BY_BLOCK: dict[str, dict[str, Any]] = {
    "general": {
        "name": "Навык «Ключевые метрики»",
        "footer": "Общий светофор",
        "button": TOOL_BUTTONS["general"],
    },
    "goals": {
        "name": "Навык «Цели»",
        "footer_dynamic": "green_count",
        "button": TOOL_BUTTONS["goals"],
    },
    "alerts": {
        "name": "Инструкция",
        "footer": "по настройке алертов по отчету",
        "button": TOOL_BUTTONS["alerts"],
        "variant": "blue",
        "kind": "instruction",
        "show_dots": False,
    },
    "cx": {
        "name": "Навык «Анализ Score»",
        "footer": "Жалобы, обращения, CSI",
        "button": TOOL_BUTTONS["cx"],
    },
    "attract": {
        "name": "Группа навыков «Привлечение»",
        "buttons": ATTRACT_SKILL_STAGES,
    },
    "churn": {
        "name": "Навык «Анализ оттока»",
        "footer": "Общий светофор",
        "button": TOOL_BUTTONS["churn"],
        "variant": "gray",
    },
}

ACTIONS_BY_BLOCK: dict[str, list[dict[str, Any]]] = {
    "general": [
        {
            "button": COMMON_BUTTONS["general_mau_report"],
        },
    ],
    "goals": [
        {
            "unit_goals_dashboard": True,
            "label": 'Отчет "Цели в мастер-деше"',
        },
    ],
    "attract": [
        {
            "button": COMMON_BUTTONS["attract_pilot_campaigns"],
        },
        {
            "button": COMMON_BUTTONS["attract_comm_to_sale"],
            "links_key": "attract_funnel",
            "requires_link": True,
        },
    ],
    "churn": [
        {
            "links_key": "churn_funnel",
        },
    ],
    "hyp": [
        {
            "button": COMMON_BUTTONS["hyp_drafts"],
        },
    ],
}

LINK_ROW_TARGETS: dict[str, dict[str, str]] = {
    "Ссылка на коронку привлечения": {
        "key": "attract_funnel",
        "label": 'Отчет "Воронки из коммуникации в продажу"',
    },
    "Ссылка на воронку привлечения": {
        "key": "attract_funnel",
        "label": 'Отчет "Воронки из коммуникации в продажу"',
    },
    "Ссылка на воронку оттока": {
        "key": "churn_funnel",
        "label": "Воронка оттока",
    },
    "Ссылка на бэклог": {
        "key": "backlog",
        "label": "Бэклог",
    },
}

METRIC_CODES = {
    ("Самооценка знания продуктовых метрик", "Объем целевого рынка в России"): "general.market_ru",
    ("Самооценка знания продуктовых метрик", "Объем целевого рынка в Сбере"): "general.market_sber",
    ("Самооценка знания продуктовых метрик", "Клиенты с продуктом"): "general.clients_with_product",
    ("Самооценка знания продуктовых метрик", "MAU продукта"): "general.product_mau",
    ("Самооценка знания продуктовых метрик", "Знание продуктов спутников"): "general.satellite_products_knowledge",
    ("Самооценка знания продуктовых метрик", "Знание об отчетности в Навигаторе"): "general.navigator_reporting_knowledge",
    ("Цели", "Цели выведены на мониторинг"): "goals.monitored",
    ("Цели", "Факторный анализ - драйверы 1-2 ур."): "goals.factor_analysis_l1_l2",
    ("Цели", "Прогноз по целям"): "goals.forecast",
    ("Алерты", "Оповещения по системным сбоям"): "alerts.system_failures",
    ("Алерты", "Оповещения по бизнес-метрикам"): "alerts.business_metrics",
    ("Клиентский опыт", "Полнота продуктовых механик"): "cx.product_mechanics",
    ("Клиентский опыт", "CX Score"): "cx.score",
    ("Воронка привлечения", "Регулярная отчетность"): "attract.regular_reporting",
    ("Воронка привлечения", "Полнота отчета"): "attract.report_completeness",
    ("Воронка привлечения", "Регулярность (авто)"): "attract.auto_regularity",
    ("Воронка привлечения", "Наличие бенчмарков"): "attract.benchmarks",
    ("Воронка привлечения", "Проведение анализа воронки привлечения"): "attract.funnel_analysis",
    ("Воронка привлечения", "Составлен перечень инициатив по привлечению"): "attract.initiatives_list",
    ("Воронка привлечения", "Cross-sell"): "attract.cross_sell",
    ("Воронка привлечения", "Запуски кампаний за квартал"): "attract.campaign_launches",
    ("Воронка оттока", "Регулярная отчетность"): "churn.regular_reporting",
    ("Воронка оттока", "Полнота отчета"): "churn.report_completeness",
    ("Воронка оттока", "Регулярность (авто)"): "churn.auto_regularity",
    ("Воронка оттока", "Наличие бенчмарков"): "churn.benchmarks",
    ("Воронка оттока", "Проведение анализа воронки оттока"): "churn.funnel_analysis",
    ("Воронка оттока", "Знание метрик для мониторинга механик"): "churn.mechanics_metrics_knowledge",
    ("Воронка оттока", "Мероприятия по работе с отклонениями"): "churn.deviation_actions",
    ("Воронка оттока", "Удержание клиентов"): "churn.client_retention",
    ("Воронка оттока", "Возврат клиентов"): "churn.client_return",
    ("Воронка оттока", "Гибкое изменение условий продукта"): "churn.flexible_terms",
    ("Воронка оттока", "Гибкое изменение условий"): "churn.flexible_terms",
    ("Гипотезы и инициативы", "Discovery >=40% бэклога"): "hyp.discovery_40_backlog",
    ("Гипотезы и инициативы", "Черновики в СБОЛ >=70%"): "hyp.drafts_70",
    ("Гипотезы и инициативы", "A/B-тесты"): "hyp.ab_tests",
    ("Гипотезы и инициативы", "Рейтинг DataDriven >=7,5"): "hyp.datadriven_rating_7_5",
    ("Гипотезы и инициативы", "Доп. инициативы сверх БП"): "hyp.extra_initiatives",
}

METRIC_ID_OVERRIDES: dict[int, dict[str, str]] = {
    97: {
        "metric_group": "Воронка оттока",
        "metric_name_clean": "Знание метрик для мониторинга механик",
        "metric_footer_clean": "Понимание метрик эффективности механик",
        "recommendation_clean": "Определить метрики механик оттока",
        "recommendation_group_clean": "medium",
    },
    98: {
        "metric_name_clean": "Гибкое изменение условий",
        "metric_footer_clean": "Персонализация без IT",
    },
}

METRIC_ORDER_OVERRIDES: dict[str, float] = {
    "general.navigator_reporting_knowledge": 999,
}


def text(value: Any) -> str:
    if value is None or pd.isna(value):
        return ""
    return str(value).strip()


def deyo(value: str) -> str:
    return value.replace("ё", "е").replace("Ё", "Е")


def normalize_text(value: Any) -> str:
    cleaned = deyo(text(value))
    cleaned = cleaned.replace("—", "-").replace("–", "-").replace("≥", ">=")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def clean_metric_name(value: Any) -> str:
    cleaned = normalize_text(value)
    cleaned = re.sub(r"^(Привлечение|Отток)\s*[.]\s*", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def number(value: Any) -> float:
    if value is None or pd.isna(value) or value == "":
        return 0.0
    if isinstance(value, str):
        value = value.replace(",", ".").strip()
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return 0.0
    return parsed if parsed > 0 else 0.0


def clean_float(value: float) -> int | float:
    rounded = round(float(value), 10)
    return int(rounded) if rounded.is_integer() else rounded


def unique_texts(values: Any) -> list[str]:
    result = []
    seen = set()
    for value in values:
        clean = normalize_text(value)
        if not clean:
            continue
        key = clean.casefold()
        if key in seen:
            continue
        seen.add(key)
        result.append(clean)
    return result


def unique_links(links: list[str]) -> list[str]:
    seen = set()
    result = []
    for link in links:
        clean = text(link)
        if not clean or clean in {"0", "0.0"} or clean in seen:
            continue
        seen.add(clean)
        result.append(clean)
    return result


def parse_link_values(value: Any) -> list[str]:
    raw = text(value)
    if not raw or raw in {"0", "0.0"}:
        return []

    if raw.startswith("[") and raw.endswith("]"):
        try:
            parsed = ast.literal_eval(raw)
        except (SyntaxError, ValueError):
            parsed = None
        if isinstance(parsed, (list, tuple, set)):
            links: list[str] = []
            for item in parsed:
                links.extend(parse_link_values(item))
            return unique_links(links)

    links = re.findall(r"https?://[^\s'\"\\\],]+", raw)
    if not links and raw.lower().startswith(("http://", "https://")):
        links = [raw]
    return unique_links(links)


def make_link_records(label: str, urls: list[str]) -> list[dict[str, str]]:
    clean_urls = unique_links(urls)
    if not clean_urls:
        return []
    if len(clean_urls) == 1:
        return [{"label": label, "url": clean_urls[0]}]
    return [{"label": f"{label} {index}", "url": url} for index, url in enumerate(clean_urls, start=1)]


def entity_type_from_row(row: Any) -> str:
    for column in ENTITY_TYPE_COLUMNS:
        value = text(row.get(column))
        if value:
            return value
    return DEFAULT_ENTITY_TYPE


def entity_key(entity_type: str, name: str) -> str:
    return f"{entity_type}\0{name}"


def collect_product_links(df: pd.DataFrame) -> dict[str, dict[str, list[dict[str, str]]]]:
    links_by_product: dict[str, dict[str, list[dict[str, str]]]] = {}

    for _, row in df.iterrows():
        product_name = text(row.get("Продукт"))
        if not product_name:
            continue
        product_key = entity_key(entity_type_from_row(row), product_name)

        metric_name = normalize_text(row.get("metric_name"))
        target = LINK_ROW_TARGETS.get(metric_name)
        if not target:
            continue

        urls = parse_link_values(row.get("max_value"))
        if not urls:
            continue

        product_links = links_by_product.setdefault(product_key, {})
        bucket = product_links.setdefault(target["key"], [])
        bucket.extend(make_link_records(target["label"], urls))

    for product_links in links_by_product.values():
        for key, links in list(product_links.items()):
            deduped: list[dict[str, str]] = []
            seen = set()
            for link in links:
                url = link["url"]
                if url in seen:
                    continue
                seen.add(url)
                deduped.append(link)
            product_links[key] = deduped

    return links_by_product


def traffic_light(value: float, max_value: float, applicable: bool) -> str:
    if not applicable or max_value <= 0:
        return "gray"
    if abs(value - max_value) < 1e-9:
        return "green"
    return "yellow" if value > 0 else "red"


def traffic_light_from_score(value: float, max_value: float) -> str:
    if max_value <= 0:
        return "gray"
    ratio = value / max_value
    if ratio >= 0.66:
        return "green"
    if ratio >= 0.33:
        return "yellow"
    return "red"


def excluded_from_index(block_code: str, metric_name: str, code: str) -> bool:
    if code.endswith(".auto_regularity"):
        return True
    normalized_name = normalize_text(metric_name).casefold()
    return block_code in {"attract", "churn"} and "регулярность" in normalized_name


def slugify(value: str) -> str:
    translit = {
        "а": "a",
        "б": "b",
        "в": "v",
        "г": "g",
        "д": "d",
        "е": "e",
        "ж": "zh",
        "з": "z",
        "и": "i",
        "й": "y",
        "к": "k",
        "л": "l",
        "м": "m",
        "н": "n",
        "о": "o",
        "п": "p",
        "р": "r",
        "с": "s",
        "т": "t",
        "у": "u",
        "ф": "f",
        "х": "h",
        "ц": "c",
        "ч": "ch",
        "ш": "sh",
        "щ": "sch",
        "ы": "y",
        "э": "e",
        "ю": "yu",
        "я": "ya",
    }
    result = []
    for char in normalize_text(value).lower():
        if char in translit:
            result.append(translit[char])
        elif char.isalnum():
            result.append(char)
        else:
            result.append("_")
    return re.sub(r"_+", "_", "".join(result)).strip("_") or "metric"


def block_info(metric_group: str) -> tuple[str, str]:
    return BLOCKS.get(metric_group, (slugify(metric_group), metric_group))


def metric_code(metric_group: str, metric_name: str) -> str:
    block_code, _ = block_info(metric_group)
    return METRIC_CODES.get((metric_group, metric_name), f"{block_code}.{slugify(metric_name)}")


def copy_button(button: dict[str, str] | None) -> dict[str, str] | None:
    if not button:
        return None
    return {
        "type": text(button.get("type")) or "general",
        "label": text(button.get("label")),
        "link": text(button.get("link")),
    }


def with_link(button: dict[str, str] | None, links: list[dict[str, str]]) -> dict[str, str] | None:
    copied = copy_button(button)
    if not links:
        return copied
    if not copied:
        copied = {"type": "general", "label": links[0]["label"], "link": ""}
    copied["link"] = text(links[0].get("url"))
    return copied


def unit_goals_link(unit: str) -> str:
    return UNIT_GOALS_DASHBOARD_LINKS.get(unit, UNIT_GOALS_DASHBOARD_LINKS["default"])


def make_tool_button(
    definition: dict[str, Any],
    product_links: dict[str, list[dict[str, str]]],
    unit: str,
    earned: float,
    max_value: float,
) -> dict[str, Any]:
    link_key = text(definition.get("links_key"))
    links = product_links.get(link_key, []) if link_key else []
    button = with_link(definition.get("button"), links)
    if definition.get("unit_link"):
        button = copy_button(definition.get("button")) or {"type": "general", "label": "Перейти", "link": ""}
        button["link"] = unit_goals_link(unit)

    has_link = bool(button and button.get("link"))
    item: dict[str, Any] = {
        "name": text(definition.get("name")) or "Инструмент",
        "traffic_light": text(definition.get("traffic_light")) or (
            traffic_light_from_score(earned, max_value) if has_link else "gray"
        ),
        "button": button if has_link else {"type": "general", "label": "TBD", "link": ""},
    }

    if definition.get("stage"):
        item["stage"] = definition["stage"]
    if links:
        item["links"] = links
    if definition.get("footer"):
        item["footer"] = definition["footer"]
    if definition.get("footer_dynamic"):
        item["footer_dynamic"] = definition["footer_dynamic"]
    if definition.get("variant"):
        item["variant"] = definition["variant"]
    if "show_dots" in definition:
        item["show_dots"] = bool(definition["show_dots"])

    return item


def make_tool(
    definition: dict[str, Any],
    block: dict[str, Any],
    product_links: dict[str, list[dict[str, str]]],
    unit: str,
    earned: float,
    max_value: float,
) -> dict[str, Any]:
    link_key = text(definition.get("links_key"))
    links = product_links.get(link_key, []) if link_key else []
    button = with_link(definition.get("button"), links)
    if definition.get("unit_link"):
        button = copy_button(definition.get("button")) or {"type": "general", "label": "Перейти", "link": ""}
        button["link"] = unit_goals_link(unit)

    has_link = bool(button and button.get("link"))
    tool_buttons = [
        make_tool_button(button_definition, product_links, unit, earned, max_value)
        for button_definition in definition.get("buttons", [])
    ]
    tool: dict[str, Any] = {
        "name": definition["name"],
        "traffic_light": traffic_light_from_score(earned, max_value) if has_link or tool_buttons else "gray",
    }

    if tool_buttons:
        tool["buttons"] = tool_buttons
    else:
        tool["button"] = button if has_link else {"type": "general", "label": "TBD", "link": ""}

    if links:
        tool["links"] = links
    if definition.get("footer"):
        tool["footer"] = definition["footer"]
    if definition.get("footer_dynamic"):
        tool["footer_dynamic"] = definition["footer_dynamic"]
    if definition.get("variant"):
        tool["variant"] = definition["variant"]
    if definition.get("kind"):
        tool["kind"] = definition["kind"]
    if "show_dots" in definition:
        tool["show_dots"] = bool(definition["show_dots"])

    return tool


def with_tools(block: dict[str, Any], product_links: dict[str, list[dict[str, str]]], unit: str) -> None:
    earned = sum(float(metric.get("value") or 0) for metric in block["metrics"] if not metric.get("excluded_from_index"))
    max_value = sum(float(metric.get("max_value") or 0) for metric in block["metrics"] if not metric.get("excluded_from_index"))

    tools = []
    definition = TOOLS_BY_BLOCK.get(block["code"])
    if definition:
        tools.append(make_tool(definition, block, product_links, unit, earned, max_value))

    if tools:
        block["tools"] = tools


def action_from_button(button: dict[str, str] | None) -> dict[str, str] | None:
    copied = copy_button(button)
    if not copied or not copied.get("link"):
        return None
    return {"label": copied["label"], "url": copied["link"]}


def with_actions(block: dict[str, Any], product_links: dict[str, list[dict[str, str]]], unit: str) -> None:
    actions: list[dict[str, str]] = []

    for definition in ACTIONS_BY_BLOCK.get(block["code"], []):
        if definition.get("unit_goals_dashboard"):
            url = unit_goals_link(unit)
            if url:
                actions.append({"label": text(definition.get("label")) or "Открыть", "url": url})
            continue

        link_key = text(definition.get("links_key"))
        links = product_links.get(link_key, []) if link_key else []
        if links:
            actions.extend(links)
            continue
        if definition.get("requires_link"):
            continue

        fallback = definition.get("fallback")
        if fallback and fallback.get("url"):
            actions.append({"label": text(fallback.get("label")) or "Открыть", "url": text(fallback.get("url"))})
            continue

        action = action_from_button(definition.get("button"))
        if action:
            actions.append(action)

    deduped: list[dict[str, str]] = []
    seen = set()
    for action in actions:
        url = text(action.get("url"))
        label = text(action.get("label")) or "Открыть"
        if not url:
            continue
        key = (label, url)
        if key in seen:
            continue
        seen.add(key)
        deduped.append({"label": label, "url": url})

    if deduped:
        block["actions"] = deduped


def metric_button_for_code(code: str, product_links: dict[str, list[dict[str, str]]]) -> dict[str, str] | None:
    if code == "hyp.discovery_40_backlog":
        backlog_links = product_links.get("backlog", [])
        if not backlog_links:
            return None
        button = copy_button(COMMON_BUTTONS["hyp_backlog_excel"])
        if button:
            button["link"] = text(backlog_links[0].get("url"))
        return button

    if code == "hyp.datadriven_rating_7_5":
        return copy_button(COMMON_BUTTONS["hyp_library"])

    return copy_button(METRIC_BUTTONS.get(code))


def with_block_info(block: dict[str, Any], product_name: str) -> None:
    if block["code"] != "cx":
        return

    block["info"] = {
        "type": "losshunter",
        "count": LOSS_HUNTER_ANALYTICS_BY_PRODUCT.get(product_name, LOSS_HUNTER_DEFAULT_COUNT),
        "title": "аналитики в LossHunter",
        "footer": "проведено за квартал по продукту",
        "button": copy_button(COMMON_BUTTONS["loss_hunter_analysis"]),
    }


def split_benchmarks(product_rows: pd.DataFrame) -> pd.DataFrame:
    benchmark_mask = product_rows["metric_group"].eq("BENCHMARKS")
    benchmark_rows = product_rows[benchmark_mask]
    if benchmark_rows.empty:
        product_rows.attrs["benchmark_rows_split"] = 0
        return product_rows

    regular_rows = product_rows[~benchmark_mask]
    split_parts = []
    for target_group in ("Воронка привлечения", "Воронка оттока"):
        part = benchmark_rows.copy()
        part["metric_group"] = target_group
        part["metric_name_clean"] = "Наличие бенчмарков"
        part["value_num"] = part["value_num"] / 2
        part["max_value_num"] = part["max_value_num"] / 2
        part["value"] = part["value_num"]
        part["max_value"] = part["max_value_num"]
        split_parts.append(part)

    result = pd.concat([regular_rows, *split_parts], ignore_index=True)
    result.attrs.update(product_rows.attrs)
    result.attrs["benchmark_rows_split"] = len(benchmark_rows)
    return result


def product_uuid(entity_type: str, product_name: str) -> str:
    if entity_type == DEFAULT_ENTITY_TYPE:
        return str(uuid.uuid5(PRODUCT_NAMESPACE, product_name))
    return str(uuid.uuid5(PRODUCT_NAMESPACE, f"{entity_type}:{product_name}"))


def validate_columns(df: pd.DataFrame) -> None:
    missing = sorted(REQUIRED_COLUMNS - set(df.columns))
    if missing:
        raise ValueError("В Excel не хватает колонок: " + ", ".join(missing))


def load_metric_rows(path: Path, sheet_name: str | None) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name=sheet_name or 0)
    validate_columns(df)

    links_by_product = collect_product_links(df)
    df = df.copy()
    df["metric_group"] = df["metric_group"].map(normalize_text)
    df["metric_name_clean"] = df["metric_name"].map(clean_metric_name)
    df["metric_footer_clean"] = df["metric_footer"].map(normalize_text)
    df["recommendation_clean"] = df["recommendation"].map(normalize_text)
    df["recommendation_group_clean"] = df["recommendation_group"].map(normalize_text)
    df["entity_type"] = df.apply(entity_type_from_row, axis=1)

    with_group = df[df["metric_group"] != ""].copy()
    product_rows = with_group[
        (with_group["Продукт"].map(text) != "")
        & (with_group["Юнит"].map(text) != "")
        & (with_group["metric_name_clean"] != "")
    ].copy()

    product_rows["value_num"] = product_rows["value"].map(number)
    product_rows["max_value_num"] = product_rows["max_value"].map(number)
    product_rows["metric_id_num"] = product_rows["metric"].map(number)

    for metric_id, overrides in METRIC_ID_OVERRIDES.items():
        mask = product_rows["metric_id_num"].eq(metric_id)
        for column, value in overrides.items():
            product_rows.loc[mask, column] = value

    product_rows.attrs["metric_group_rows"] = len(with_group)
    product_rows.attrs["template_rows_skipped"] = len(with_group) - len(product_rows)
    product_rows.attrs["links_by_product"] = links_by_product
    return split_benchmarks(product_rows)


def aggregate_product(
    product_rows: pd.DataFrame,
    period: str,
    product_links: dict[str, list[dict[str, str]]] | None = None,
) -> dict[str, Any]:
    product_name = text(product_rows["Продукт"].iloc[0])
    entity_type = text(product_rows["entity_type"].iloc[0]) or DEFAULT_ENTITY_TYPE
    unit = text(product_rows["Юнит"].iloc[0]) or "Без юнита"
    group_uuid = product_uuid(entity_type, product_name)
    product_links = product_links or {}

    block_buckets: dict[str, dict[str, Any]] = {}

    group_cols = ["metric_group", "metric_name_clean"]
    for (metric_group, metric_name), rows in product_rows.groupby(group_cols, sort=False):
        block_code, block_name = block_info(metric_group)
        code = metric_code(metric_group, metric_name)
        value = float(rows["value_num"].sum())
        max_value = float(rows["max_value_num"].sum())
        applicable = max_value > 0
        recommendations = unique_texts(rows["recommendation_clean"])
        recommendation_groups = unique_texts(rows["recommendation_group_clean"])
        footers = unique_texts(rows["metric_footer_clean"])

        block = block_buckets.setdefault(
            block_code,
            {
                "type": "block",
                "code": block_code,
                "name": block_name,
                "tools": [],
                "metrics": [],
                "_order": float(rows["metric_id_num"].min()),
            },
        )
        block["_order"] = min(block["_order"], float(rows["metric_id_num"].min()))

        metric_payload: dict[str, Any] = {
            "code": code,
            "name": metric_name,
            "footer": " · ".join(footers),
            "value": clean_float(value),
            "max_value": clean_float(max_value),
            "is_applicabble_flg": applicable,
            "traffic_light": traffic_light(value, max_value, applicable),
            "recommendation": " · ".join(recommendations),
            "recommendations": recommendations,
            "recommendation_group": " · ".join(recommendation_groups),
            "recommendation_groups": recommendation_groups,
        }

        metric_button = metric_button_for_code(code, product_links)
        if metric_button:
            metric_payload["button"] = metric_button

        metric_buttons = [copy_button(button) for button in METRIC_EXTRA_BUTTONS.get(code, [])]
        metric_buttons = [button for button in metric_buttons if button]
        if metric_buttons:
            metric_payload["buttons"] = metric_buttons

        if code in ZERO_METRIC_BUTTONS:
            metric_payload["zero_button"] = copy_button(ZERO_METRIC_BUTTONS[code])

        if excluded_from_index(block_code, metric_name, code):
            metric_payload["excluded_from_index"] = True

        if code in TBD_METRIC_CODES:
            metric_payload.update(
                {
                    "value": 0,
                    "max_value": 0,
                    "is_applicabble_flg": False,
                    "traffic_light": "gray",
                    "tbd": True,
                    "excluded_from_index": True,
                }
            )

        metric_payload["_order"] = METRIC_ORDER_OVERRIDES.get(code, float(rows["metric_id_num"].min()))
        block["metrics"].append(metric_payload)

    blocks = sorted(block_buckets.values(), key=lambda item: item["_order"])
    for block in blocks:
        block["metrics"].sort(key=lambda item: item["_order"])
        block.pop("_order", None)
        for metric in block["metrics"]:
            metric.pop("_order", None)
        with_tools(block, product_links, unit)
        with_actions(block, product_links, unit)
        with_block_info(block, product_name)

    return {
        "id": f"{group_uuid}¦{product_name}",
        "type": entity_type,
        "name": product_name,
        "unit": unit,
        "period": period,
        "product_group_uuid": group_uuid,
        "links": product_links,
        "metrics": blocks,
    }


def build_report_data(path: Path, sheet_name: str | None, period: str) -> tuple[dict[str, Any], dict[str, int]]:
    rows = load_metric_rows(path, sheet_name)
    links_by_product = rows.attrs.get("links_by_product", {})
    products = []
    for _, product_rows in rows.groupby(["entity_type", "Продукт"], sort=False):
        product_name = text(product_rows["Продукт"].iloc[0])
        entity_type = text(product_rows["entity_type"].iloc[0]) or DEFAULT_ENTITY_TYPE
        products.append(
            aggregate_product(
                product_rows,
                period,
                links_by_product.get(entity_key(entity_type, product_name), {}),
            )
        )

    metric_count = sum(len(block["metrics"]) for product in products for block in product["metrics"])
    summary = {
        "excel_rows_with_metric_group": rows.attrs["metric_group_rows"],
        "template_rows_skipped": rows.attrs["template_rows_skipped"],
        "benchmark_rows_split": rows.attrs.get("benchmark_rows_split", 0),
        "product_metric_rows": len(rows),
        "products": len(products),
        "units": len({product["unit"] for product in products}),
        "aggregated_metrics": metric_count,
        "products_with_links": sum(1 for product_links in links_by_product.values() if product_links),
    }
    return {"products": products}, summary


def write_standalone(data: dict[str, Any], output_path: Path) -> None:
    from build_dd_json2 import build_embedded_html

    output_path.write_text(
        build_embedded_html(data, "DD-Индекс - отчет из Excel"),
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate standalone DD HTML from Книга4.xlsx")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Path to source .xlsx")
    parser.add_argument("--sheet", default=None, help="Sheet name; first sheet is used by default")
    parser.add_argument("--period", default=DEFAULT_PERIOD, help="Period label to put into product rows")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output standalone HTML path",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data, summary = build_report_data(args.input, args.sheet, args.period)

    write_standalone(data, args.output)

    print(json.dumps({"html": str(args.output), **summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
