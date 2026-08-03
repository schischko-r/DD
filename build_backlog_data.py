#!/usr/bin/env python3
"""Build anonymized monthly backlog aggregates from an XLSX workbook."""

from __future__ import annotations

import argparse
import json
import posixpath
import re
import statistics
import xml.etree.ElementTree as ET
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from zipfile import BadZipFile, ZipFile


ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "sbertrack_all_full_history_to_export.xlsx"
DEFAULT_OUTPUT = ROOT / "gravity-app" / "public" / "backlog-data.json"
DEFAULT_HISTORY_START = date(2026, 2, 1)
DEFAULT_HISTORY_END = date(2026, 6, 30)
REQUIRED_COLUMNS = (
    "Created",
    "Resolved",
    "Status",
    "Issue key",
    "direction",
    "scenario",
    "team",
)
COLUMN_ALIASES = {
    "Created": ("Created", "Дата создания"),
    "Resolved": ("Resolved", "Дата ухода в done/resolved"),
    "Status": ("Status",),
    "Issue key": ("Issue key", "issuekey", "Тикет"),
    "direction": ("direction",),
    "scenario": ("scenario",),
    "team": ("team", "product"),
    "Дата перехода в in_progress": (
        "Дата перехода в in_progress",
        "In Progress",
        "In progress",
    ),
    "SP": ("SP", "Story Points", "Story points"),
}
REQUIRED_SOURCE_COLUMNS = tuple(
    column for column in REQUIRED_COLUMNS if column != "Status"
)

SCENARIO_LABELS = {
    "exports_to_excel": "Выгрузки в Excel",
    "AI": "AI",
    "methodology_dev": "Разработка методологии",
    "metrics_calculation": "Расчет метрик",
    "exports_to_excel_regulator": "Выгрузки для регулятора",
    "excel_automatic_reports": "Автоматизированные отчеты",
    "root_cause_analysis": "Анализ корневых причин",
    "growth_factors_research": "Поиск точек роста",
    "business_planning": "Бизнес-планирование",
    "financial_impact_estimation": "Оценка финансового эффекта",
    "unknown": "Невозможно разметить",
    "employee_trainings": "Обучение сотрудников",
    "social_communications": "Встречи, коммуникации",
    "business_requirements_composing": "Формирование БТ/ТЗ",
    "project_management": "Project Management",
    "data_marts": "Данные и автоматизация",
    "knowledge_base_maintenance": "Формирование базы знаний",
    "presentations": "Презентации",
    "excel_reports": "Отчеты в Excel",
    "dashboard_improvements": "Доработки дешбордов",
    "BI_bugfix": "Фикс багов в BI",
    "dashboard_manual_data_update": "Ручное обновление данных",
    "dashboard_migration": "Миграция дешбордов",
    "customer_experience_analytics": "Аналитика клиентского опыта",
    "manual_data_quality_control": "Ручной ККД",
}
SCENARIO_ALIASES = {
    "metric_calculation": "metrics_calculation",
    "social_communication": "social_communications",
}
SCENARIO_CONTINUOUS_25TH_HOURS = {
    "AI": 2.11,
    "BI_bugfix": 0.82,
    "business_planning": 4.40,
    "business_requirements_composing": 2.10,
    "customer_experience_analytics": 4.28,
    "dashboard_improvements": 1.86,
    "dashboard_manual_data_update": 1.90,
    "dashboard_migration": 5.36,
    "data_marts": 0.62,
    "employee_trainings": 0.02,
    "excel_automatic_reports": 0.45,
    "excel_reports": 1.49,
    "exports_to_excel": 1.68,
    "exports_to_excel_regulator": 0.00,
    "financial_impact_estimation": 0.79,
    "growth_factors_research": 5.90,
    "knowledge_base_maintenance": 2.11,
    "manual_data_quality_control": 0.20,
    "methodology_dev": 0.00,
    "metrics_calculation": 1.25,
    "presentations": 3.88,
    "project_management": 4.54,
    "root_cause_analysis": 3.01,
    "social_communications": 0.29,
    "unknown": 0.03,
}
RU_MONTHS = (
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
)
RU_QUARTERS = ("I", "II", "III", "IV")
DISCOVERY_DIRECTION_LABEL = "Аналитика"
UNKNOWN_DIRECTION_LABEL = "Неизвестно"
DISCOVERY_TARGET = 40
PRIMARY_TEAM_LABEL = "СберЧаевые"
AUTOMATION_SCENARIO = "excel_automatic_reports"
CANCELLED_STATUSES = {"cancelled", "canceled", "отменен", "отменён", "отменено"}
TERMINAL_STATUSES = {"done", "resolved", "выполнен", "выполнено", "решен", "решён"}
EXPORT_ROUTINE_SCENARIOS = {
    "exports_to_excel",
    "excel_reports",
    AUTOMATION_SCENARIO,
}

