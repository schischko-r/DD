import tempfile
import unittest
from pathlib import Path

import build_calc_report as report


class SyntheticReportTest(unittest.TestCase):
    def test_goals_copy_and_tool_group_layout(self) -> None:
        data = {
            "products": [
                {
                    "id": "synthetic-product",
                    "name": "Синтетический продукт",
                    "type": "Продукт",
                    "unit": "Тестовый юнит",
                    "metrics": [
                        {
                            "code": "goals",
                            "name": "Цели",
                            "tools": [{"name": "Навык «Цели»", "button": {"label": "TBD", "link": ""}}],
                            "metrics": [
                                {
                                    "code": "goals.monitored",
                                    "name": "Цели выведены на мониторинг",
                                    "footer": "Регулярное обновление в Навигаторе",
                                    "value": 0,
                                    "max_value": 1,
                                    "is_applicabble_flg": True,
                                }
                            ],
                            "actions": [
                                {"label": 'Отчет "Цели в мастер-деше"', "url": "https://example.test/goals"}
                            ],
                        },
                        {
                            "code": "attract",
                            "name": "Воронка привлечения",
                            "tools": [
                                {
                                    "name": "Группа навыков «Привлечение»",
                                    "kind": "ai",
                                    "buttons": [
                                        {
                                            "name": "Пилотные кампании",
                                            "button": {"label": "Перейти", "link": "https://example.test/pilots"},
                                            "digest_texts": ["Синтетическая рекомендация"],
                                            "digest_items": [
                                                {
                                                    "indicator": "Пилоты",
                                                    "digest_texts": ["Синтетическая рекомендация"],
                                                }
                                            ],
                                        },
                                        {
                                            "name": "Воронка кампейнинга",
                                            "button": {"label": "Перейти", "link": "https://example.test/funnel"},
                                        },
                                    ],
                                }
                            ],
                            "metrics": [],
                        },
                    ],
                }
            ],
            "title": {
                "rows": [
                    {
                        "id": "synthetic-product",
                        "name": "Синтетический продукт",
                        "unit": "Тестовый юнит",
                        "type": "Продукт",
                        "score": 0,
                        "group": "Тест",
                        "order": 0,
                    }
                ],
                "units": ["Тестовый юнит"],
                "types": ["Продукт"],
                "avgScore": 0,
            },
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "synthetic-report.html"
            report.write_html(data, output)
            html = output.read_text(encoding="utf-8")

        self.assertIn("Для мониторинга целей используйте мастер-деш вашего юнита.", html)
        self.assertIn("Для его обогащения обратитесь в штаб юнита.", html)
        self.assertIn("Отчетность по блоку:", html)
        self.assertIn("ai-digest-toggle-spacer", html)
        self.assertIn("grid-template-columns: 22px 10px minmax(0, 1fr) auto", html)
        self.assertIn("Синтетическая рекомендация", html)


if __name__ == "__main__":
    unittest.main()
