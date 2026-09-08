import json
import tempfile
import unittest
from pathlib import Path

from openpyxl import Workbook

import build_data_maturity as maturity


HEADER = [
    "Период", "Юнит", "Метрика", "Описание", "Ед.измерения",
    "Категория", "План", "2Q2026", "1Q2026", "4Q2025", "3Q2025",
]

METRIC_TEMPLATE = [
    ("Новые витрины на B2C SQL", "Доля витрин", "%", "Инструмент", "0.9"),
    ("Использование базовых витрин ЕПКАП", "Доля подписок", "%", "Потребленияе", "0.9"),
    ("Покрытие проверками качества данных критичных процессов", "Доля таблиц", "%", "Качество данных", "100% Мониторинг"),
    ("Скорость поставки данных Банка в Фабрику данных", "Время загрузки", "раб.дни", "Скорость", "Мониторинг\nNew <40"),
    ("Скорость поставки данных Банка в Фабрику данных", "Время загрузки", "раб.дни", "Скорость", "CR <15"),
    ("Плотность инцидентов", "Инциденты на поток", "%", "Надежность", "<5%"),
    ("Доля ИОР в инцидентах", "ИОР", "%", "Надежность", "0"),
    ("Доля данных АС, загруженных  в Фабрику данных", "Реплики АС", "%", "Потребление", "- %  Мониторинг"),
    ("Скорость поставки внешних данных в Фабрику данных", "Данные ДЗО", "раб.дни", "Скорость", "40 раб. Дней"),
]


def build_workbook(path: Path, overrides: dict | None = None) -> None:
    overrides = overrides or {}
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Данные"
    sheet.append(HEADER)
    for unit in (*maturity.UNIT_MAPPING, "Ecom"):
        for position, (name, description, measure, category, plan) in enumerate(METRIC_TEMPLATE):
            current, previous = overrides.get((unit, position), ("0.5", "0.4"))
            sheet.append([
                "2Q2026", unit, name, description, measure,
                category, plan, current, previous, "-", "-",
            ])
    workbook.save(path)


