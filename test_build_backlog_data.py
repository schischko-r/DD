import json
import tempfile
import unittest
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import build_backlog_data as backlog


def _column_name(index: int) -> str:
    name = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(65 + remainder) + name
    return name


def _xml_text(value: object) -> str:
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _write_minimal_xlsx(path: Path, rows: list[dict[str, object]]) -> None:
    """Write the tiny OOXML subset needed by pandas/openpyxl, using stdlib only."""
    headers = list(rows[0])
    sheet_rows = [headers, *[[row.get(header, "") for header in headers] for row in rows]]
    row_xml = []
    for row_number, values in enumerate(sheet_rows, start=1):
        cells = []
        for column_number, value in enumerate(values, start=1):
            if value in (None, ""):
                continue
            reference = f"{_column_name(column_number)}{row_number}"
            cells.append(
                f'<c r="{reference}" t="inlineStr"><is><t>{_xml_text(value)}</t></is></c>'
            )
        row_xml.append(f'<row r="{row_number}">{"".join(cells)}</row>')

    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(row_xml)}</sheetData></worksheet>'
    )

    with ZipFile(path, "w", ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '</Types>',
        )
        archive.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '</Relationships>',
        )
        archive.writestr(
            "xl/workbook.xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Tickets" sheetId="1" r:id="rId1"/></sheets></workbook>',
        )
        archive.writestr(
            "xl/_rels/workbook.xml.rels",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '</Relationships>',
        )
        archive.writestr("xl/worksheets/sheet1.xml", sheet_xml)


def _ticket_workbook(root: Path) -> Path:
    path = root / "tips_tickets.xlsx"
    common = {
        "team": "СберЧаевые",
        "direction": "product_analytics",
        "Summary": "Секретный клиент и внутренний проект",
        "Assignee": "Иван Иванов <ivan@example.test>",
        "Reporter": "Мария Петрова <maria@example.test>",
    }
    _write_minimal_xlsx(
        path,
        [
            {
                **common,
                "Created": "2024-01-31",
                "Resolved": "2024-03-01",
                "Status": "Done",
                "Issue key": "SECRET-1",
                "scenario": "metric_calculation",
            },
            {
                **common,
                "Created": "2024-02-15",
                "Resolved": "",
                "Status": "In Progress",
                "Issue key": "SECRET-2",
                "scenario": "metrics_calculation",
            },
            {
                **common,
                "Created": "2024-03-31",
                "Resolved": "2024-03-31",
                "Status": "Cancelled",
                "Issue key": "SECRET-CANCELLED",
                "direction": "must_not_appear",
                "scenario": "AI",
            },
        ],
    )
    return path


def _quarter_workbook(root: Path) -> Path:
    path = root / "quarter_tickets.xlsx"
    private = {
        "team": "СберЧаевые",
        "Summary": "Секретная квартальная инициатива",
        "Assignee": "Пётр Секретов <petr@example.test>",
        "Reporter": "Скрытый Автор <author@example.test>",
    }
    _write_minimal_xlsx(
        path,
        [
            {
                **private,
                "Created": "2023-12-20",
                "Resolved": "2024-04-10",
                "Status": "Done",
                "Issue key": "PRIVATE-ACROSS",
                "direction": "Аналитика",
                "scenario": "root_cause_analysis",
            },
            {
                **private,
                "Created": "2024-01-01",
                "Resolved": "2024-01-01",
                "Status": "Done",
                "Issue key": "PRIVATE-ONE",
                "direction": "Аналитика",
                "scenario": "growth_factors_research",
            },
            {
                **private,
                "Created": "2024-01-10",
                "Resolved": "2024-01-13",
                "Status": "Done",
                "Issue key": "PRIVATE-FOUR",
                "direction": "Поддержка",
                "scenario": "exports_to_excel",
            },
            {
                **private,
                "Created": "2024-02-01",
                "Resolved": "2024-02-08",
                "Status": "Done",
                "Issue key": "PRIVATE-EIGHT",
                "direction": "Поддержка",
                "scenario": "excel_automatic_reports",
            },
            {
                **private,
                "Created": "2024-01-20",
                "Resolved": "2024-01-21",
                "Status": "Done",
                "Issue key": "PRIVATE-TWO",
                "direction": "Поддержка",
                "scenario": "excel_reports",
            },
            {
                **private,
                "Created": "2024-03-01",
                "Resolved": "",
                "Status": "In Progress",
                "Issue key": "PRIVATE-OPEN",
                "direction": "",
                "scenario": "private_customer_scenario",
            },
            {
                **private,
                "Created": "2024-04-15",
                "Resolved": "2024-04-15",
                "Status": "Cancelled",
                "Issue key": "PRIVATE-ASOF",
                "direction": "Не должно попасть",
                "scenario": "AI",
            },
        ],
    )
    return path


