import unittest
import tempfile
from pathlib import Path

import build_calc_report as report


class SyntheticReportTest(unittest.TestCase):
    def test_remove_ai_skills_keeps_regular_tools(self) -> None:
        data = {
            "ai_skill_digest": {"rows": 2},
            "products": [{"metrics": [{"tools": [
                {"name": "Навык «Цели»", "kind": "ai"},
                {"name": "Группа навыков «Привлечение»", "buttons": [{"ai_tool_key": "pilots"}]},
                {"name": "Отчетность", "button": {"label": "Перейти", "link": "https://example.test"}},
            ]}]}],
        }

        result = report.remove_ai_skills(data)

        self.assertNotIn("ai_skill_digest", result)
        self.assertEqual(
            [tool["name"] for tool in result["products"][0]["metrics"][0]["tools"]],
            ["Отчетность"],
        )

    def test_no_ai_report_has_recommendation_accent(self) -> None:
        data = {
            "ai_skills_enabled": False,
            "products": [],
            "title": {"rows": [], "units": [], "types": [], "avgScore": 0},
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "no-ai-report.html"
            report.write_html(data, output)
            html = output.read_text(encoding="utf-8")

        self.assertIn('class="report-action-panel no-ai-skills"', html)
        self.assertIn("Мы подготовили для вас AI-рекомендации по вашим ключевым метрикам", html)
        self.assertIn("linear-gradient(135deg, rgba(255,149,0,.22)", html)

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
        self.assertIn("'Набрано ' + fmt(block.earned) + ' баллов из ' + fmt(block.max)", html)
        self.assertIn("compact: true", html)
        self.assertIn('id="detailCompactBtn" class="active"', html)
        self.assertIn("Отчетность по блоку:", html)
        self.assertIn("ai-digest-toggle-spacer", html)
        self.assertIn("grid-template-columns: 22px 10px minmax(0, 1fr) auto", html)
        self.assertIn("AI-рекомендации пока недоступны: для продукта нет данных в AI-digest.", html)
        self.assertIn(".block-note.tool-group > .note-copy", html)
        self.assertIn("Синтетическая рекомендация", html)


if __name__ == "__main__":
    unittest.main()