MAIN_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PACKAGE_REL_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}"


@dataclass
class Ticket:
    team_key: str
    team_label: str
    issue_key: str
    created: datetime
    resolved: datetime | None
    in_progress: datetime | None
    story_points: str
    cancelled: bool
    completed_by_status: bool
    terminal_without_resolved: bool
    direction_key: str
    direction_label: str
    scenario_key: str
    scenario_label: str


@dataclass
class TeamTickets:
    key: str
    label: str
    tickets: list[Ticket]
    as_of: datetime
    total_tickets: int
    excluded_cancelled: int
    excluded_missing_issue_key: int
    excluded_before_history_start: int
    excluded_after_history_end: int
    terminal_without_resolved: int


def _cell_column(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference)
    if letters is None:
        raise ValueError(f"Некорректный адрес ячейки: {reference!r}")
    result = 0
    for char in letters.group(0):
        result = result * 26 + ord(char) - ord("A") + 1
    return result - 1


def _shared_strings(archive: ZipFile) -> list[str]:
    try:
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    return ["".join(node.text or "" for node in item.iter(MAIN_NS + "t")) for item in root]


def _sheet_paths(archive: ZipFile) -> list[tuple[str, str]]:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {
        relationship.attrib["Id"]: relationship.attrib["Target"]
        for relationship in relationships.findall(PACKAGE_REL_NS + "Relationship")
    }
    result = []
    for sheet in workbook.find(MAIN_NS + "sheets") or []:
        relation_id = sheet.attrib[REL_NS + "id"]
        target = targets[relation_id].lstrip("/")
        if not target.startswith("xl/"):
            target = posixpath.normpath(posixpath.join("xl", target))
        result.append((sheet.attrib.get("name", target), target))
    return result


def _cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.iter(MAIN_NS + "t"))
    value = cell.find(MAIN_NS + "v")
    if value is None or value.text is None:
        return ""
    if cell_type == "s":
        try:
            return shared_strings[int(value.text)]
        except (IndexError, ValueError) as error:
            raise ValueError("Книга содержит некорректную ссылку shared string") from error
    return value.text


def _sheet_rows(archive: ZipFile, path: str, shared_strings: list[str]) -> list[list[str]]:
    root = ET.fromstring(archive.read(path))
    rows: list[list[str]] = []
    for row in root.iter(MAIN_NS + "row"):
        values: dict[int, str] = {}
        for cell in row.findall(MAIN_NS + "c"):
            values[_cell_column(cell.attrib["r"])] = _cell_value(cell, shared_strings)
        if values:
            width = max(values) + 1
            rows.append([values.get(index, "") for index in range(width)])
    return rows


def read_workbook_rows(path: Path) -> tuple[list[dict[str, str]], bool]:
    """Read and canonicalize the first worksheet containing backlog columns."""

    if path.name.startswith("~$"):
        raise ValueError("Временный Excel-файл Office нельзя использовать как источник")
    try:
        with ZipFile(path) as archive:
            workbook = ET.fromstring(archive.read("xl/workbook.xml"))
            workbook_pr = workbook.find(MAIN_NS + "workbookPr")
            date_1904 = workbook_pr is not None and workbook_pr.attrib.get("date1904") in {"1", "true"}
            shared_strings = _shared_strings(archive)
            candidates: list[tuple[str, list[str]]] = []
            for sheet_name, sheet_path in _sheet_paths(archive):
                rows = _sheet_rows(archive, sheet_path, shared_strings)
                for header_index, raw_header in enumerate(rows):
                    header = [value.strip() for value in raw_header]
                    column_indexes = {
                        column: [
                            index
                            for alias in aliases
                            for index, value in enumerate(header)
                            if value == alias
                        ]
                        for column, aliases in COLUMN_ALIASES.items()
                    }
                    missing = [
                        column
                        for column in REQUIRED_SOURCE_COLUMNS
                        if not column_indexes[column]
                    ]
                    if missing:
                        candidates.append((sheet_name, missing))
                        continue
                    records: list[dict[str, str]] = []
                    for raw_row in rows[header_index + 1 :]:
                        record = {
                            column: next(
                                (
                                    raw_row[index].strip()
                                    for index in indexes
                                    if index < len(raw_row) and raw_row[index].strip()
                                ),
                                "",
                            )
                            for column, indexes in column_indexes.items()
                        }
                        if not record["Status"]:
                            record["Status"] = (
                                "Done" if record["Resolved"] else "In Progress"
                            )
                        if any(record.get(column, "") for column in REQUIRED_COLUMNS):
                            records.append(record)
                    return records, date_1904
    except (BadZipFile, KeyError, ET.ParseError) as error:
        raise ValueError(f"Не удалось прочитать XLSX: {path}") from error

    details = "; ".join(
        f"{sheet}: {', '.join(missing)}" for sheet, missing in candidates[-3:]
    )
    raise ValueError("В XLSX нет листа с обязательными колонками: " + details)


