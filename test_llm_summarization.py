import unittest

import build_calc_report as report
import llm_summarization


class LlmSummarizationTest(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
