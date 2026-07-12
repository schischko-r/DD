import unittest
import tempfile
from pathlib import Path

import build_calc_report as report


class SyntheticReportTest(unittest.TestCase):
    def test_metric_recommendations_use_mapping_without_dd_block(self) -> None:
        rows = [
            {
                "skill_name": "CSI",
                "skill_key": "csi",
                "month": "2026-06",
                "month_label": "Июнь 2026",
                "month_sort": (2026, 6, ""),
                "product": "AI Segment",
                "product_key": report.normalize_ai_product_key("AI Segment"),
                "indicator": "CSI",
                "row_type": "recommendation",
                "color": "red",
                "text": "Разобрать причины снижения CSI",
                "rule": "Красный ниже целевого значения",
                "source_order": 1,
            }
        ]
        mapping = {
            (report.normalize_mapping_key("DD Segment"), "csi"): ["AI Segment"]
        }
        digest_index = report.build_ai_digest_index(rows)

        result = report.build_metric_recommendations(
            "DD Segment", rows, mapping, digest_index
        )

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["skill_key"], "csi")
        self.assertEqual(result[0]["block_code"], "cx")
        self.assertFalse(result[0]["is_traffic_light"])
        self.assertEqual(result[0]["traffic_light"], "red")
        self.assertEqual(
            result[0]["recommendations"], ["Разобрать причины снижения CSI"]
        )

    def test_metric_recommendations_keep_item_product_scope(self) -> None:
        rows = []
        for order, product in enumerate(("Вклад", "Накопительные счета"), start=1):
            rows.append(
                {
                    "skill_name": "Ключевые метрики",
                    "skill_key": "client_metrics",
                    "month": "2026-06",
                    "month_label": "Июнь 2026",
                    "month_sort": (2026, 6, ""),
                    "product": product,
                    "product_key": report.normalize_ai_product_key(product),
                    "indicator": "MAU",
                    "row_type": "светофор",
                    "color": "yellow",
                    "text": f"Проверить MAU: {product}",
                    "rule": "Жёлтый при отклонении",
                    "source_order": order,
                }
            )
        mapping = {
            (report.normalize_mapping_key("Вклады+НС"), "client_metrics"): [
                "Вклад",
                "Накопительные счета",
            ]
        }
        result = report.build_metric_recommendations(
            "Вклады+НС", rows, mapping, report.build_ai_digest_index(rows)
        )

        self.assertEqual(
            {tuple(item["ai_products"]) for item in result},
            {("Вклад",), ("Накопительные счета",)},
        )

    def test_deposit_metric_product_aliases_use_two_user_facing_groups(self) -> None:
        deposit = "\u0412\u043a\u043b\u0430\u0434\u044b+\u041d\u0421"

        self.assertEqual(
            report.metric_recommendation_product_group(
                deposit, ["\u0412\u043a\u043b\u0430\u0434", "\u0412\u043a\u043b\u0430\u0434\u044b, \u0440\u0443\u0431."]
            ),
            "\u0412\u043a\u043b\u0430\u0434\u044b",
        )
        self.assertEqual(
            report.metric_recommendation_product_group(
                deposit,
                [
                    "\u041d\u0430\u043a\u043e\u043f\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u0441\u0447\u0435\u0442",
                    "\u041d\u0430\u043a\u043e\u043f\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u0441\u0447\u0435\u0442 (\u043f\u043e\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435)",
                ],
            ),
            "\u041d\u0430\u043a\u043e\u043f\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0441\u0447\u0435\u0442\u0430",
        )

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
        self.assertIn(".ai-digest-item.no-light", html)
        self.assertIn("ai-digest-item${hasTrafficLight ? '' : ' no-light'}", html)
        self.assertIn("AI-рекомендации пока недоступны: для продукта нет данных в AI-digest.", html)
        self.assertIn(".block-note.tool-group > .note-copy", html)
        self.assertIn("Синтетическая рекомендация", html)


if __name__ == "__main__":
    unittest.main()