def parse_datetime(value: str, date_1904: bool = False) -> datetime:
    value = value.strip()
    if not value:
        raise ValueError("пустая дата")
    if re.fullmatch(r"-?\d+(?:\.\d+)?", value):
        epoch = datetime(1904, 1, 1) if date_1904 else datetime(1899, 12, 30)
        return epoch + timedelta(days=float(value))

    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
        return parsed.replace(tzinfo=None)
    except ValueError:
        pass

    for date_format in (
        "%d/%b/%y %H:%M",
        "%d/%b/%Y %H:%M",
        "%d/%b/%y %H:%M:%S",
        "%d/%b/%Y %H:%M:%S",
        "%d.%m.%Y %H:%M",
        "%d.%m.%Y",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
    ):
        try:
            return datetime.strptime(value, date_format)
        except ValueError:
            continue
    raise ValueError(f"неподдерживаемый формат даты {value!r}")


def _normalize_scenario(value: str) -> tuple[str, str]:
    key = SCENARIO_ALIASES.get(value.strip(), value.strip())
    if key not in SCENARIO_LABELS:
        key = "unknown"
    return key, SCENARIO_LABELS[key]


def _normalize_direction(value: str) -> tuple[str, str]:
    label = value.strip() or "Неизвестно"
    return label, label


_CYRILLIC_TRANSLITERATION = str.maketrans(
    {
        "а": "a",
        "б": "b",
        "в": "v",
        "г": "g",
        "д": "d",
        "е": "e",
        "ё": "e",
        "ж": "zh",
        "з": "z",
        "и": "i",
        "й": "i",
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
        "ц": "ts",
        "ч": "ch",
        "ш": "sh",
        "щ": "sch",
        "ъ": "",
        "ы": "y",
        "ь": "",
        "э": "e",
        "ю": "yu",
        "я": "ya",
    }
)
_TEAM_KEY_OVERRIDES = {PRIMARY_TEAM_LABEL.casefold(): "sberchai"}


def _normalize_team(value: str) -> tuple[str, str]:
    label = " ".join(value.split())
    if not label:
        raise ValueError("пустая команда")
    identity = label.casefold()
    transliterated = identity.translate(_CYRILLIC_TRANSLITERATION)
    key = _TEAM_KEY_OVERRIDES.get(identity) or re.sub(
        r"[^a-z0-9]+", "-", transliterated
    ).strip("-")
    if not key:
        key = "team-" + "-".join(f"{ord(char):x}" for char in identity)
    return key, label


