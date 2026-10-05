import tempfile
import unittest
from pathlib import Path

import openpyxl

from build_questionnaire_data import build_payload


class QuestionnaireDataTest(unittest.TestCase):
    def test_keeps_only_visible_numeric_gaps(self) -> None:
        headers = [
            "metric_code", "metric_name", "Юнит", "трайб", "product", "тип",
            "факт", "макс балл", "metric_group", "metric_subgroup", "metric_footer",
            "is_visible", "flg",
        ]
        rows = [
            [1, "Подходит", "U", "T", "Продукт", "продукт", "0,5", 1, "G", "", "F", 1, 1],
            [2, "Достигнут максимум", "U", "T", "Продукт", "продукт", 1, 1, "G", "", "", 1, 1],
            [3, "Текст", "U", "T", "Продукт", "продукт", 0, "не релевантно", "G", "", "", 1, 1],
            [4, "Нулевой максимум", "U", "T", "Продукт", "продукт", 0, 0, "G", "", "", 1, 1],
            [5, "Скрыта", "U", "T", "Продукт", "продукт", 0, 1, "G", "", "", 0, 1],
            [6, "Не в индексе", "U", "T", "Продукт", "продукт", 0, 1, "G", "", "", 1, 0],
            [7, "Служебная", "U", "T", "Служебный", "Исключить", 0, 1, "G", "", "", 1, 1],
        ]
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "flat_table.xlsx"
            workbook = openpyxl.Workbook()
            sheet = workbook.active
            sheet.title = "Лист1"
            sheet.append(headers)
            for row in rows:
                sheet.append(row)
            workbook.save(path)

            payload = build_payload(path)

        self.assertEqual(payload["productCount"], 1)
        self.assertEqual(payload["questionCount"], 1)
        question = payload["products"][0]["questions"][0]
        self.assertEqual(question["metricName"], "Подходит")
        self.assertEqual(question["score"], 0.5)
        self.assertEqual(question["maxScore"], 1.0)
        self.assertEqual(question["question"], "")


if __name__ == "__main__":
    unittest.main()
