import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch

import build_calc_report as report


class SyntheticReportTest(unittest.TestCase):
    @staticmethod
    def flat_row(**overrides):
        row = {
            "metric_code": 1,
            "metric_name": "Тестовая метрика",
            "Юнит": "СХ",
            "трайб": "Тестовый трайб",
            "product": "Тестовый продукт",
            "макс балл": 1,
            "факт": 0,
            "metric_group": "Цели",
            "Column4": "продукт",
            "Column5": None,
            "metric_subgroup": None,
            "metric_footer": "Описание",
            "recommendation": "Рекомендация",
            "recommendation_group": 1,
            "sort": 1,
            "flg": 1,
            "is_visible": 1,
        }
        row.update(overrides)
        return row

    def test_cyrillic_cx_unit_is_normalized_to_latin(self) -> None:
        self.assertEqual(report.normalize_upload_unit("CX"), "CX")
        self.assertEqual(report.normalize_upload_unit("СХ"), "CX")

    def test_metric_blocks_follow_requested_display_order(self) -> None:
        blocks = [
            {"code": "cx"},
            {"code": "unknown_first"},
            {"code": "alerts"},
            {"code": "voronka_prodazh"},
            {"code": "churn"},
            {"code": "general"},
            {"code": "hyp"},
            {"code": "voronka_onbordinga"},
            {"code": "mehaniki"},
            {"code": "goals"},
            {"code": "attract"},
            {"code": "voronka_vhoda_v_kanal"},
            {"code": "unknown_second"},
        ]

        self.assertEqual(
            [block["code"] for block in report.sort_metric_blocks(blocks)],
            [
                "general",
                "goals",
                "attract",
                "churn",
                "voronka_vhoda_v_kanal",
                "voronka_onbordinga",
                "voronka_prodazh",
                "alerts",
                "mehaniki",
                "hyp",
                "cx",
                "unknown_first",
                "unknown_second",
            ],
        )

    def test_single_funnel_benchmark_is_split_between_attract_and_churn(self) -> None:
        rows = report._PD.DataFrame(
            [
                {
                    "entity_type": "продукт",
                    "_unit_key": "Юнит",
                    "_product_key": "Продукт",
                    "metric_group": "Воронка оттока",
                    "metric_name_clean": "Наличие бенчмарков",
                    "value_num": 1.0,
                    "max_value_num": 1.0,
                    "value": 1.0,
                    "max_value": 1.0,
                },
                {
                    "entity_type": "продукт",
                    "_unit_key": "Юнит",
                    "_product_key": "Продукт",
                    "metric_group": "Алерты",
                    "metric_name_clean": "Контрольная метрика",
                    "value_num": 1.0,
                    "max_value_num": 1.0,
                    "value": 1.0,
                    "max_value": 1.0,
                },
            ]
        )

        result = report.split_named_funnel_benchmarks(rows)
        benchmarks = result[
            result["metric_name_clean"].eq("Наличие бенчмарков")
        ].sort_values("metric_group")

        self.assertEqual(
            set(benchmarks["metric_group"]),
            {"Воронка привлечения", "Воронка оттока"},
        )
        self.assertEqual(benchmarks["value_num"].tolist(), [0.5, 0.5])
        self.assertEqual(benchmarks["max_value_num"].tolist(), [0.5, 0.5])
        self.assertEqual(result.attrs["named_benchmark_rows_split"], 1)
        self.assertEqual(len(result[result["metric_group"].eq("Алерты")]), 1)

    def test_benchmarks_group_is_split_into_analysis_subgroups(self) -> None:
        frame = report._PD.DataFrame(
            [
                self.flat_row(
                    metric_code=15,
                    metric_name="Наличие бенчмарков",
                    metric_group="BENCHMARKS",
                    metric_subgroup=None,
                    факт=1,
                )
            ]
        )

        normalized = report.normalize_flat_table_frame(frame)
        rows = report.normalize_flat_metric_rows(normalized)
        data, _ = report.build_report_data_from_metric_rows(rows, "Тест")
        data = report.enrich_metric_layout(
            data,
            Path("unused.xlsx"),
            "Лист1",
            metric_rows=rows,
        )
        benchmarks = [
            metric
            for block in data["products"][0]["metrics"]
            for metric in block["metrics"]
            if metric["name"] == "Наличие бенчмарков"
        ]

        self.assertEqual(
            set(rows["metric_group"]),
            {"Воронка привлечения", "Воронка оттока"},
        )
        self.assertEqual(set(rows["metric_subgroup"]), {"Анализ"})
        self.assertEqual(len(benchmarks), 2)
        self.assertTrue(all(metric["metric_subgroup"] == "Анализ" for metric in benchmarks))

    def test_channel_upload_frame_is_normalized_as_channels(self) -> None:
        frame = report._PD.DataFrame(
            [
                {
                    "metric_code": 6,
                    "metric_name": "Цели выведены на мониторинг",
                    "product": "СБОЛ",
                    "макс балл": 1,
                    "факт": 1,
                    "metric_group": "Цели",
                    "metric_footer": "Мониторинг",
                    "recommendation": "Настроить мониторинг",
                    "recommendation_group": 1,
                }
            ]
        )

        result = report.normalize_channel_upload_frame(frame)

        self.assertEqual(result.loc[0, "Продукт"], "СБОЛ")
        self.assertEqual(result.loc[0, "Юнит"], "Каналы")
        self.assertEqual(result.loc[0, "type"], "Канал")
        self.assertEqual(result.loc[0, "metric"], 6)
        self.assertEqual(result.loc[0, "value"], 1)
        self.assertEqual(result.loc[0, "max_value"], 1)

    def test_flat_table_derives_types_without_artificial_channels_unit(self) -> None:
        frame = report._PD.DataFrame(
            [
                self.flat_row(product="Обычный продукт", Column4="продукт"),
                self.flat_row(product="Канал", Юнит="DP", Column4="канал"),
                self.flat_row(product="Сегмент", Column4=None),
            ]
        )

        result = report.normalize_flat_table_frame(frame)

        types = result.groupby("Продукт")["type"].first().to_dict()
        self.assertEqual(types["Обычный продукт"], "продукт")
        self.assertEqual(types["Канал"], "Канал")
        self.assertEqual(types["Сегмент"], "Сегмент")
        self.assertEqual(result.loc[result["Продукт"].eq("Канал"), "Юнит"].iloc[0], "DP")

    def test_flat_table_uses_explicit_cyrillic_type_and_filters_other_types(self) -> None:
        frame = report._PD.DataFrame(
            [
                self.flat_row(product="Продукт", тип="продукт", Column4=None),
                self.flat_row(product="Сегмент", тип="Сегмент", Column4="продукт"),
                self.flat_row(product="Канал", тип="Канал", Column4=None),
                self.flat_row(product="ДЗО", тип="ДЗО", Column4="продукт"),
                self.flat_row(product="Исключить", тип="Исключить", Column4="продукт"),
                self.flat_row(product="Без типа", тип=None, Column4="продукт"),
            ]
        )

        result = report.normalize_flat_table_frame(frame)

        self.assertEqual(
            result.groupby("Продукт")["type"].first().to_dict(),
            {"Продукт": "продукт", "Сегмент": "Сегмент", "Канал": "Канал"},
        )

    def test_flat_table_on_single_sheet_keeps_all_report_entity_types(self) -> None:
        frame = report._PD.DataFrame(
            [
                self.flat_row(product="Продукт", тип="продукт"),
                self.flat_row(product="Сегмент", тип="Сегмент"),
                self.flat_row(product="Канал", тип="Канал"),
            ]
        )

        with patch.object(report._PD, "read_excel", return_value=frame):
            result = report.flat_upload_sheet(
                Path("flat_table.xlsx"),
                "Лист1",
                allowed_entity_types=report.PRODUCT_ENTITY_TYPES,
            )

        self.assertEqual(set(result["type"]), {"продукт", "Сегмент", "Канал"})

    def test_flat_table_flg_is_the_only_rating_inclusion_rule(self) -> None:
        frame = report._PD.DataFrame(
            [
                self.flat_row(metric_code=3, metric_name="Одинаковое имя", факт=0, flg=1),
                self.flat_row(metric_code=4, metric_name="Одинаковое имя", факт=1, flg=1),
                self.flat_row(
                    metric_code=3,
                    metric_name="Одинаковое имя",
                    факт=7,
                    **{"макс балл": 10, "flg": 0},
                ),
                self.flat_row(
                    metric_code=43,
                    metric_name="A/B-тесты",
                    metric_group="Гипотезы и инициативы",
                    факт=1,
                    flg=1,
                ),
            ]
        )
        normalized = report.normalize_flat_table_frame(frame)
        rows = report.normalize_flat_metric_rows(normalized)
        data, summary = report.build_report_data_from_metric_rows(rows, "Тест")
        title = report.upload_title_from_products(data["products"])

        metrics = [
            metric
            for block in data["products"][0]["metrics"]
            for metric in block["metrics"]
        ]
        same_name = [metric for metric in metrics if metric["name"] == "Одинаковое имя"]
        ab_test = next(metric for metric in metrics if metric["name"] == "A/B-тесты")

        self.assertEqual(len(same_name), 2)
        self.assertEqual(sorted(metric["dd_calculation_flg"] for metric in same_name), [0, 1])
        self.assertEqual(sum(bool(metric.get("excluded_from_index")) for metric in same_name), 1)
        included = next(metric for metric in same_name if metric["dd_calculation_flg"] == 1)
        display_only = next(metric for metric in same_name if metric["dd_calculation_flg"] == 0)
        self.assertEqual((included["value"], included["max_value"]), (1, 2))
        self.assertEqual((display_only["value"], display_only["max_value"]), (7, 10))
        self.assertFalse(ab_test["excluded_from_index"])
        self.assertTrue(ab_test["is_applicabble_flg"])
        self.assertNotIn("tbd", ab_test)
        self.assertEqual(ab_test["value"], 1)
        self.assertEqual(ab_test["max_value"], 1)
        self.assertEqual(title["rows"][0]["score"], 67)
        self.assertEqual(title["rows"][0]["unit"], "CX")
        self.assertEqual(summary["flg_excluded_metrics"], 1)

    def test_flat_table_keeps_duplicate_display_only_rows_separate(self) -> None:
        frame = report._PD.DataFrame(
            [
                self.flat_row(metric_code=3, metric_name="Подсказка", факт=1, flg=0),
                self.flat_row(metric_code=3, metric_name="Подсказка", факт=2, flg=0),
            ]
        )

        normalized = report.normalize_flat_table_frame(frame)
        rows = report.normalize_flat_metric_rows(normalized)
        data, summary = report.build_report_data_from_metric_rows(rows, "Тест")
        metrics = data["products"][0]["metrics"][0]["metrics"]

        self.assertEqual([metric["name"] for metric in metrics], ["Подсказка", "Подсказка"])
        self.assertEqual([metric["value"] for metric in metrics], [1, 2])
        self.assertTrue(all(metric["excluded_from_index"] for metric in metrics))
        self.assertEqual(summary["flg_excluded_metrics"], 2)

    def test_flat_table_removes_invisible_rows_before_aggregation(self) -> None:
        frame = report._PD.DataFrame(
            [
                self.flat_row(metric_code=3, metric_name="Расчет", факт=1, flg=1),
                self.flat_row(
                    metric_code=4,
                    metric_name="Расчет",
                    факт=100,
                    **{"макс балл": 100, "flg": 1, "is_visible": 0},
                ),
                self.flat_row(
                    metric_code=5,
                    metric_name="Потребности",
                    metric_group=None,
                    факт=5,
                    flg=0,
                    is_visible=0,
                ),
            ]
        )

        normalized = report.normalize_flat_table_frame(frame)
        rows = report.normalize_flat_metric_rows(normalized)
        data, summary = report.build_report_data_from_metric_rows(rows, "Тест")
        metrics = data["products"][0]["metrics"][0]["metrics"]

        self.assertEqual([metric["name"] for metric in metrics], ["Расчет"])
        self.assertNotIn(
            "Потребности",
            [
                metric["name"]
                for block in data["products"][0]["metrics"]
                for metric in block["metrics"]
            ],
        )
        self.assertEqual((metrics[0]["value"], metrics[0]["max_value"]), (1, 1))
        self.assertEqual(summary["visibility_hidden_rows"], 2)

    def test_flat_table_display_only_text_without_group_stays_visible(self) -> None:
        frame = report._PD.DataFrame(
            [
                self.flat_row(
                    metric_code=37,
                    metric_name="Потребности",
                    metric_group=None,
                    metric_footer=None,
                    **{"макс балл": "Нужна автоматизация отчетности", "факт": None, "flg": 0},
                )
            ]
        )

        normalized = report.normalize_flat_table_frame(frame)
        rows = report.normalize_flat_metric_rows(normalized)
        data, summary = report.build_report_data_from_metric_rows(rows, "Тест")
        metric = data["products"][0]["metrics"][0]["metrics"][0]

        self.assertEqual(metric["name"], "Потребности")
        self.assertEqual(metric["footer"], "Нужна автоматизация отчетности")
        self.assertEqual(metric["dd_calculation_flg"], 0)
        self.assertTrue(metric["excluded_from_index"])
        self.assertEqual(summary["flg_display_only_rows"], 1)

    def test_flat_table_uses_numeric_regularity_fact_as_share(self) -> None:
        frame = report._PD.DataFrame(
            [
                self.flat_row(
                    metric_code=103,
                    metric_name="Регулярность",
                    metric_group="Воронка онбординга",
                    факт=0.5,
                    **{"макс балл": None, "flg": 0},
                ),
                self.flat_row(
                    metric_code=210,
                    metric_name="Регулярность",
                    metric_group="Воронка продаж",
                    факт="не релевантно",
                    **{"макс балл": None, "flg": 0},
                ),
            ]
        )

        normalized = report.normalize_flat_table_frame(frame)
        rows = report.normalize_flat_metric_rows(normalized)
        data, _ = report.build_report_data_from_metric_rows(rows, "Тест")
        metrics = [
            metric
            for block in data["products"][0]["metrics"]
            for metric in block["metrics"]
        ]
        numeric = next(metric for metric in metrics if metric["value"] == 0.5)
        not_relevant = next(metric for metric in metrics if metric["footer"] == "Описание" and metric["value"] == 0)

        self.assertEqual(numeric["max_value"], 1)
        self.assertTrue(numeric["is_applicabble_flg"])
        self.assertTrue(numeric["excluded_from_index"])
        self.assertEqual(not_relevant["max_value"], 0)
        self.assertFalse(not_relevant["is_applicabble_flg"])

    def test_flat_table_rejects_invalid_flg_for_metric_rows(self) -> None:
        frame = report._PD.DataFrame([self.flat_row(flg=2)])
        normalized = report.normalize_flat_table_frame(frame)

        with self.assertRaisesRegex(ValueError, "flg должно быть 0 или 1"):
            report.normalize_flat_metric_rows(normalized)

    def test_requested_channel_metrics_are_excluded_from_index(self) -> None:
        excluded_ids = sorted(report.CHANNEL_EXCLUDED_METRIC_IDS)
        metric_names = [f"Метрика {metric_id}" for metric_id in excluded_ids]
        rows = report._PD.DataFrame(
            {
                "metric_id_num": [*excluded_ids, 999],
                "metric_group": ["Тестовый блок"] * (len(excluded_ids) + 1),
                "metric_name_clean": [*metric_names, "Контрольная метрика"],
            }
        )
        block_code, _ = report._DD_FROM_EXCEL["block_info"]("Тестовый блок")
        excluded_codes = [
            report._DD_FROM_EXCEL["metric_code"]("Тестовый блок", name)
            for name in metric_names
        ]
        included_code = report._DD_FROM_EXCEL["metric_code"](
            "Тестовый блок", "Контрольная метрика"
        )
        product = {
            "type": "Канал",
            "metrics": [
                {
                    "code": block_code,
                    "metrics": [
                        *[{"code": code} for code in excluded_codes],
                        {"code": included_code},
                    ],
                }
            ],
        }

        report.mark_channel_metrics_excluded(product, rows)

        metrics = product["metrics"][0]["metrics"]
        self.assertTrue(all(metric["excluded_from_index"] for metric in metrics[:-1]))
        self.assertNotIn("excluded_from_index", metrics[-1])

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
                ["\u041d\u0430\u043a\u043e\u043f\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u0441\u0447\u0435\u0442"],
            ),
            "\u041d\u0430\u043a\u043e\u043f\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0441\u0447\u0435\u0442\u0430",
        )
        self.assertEqual(
            report.metric_recommendation_product_group(
                deposit,
                ["\u041d\u0430\u043a\u043e\u043f\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u0441\u0447\u0435\u0442 (\u043f\u043e\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435)"],
            ),
            "\u041d\u0430\u043a\u043e\u043f\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0441\u0447\u0435\u0442\u0430 (\u043f\u043e\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435)",
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