class DataMaturityConnectorTest(unittest.TestCase):
    def _build(self, overrides: dict | None = None) -> dict:
        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "Книга1.xlsx"
            build_workbook(source, overrides)
            return maturity.build_payload(maturity.read_rows(source))

    def test_only_mapped_units_reach_the_dashboard(self) -> None:
        payload = self._build()
        self.assertEqual(
            [(unit["key"], unit["label"], unit["sourceUnit"]) for unit in payload["units"]],
            [
                ("Data", "Data", "Data"),
                ("CX", "CX", "CX"),
                ("УБ", "УБ", "УБ"),
                ("CBP", "Core Banking", "Core"),
                ("DB", "Daily Banking", "Daily"),
                ("PC", "PH (CC)", "СС"),
                ("DP", "Digital (DC)", "Digital"),
                ("ДомКлик", "ДомКлик", "Домклик"),
            ],
        )
        self.assertEqual(payload["meta"]["period"], "2Q2026")
        self.assertEqual(payload["meta"]["previousPeriod"], "1Q2026")

    def test_delta_compares_the_two_requested_quarters_only(self) -> None:
        payload = self._build({("Core", 0): ("0.95", "0.9")})
        metric = self._metric(payload, "CBP", "b2c-sql-marts")
        self.assertEqual(metric["value"], 0.95)
        self.assertEqual(metric["previousValue"], 0.9)
        self.assertAlmostEqual(metric["delta"], 0.05)
        self.assertEqual(metric["trend"], "positive")

    def test_a_lower_reading_improves_speed_and_reliability(self) -> None:
        payload = self._build({("Core", 4): ("15", "21"), ("Core", 5): ("0.06", "0.02")})
        speed = self._metric(payload, "CBP", "bank-delivery-speed-cr")
        self.assertEqual(speed["betterDirection"], "down")
        self.assertEqual(speed["trend"], "positive")

        incidents = self._metric(payload, "CBP", "incident-density")
        self.assertEqual(incidents["betterDirection"], "down")
        self.assertEqual(incidents["trend"], "negative")

    def test_the_two_delivery_norms_stay_separate_metrics(self) -> None:
        payload = self._build()
        keys = [metric["key"] for metric in self._metrics(payload, "CBP")]
        self.assertIn("bank-delivery-speed-new", keys)
        self.assertIn("bank-delivery-speed-cr", keys)
        self.assertEqual(len(keys), len(set(keys)), "every metric key is unique within a unit")

        labels = {metric["key"]: metric["label"] for metric in self._metrics(payload, "CBP")}
        self.assertTrue(labels["bank-delivery-speed-new"].endswith("(NEW)"))
        self.assertTrue(labels["bank-delivery-speed-cr"].endswith("(CR)"))

        norms = {metric["key"]: metric["planLabel"] for metric in self._metrics(payload, "CBP")}
        self.assertEqual(norms["bank-delivery-speed-new"], "<40")
        self.assertEqual(norms["bank-delivery-speed-cr"], "<15")

    def test_a_missing_reading_produces_no_delta_and_no_verdict(self) -> None:
        payload = self._build({("Core", 0): ("-", "0.9"), ("Core", 1): ("0.9", None)})
        for key in ("b2c-sql-marts", "epkap-marts-usage"):
            metric = self._metric(payload, "CBP", key)
            self.assertIsNone(metric["delta"])
            self.assertEqual(metric["trend"], "unknown")

    def test_a_text_cell_explaining_the_gap_is_carried_as_a_note(self) -> None:
        payload = self._build({("Core", 0): ("Юнит не работает в КАП \n(Фабрике данных)", "-")})
        metric = self._metric(payload, "CBP", "b2c-sql-marts")
        self.assertIsNone(metric["value"])
        self.assertEqual(metric["note"], "Юнит не работает в КАП (Фабрике данных)")

    def test_the_category_typo_is_folded_into_one_group(self) -> None:
        payload = self._build()
        labels = [category["label"] for category in payload["units"][0]["categories"]]
        self.assertIn("Потребление", labels)
        self.assertNotIn("Потребленияе", labels)
        self.assertEqual(labels, list(maturity.CATEGORY_ORDER))

    def test_a_unit_missing_from_the_workbook_fails_the_build(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "Книга1.xlsx"
            build_workbook(source)
            records = [record for record in maturity.read_rows(source) if record["Юнит"] != "Core"]
            with self.assertRaises(ValueError) as error:
                maturity.build_payload(records)
        self.assertIn("Core", str(error.exception))

    def test_measured_counts_report_data_coverage(self) -> None:
        payload = self._build({("Core", index): ("-", "-") for index in range(3)})
        unit = next(item for item in payload["units"] if item["key"] == "CBP")
        self.assertEqual(unit["metricCount"], 9)
        self.assertEqual(unit["measuredCount"], 6)

    def test_output_is_written_as_readable_utf8_json(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "Книга1.xlsx"
            output = Path(temp_dir) / "data-maturity.json"
            build_workbook(source)
            payload = maturity.build_payload(maturity.read_rows(source))
            output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            written = output.read_text(encoding="utf-8")
        self.assertIn("Core Banking", written)
        self.assertNotIn("\\u", written)

    def test_a_norm_is_read_as_a_threshold_and_a_side_to_land_on(self) -> None:
        payload = self._build({
            ("Core", 0): ("0.95", "0.9"),   # 0.9 share, higher is better
            ("Core", 2): ("0.8", "0.7"),    # "100% Мониторинг"
            ("Core", 4): ("15", "21"),      # "CR <15"
            ("Core", 5): ("0.07", "0.02"),  # "<5%"
        })
        expectations = {
            "b2c-sql-marts": (0.9, "min", True),
            "dq-coverage": (1.0, "min", False),
            "bank-delivery-speed-cr": (15.0, "max", True),
            "incident-density": (0.05, "max", False),
        }
        for key, (target, comparison, met) in expectations.items():
            metric = self._metric(payload, "CBP", key)
            self.assertAlmostEqual(metric["planTarget"], target, msg=key)
            self.assertEqual(metric["planComparison"], comparison, msg=key)
            self.assertIs(metric["meetsPlan"], met, msg=key)

    def test_a_metric_without_a_norm_or_a_reading_is_not_judged(self) -> None:
        payload = self._build({("Core", 0): ("-", "0.9")})
        self.assertIsNone(self._metric(payload, "CBP", "as-data-share")["planTarget"])
        self.assertIsNone(self._metric(payload, "CBP", "as-data-share")["meetsPlan"])
        self.assertIsNone(self._metric(payload, "CBP", "b2c-sql-marts")["meetsPlan"])

    def test_the_unit_score_is_the_share_of_norms_it_meets(self) -> None:
        payload = self._build({
            ("Core", 0): ("0.95", "0.9"),   # met
            ("Core", 2): ("0.8", "0.7"),    # missed
            ("Core", 3): ("30", "35"),      # met, New <40
            ("Core", 4): ("15", "21"),      # met, CR <15
            ("Core", 5): ("0.07", "0.02"),  # missed
            ("Core", 6): ("0", "0"),        # met, ИОР 0
            ("Core", 8): ("50", "45"),      # missed, 40 раб. дней
        })
        unit = next(item for item in payload["units"] if item["key"] == "CBP")
        self.assertEqual(unit["judgedCount"], 8)
        self.assertEqual(unit["metCount"], 4)
        self.assertEqual(unit["score"], 50)

    def test_the_b2c_average_summarises_the_scored_units(self) -> None:
        payload = self._build()
        scores = [unit["score"] for unit in payload["units"] if unit["score"] is not None]
        self.assertTrue(scores)
        self.assertEqual(payload["meta"]["averageScore"], round(sum(scores) / len(scores)))
        self.assertIn("норматив", payload["meta"]["scoreDefinition"])

    def _metrics(self, payload: dict, unit_key: str) -> list[dict]:
        unit = next(item for item in payload["units"] if item["key"] == unit_key)
        return [metric for category in unit["categories"] for metric in category["metrics"]]

    def _metric(self, payload: dict, unit_key: str, metric_key: str) -> dict:
        return next(metric for metric in self._metrics(payload, unit_key) if metric["key"] == metric_key)


if __name__ == "__main__":
    unittest.main()