def _discovery_goal_workbook(root: Path) -> Path:
    path = root / "discovery_goal.xlsx"
    rows = []
    for index in range(5):
        rows.append(
            {
                "team": "СберЧаевые",
                "Created": f"2024-01-0{index + 1}",
                "Resolved": f"2024-01-0{index + 1}",
                "Status": "Done",
                "Issue key": f"SYNTHETIC-{index + 1}",
                "direction": "Аналитика" if index < 2 else "Поддержка",
                "scenario": "growth_factors_research" if index < 2 else "project_management",
                "Summary": "Не публиковать исходную задачу",
            }
        )
    _write_minimal_xlsx(path, rows)
    return path


def _multi_team_workbook(root: Path) -> Path:
    path = root / "multi_team.xlsx"
    _write_minimal_xlsx(
        path,
        [
            {
                "team": "СберЧаевые",
                "Created": "2024-01-01",
                "Resolved": "2024-01-02",
                "Status": "Done",
                "Issue key": "SHARED-1",
                "direction": "Аналитика",
                "scenario": "AI",
            },
            {
                "team": "СберЧаевые",
                "Created": "2024-01-01",
                "Resolved": "2024-01-02",
                "Status": "Done",
                "Issue key": "SHARED-1",
                "direction": "Аналитика",
                "scenario": "AI",
            },
            {
                "team": "Объект Авто",
                "Created": "2024-02-01",
                "Resolved": "2024-02-01",
                "Status": "Решен",
                "Issue key": "SHARED-1",
                "direction": "Поддержка",
                "scenario": "social_communication",
            },
            {
                "team": "Объект Авто",
                "Created": "2024-02-02",
                "Resolved": "",
                "Status": "Выполнен",
                "Issue key": "OBJECT-OPEN",
                "direction": "",
                "scenario": "",
            },
            {
                "team": "Объект Авто",
                "Created": "2024-02-03",
                "Resolved": "",
                "Status": "In Progress",
                "Issue key": "",
                "direction": "Поддержка",
                "scenario": "AI",
            },
            {
                "team": "Объект Авто",
                "Created": "2024-02-04",
                "Resolved": "2024-02-04",
                "Status": "Отменен",
                "Issue key": "OBJECT-CANCELLED",
                "direction": "Поддержка",
                "scenario": "AI",
            },
        ],
    )
    return path


def _month(payload: dict, key: str) -> dict:
    return next(month for month in payload["months"] if month["key"] == key)


def _category(items: list[dict], key: str) -> dict:
    return next(item for item in items if item["key"] == key)


def _quarter(payload: dict, key: str) -> dict:
    return next(quarter for quarter in payload["quarters"] if quarter["key"] == key)


class BuildBacklogDataTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.ticket_workbook = _ticket_workbook(Path(self.temporary_directory.name))

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def test_counts_each_ticket_only_in_its_created_month(self) -> None:
        payload = backlog.build_payload(self.ticket_workbook)

        january = _month(payload, "2024-01")
        february = _month(payload, "2024-02")
        march = _month(payload, "2024-03")

        self.assertEqual(
            [january["totalCount"], february["totalCount"], march["totalCount"]],
            [1, 1, 0],
        )
        self.assertEqual(january["totalCount"], january["createdCount"])
        self.assertEqual(february["totalCount"], february["createdCount"])
        self.assertEqual(march["totalCount"], march["createdCount"])
        self.assertEqual(
            _category(january["scenarios"], "metrics_calculation")["count"], 1
        )
        self.assertEqual(
            _category(february["scenarios"], "metrics_calculation")["count"], 1
        )
        self.assertEqual(
            _category(march["scenarios"], "metrics_calculation")["count"], 0
        )
        # The January ticket resolved in March remains in its Created cohort.
        self.assertEqual(january["createdResolvedCount"], 1)
        self.assertEqual(january["createdOpenCount"], 0)
        self.assertEqual(february["createdResolvedCount"], 0)
        self.assertEqual(february["createdOpenCount"], 1)
        self.assertEqual(march["createdResolvedCount"], 0)
        self.assertEqual(march["createdOpenCount"], 0)
        self.assertEqual(march["resolvedCount"], 1)

        for month in payload["months"]:
            self.assertEqual(
                month["createdResolvedCount"] + month["createdOpenCount"],
                month["createdCount"],
            )

    def test_completed_created_cohort_uses_only_resolved_and_done_statuses(self) -> None:
        path = Path(self.temporary_directory.name) / "completion_statuses.xlsx"
        _write_minimal_xlsx(
            path,
            [
                {
                    "team": "СберЧаевые",
                    "Created": "2024-01-01",
                    "Resolved": "",
                    "Status": "Done",
                    "Issue key": "DONE-NO-DATE",
                    "direction": "Аналитика",
                    "scenario": "AI",
                },
                {
                    "team": "СберЧаевые",
                    "Created": "2024-01-02",
                    "Resolved": "",
                    "Status": "Resolved",
                    "Issue key": "RESOLVED-NO-DATE",
                    "direction": "Аналитика",
                    "scenario": "AI",
                },
                {
                    "team": "СберЧаевые",
                    "Created": "2024-01-03",
                    "Resolved": "2024-01-04",
                    "Status": "In Progress",
                    "Issue key": "DATE-WITHOUT-COMPLETED-STATUS",
                    "direction": "Аналитика",
                    "scenario": "AI",
                },
                {
                    "team": "СберЧаевые",
                    "Created": "2024-01-05",
                    "Resolved": "",
                    "Status": "Выполнен",
                    "Issue key": "DONE-LOCALIZED",
                    "direction": "Аналитика",
                    "scenario": "AI",
                },
                {
                    "team": "СберЧаевые",
                    "Created": "2024-01-06",
                    "Resolved": "",
                    "Status": "Решен",
                    "Issue key": "RESOLVED-LOCALIZED",
                    "direction": "Аналитика",
                    "scenario": "AI",
                },
            ],
        )

        payload = backlog.build_payload(path)
        january = _month(payload, "2024-01")
        quarter = _quarter(payload, "2024-Q1")

        self.assertEqual(january["createdCount"], 5)
        self.assertEqual(january["createdResolvedCount"], 4)
        self.assertEqual(january["createdOpenCount"], 1)
        self.assertEqual(quarter["createdResolvedCount"], 4)
        self.assertEqual(quarter["createdOpenCount"], 1)

    def test_open_cancelled_aliases_and_public_payload_safety(self) -> None:
        payload = backlog.build_payload(self.ticket_workbook)

        self.assertEqual(payload["meta"]["asOf"], "2024-03-31")
        self.assertEqual(payload["meta"]["totalTickets"], 3)
        self.assertEqual(payload["meta"]["includedTickets"], 2)
        self.assertEqual(payload["meta"]["excludedCancelled"], 1)

        canonical = _category(payload["scenarios"], "metrics_calculation")
        self.assertEqual(canonical["label"], "Расчет метрик")
        self.assertEqual(canonical["totalCount"], 2)

        serialized = json.dumps(payload, ensure_ascii=False)
        for removed_ttm_field in (
            "totalTtmDays",
            "ttmDays",
            "ttmShare",
            "medianTtmDays",
            "p75TtmDays",
            "discoveryTtmDays",
            "discoveryTtmShare",
        ):
            self.assertNotIn(removed_ttm_field, serialized)
        for private_value in (
            "SECRET-1",
            "SECRET-2",
            "SECRET-CANCELLED",
            "Секретный клиент",
            "Иван Иванов",
            "ivan@example.test",
            "Мария Петрова",
            "maria@example.test",
        ):
            self.assertNotIn(private_value, serialized)
        self.assertNotIn("must_not_appear", serialized)

    def test_exposes_extensible_team_contract_with_legacy_fields(self) -> None:
        payload = backlog.build_payload(self.ticket_workbook)

        self.assertEqual(payload["meta"]["teamCount"], 1)
        self.assertEqual(payload["meta"]["teamKey"], "sberchai")
        self.assertEqual(payload["meta"]["teamLabel"], "СберЧаевые")
        self.assertEqual(len(payload["teams"]), 1)

        team = payload["teams"][0]
        self.assertEqual(team["key"], "sberchai")
        self.assertEqual(team["label"], "СберЧаевые")
        self.assertEqual(team["meta"]["teamKey"], "sberchai")
        self.assertEqual(team["meta"]["excludedMissingIssueKey"], 0)
        self.assertEqual(team["meta"]["terminalWithoutResolved"], 0)
        for field in ("months", "quarters", "directions", "scenarios"):
            self.assertEqual(team[field], payload[field])

        serialized = json.dumps(team, ensure_ascii=False)
        for private_value in (
            "SECRET-1",
            "Секретный клиент",
            "Иван Иванов",
            "ivan@example.test",
        ):
            self.assertNotIn(private_value, serialized)

    def test_multi_team_aggregates_are_isolated_and_keep_primary_compatibility(self) -> None:
        payload = backlog.build_payload(
            _multi_team_workbook(Path(self.temporary_directory.name))
        )

        self.assertEqual(payload["meta"]["teamCount"], 2)
        self.assertEqual(payload["meta"]["teamKey"], "sberchai")
        self.assertEqual(payload["meta"]["includedTickets"], 1)
        self.assertEqual(
            [team["key"] for team in payload["teams"]],
            ["sberchai", "obekt-avto"],
        )

        tips, object_auto = payload["teams"]
        self.assertEqual(tips["months"], payload["months"])
        self.assertEqual(tips["meta"]["totalTickets"], 1)
        self.assertEqual(tips["meta"]["includedTickets"], 1)

        object_meta = object_auto["meta"]
        self.assertEqual(object_meta["teamLabel"], "Объект Авто")
        self.assertEqual(object_meta["asOf"], "2024-02-04")
        self.assertEqual(object_meta["totalTickets"], 4)
        self.assertEqual(object_meta["includedTickets"], 2)
        self.assertEqual(object_meta["excludedCancelled"], 1)
        self.assertEqual(object_meta["excludedMissingIssueKey"], 1)
        self.assertEqual(object_meta["terminalWithoutResolved"], 1)
        self.assertEqual(
            object_meta["totalTickets"],
            object_meta["includedTickets"]
            + object_meta["excludedCancelled"]
            + object_meta["excludedMissingIssueKey"],
        )

        february = _month(object_auto, "2024-02")
        self.assertEqual(february["totalCount"], 2)
        social = _category(object_auto["scenarios"], "social_communications")
        self.assertEqual(social["label"], "Встречи, коммуникации")
        self.assertEqual(social["totalCount"], 1)
        self.assertEqual(_category(object_auto["scenarios"], "unknown")["totalCount"], 1)

    def test_requires_team_column(self) -> None:
        path = Path(self.temporary_directory.name) / "missing_team.xlsx"
        _write_minimal_xlsx(
            path,
            [
                {
                    "Created": "2024-01-01",
                    "Resolved": "2024-01-01",
                    "Status": "Done",
                    "Issue key": "NO-TEAM-1",
                    "direction": "Аналитика",
                    "scenario": "AI",
                }
            ],
        )

        with self.assertRaisesRegex(ValueError, "team"):
            backlog.build_payload(path)

    def test_quarter_aggregates_keep_flow_and_use_created_cohort_for_structure(self) -> None:
        payload = backlog.build_payload(_quarter_workbook(Path(self.temporary_directory.name)))
        first_quarter = _quarter(payload, "2024-Q1")
        second_quarter = _quarter(payload, "2024-Q2")

        self.assertEqual(first_quarter["start"], "2024-01-01")
        self.assertEqual(first_quarter["end"], "2024-03-31")
        self.assertEqual(first_quarter["dataThrough"], "2024-03-31")
        self.assertTrue(first_quarter["isComplete"])
        self.assertEqual(first_quarter["totalActive"], 6)
        self.assertEqual(first_quarter["createdCount"], 5)
        self.assertEqual(first_quarter["createdResolvedCount"], 4)
        self.assertEqual(first_quarter["createdOpenCount"], 1)
        self.assertEqual(first_quarter["resolvedCount"], 4)
        self.assertEqual(first_quarter["startBacklogCount"], 1)
        self.assertEqual(first_quarter["endBacklogCount"], 2)
        self.assertEqual(first_quarter["netFlow"], 1)
        self.assertEqual(first_quarter["throughputRate"], 80)
        self.assertEqual(
            sum(item["count"] for item in first_quarter["directions"]),
            first_quarter["createdCount"],
        )
        self.assertEqual(
            sum(item["count"] for item in first_quarter["scenarios"]),
            first_quarter["createdCount"],
        )
        self.assertEqual(
            _category(first_quarter["directions"], "Аналитика")["count"], 1
        )
        self.assertFalse(second_quarter["isComplete"])
        self.assertEqual(second_quarter["dataThrough"], "2024-04-15")
        self.assertEqual(second_quarter["createdCount"], 0)
        self.assertEqual(second_quarter["createdResolvedCount"], 0)
        self.assertEqual(second_quarter["createdOpenCount"], 0)
        self.assertEqual(second_quarter["resolvedCount"], 1)
        self.assertEqual(second_quarter["netFlow"], -1)
        self.assertIsNone(second_quarter["throughputRate"])
        self.assertEqual(sum(item["count"] for item in second_quarter["directions"]), 0)
        self.assertEqual(sum(item["share"] for item in second_quarter["directions"]), 0)
        self.assertEqual(sum(item["count"] for item in second_quarter["scenarios"]), 0)
        self.assertEqual(sum(item["share"] for item in second_quarter["scenarios"]), 0)
        self.assertEqual(second_quarter["discoveryCount"], 0)
        self.assertEqual(second_quarter["discoveryShare"], 0)
        self.assertEqual(second_quarter["automationShare"], 0)
        self.assertEqual(second_quarter["exportRoutineShare"], 0)
        for quarter in payload["quarters"]:
            self.assertEqual(
                quarter["createdResolvedCount"] + quarter["createdOpenCount"],
                quarter["createdCount"],
            )

    def test_monthly_kpi_aggregates_and_partial_month_cutoff(self) -> None:
        payload = backlog.build_payload(_quarter_workbook(Path(self.temporary_directory.name)))

        january = _month(payload, "2024-01")
        february = _month(payload, "2024-02")
        march = _month(payload, "2024-03")
        april = _month(payload, "2024-04")

        self.assertEqual(january["dataThrough"], "2024-01-31")
        self.assertTrue(january["isComplete"])
        self.assertEqual(january["totalCount"], 3)
        self.assertEqual(january["createdCount"], 3)
        self.assertEqual(january["createdResolvedCount"], 3)
        self.assertEqual(january["createdOpenCount"], 0)
        self.assertEqual(january["resolvedCount"], 3)
        self.assertEqual(january["endBacklogCount"], 1)
        self.assertEqual(january["exportRoutineCount"], 2)
        self.assertEqual(january["exportRoutineShare"], 66.67)
        self.assertEqual(january["automationCount"], 0)
        self.assertEqual(january["automationBaseCount"], 3)
        self.assertEqual(january["automationShare"], 0)
        self.assertEqual(
            sum(item["count"] for item in january["directions"]),
            january["totalCount"],
        )
        self.assertEqual(
            sum(item["count"] for item in january["scenarios"]),
            january["totalCount"],
        )

        self.assertEqual(february["totalCount"], 1)
        self.assertEqual(february["createdCount"], 1)
        self.assertEqual(february["createdResolvedCount"], 1)
        self.assertEqual(february["createdOpenCount"], 0)
        self.assertEqual(february["resolvedCount"], 1)
        self.assertEqual(february["endBacklogCount"], 1)
        self.assertEqual(february["exportRoutineCount"], 1)
        self.assertEqual(february["exportRoutineShare"], 100)
        self.assertEqual(february["automationCount"], 1)
        self.assertEqual(february["automationBaseCount"], 1)
        self.assertEqual(february["automationShare"], 100)

        self.assertEqual(march["totalCount"], 1)
        self.assertEqual(march["createdCount"], 1)
        self.assertEqual(march["createdResolvedCount"], 0)
        self.assertEqual(march["createdOpenCount"], 1)
        self.assertEqual(march["resolvedCount"], 0)
        self.assertEqual(march["endBacklogCount"], 2)
        self.assertEqual(march["exportRoutineCount"], 0)
        self.assertEqual(march["exportRoutineShare"], 0)
        self.assertEqual(march["automationCount"], 0)
        self.assertEqual(march["automationBaseCount"], 1)
        self.assertEqual(march["automationShare"], 0)

        self.assertEqual(april["dataThrough"], "2024-04-15")
        self.assertFalse(april["isComplete"])
        self.assertEqual(april["totalCount"], 0)
        self.assertEqual(april["createdCount"], 0)
        self.assertEqual(april["createdResolvedCount"], 0)
        self.assertEqual(april["createdOpenCount"], 0)
        self.assertEqual(april["resolvedCount"], 1)
        self.assertEqual(april["endBacklogCount"], 1)
        self.assertEqual(april["exportRoutineCount"], 0)
        self.assertEqual(april["exportRoutineShare"], 0)
        self.assertEqual(april["automationCount"], 0)
        self.assertEqual(april["automationBaseCount"], 0)
        self.assertEqual(april["automationShare"], 0)

    def test_quarter_discovery_routine_automation_unknown_and_privacy(self) -> None:
        payload = backlog.build_payload(_quarter_workbook(Path(self.temporary_directory.name)))
        quarter = _quarter(payload, "2024-Q1")

        self.assertEqual(quarter["discoveryCount"], 1)
        self.assertEqual(quarter["createdCount"], 5)
        self.assertEqual(quarter["discoveryShare"], 20)
        self.assertEqual(quarter["discoveryTarget"], 40)
        self.assertEqual(quarter["discoveryGap"], -20)
        self.assertFalse(quarter["discoveryConfirmed"])
        self.assertEqual(quarter["unknownCount"], 1)
        self.assertEqual(quarter["unknownShare"], 20)
        self.assertEqual(quarter["automationCount"], 1)
        self.assertEqual(quarter["automationBaseCount"], 5)
        self.assertEqual(quarter["automationShare"], 20)
        self.assertEqual(quarter["exportRoutineCount"], 3)
        self.assertEqual(quarter["exportRoutineShare"], 60)

        unknown = _category(quarter["scenarios"], "unknown")
        self.assertEqual(unknown["label"], "Невозможно разметить")
        self.assertEqual(unknown["count"], 1)

        serialized = json.dumps(payload, ensure_ascii=False)
        for private_value in (
            "PRIVATE-ACROSS",
            "PRIVATE-OPEN",
            "Секретная квартальная инициатива",
            "Пётр Секретов",
            "petr@example.test",
            "Скрытый Автор",
            "author@example.test",
            "private_customer_scenario",
            "Не должно попасть",
        ):
            self.assertNotIn(private_value, serialized)

    def test_discovery_goal_is_confirmed_at_exactly_forty_percent(self) -> None:
        payload = backlog.build_payload(_discovery_goal_workbook(Path(self.temporary_directory.name)))
        quarter = _quarter(payload, "2024-Q1")

        self.assertEqual(quarter["discoveryCount"], 2)
        self.assertEqual(quarter["totalActive"], 5)
        self.assertEqual(quarter["createdCount"], 5)
        self.assertEqual(quarter["discoveryShare"], 40)
        self.assertEqual(quarter["discoveryGap"], 0)
        self.assertTrue(quarter["discoveryConfirmed"])


if __name__ == "__main__":
    unittest.main()