def read_tickets(
    path: Path,
    history_start: date | None = DEFAULT_HISTORY_START,
    history_end: date | None = DEFAULT_HISTORY_END,
) -> list[TeamTickets]:
    if (
        history_start is not None
        and history_end is not None
        and history_end < history_start
    ):
        raise ValueError("Конец истории не может быть раньше начала истории")

    rows, date_1904 = read_workbook_rows(path)
    if not rows:
        raise ValueError("В XLSX нет строк с тикетами")

    parsed_rows: list[Ticket] = []
    observed_dates: defaultdict[str, list[datetime]] = defaultdict(list)
    team_labels: dict[str, str] = {}
    team_identities: dict[str, str] = {}
    excluded_missing_issue_key: defaultdict[str, int] = defaultdict(int)
    for row_number, row in enumerate(rows, start=2):
        try:
            team_key, team_label = _normalize_team(row["team"])
        except ValueError as error:
            raise ValueError(f"Строка {row_number}: {error}") from error
        identity = team_label.casefold()
        existing_identity = team_identities.setdefault(team_key, identity)
        if existing_identity != identity:
            raise ValueError(
                f"Команды {team_labels[team_key]!r} и {team_label!r} "
                f"получили одинаковый key {team_key!r}"
            )
        team_labels.setdefault(team_key, team_label)

        issue_key = row["Issue key"].strip()
        if not issue_key:
            excluded_missing_issue_key[team_key] += 1
            continue
        try:
            created = parse_datetime(row["Created"], date_1904)
            resolved = parse_datetime(row["Resolved"], date_1904) if row["Resolved"] else None
            in_progress = (
                parse_datetime(row["Дата перехода в in_progress"], date_1904)
                if row["Дата перехода в in_progress"]
                else None
            )
        except ValueError as error:
            reference = issue_key or f"команда {team_label}"
            raise ValueError(f"Строка {row_number}, {reference}: {error}") from error
        if resolved is not None and resolved < created:
            reference = issue_key or f"команда {team_label}"
            raise ValueError(f"Строка {row_number}, {reference}: Resolved раньше Created")
        observed_dates[team_key].append(created)
        if resolved is not None:
            observed_dates[team_key].append(resolved)
        normalized_status = row["Status"].strip().casefold()
        direction_key, direction_label = _normalize_direction(row["direction"])
        scenario_key, scenario_label = _normalize_scenario(row["scenario"])
        parsed_rows.append(
            Ticket(
                team_key=team_key,
                team_label=team_label,
                issue_key=issue_key,
                created=created,
                resolved=resolved,
                in_progress=in_progress,
                story_points=row["SP"].strip(),
                cancelled=normalized_status in CANCELLED_STATUSES,
                completed_by_status=normalized_status in TERMINAL_STATUSES,
                terminal_without_resolved=(
                    resolved is None and normalized_status in TERMINAL_STATUSES
                ),
                direction_key=direction_key,
                direction_label=direction_label,
                scenario_key=scenario_key,
                scenario_label=scenario_label,
            )
        )

    grouped: dict[tuple[str, str], list[Ticket]] = defaultdict(list)
    for ticket in parsed_rows:
        grouped[(ticket.team_key, ticket.issue_key)].append(ticket)

    tickets_by_team: defaultdict[str, list[Ticket]] = defaultdict(list)
    for (team_key, issue_key), copies in grouped.items():
        first = copies[0]
        resolved_values = [ticket.resolved for ticket in copies if ticket.resolved is not None]
        in_progress_values = [
            ticket.in_progress for ticket in copies if ticket.in_progress is not None
        ]
        resolved_values_through_end = [
            value
            for value in resolved_values
            if history_end is None or value.date() <= history_end
        ]
        in_progress_values_through_end = [
            value
            for value in in_progress_values
            if history_end is None or value.date() <= history_end
        ]
        resolved = max(resolved_values_through_end, default=None)
        in_progress = min(in_progress_values_through_end, default=None)
        story_points = next(
            (
                ticket.story_points
                for ticket in reversed(copies)
                if ticket.story_points
            ),
            "",
        )
        tickets_by_team[team_key].append(
            Ticket(
                team_key=first.team_key,
                team_label=first.team_label,
                issue_key=issue_key,
                created=min(ticket.created for ticket in copies),
                resolved=resolved,
                in_progress=in_progress,
                story_points=story_points,
                cancelled=all(ticket.cancelled for ticket in copies),
                completed_by_status=(
                    resolved is not None
                    and any(ticket.completed_by_status for ticket in copies)
                ),
                terminal_without_resolved=(
                    not resolved_values
                    and any(ticket.terminal_without_resolved for ticket in copies)
                ),
                direction_key=first.direction_key,
                direction_label=first.direction_label,
                scenario_key=first.scenario_key,
                scenario_label=first.scenario_label,
            )
        )

    result: list[TeamTickets] = []
    for team_key, team_label in team_labels.items():
        tickets = tickets_by_team[team_key]
        excluded_cancelled = sum(ticket.cancelled for ticket in tickets)
        excluded_before_history_start = sum(
            not ticket.cancelled
            and history_start is not None
            and ticket.created.date() < history_start
            for ticket in tickets
        )
        excluded_after_history_end = sum(
            not ticket.cancelled
            and history_end is not None
            and ticket.created.date() > history_end
            for ticket in tickets
        )
        included = [
            ticket
            for ticket in tickets
            if not ticket.cancelled
            and (history_start is None or ticket.created.date() >= history_start)
            and (history_end is None or ticket.created.date() <= history_end)
        ]
        if not included:
            continue
        missing_count = excluded_missing_issue_key[team_key]
        result.append(
            TeamTickets(
                key=team_key,
                label=team_label,
                tickets=included,
                as_of=min(
                    max(observed_dates[team_key]),
                    datetime.combine(history_end, datetime.max.time()),
                )
                if history_end is not None
                else max(observed_dates[team_key]),
                total_tickets=len(tickets) + missing_count,
                excluded_cancelled=excluded_cancelled,
                excluded_missing_issue_key=missing_count,
                excluded_before_history_start=excluded_before_history_start,
                excluded_after_history_end=excluded_after_history_end,
                terminal_without_resolved=sum(
                    ticket.terminal_without_resolved for ticket in included
                ),
            )
        )

    if not result:
        raise ValueError(
            "После исключения некорректных строк, Status=Cancelled и тикетов "
            "вне границ истории не осталось данных"
        )

    return sorted(
        result,
        key=lambda team: (
            team.label.casefold() != PRIMARY_TEAM_LABEL.casefold(),
            team.label.casefold(),
            team.key,
        ),
    )


