import unittest
import tempfile
import json
import inspect
import unicodedata
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

    def test_crosssell_is_opt_in_for_cli_and_programmatic_builds(self) -> None:
        default_args = report.parse_args([])
        enabled_args = report.parse_args(["--crosssell"])
        cached_args = report.parse_args(["--crosssell", "--no-update-crosssell"])

        self.assertFalse(default_args.crosssell)
        self.assertTrue(enabled_args.crosssell)
        self.assertTrue(enabled_args.update_crosssell)
        self.assertTrue(cached_args.crosssell)
        self.assertFalse(cached_args.update_crosssell)
        self.assertIsNone(
            inspect.signature(report.build_combined_data).parameters["crosssell_path"].default
        )

    def test_main_ignores_existing_crosssell_cache_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_path = Path(temp_dir) / "crosssell.json"
            cache_path.write_text("{}", encoding="utf-8")
            args = report.parse_args(["--skip-ai-digest", "--crosssell-json", str(cache_path)])

            with (
                patch.object(report, "parse_args", return_value=args),
                patch.object(report, "build_combined_data", return_value=({}, {})) as build,
                patch.object(report, "write_html"),
                patch("builtins.print"),
            ):
                report.main()

        self.assertIsNone(build.call_args.kwargs["crosssell_path"])

    def test_main_uses_existing_crosssell_cache_when_explicitly_enabled(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_path = Path(temp_dir) / "crosssell.json"
            cache_path.write_text("{}", encoding="utf-8")
            args = report.parse_args([
                "--skip-ai-digest",
                "--crosssell",
                "--no-update-crosssell",
                "--crosssell-json",
                str(cache_path),
            ])

            with (
                patch.object(report, "parse_args", return_value=args),
                patch.object(report, "build_combined_data", return_value=({}, {})) as build,
                patch.object(report, "write_html"),
                patch("builtins.print"),
            ):
                report.main()

        self.assertEqual(build.call_args.kwargs["crosssell_path"], cache_path)

    def test_complex_funnel_analysis_names_keep_stable_metric_codes(self) -> None:
        metric_code = report._DD_FROM_EXCEL["metric_code"]
        expected = {
            ("Воронка привлечения", "Проведение комплексного анализа воронки привлечения"): "attract.funnel_analysis",
            ("Воронка оттока", "Проведение комплексного анализа воронки оттока"): "churn.funnel_analysis",
            ("Воронка онбординга", "Проведение комплексного анализа воронки онбординга"): "voronka_onbordinga.provedenie_analiza_voronki_onbordinga",
            ("Воронка входа в канал", "Проведение комплексного анализа воронки входа в канал"): "voronka_vhoda_v_kanal.provedenie_analiza_voronki_vhoda_v_kanal",
            ("Воронка продаж", "Проведение комплексного анализа воронки продаж"): "voronka_prodazh.provedenie_analiza_voronki_prodazh",
        }

        for (group, name), code in expected.items():
            self.assertEqual(metric_code(group, name), code)

    def test_recommendation_without_difficulty_keeps_its_index_gap(self) -> None:
        rows = report._PD.DataFrame(
            [
                {
                    "recommendation_clean": "Провести анализ, выявить точки роста",
                    "recommendation_group_clean": None,
                    "value_num": 0.5,
                    "max_value_num": 1,
                }
            ]
        )

        items = report._DD_FROM_EXCEL["recommendation_items"](rows)

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["recommendation_difficulty"], 1)
        self.assertEqual(items[0]["gap"], 0.5)

    def test_pilot_campaign_links_use_the_ai_skill_dashboard(self) -> None:
        expected = "https://navigator.sigma.sbrf.ru/gdash/1000005903/1000052526"
        self.assertEqual(report.PILOT_CAMPAIGNS_URL, expected)
        self.assertEqual(
            report._DD_FROM_EXCEL["COMMON_BUTTONS"]["attract_pilot_campaigns"]["link"],
            expected,
        )
        self.assertEqual(
            report._DD_FROM_EXCEL["AI_SKILL_BUTTONS"]["attract_pilots"]["link"],
            expected,
        )

    def test_csi_link_uses_the_ai_skill_dashboard(self) -> None:
        expected = "https://navigator.sigma.sbrf.ru/gdash/1000005903/1000053756"
        self.assertEqual(report.CSI_SKILL_URL, expected)
        self.assertEqual(
            report._DD_FROM_EXCEL["AI_SKILL_BUTTONS"]["cx.csi"]["link"],
            expected,
        )

    def test_master_dash_notice_is_added_only_for_team_with_zero_coverage_fact(self) -> None:
        data = {
            "products": [
                {
                    "type": "Продукт",
                    "name": "С нулем",
                    "metrics": [
                        {
                            "code": "goals",
                            "actions": [
                                {"label": 'Отчет "Цели в мастер-деше"', "url": "https://example.test/master"},
                                {"label": "Другая ссылка", "url": "https://example.test/other"},
                            ],
                        }
                    ],
                },
                {
                    "type": "Продукт",
                    "name": "Без нуля",
                    "metrics": [
                        {
                            "code": "goals",
                            "actions": [
                                {"label": 'Отчет "Цели в мастер-деше"', "url": "https://example.test/master"},
                            ],
                        }
                    ],
                },
            ]
        }
        rows = report._PD.DataFrame(
            [
                {
                    "type": "Продукт",
                    "Продукт": "С нулем",
                    "value": 0,
                    "Column5": report.MASTER_DASH_COVERAGE_VALUE,
                },
                {
                    "type": "Продукт",
                    "Продукт": "Без нуля",
                    "value": 0.5,
                    "Column5": report.MASTER_DASH_COVERAGE_VALUE,
                },
                {
                    "type": "Продукт",
                    "Продукт": "Без нуля",
                    "value": 0,
                    "Column5": "Другое значение",
                },
            ]
        )

        count = report.add_master_dash_enrichment_notices(data, rows)

        self.assertEqual(count, 1)
        first_actions = data["products"][0]["metrics"][0]["actions"]
        second_actions = data["products"][1]["metrics"][0]["actions"]
        self.assertEqual(first_actions[0]["notice"], report.MASTER_DASH_ENRICHMENT_NOTICE)
        self.assertNotIn("notice", first_actions[1])
        self.assertNotIn("notice", second_actions[0])

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

    def test_channel_benchmarks_are_routed_to_single_funnel_without_division(self) -> None:
        rows = report._PD.DataFrame(
            [
                {
                    "entity_type": "Канал",
                    "_unit_key": "Каналы",
                    "_product_key": product,
                    "metric_group": "BENCHMARKS",
                    "metric_subgroup": "Анализ",
                    "metric_name_clean": "Наличие бенчмарков",
                    "value_num": 1.0,
                    "max_value_num": 1.0,
                    "value": 1.0,
                    "max_value": 1.0,
                }
                for product in ("ЧАТ", "Колл-центр", "Телемаркетинг")
            ]
        )

        result = report.route_benchmark_rows(rows)

        expected = {
            "ЧАТ": "Воронка входа в канал",
            "Колл-центр": "Воронка входа в канал",
            "Телемаркетинг": "Воронка продаж",
        }
        for product, target_group in expected.items():
            actual = result[result["_product_key"].eq(product)]
            self.assertEqual(actual["metric_group"].tolist(), [target_group])
            self.assertEqual(actual["value_num"].tolist(), [1.0])
            self.assertEqual(actual["max_value_num"].tolist(), [1.0])

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

    def test_regularity_max_accepts_pandas_string_dtype(self) -> None:
        frame = report._PD.DataFrame(
            {
                "metric_group": ["Воронка продаж"],
                "metric_name_clean": ["Регулярность"],
                "value": report._PD.Series(["0.5"], dtype="string"),
                "max_value_num": [float("nan")],
                "max_value": report._PD.Series([report._PD.NA], dtype="string"),
            }
        )

        report.fill_auto_regularity_max_from_value(frame)

        self.assertEqual(frame.at[0, "max_value_num"], 1.0)
        self.assertEqual(frame.at[0, "max_value"], 1.0)
        self.assertEqual(frame["max_value"].dtype, object)

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

    def test_crosssell_export_enriches_all_common_dd_products(self) -> None:
        data = {
            "products": [
                {
                    "name": "ОСАГО",
                    "unit": "УБ",
                    "type": "Продукт",
                    "metrics": [{"code": "mehaniki", "tools": [], "metrics": [
                        {"code": "mehaniki.cross_sell", "value": 0, "max_value": 1},
                    ]}],
                    "metric_recommendations": [],
                },
                {
                    "name": "Сделка ИЖС",
                    "unit": "ДомКлик",
                    "type": "Продукт",
                    "metrics": [{"code": "mehaniki", "tools": [], "metrics": []}],
                    "metric_recommendations": [],
                },
                {
                    "name": "СБОЛ",
                    "unit": "DP",
                    "type": "Канал",
                    "metrics": [{"code": "mehaniki", "tools": [], "metrics": []}],
                    "metric_recommendations": [],
                },
            ]
        }
        export = {
            "markers_response": {
                "meta": {
                    "status": "ok",
                    "round_id": "round-1",
                    "generated_at": "2026-07-16T22:01:25+00:00",
                    "schema_version": 1,
                    "validation": "ok",
                },
                "markers": [
                    {
                        "id": "ОСАГО",
                        "name": "ОСАГО",
                        "unit": "УБ",
                        "cross_sell": {
                            "traffic_light": "red",
                            "etalon_pairs": 3,
                            "implemented": 1,
                            "missing_ab_ready": 2,
                            "top_actions": [
                                {
                                    "text": "Добавить в путь: → КАСКО",
                                    "market_example": "Т-Банк",
                                }
                            ],
                            "deeplink": "cross-sell-analytics.html#product=осаго",
                        },
                    }
                ],
            },
            "products_response": {
                "meta": {"status": "ok", "round_id": "round-1"},
                "products": [
                    {"uid": "осаго", "key": "осаго", "name": "ОСАГО", "unit": "УБ", "light": "yellow", "covered": True},
                    {"uid": "сделка ижс", "key": "сделка ижс", "name": "Сделка ИЖС", "unit": "ДомКлик", "light": "green", "covered": False},
                    {"uid": "сбол", "key": "сбол", "name": "СБОЛ", "unit": "DP", "light": "green", "covered": True},
                ],
            },
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            export_path = Path(temp_dir) / "crosssell.json"
            export_path.write_text(json.dumps(export, ensure_ascii=False), encoding="utf-8")
            result = report.apply_crosssell_export(data, export_path)

        self.assertEqual(result["crosssell"]["matched_products"], 2)
        self.assertEqual(result["crosssell"]["matched_markers"], 1)
        self.assertEqual(result["crosssell"]["catalog_fallbacks"], 1)
        self.assertEqual(result["crosssell"]["manual_validation_count"], 1)
        osago = result["products"][0]
        osago_recommendation = osago["metric_recommendations"][0]
        self.assertEqual(osago_recommendation["skill_key"], "cross_sell")
        self.assertEqual(osago_recommendation["traffic_light"], "yellow")
        self.assertIn("Реализовано cross-sell связок: 1 из 3.", osago_recommendation["recommendations"])
        self.assertIn("Рыночный пример: Т-Банк.", osago_recommendation["recommendations"][-1])
        self.assertTrue(osago_recommendation["requires_manual_validation"])
        self.assertEqual(osago_recommendation["dd_crosssell_value"], 0)
        self.assertEqual(osago_recommendation["dd_crosssell_max"], 1)
        self.assertEqual(osago_recommendation["api_implemented"], 1)
        self.assertEqual(osago_recommendation["api_crosssell_count"], 3)
        osago_tool = osago["metrics"][0]["tools"][0]
        self.assertEqual(osago_tool["ai_tool_key"], "cross_sell")
        self.assertEqual(
            osago_tool["button"]["link"],
            "https://losshunter.ru/showcase/crosssell/#product=%D0%BE%D1%81%D0%B0%D0%B3%D0%BE",
        )
        fallback = result["products"][1]["metric_recommendations"][0]
        self.assertFalse(fallback["crosssell_marker"])
        self.assertEqual(fallback["traffic_light"], "green")
        self.assertFalse(fallback["requires_manual_validation"])
        self.assertIn("Дозаписать видео пути продукта", fallback["recommendations"][0])
        fallback_tool = result["products"][1]["metrics"][0]["tools"][0]
        self.assertEqual(fallback_tool["traffic_light"], "green")
        self.assertEqual(
            fallback_tool["button"]["link"],
            "https://losshunter.ru/showcase/crosssell/#product=%D1%81%D0%B4%D0%B5%D0%BB%D0%BA%D0%B0%20%D0%B8%D0%B6%D1%81",
        )
        self.assertEqual(result["products"][2]["metric_recommendations"], [])

    def test_crosssell_matching_uses_nfc_casefold(self) -> None:
        composed = "СберПрайм"
        decomposed = unicodedata.normalize("NFD", composed.upper())
        index = report.crosssell_items_by_name([{"name": composed, "unit": "УБ"}])

        self.assertEqual(report.find_crosssell_item(index, decomposed, "уб")["name"], composed)

    def test_crosssell_absolute_deeplink_is_preserved(self) -> None:
        absolute = "https://product-lens.example/cross-sell#product=осаго"
        marker = {"cross_sell": {"deeplink": absolute}}

        self.assertEqual(
            report.crosssell_analytics_link(marker, {"name": "ОСАГО"}),
            absolute,
        )

    def test_crosssell_catalog_uid_wins_over_ambiguous_marker_key(self) -> None:
        marker = {
            "cross_sell": {
                "deeplink": "cross-sell-analytics.html#product=сберпэй",
            }
        }
        catalog_product = {
            "uid": "сберпэй-49",
            "key": "сберпэй",
            "name": "SberPay NFC",
        }

        self.assertEqual(
            report.crosssell_analytics_link(marker, catalog_product),
            "https://losshunter.ru/showcase/crosssell/#product=%D1%81%D0%B1%D0%B5%D1%80%D0%BF%D1%8D%D0%B9-49",
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

    def test_pilots_digest_uses_quarter_summary_format(self) -> None:
        product = "Тестовый продукт"
        rows = [
            {
                "skill_key": "pilots",
                "product_key": report.normalize_ai_product_key(product),
                "indicator": indicator,
                "month_sort": (2026, 3, ""),
                "text": value,
            }
            for indicator, value in (
                ("Всего пилотов", "12"),
                ("Запущено", "9"),
                ("Значимых", "5"),
                ("Значимые запуски", "3"),
                ("Self-service", "4"),
            )
        ]

        digest = report.build_pilots_digest(rows, [product])

        self.assertIsNotNone(digest)
        self.assertEqual(
            digest["digest_texts"],
            [
                "В рамках первого квартала (январь-март 2026) было запущено 12 пилотов.",
                "Из них:",
                "- 9 запущено",
                "- 5 значимых",
                "- 3 успешных",
                "Из 12 пилотов, было 4 Self-Service запусков.",
            ],
        )

    def test_pilots_digest_sums_counts_across_mapped_ai_products(self) -> None:
        mapped_products = ["Вклад", "Накопительный счет"]
        values_by_product = {
            "Вклад": (12, 3, 2, 1, 4),
            "Накопительный счет": (9, 7, 4, 3, 2),
            "Несметченный продукт": (100, 100, 100, 100, 100),
        }
        indicators = (
            "Всего пилотов",
            "Запущено",
            "Значимых",
            "Успешных",
            "Self-service",
        )
        rows = [
            {
                "skill_key": "pilots",
                "product_key": report.normalize_ai_product_key(product),
                "indicator": indicator,
                "month_sort": (2026, 3, ""),
                "text": str(value),
            }
            for product, values in values_by_product.items()
            for indicator, value in zip(indicators, values)
        ]

        digest = report.build_pilots_digest(rows, mapped_products)

        self.assertIsNotNone(digest)
        self.assertEqual(
            digest["digest_texts"],
            [
                "В рамках первого квартала (январь-март 2026) было запущено 21 пилотов.",
                "Из них:",
                "- 10 запущено",
                "- 6 значимых",
                "- 4 успешных",
                "Из 21 пилотов, было 6 Self-Service запусков.",
            ],
        )
        self.assertEqual(digest["ai_tool_product_names"], mapped_products)

    def test_pilot_counts_use_one_snapshot_per_normalized_product(self) -> None:
        rows = [
            {
                "product_key": "кредитныйпотенциал",
                "indicator": "Запущено",
                "month_sort": (2026, 3, ""),
                "text": value,
                "source_order": source_order,
            }
            for value, source_order in (("8", 10), ("11", 20))
        ]

        self.assertEqual(
            report.pilot_metric_value_for_month(rows, "launched", (2026, 3)),
            11,
        )

    def test_pilot_successful_metric_aliases(self) -> None:
        for indicator in (
            "Значимые запуски",
            "Успешных",
            "Успешные запуски",
        ):
            with self.subTest(indicator=indicator):
                self.assertEqual(report.pilot_metric_key({"indicator": indicator}), "successful")

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
