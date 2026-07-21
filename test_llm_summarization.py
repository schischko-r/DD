import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import build_calc_report as report
import llm_summarization


class LlmSummarizationTest(unittest.TestCase):
    def test_parallel_llm_tasks_use_four_slots_and_isolate_errors(self) -> None:
        lock = threading.Lock()
        first_wave = threading.Barrier(4)
        active = 0
        max_active = 0

        def task(index):
            def run():
                nonlocal active, max_active
                with lock:
                    active += 1
                    max_active = max(max_active, active)
                if index < 4:
                    first_wave.wait(timeout=1)
                with lock:
                    active -= 1
                if index == 2:
                    raise RuntimeError("failed task")
                return index

            return run

        results = llm_summarization.run_parallel_llm_tasks(
            [task(index) for index in range(8)]
        )

        self.assertEqual(max_active, 4)
        self.assertEqual([value for value, _ in results], [0, 1, None, 3, 4, 5, 6, 7])
        self.assertIsInstance(results[2][1], RuntimeError)

    def test_digest_candidates_are_sent_to_llm_in_parallel(self) -> None:
        products = [
            {"name": f"Product {index}", "metrics": [{"code": "attract"}]}
            for index in range(8)
        ]
        mapping = {
            (report.normalize_mapping_key(product["name"]), "drafts"): ["Mapped"]
            for product in products
        }
        lock = threading.Lock()
        active = 0
        max_active = 0

        def build_summary(*args, **kwargs):
            nonlocal active, max_active
            with lock:
                active += 1
                max_active = max(max_active, active)
            time.sleep(0.03)
            with lock:
                active -= 1
            return {"summary": "Done", "traffic_light": "green"}

        with (
            patch.object(report, "AI_SKILL_ORDER", ("drafts",)),
            patch.object(report, "read_ai_digest_rows", return_value=[{}]),
            patch.object(report, "read_ai_product_mapping", return_value=mapping),
            patch.object(
                report,
                "build_ai_digest_index",
                return_value={
                    ("drafts", report.normalize_ai_product_key("Mapped")): {
                        "traffic_light": "green"
                    }
                },
            ),
            patch.object(report, "build_metric_recommendations", return_value=[]),
            patch.object(report, "aggregate_ai_digests", return_value={"traffic_light": "green"}),
            patch.object(report, "digest_display_payload", return_value={}),
            patch.object(report, "update_ai_tool", return_value=True),
            patch.object(report, "append_llm_summary_to_group", return_value=True),
            patch.object(report, "gigachat_is_configured", return_value=True),
            patch.object(report, "build_llm_summary", side_effect=build_summary),
        ):
            result = report.apply_ai_skill_digest(
                {"products": products},
                Path("digest.xlsx"),
                Path("mapping.xlsx"),
                update_llm_summary=True,
                llm_log=False,
            )

        self.assertEqual(max_active, 4)
        self.assertEqual(result["ai_skill_digest"]["llm_summaries"], 8)

    def test_builder_keeps_public_compatibility_names(self) -> None:
        for name in (
            "gigachat_is_configured",
            "make_gigachat",
            "run_gigachat",
            "llm_log_write",
            "llm_log_event",
            "extract_json_object",
            "llm_summary_input",
            "normalize_llm_summary",
            "build_llm_summary",
            "append_llm_summary_to_group",
            "ensure_llm_summary_placeholder",
            "ensure_llm_summary_visible",
            "sync_llm_summary_recommendations",
        ):
            self.assertTrue(callable(getattr(report, name)))
        self.assertTrue(callable(llm_summarization.build_llm_summary))
        self.assertEqual(
            report.LLM_ATTRACT_SUMMARY_PROMPT,
            llm_summarization.DEFAULT_ATTRACT_SUMMARY_PROMPT,
        )

    def test_normalize_llm_summary_accepts_json_and_plain_text(self) -> None:
        self.assertEqual(
            report.normalize_llm_summary(
                '{"summary":"Главный вывод","traffic_light":"yellow"}',
                "green",
            ),
            {"summary": "Главный вывод", "traffic_light": "yellow"},
        )
        self.assertEqual(
            report.normalize_llm_summary("Обычный вывод", "red"),
            {"summary": "Обычный вывод", "traffic_light": "red"},
        )
        self.assertIsNone(report.normalize_llm_summary("", "gray"))

    def test_summary_input_preserves_existing_schema(self) -> None:
        payload = report.llm_summary_input(
            [
                {
                    "skill_key": "pilots",
                    "digest_month": "май 2026",
                    "traffic_light": "yellow",
                    "ai_tool_product_names": ["Продукт"],
                    "digest_texts": ["Комментарий"],
                    "digest_rule": "Правило",
                    "digest_items": [
                        {
                            "indicator": "Пилоты",
                            "traffic_light": "yellow",
                            "ai_product_name": "Продукт",
                            "digest_texts": ["Действие"],
                            "digest_rule": "Правило строки",
                        }
                    ],
                }
            ]
        )
        self.assertEqual(list(payload), ["matched_ai_digest"])
        self.assertEqual(payload["matched_ai_digest"][0]["skill_key"], "pilots")
        self.assertEqual(payload["matched_ai_digest"][0]["items"][0]["comments"], ["Действие"])

    def test_summary_prompt_demands_facts_instead_of_traffic_light_prose(self) -> None:
        prompt = llm_summarization.DEFAULT_ATTRACT_SUMMARY_PROMPT
        self.assertIn("traffic_light нужен только для приоритизации", prompt)
        self.assertIn("запрещены формулировки «красная динамика»", prompt)
        self.assertIn("Сохраняй числа, знаки, проценты, единицы, MoM", prompt)
        self.assertIn("2–4 строки", prompt)

    def test_builder_passes_dd_product_name_to_the_prompt(self) -> None:
        captured = {}

        class Client:
            def invoke(self, prompt):
                captured["prompt"] = prompt
                return type("Response", (), {"content": '{"summary":"Факт","traffic_light":"green"}'})()

        result = llm_summarization.build_llm_summary(
            "Вклады",
            "attract",
            [{"traffic_light": "green"}],
            False,
            is_configured=lambda: True,
            clean_text=lambda value: str(value or "").strip(),
            worst_ai_light=lambda lights: "green",
            make_summary_input=lambda digests: {"matched_ai_digest": digests},
            prompt_template="PROMPT",
            log_write=lambda message: None,
            make_client=Client,
            run_client=lambda call: call(),
            normalize_summary=lambda content, fallback: {"summary": "Факт", "traffic_light": fallback},
        )

        self.assertEqual(result, {"summary": "Факт", "traffic_light": "green"})
        self.assertIn('"dd_product": "Вклады"', captured["prompt"])

    def test_placeholder_and_summary_keep_rendering_shape(self) -> None:
        group_name = report.AI_SKILL_GROUP_TOOLS["attract"]
        block = {"code": "attract", "tools": [{"name": group_name, "buttons": []}]}
        self.assertTrue(report.ensure_llm_summary_placeholder(block, "attract"))
        placeholder = block["tools"][0]["buttons"][0]
        self.assertTrue(placeholder["llm_summary"])
        self.assertTrue(placeholder["llm_placeholder"])
        self.assertEqual(placeholder["digest_items"][0]["indicator"], "Основные выводы")

        digest = {
            "digest_display_month_sort": (2026, 5, ""),
            "digest_month": "май 2026",
            "digest_month_raw": "2026-05",
            "ai_tool_product_names": ["Продукт"],
            "traffic_light": "yellow",
        }
        self.assertTrue(
            report.append_llm_summary_to_group(
                block,
                "attract",
                {"summary": "Главный вывод", "traffic_light": "red"},
                [digest],
            )
        )
        summary = block["tools"][0]["buttons"][0]
        self.assertTrue(summary["llm_summary"])
        self.assertNotIn("llm_placeholder", summary)
        self.assertEqual(summary["traffic_light"], "red")
        self.assertEqual(summary["digest_items"][0]["digest_texts"], ["Главный вывод"])

    def test_llm_summary_is_synced_to_ai_recommendations(self) -> None:
        group_name = report.AI_SKILL_GROUP_TOOLS["attract"]
        block = {"code": "attract", "tools": [{"name": group_name, "buttons": []}]}
        data = {
            "products": [
                {
                    "name": "Продукт",
                    "metrics": [block],
                    "metric_recommendations": [{"id": "existing", "indicator": "Сигнал"}],
                }
            ],
            "ai_skill_digest": {},
        }
        digest = {
            "digest_display_month_sort": (2026, 5, ""),
            "digest_month": "май 2026",
            "digest_month_raw": "2026-05",
            "ai_tool_product_names": ["Продукт AI"],
            "traffic_light": "yellow",
        }
        report.append_llm_summary_to_group(
            block,
            "attract",
            {"summary": "Главный вывод", "traffic_light": "red"},
            [digest],
        )

        self.assertEqual(report.sync_llm_summary_recommendations(data), 1)
        summary = data["products"][0]["metric_recommendations"][0]
        self.assertTrue(summary["llm_summary"])
        self.assertFalse(summary["llm_placeholder"])
        self.assertEqual(summary["skill_name"], "LLM-cуммаризация")
        self.assertEqual(summary["indicator"], "Основные выводы")
        self.assertEqual(summary["recommendations"], ["Главный вывод"])
        self.assertEqual(data["products"][0]["metric_recommendations"][1]["id"], "existing")
        self.assertEqual(data["ai_skill_digest"]["recommendation_items"], 2)


if __name__ == "__main__":
    unittest.main()