def _month_start(value: date) -> date:
    return value.replace(day=1)


def _next_month(value: date) -> date:
    return date(value.year + (value.month == 12), 1 if value.month == 12 else value.month + 1, 1)


def _quarter_start(value: date) -> date:
    return date(value.year, ((value.month - 1) // 3) * 3 + 1, 1)


def _next_quarter(value: date) -> date:
    return date(value.year + (value.month == 10), 1 if value.month == 10 else value.month + 3, 1)


def _percentage(numerator: float, denominator: float) -> float:
    return round(numerator / denominator * 100, 2) if denominator else 0.0


def _cycle_times_days(tickets: list[Ticket]) -> list[float]:
    return [
        (ticket.resolved - ticket.in_progress).total_seconds() / 86_400
        for ticket in tickets
        if ticket.resolved is not None
        and ticket.in_progress is not None
        and ticket.resolved >= ticket.in_progress
    ]


def _median_days(values: list[float]) -> float | None:
    return round(float(statistics.median(values)), 1) if values else None


def _median_hours(values: list[float]) -> float | None:
    return round(float(statistics.median(values)) * 24, 1) if values else None


def _category_order(totals: dict[str, dict[str, object]]) -> list[str]:
    return sorted(
        totals,
        key=lambda key: (
            -int(totals[key]["totalCount"]),
            str(totals[key]["label"]).casefold(),
            key,
        ),
    )


def _build_team_aggregates(
    tickets: list[Ticket], as_of: datetime
) -> dict[str, list[dict[str, object]]]:
    first_month = min(_month_start(ticket.created.date()) for ticket in tickets)
    last_month = _month_start(as_of.date())
    month_keys: list[str] = []
    cursor = first_month
    while cursor <= last_month:
        month_keys.append(cursor.strftime("%Y-%m"))
        cursor = _next_month(cursor)

    direction_totals: dict[str, dict[str, object]] = {}
    scenario_totals: dict[str, dict[str, object]] = {}
    month_totals = {
        key: {
            "totalCount": 0,
            "directions": defaultdict(lambda: {"count": 0}),
            "scenarios": defaultdict(lambda: {"count": 0}),
        }
        for key in month_keys
    }

    for ticket in tickets:
        direction_total = direction_totals.setdefault(
            ticket.direction_key,
            {"label": ticket.direction_label, "totalCount": 0},
        )
        scenario_total = scenario_totals.setdefault(
            ticket.scenario_key,
            {"label": ticket.scenario_label, "totalCount": 0},
        )
        direction_total["totalCount"] = int(direction_total["totalCount"]) + 1
        scenario_total["totalCount"] = int(scenario_total["totalCount"]) + 1
        month = month_totals[_month_start(ticket.created.date()).strftime("%Y-%m")]
        month["totalCount"] = int(month["totalCount"]) + 1
        month["directions"][ticket.direction_key]["count"] += 1  # type: ignore[index]
        month["scenarios"][ticket.scenario_key]["count"] += 1  # type: ignore[index]

    direction_order = _category_order(direction_totals)
    scenario_order = _category_order(scenario_totals)

    def monthly_categories(
        values: defaultdict[str, dict[str, int]],
        totals: dict[str, dict[str, object]],
        order: list[str],
    ) -> list[dict[str, object]]:
        result = []
        for key in order:
            category = values[key]
            result.append(
                {
                    "key": key,
                    "label": totals[key]["label"],
                    "count": category["count"],
                }
            )
        return result

    months = []
    for key in month_keys:
        year, month_number = (int(part) for part in key.split("-"))
        month_start = date(year, month_number, 1)
        month_end = _next_month(month_start) - timedelta(days=1)
        data_through = min(month_end, as_of.date())
        values = month_totals[key]
        created_tickets = [
            ticket
            for ticket in tickets
            if month_start <= ticket.created.date() <= data_through
        ]
        created_resolved_count = sum(
            ticket.completed_by_status for ticket in created_tickets
        )
        resolved_tickets = [
            ticket
            for ticket in tickets
            if ticket.resolved is not None
            and month_start <= ticket.resolved.date() <= data_through
        ]
        end_backlog = [
            ticket
            for ticket in tickets
            if ticket.created.date() <= data_through
            and (ticket.resolved is None or ticket.resolved.date() > data_through)
        ]
        export_routine_count = sum(
            ticket.scenario_key in EXPORT_ROUTINE_SCENARIOS for ticket in created_tickets
        )
        automation_count = sum(
            ticket.scenario_key == AUTOMATION_SCENARIO for ticket in created_tickets
        )
        story_points_filled_count = sum(
            bool(ticket.story_points) for ticket in created_tickets
        )
        cycle_times = _cycle_times_days(resolved_tickets)
        months.append(
            {
                "key": key,
                "label": f"{RU_MONTHS[month_number - 1]} {year}",
                "dataThrough": data_through.isoformat(),
                "isComplete": month_end <= as_of.date(),
                "totalCount": values["totalCount"],
                "createdCount": len(created_tickets),
                "createdResolvedCount": created_resolved_count,
                "createdOpenCount": len(created_tickets) - created_resolved_count,
                "resolvedCount": len(resolved_tickets),
                "endBacklogCount": len(end_backlog),
                "exportRoutineCount": export_routine_count,
                "exportRoutineShare": _percentage(
                    export_routine_count, len(created_tickets)
                ),
                "automationCount": automation_count,
                "automationBaseCount": len(created_tickets),
                "automationShare": _percentage(
                    automation_count, len(created_tickets)
                ),
                "storyPointsFilledCount": story_points_filled_count,
                "storyPointsBaseCount": len(created_tickets),
                "storyPointsFilledShare": _percentage(
                    story_points_filled_count, len(created_tickets)
                ),
                "medianCycleTimeDays": _median_days(cycle_times),
                "cycleTimeSampleCount": len(cycle_times),
                "directions": monthly_categories(
                    values["directions"], direction_totals, direction_order  # type: ignore[arg-type]
                ),
                "scenarios": monthly_categories(
                    values["scenarios"], scenario_totals, scenario_order  # type: ignore[arg-type]
                ),
            }
        )

    quarters = []
    quarter_cursor = _quarter_start(first_month)
    last_quarter = _quarter_start(as_of.date())
    while quarter_cursor <= last_quarter:
        quarter_end = _next_quarter(quarter_cursor) - timedelta(days=1)
        data_through = min(quarter_end, as_of.date())
        active_tickets = [
            ticket
            for ticket in tickets
            if ticket.created.date() <= data_through
            and (ticket.resolved is None or ticket.resolved.date() >= quarter_cursor)
        ]
        created_tickets = [
            ticket
            for ticket in tickets
            if quarter_cursor <= ticket.created.date() <= data_through
        ]
        created_resolved_count = sum(
            ticket.completed_by_status for ticket in created_tickets
        )
        resolved_tickets = [
            ticket
            for ticket in tickets
            if ticket.resolved is not None
            and quarter_cursor <= ticket.resolved.date() <= data_through
        ]
        start_backlog = [
            ticket
            for ticket in tickets
            if ticket.created.date() < quarter_cursor
            and (ticket.resolved is None or ticket.resolved.date() >= quarter_cursor)
        ]
        end_backlog = [
            ticket
            for ticket in tickets
            if ticket.created.date() <= data_through
            and (ticket.resolved is None or ticket.resolved.date() > data_through)
        ]

        quarter_directions: defaultdict[str, dict[str, int]] = defaultdict(
            lambda: {"count": 0}
        )
        quarter_scenarios: defaultdict[str, dict[str, int]] = defaultdict(
            lambda: {"count": 0}
        )
        quarter_scenario_tickets: defaultdict[str, list[Ticket]] = defaultdict(list)
        for ticket in created_tickets:
            quarter_directions[ticket.direction_key]["count"] += 1
            quarter_scenarios[ticket.scenario_key]["count"] += 1
            quarter_scenario_tickets[ticket.scenario_key].append(ticket)
        quarter_cycle_time_total = sum(_cycle_times_days(created_tickets))

        def quarterly_categories(
            values: defaultdict[str, dict[str, int]],
            totals: dict[str, dict[str, object]],
            order: list[str],
        ) -> list[dict[str, object]]:
            return [
                {
                    "key": key,
                    "label": totals[key]["label"],
                    "count": values[key]["count"],
                    "share": _percentage(values[key]["count"], len(created_tickets)),
                }
                for key in order
            ]

        def quarterly_scenario_categories() -> list[dict[str, object]]:
            result = []
            for key in scenario_order:
                cycle_times = _cycle_times_days(quarter_scenario_tickets[key])
                result.append(
                    {
                        "key": key,
                        "label": scenario_totals[key]["label"],
                        "count": quarter_scenarios[key]["count"],
                        "share": _percentage(
                            quarter_scenarios[key]["count"], len(created_tickets)
                        ),
                        "continuous25thHours": SCENARIO_CONTINUOUS_25TH_HOURS[key],
                        "medianCycleTimeHours": _median_hours(cycle_times),
                        "cycleTimeSampleCount": len(cycle_times),
                        "cycleTimeShare": _percentage(
                            sum(cycle_times), quarter_cycle_time_total
                        ),
                    }
                )
            return result

        discovery_tickets = [
            ticket
            for ticket in created_tickets
            if ticket.direction_label == DISCOVERY_DIRECTION_LABEL
        ]
        unknown_count = sum(
            ticket.direction_label == UNKNOWN_DIRECTION_LABEL for ticket in created_tickets
        )
        export_routine_count = sum(
            ticket.scenario_key in EXPORT_ROUTINE_SCENARIOS for ticket in created_tickets
        )
        automation_count = sum(
            ticket.scenario_key == AUTOMATION_SCENARIO for ticket in created_tickets
        )
        story_points_filled_count = sum(
            bool(ticket.story_points) for ticket in created_tickets
        )
        cycle_times = _cycle_times_days(resolved_tickets)
        end_backlog_ages = [
            (data_through - ticket.created.date()).days + 1 for ticket in end_backlog
        ]
        discovery_share = _percentage(len(discovery_tickets), len(created_tickets))
        quarter_number = (quarter_cursor.month - 1) // 3
        quarters.append(
            {
                "key": f"{quarter_cursor.year}-Q{quarter_number + 1}",
                "label": f"{RU_QUARTERS[quarter_number]} кв. {quarter_cursor.year}",
                "start": quarter_cursor.isoformat(),
                "end": quarter_end.isoformat(),
                "dataThrough": data_through.isoformat(),
                "isComplete": quarter_end <= as_of.date(),
                "totalActive": len(active_tickets),
                "createdCount": len(created_tickets),
                "createdResolvedCount": created_resolved_count,
                "createdOpenCount": len(created_tickets) - created_resolved_count,
                "resolvedCount": len(resolved_tickets),
                "startBacklogCount": len(start_backlog),
                "endBacklogCount": len(end_backlog),
                "netFlow": len(created_tickets) - len(resolved_tickets),
                "throughputRate": (
                    _percentage(len(resolved_tickets), len(created_tickets))
                    if created_tickets
                    else None
                ),
                "discoveryCount": len(discovery_tickets),
                "discoveryShare": discovery_share,
                "discoveryTarget": DISCOVERY_TARGET,
                "discoveryGap": round(discovery_share - DISCOVERY_TARGET, 2),
                "discoveryConfirmed": discovery_share >= DISCOVERY_TARGET,
                "endBacklogMedianAgeDays": (
                    round(float(statistics.median(end_backlog_ages)), 1)
                    if end_backlog_ages
                    else None
                ),
                "endBacklogAged30Count": sum(age >= 30 for age in end_backlog_ages),
                "unknownCount": unknown_count,
                "unknownShare": _percentage(unknown_count, len(created_tickets)),
                "directions": quarterly_categories(
                    quarter_directions, direction_totals, direction_order
                ),
                "scenarios": quarterly_scenario_categories(),
                "automationCount": automation_count,
                "automationBaseCount": len(created_tickets),
                "automationShare": _percentage(automation_count, len(created_tickets)),
                "storyPointsFilledCount": story_points_filled_count,
                "storyPointsBaseCount": len(created_tickets),
                "storyPointsFilledShare": _percentage(
                    story_points_filled_count, len(created_tickets)
                ),
                "medianCycleTimeDays": _median_days(cycle_times),
                "cycleTimeSampleCount": len(cycle_times),
                "exportRoutineCount": export_routine_count,
                "exportRoutineShare": _percentage(export_routine_count, len(created_tickets)),
            }
        )
        quarter_cursor = _next_quarter(quarter_cursor)

    def top_level_categories(
        totals: dict[str, dict[str, object]], order: list[str]
    ) -> list[dict[str, object]]:
        return [
            {
                "key": key,
                "label": totals[key]["label"],
                "totalCount": totals[key]["totalCount"],
            }
            for key in order
        ]

    return {
        "months": months,
        "quarters": quarters,
        "directions": top_level_categories(direction_totals, direction_order),
        "scenarios": top_level_categories(scenario_totals, scenario_order),
    }


def _discovery_definition() -> dict[str, object]:
    return {
        "directionLabel": DISCOVERY_DIRECTION_LABEL,
        "metric": "Доля созданных тикетов направления «Аналитика» среди всех созданных тикетов квартала",
        "targetPercent": DISCOVERY_TARGET,
        "period": "Календарный квартал",
        "interval": "Тикет учитывается один раз — в периоде своей даты Created",
    }


def build_payload(
    input_path: Path,
    history_start: date | None = DEFAULT_HISTORY_START,
    history_end: date | None = DEFAULT_HISTORY_END,
) -> dict[str, object]:
    team_sources = read_tickets(
        input_path,
        history_start=history_start,
        history_end=history_end,
    )
    teams: list[dict[str, object]] = []
    for source in team_sources:
        aggregates = _build_team_aggregates(source.tickets, source.as_of)
        cycle_times = _cycle_times_days(source.tickets)
        story_points_filled_count = sum(
            bool(ticket.story_points) for ticket in source.tickets
        )
        meta = {
            "source": input_path.name,
            "asOf": source.as_of.date().isoformat(),
            "historyStart": history_start.isoformat() if history_start else None,
            "historyEnd": history_end.isoformat() if history_end else None,
            "totalTickets": source.total_tickets,
            "includedTickets": len(source.tickets),
            "excludedCancelled": source.excluded_cancelled,
            "excludedMissingIssueKey": source.excluded_missing_issue_key,
            "excludedBeforeHistoryStart": source.excluded_before_history_start,
            "excludedAfterHistoryEnd": source.excluded_after_history_end,
            "terminalWithoutResolved": source.terminal_without_resolved,
            "storyPointsFilledCount": story_points_filled_count,
            "storyPointsBaseCount": len(source.tickets),
            "storyPointsFilledShare": _percentage(
                story_points_filled_count, len(source.tickets)
            ),
            "medianCycleTimeDays": _median_days(cycle_times),
            "cycleTimeSampleCount": len(cycle_times),
            "monthCount": len(aggregates["months"]),
            "quarterCount": len(aggregates["quarters"]),
            "teamKey": source.key,
            "teamLabel": source.label,
            "discoveryDefinition": _discovery_definition(),
        }
        teams.append(
            {
                "key": source.key,
                "label": source.label,
                "meta": meta,
                **aggregates,
            }
        )

    primary = next(
        (
            team
            for team in teams
            if str(team["label"]).casefold() == PRIMARY_TEAM_LABEL.casefold()
        ),
        teams[0],
    )
    primary_meta = dict(primary["meta"])  # type: ignore[arg-type]
    primary_meta["teamCount"] = len(teams)

    return {
        "meta": primary_meta,
        "months": primary["months"],
        "quarters": primary["quarters"],
        "directions": primary["directions"],
        "scenarios": primary["scenarios"],
        "teams": teams,
    }


def write_payload(
    input_path: Path,
    output_path: Path,
    history_start: date | None = DEFAULT_HISTORY_START,
    history_end: date | None = DEFAULT_HISTORY_END,
) -> dict[str, object]:
    payload = build_payload(
        input_path,
        history_start=history_start,
        history_end=history_end,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build anonymized monthly backlog aggregates from XLSX")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--history-start",
        type=date.fromisoformat,
        default=DEFAULT_HISTORY_START,
        help="Earliest Created date to include (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--history-end",
        type=date.fromisoformat,
        default=DEFAULT_HISTORY_END,
        help="Latest Created and report date to include (YYYY-MM-DD)",
    )
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    payload = write_payload(
        args.input,
        args.output,
        history_start=args.history_start,
        history_end=args.history_end,
    )
    included_tickets = sum(
        int(team["meta"]["includedTickets"]) for team in payload["teams"]  # type: ignore[index]
    )
    print(
        f"{args.output}: {included_tickets} tickets, "
        f"{payload['meta']['teamCount']} teams"  # type: ignore[index]
    )


if __name__ == "__main__":
    main()
