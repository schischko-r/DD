import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from zipfile import ZipFile

import build_report


class ReportBuildTest(unittest.TestCase):
    @staticmethod
    def report(label, dd_product=None):
        return {
            "label": label,
            "mapping": {"dd_product": dd_product or label},
        }

    @staticmethod
    def losshunter_data():
        card = {
            "stage": "Вход в продукт",
            "trigger": "обрыв · путь",
            "event_registry": "нужен ввод: реестр",
            "segment": "25–60",
            "send_time": "через 3 ч · гипотеза",
            "primary_channel": "Пуш · путь+анкета",
            "fallback_channel": "Баннер · гипотеза",
            "message": "Вернитесь в заявку · гипотеза",
            "upsell": "не предлагать · гипотеза",
            "rationale": "2 кадра · путь",
            "success_metric": "возврат за 72 часа · гипотеза",
            "brief_template": "нужен ввод: шаблон ТЗ",
            "outreach": {
                "when": "через 3 ч · гипотеза",
                "primary_channel": "Пуш · путь+анкета",
                "fallback_channel": "Баннер · гипотеза",
                "what_to_say": "сдержанно · анкета; пример: «Вернитесь» · гипотеза",
                "upsell": "не предлагать · гипотеза",
                "rationale": "почему время · путь | почему канал · анкета",
            },
        }
        return {
            "title": "Рекомендации",
            "path": "Купить ОСАГО · СберБанк Онлайн · ios",
            "run_id": "test-run",
            "source_note": "Один проход; · путь · анкета · гипотеза; нужен ввод.",
            "verification_plan": "Возврат за 72 часа; контроль 10–15%; две недели или 200 обрывов.",
            "missing_inputs": "реестр событий",
            "copy_block_html": (
                '<section class="block-section section-filter_table">'
                "<h3>Клиент оборвал на этапе — что, когда и куда отправлять</h3>"
                "<div class=\"ft-root\"><table><tbody><tr><td>Этап 1</td>"
                "</tr></tbody></table></div></section>"
            ),
            "copy_page_style": "table{border-collapse:collapse;width:100%}",
            "cards": [
                dict(card, stage=f"Этап {index}")
                for index in range(1, 10)
            ],
        }

    def test_extract_embedded_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "report.html"
            path.write_text(
                '<script>var _ALL_DATA = {"value": 7}; alert("after")</script>',
                encoding="utf-8",
            )
            self.assertEqual(
                build_report.extract_embedded_json(path, ("var _ALL_DATA = ",)),
                {"value": 7},
            )

    def test_parse_losshunter_extracts_nine_complete_cards(self):
        fields = {
            "Триггер": "обрыв · путь",
            "Событие в реестре": "нужен ввод: реестр",
            "Сегмент": "25–60",
            "Время отправки": "через 3 ч · гипотеза",
            "Канал основной": "Пуш · путь+анкета",
            "Запасной канал и правило": "Баннер · гипотеза",
            "Текст сообщения": "Вернитесь в заявку · гипотеза",
            "Up-sell": "не предлагать · гипотеза",
            "Обоснование": "кадр-улика · путь",
            "Метрика успеха": "возврат за 72 часа · гипотеза",
            "Шаблон ТЗ": "нужен ввод: шаблон",
        }
        field_html = "".join(
            f"<dt>{key}</dt><dd>{value}</dd>" for key, value in fields.items()
        )
        cards = "".join(
            f'<details class="dt-item"><summary><b>Этап {index}</b></summary>'
            f'<dl class="dt-fields">{field_html}</dl></details>'
            for index in range(1, 10)
        )
        table_rows = "".join(
            '<tr>'
            f'<td>Этап {index}</td>'
            '<td><span class="ft-var" data-ft-when="daytime=day">через 3 ч · гипотеза</span></td>'
            '<td>Пуш · путь+анкета</td>'
            '<td>Баннер · гипотеза</td>'
            '<td><span class="ft-var" data-ft-when="age=core"><span class="ft-tag">25–60:</span> '
            'сдержанно · анкета; пример: «Вернитесь» · гипотеза</span></td>'
            '<td>не предлагать · гипотеза</td>'
            '<td><span class="ft-var" data-ft-when="daytime=day">почему время · путь | '
            'почему канал · анкета</span></td>'
            '</tr>'
            for index in range(1, 10)
        )
        source = (
            "<title>Рекомендации ОСАГО</title>"
            '<p class=lead>Путь «Купить ОСАГО · СБОЛ · ios», прогон '
            "<code>run-id</code>.</p>"
            '<div class=warn><b>Как читать.</b> · путь · анкета · гипотеза; '
            "нужен ввод.</div>"
            '<section class="block-section section-filter_table"><table><tbody>'
            f"{table_rows}</tbody></table></section>"
            "<style>.dt-item{border:1px solid}.dt-fields{display:grid}</style>"
            f"{cards}"
            '<h3>План проверки</h3><div class="callout callout-warn">'
            "Возврат за 72 часа; контроль 10–15%.</div>"
            '<p class=gaps>Не хватило: реестр событий.</p>'
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "loss.htm"
            path.write_text(source, encoding="utf-8")
            parsed = build_report.parse_losshunter_report(path)
        self.assertEqual(parsed["run_id"], "run-id")
        self.assertEqual(len(parsed["cards"]), 9)
        self.assertEqual(
            parsed["copy_block_html"],
            re.search(
                r'<section class="block-section section-filter_table">.*?</section>',
                source,
                flags=re.S,
            ).group(0),
        )
        self.assertEqual(
            parsed["copy_page_style"],
            re.search(r"<style>(.*?)</style>", source, flags=re.S).group(1),
        )
        self.assertEqual(parsed["cards"][0]["primary_channel"], "Пуш · путь+анкета")
        self.assertIn("· гипотеза", parsed["source_note"])
        self.assertIn("нужен ввод", parsed["cards"][0]["event_registry"])
        self.assertEqual(
            parsed["cards"][0]["outreach"]["what_to_say"],
            "сдержанно · анкета; пример: «Вернитесь» · гипотеза",
        )

    def test_recommendations_scope_osago_evidence_and_other_product_schema(self):
        source = self.losshunter_data()
        steps = [
            {
                "number": 1,
                "name": "Деталка",
                "status": "none",
                "covered": 0,
                "total": 4,
            }
        ]
        summary = {"event_covered": 0, "event_total": 4, "total": 1}
        osago = build_report.build_recommendations(
            product_name="ОСАГО", steps=steps, summary=summary, losshunter=source
        )
        self.assertEqual(osago["scope"], "exact_osago_path")
        self.assertEqual(len(osago["items"]), 9)
        self.assertTrue(
            all(item["source_scope"] == "exact_osago_path" for item in osago["items"])
        )
        for field in (
            "stage",
            "trigger",
            "event_registry",
            "segment",
            "send_time",
            "primary_channel",
            "fallback_channel",
            "message",
            "upsell",
            "rationale",
            "success_metric",
            "brief_template",
            "outreach",
        ):
            self.assertEqual(osago["items"][0][field], source["cards"][0][field])
        self.assertIn("прямое соответствие не доказано", osago["items"][0]["nrt_link"])

        deposit = build_report.build_recommendations(
            product_name="Вклады+НС", steps=steps, summary=summary, losshunter=source
        )
        self.assertEqual(deposit["scope"], "schema_only")
        self.assertEqual(len(deposit["items"]), 1)
        item = deposit["items"][0]
        self.assertIn("нужен ввод", item["primary_channel"])
        deposit_json = json.dumps(deposit, ensure_ascii=False)
        for source_field in (
            "trigger",
            "segment",
            "send_time",
            "primary_channel",
            "fallback_channel",
            "message",
            "upsell",
            "rationale",
            "brief_template",
        ):
            self.assertNotIn(source["cards"][0][source_field], deposit_json)
        self.assertTrue(
            all(rec["source_scope"] == "schema_only" for rec in deposit["items"])
        )
        self.assertIn("факты ОСАГО не переиспользуются", deposit["note"])

    def test_coverage_full_partial_and_none(self):
        row = {
            "event_token_groups": [
                ["ios", "Event A"],
                ["android", "Event B"],
            ]
        }
        full = [
            {
                "product": "NRT",
                "events": [
                    {"original": "ios / Event A"},
                    {"original": "android / Event B"},
                ],
            }
        ]
        partial = [{"product": "NRT", "events": [{"original": "ios / Event A"}]}]
        full_result = build_report.coverage_for_step(row, full)
        self.assertEqual(full_result["status"], "full")
        self.assertTrue(all(group["covered"] for group in full_result["event_coverage"]))
        self.assertEqual(
            build_report.coverage_for_step(row, partial)["status"], "partial"
        )
        partial_result = build_report.coverage_for_step(row, partial)
        self.assertEqual(
            [group["covered"] for group in partial_result["event_coverage"]],
            [True, False],
        )
        self.assertEqual(build_report.coverage_for_step(row, [])["status"], "none")
        self.assertEqual(
            build_report.coverage_for_step({"event_token_groups": []}, [])["status"],
            "not_applicable",
        )

    def test_coverage_falls_back_to_flat_production_event_tokens(self):
        row = {
            "event_match_tokens": [
                "android",
                "Checkout Application Start Show",
                "productCode",
                "consumer_loan",
                "ios",
            ]
        }
        result = build_report.coverage_for_step(
            row,
            [
                {
                    "product": "NRT",
                    "events": [
                        {"original": "ios / Checkout Application Start Show"}
                    ],
                }
            ],
        )

        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["covered"], 1)
        self.assertEqual(result["total"], 3)
        self.assertEqual(
            [group["tokens"] for group in result["event_coverage"]],
            [
                ["Checkout Application Start Show"],
                ["productCode"],
                ["consumer_loan"],
            ],
        )
        self.assertEqual(
            result["event_coverage"][0]["matched_tokens"],
            ["Checkout Application Start Show"],
        )

    def test_flat_production_event_tokens_can_be_fully_covered(self):
        row = {"event_match_tokens": ["ios", "Event A", "android"]}
        result = build_report.coverage_for_step(
            row,
            [{"product": "NRT", "events": [{"original": "ios / Event A"}]}],
        )

        self.assertEqual(result["status"], "full")
        self.assertEqual(result["covered"], 1)
        self.assertEqual(result["total"], 1)

    def test_coverage_accepts_nested_production_event_tokens(self):
        row = {"event_match_tokens": [["ios", "Event A"], ["android", "Event B"]]}
        result = build_report.coverage_for_step(
            row,
            [{"product": "NRT", "events": [{"original": "ios / Event A"}]}],
        )

        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["covered"], 1)
        self.assertEqual(result["total"], 2)

    def test_build_steps_excludes_steps_without_events_from_summary(self):
        steps, summary = build_report.build_steps(
            {
                "funnel": {
                    "1": {
                        "step_name": "Без события",
                        "event_token_groups": [],
                        "count": 0,
                    },
                    "2": {
                        "step_name": "С событием",
                        "event_token_groups": [["Event A"]],
                        "count": 0,
                    },
                }
            }
        )
        self.assertEqual(len(steps), 2)
        self.assertEqual(summary["total"], 1)
        self.assertEqual(summary["none"], 1)

    def test_read_product_mapping_deduplicates_rows(self):
        shared = """<?xml version="1.0" encoding="UTF-8"?>
        <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <si><t>dd_product</t></si><si><t>ai_tool_key</t></si>
          <si><t>ai_tool_product name</t></si><si><t>ПДС</t></si>
          <si><t>drafts</t></si>
        </sst>"""
        sheet = """<?xml version="1.0" encoding="UTF-8"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <sheetData>
            <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
            <row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="C2" t="s"><v>3</v></c></row>
            <row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3" t="s"><v>4</v></c><c r="C3" t="s"><v>3</v></c></row>
          </sheetData>
        </worksheet>"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "mapping.xlsx"
            with ZipFile(path, "w") as archive:
                archive.writestr("xl/sharedStrings.xml", shared)
                archive.writestr("xl/worksheets/sheet1.xml", sheet)
            self.assertEqual(
                build_report.read_product_mapping(path), {("ПДС", "drafts", "ПДС")}
            )

    def test_render_html_escapes_script_breakout(self):
        payload = {
            "default_product": "</script>",
            "products": [],
            "ddi_products": [],
            "meta": {"source_files": {}, "coverage_rule": ""},
        }
        html = build_report.render_html(payload)
        self.assertNotIn("</script>\",\"products", html)
        self.assertIn("\\u003c/script>", html)

    def test_both_report_variants_have_valid_javascript_and_copy_contract(self):
        payload = {
            "default_product": "",
            "products": [],
            "ddi_products": [],
            "meta": {"source_files": {}, "coverage_rule": ""},
        }
        analytical = build_report.render_html(payload, "analytical")
        copy_paste = build_report.render_html(payload, "copy_paste")
        self.assertIn('const REPORT_VARIANT = "analytical"', analytical)
        self.assertIn('const REPORT_VARIANT = "copy_paste"', copy_paste)
        self.assertIn(
            'readyToSend=copyMode&&recommendationSet.scope==="exact_osago_path"',
            copy_paste,
        )
        self.assertIn('byId("copy-all").hidden=true', copy_paste)
        self.assertIn(
            '"Клиент оборвал на этапе — что, когда и куда отправлять"',
            copy_paste,
        )
        self.assertIn('"Копировать исходный блок"', copy_paste)
        self.assertIn("синтетический шаблон не создаётся", copy_paste)
        for marker in (
            "function sourceBlockText(sourceHtml)",
            "function mountSourceBlock(container,sourceHtml,pageStyle)",
            "async function copySourceHtml(sourceHtml)",
            "mountSourceBlock(block,sourceHtml,recommendationSet.source_page_style)",
            "ClipboardItem",
            "Копировать все исходные блоки",
            'REPORT_VARIANT==="copy_paste"?"ОСАГО":REPORT.default_product',
        ):
            self.assertIn(marker, copy_paste)
        self.assertNotIn("function copyPasteText(rec)", copy_paste)
        if not shutil.which("node"):
            self.skipTest("Node.js не установлен")
        for rendered in (analytical, copy_paste):
            script = rendered.rsplit("<script>", 1)[1].split("</script>", 1)[0]
            result = subprocess.run(
                ["node", "--check", "-"],
                input=script,
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_copy_paste_preserves_source_html_instead_of_rebuilding_text(self):
        source = self.losshunter_data()
        recommendations = build_report.build_recommendations(
            product_name="ОСАГО",
            steps=[],
            summary={"event_covered": 0, "event_total": 0, "total": 0},
            losshunter=source,
        )
        self.assertEqual(recommendations["source_html"], source["copy_block_html"])
        self.assertEqual(
            recommendations["source_page_style"], source["copy_page_style"]
        )
        self.assertTrue(
            all("source_html" not in item for item in recommendations["items"])
        )
        schema = build_report.build_recommendations(
            product_name="Вклады+НС",
            steps=[],
            summary={"event_covered": 0, "event_total": 0, "total": 0},
            losshunter=source,
        )
        self.assertEqual(schema["source_html"], "")
        self.assertEqual(schema["source_page_style"], "")
        self.assertTrue(all("source_html" not in item for item in schema["items"]))

    def test_render_html_rejects_unknown_variant(self):
        with self.assertRaisesRegex(build_report.ReportBuildError, "Неизвестный"):
            build_report.render_html({}, "unknown")

    def test_ddi_lineup_keeps_only_products_and_maps_report_aliases(self):
        lineup = build_report.build_ddi_product_lineup(
            {
                "products": [
                    {
                        "id": "deposit",
                        "name": "Вклады+НС",
                        "type": "Продукт",
                        "unit": "Daily Banking",
                    },
                    {
                        "id": "broker",
                        "name": "Брокерский счет",
                        "type": "Продукт",
                    },
                    {"id": "sbol", "name": "СБОЛ", "type": "Канал"},
                ]
            },
            [
                self.report("Вклады, руб.", "Вклады+НС"),
                self.report("Накопительные счета", "Вклады+НС"),
                self.report("Брокерский счёт"),
            ],
            [],
        )
        self.assertEqual([item["id"] for item in lineup], ["broker", "deposit"])
        self.assertEqual(lineup[0]["report_labels"], ["Брокерский счёт"])
        self.assertEqual(
            lineup[1]["report_labels"], ["Вклады, руб.", "Накопительные счета"]
        )
        self.assertTrue(all(item["available"] for item in lineup))
        self.assertTrue(all(not item["unavailable_reason"] for item in lineup))

    def test_ddi_lineup_keeps_unavailable_products_with_reason(self):
        lineup = build_report.build_ddi_product_lineup(
            {
                "products": [
                    {"id": "new", "name": "Новый продукт", "type": "Продукт"},
                    {"id": "life", "name": "ДСЖ КК", "type": "Продукт"},
                ]
            },
            [],
            [{"dd_product": "ДСЖ КК", "reason": "Нет общего месяца."}],
        )
        by_name = {item["name"]: item for item in lineup}
        self.assertFalse(by_name["Новый продукт"]["available"])
        self.assertTrue(by_name["Новый продукт"]["unavailable_reason"])
        self.assertEqual(
            by_name["ДСЖ КК"]["unavailable_reason"], "Нет общего месяца."
        )

    def test_ddi_lineup_rejects_duplicate_ids_and_names(self):
        with self.assertRaisesRegex(build_report.ReportBuildError, "повтор product id"):
            build_report.build_ddi_product_lineup(
                {
                    "products": [
                        {"id": "same", "name": "Один", "type": "Продукт"},
                        {"id": "same", "name": "Два", "type": "Продукт"},
                    ]
                },
                [],
                [],
            )
        with self.assertRaisesRegex(build_report.ReportBuildError, "повтор имени"):
            build_report.build_ddi_product_lineup(
                {
                    "products": [
                        {"id": "one", "name": "Счёт", "type": "Продукт"},
                        {"id": "two", "name": "счет", "type": "Продукт"},
                    ]
                },
                [],
                [],
            )

    def test_template_has_clickable_ddi_navigation_and_bridge(self):
        self.assertIn('id="product-options"', build_report.HTML_TEMPLATE)
        self.assertIn('button.addEventListener("click"', build_report.HTML_TEMPLATE)
        self.assertIn("renderUnavailable(product)", build_report.HTML_TEMPLATE)
        self.assertIn('id="exp-product"', build_report.HTML_TEMPLATE)
        self.assertIn('id="exp-period"', build_report.HTML_TEMPLATE)
        self.assertIn('id="exp-show"', build_report.HTML_TEMPLATE)
        self.assertIn("function ddiContextForValue(value)", build_report.HTML_TEMPLATE)
        self.assertIn(
            "normalizeText(product.name)===normalized", build_report.HTML_TEMPLATE
        )
        self.assertIn(
            "product.report_labels.find(label=>normalizeText(label)===normalized)",
            build_report.HTML_TEMPLATE,
        )

    def test_refactored_ui_has_hierarchy_states_and_accessibility_contract(self):
        template = build_report.HTML_TEMPLATE
        for required in (
            'class="journey-grid"',
            'class="coverage-overview"',
            'element("details","event-disclosure")',
            'id="coverage-track-value"',
            'aria-controls="product-menu"',
            'aria-live="polite"',
            'role="combobox"',
            "@media(prefers-reduced-motion:reduce)",
            '"ArrowDown","ArrowUp"',
            'button.setAttribute("aria-pressed"',
            'REPORT.meta.zeroed_mode?"Обезличено"',
            'details.addEventListener("toggle"',
            'rowHeader.scope="row"',
            'id="recommendation-source-note"',
            'element("details","rec")',
            "function sourceCopyParts(value)",
            'rec.outreach.what_to_say',
            'element("details","rec-detail")',
            'rec.outreach.rationale.split(" | ")',
            'summary-card ${state}',
            'NRT-событий покрыто',
        ):
            self.assertIn(required, template)
        self.assertNotIn('class="metrics"', template)
        self.assertNotIn('class="section"', template)
        self.assertNotIn("Кампейнинг", template)
        self.assertLess(
            template.index('route=element("div","rec-route")'),
            template.index('copy=element("div","rec-copy")'),
        )
        self.assertLess(
            template.index('copy=element("div","rec-copy")'),
            template.index('upsell=element("div","rec-upsell")'),
        )
        self.assertLess(
            template.index('upsell=element("div","rec-upsell")'),
            template.index('disclosures=element("div","rec-disclosures")'),
        )
        self.assertLess(
            template.index('disclosures=element("div","rec-disclosures")'),
            template.index('tech=element("details","rec-detail")'),
        )

    def test_campaign_dependency_is_removed_and_nrt_summary_is_compact(self):
        builder_source = Path(build_report.__file__).read_text(encoding="utf-8")
        readme_source = (Path(build_report.__file__).parent / "README.md").read_text(
            encoding="utf-8"
        )
        for source in (builder_source, readme_source, build_report.HTML_TEMPLATE):
            normalized = source.casefold()
            self.assertNotIn("campaign", normalized)
            self.assertNotIn("кампейн", normalized)
            self.assertNotIn("2гис", normalized)

        template = build_report.HTML_TEMPLATE
        self.assertIn(
            ".coverage-overview{min-height:58px;padding:0 20px;display:flex;",
            template,
        )
        self.assertIn(
            '.summary-card{min-width:0;padding:10px 14px;display:flex;',
            template,
        )
        self.assertIn(
            'const cards=[[`${s.event_covered}/${s.event_total}`', template
        )
        self.assertIn('id="micro"', template)

    def test_generated_static_ids_are_unique_and_used_ids_exist(self):
        class IdParser(HTMLParser):
            def __init__(self):
                super().__init__()
                self.ids = []

            def handle_starttag(self, _tag, attrs):
                self.ids.extend(value for key, value in attrs if key == "id")

        html = build_report.render_html(
            {
                "default_product": "",
                "products": [],
                "ddi_products": [],
                "meta": {
                    "source_files": {},
                    "coverage_rule": "",
                    "zeroed_mode": True,
                    "excluded_products": [],
                },
            }
        )
        parser = IdParser()
        parser.feed(html)
        self.assertEqual(len(parser.ids), len(set(parser.ids)))
        literal_by_ids = set(re.findall(r'byId\("([^"]+)"\)', html))
        self.assertTrue(literal_by_ids.issubset(set(parser.ids)))

    def test_ddi_context_resolver_preserves_requested_report_variant(self):
        if not shutil.which("node"):
            self.skipTest("Node.js не установлен")
        source_start = build_report.HTML_TEMPLATE.index("const normalizeText")
        source_end = build_report.HTML_TEMPLATE.index("function syncDdiAdapter")
        resolver_source = build_report.HTML_TEMPLATE[source_start:source_end]
        report = {
            "ddi_products": [
                {
                    "id": "deposit-id",
                    "name": "Вклады+НС",
                    "report_labels": ["Вклады, руб.", "Накопительные счета"],
                }
            ]
        }
        script = f"""
const REPORT={json.dumps(report, ensure_ascii=False)};
{resolver_source}
const byId=ddiContextForValue("deposit-id");
const byName=ddiContextForValue("  ВКЛАДЫ+НС ");
const first=ddiContextForValue("Вклады, руб.");
const second=ddiContextForValue("Накопительные счета");
if(byId.product.id!=="deposit-id"||byId.reportLabel!==null)process.exit(1);
if(byName.product.id!=="deposit-id"||byName.reportLabel!==null)process.exit(2);
if(first.reportLabel!=="Вклады, руб.")process.exit(3);
if(second.reportLabel!=="Накопительные счета")process.exit(4);
"""
        result = subprocess.run(
            ["node", "-e", script],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_mapping_file_is_valid_json(self):
        mapping = json.loads(build_report.DEFAULT_MAPPING.read_text(encoding="utf-8"))
        self.assertIn(mapping["default_product"], {p["label"] for p in mapping["products"]})
        self.assertEqual(
            len(mapping["products"]), len({p["label"] for p in mapping["products"]})
        )

    def test_real_exports_have_expected_shapes_when_available(self):
        try:
            drafts_path = build_report.locate_input(
                None, build_report.INPUT_NAMES["drafts"]
            )
            clickstream_path = build_report.locate_input(
                None, build_report.INPUT_NAMES["clickstream"]
            )
            mapping_path = build_report.locate_input(
                None, build_report.INPUT_NAMES["product_mapping"]
            )
        except build_report.ReportBuildError as exc:
            self.skipTest(str(exc))
        drafts = build_report.extract_embedded_json(
            drafts_path, build_report.ASSIGNMENTS["drafts"]
        )
        clickstream = build_report.extract_embedded_json(
            clickstream_path, build_report.ASSIGNMENTS["clickstream"]
        )
        self.assertEqual(len(drafts["product_groups"]), 48)
        self.assertEqual(len(clickstream["funnels"]), 64)
        self.assertEqual(len(build_report.read_product_mapping(mapping_path)), 995)

        ddi_path = build_report.locate_ddi_data(None)
        ddi_data = json.loads(ddi_path.read_text(encoding="utf-8"))
        ddi_products = [
            item for item in ddi_data["products"] if item.get("type") == "Продукт"
        ]
        self.assertEqual(len(ddi_products), 64)
        self.assertEqual(len({item["id"] for item in ddi_products}), 64)
        payload = build_report.build_payload(
            build_report.SourcePaths(
                drafts=drafts_path,
                clickstream=clickstream_path,
            ),
            build_report.DEFAULT_MAPPING,
            mapping_path,
            ddi_path,
        )
        self.assertEqual(sum(item["available"] for item in payload["ddi_products"]), 18)
        self.assertEqual(
            sum(not item["available"] for item in payload["ddi_products"]), 46
        )
        self.assertEqual(
            sum(len(item["report_labels"]) for item in payload["ddi_products"]), 19
        )
        self.assertIn("losshunter", payload["meta"]["source_files"])
        self.assertNotIn("campaign", build_report.INPUT_NAMES)
        self.assertNotIn("campaign", payload["meta"]["source_files"])
        self.assertTrue(
            all("campaign" not in item["periods"] for item in payload["products"])
        )
        osago = next(
            item for item in payload["products"] if item["mapping"]["dd_product"] == "ОСАГО"
        )
        self.assertEqual(osago["recommendations"]["scope"], "exact_osago_path")
        self.assertEqual(len(osago["recommendations"]["items"]), 9)
        losshunter_path = build_report.locate_losshunter(None)
        losshunter_source = losshunter_path.read_text(encoding="utf-8")
        losshunter = build_report.parse_losshunter_report(losshunter_path)
        raw_source_block = re.search(
            r'<section class="block-section section-filter_table">.*?</section>',
            losshunter_source,
            flags=re.S,
        ).group(0)
        raw_page_style = re.search(
            r"<style>(.*?)</style>", losshunter_source, flags=re.S
        ).group(1)
        self.assertEqual(
            losshunter["copy_block_html"],
            raw_source_block,
        )
        self.assertEqual(osago["recommendations"]["source_html"], raw_source_block)
        self.assertEqual(losshunter["copy_page_style"], raw_page_style)
        self.assertEqual(
            osago["recommendations"]["source_page_style"], raw_page_style
        )
        self.assertNotIn("Заготовка ТЗ на коммуникацию", raw_source_block)
        self.assertNotIn("Событие в реестре", raw_source_block)
        self.assertNotRegex(raw_source_block, r"<details\b")
        self.assertNotRegex(raw_source_block, r'<dl class="dt-fields"')
        self.assertEqual(
            [card["stage"] for card in losshunter["cards"]],
            [
                "Вход в продукт",
                "Знакомство с продуктом",
                "Данные автомобиля",
                "Данные владельца и водителей",
                "Выбор предложения",
                "Дополнительная защита",
                "Документы и согласия",
                "Подтверждение",
                "Помощь и вопросы",
            ],
        )
        outreach_snapshot = json.dumps(
            [
                {"stage": card["stage"], "outreach": card["outreach"]}
                for card in losshunter["cards"]
            ],
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        self.assertEqual(
            hashlib.sha256(outreach_snapshot.encode()).hexdigest(),
            "ec3cb295bc1d409de1f608593c867538ae55e4fd5acde0c1d270897831958a3b",
        )
        self.assertEqual(
            [
                {"stage": item["stage"], "outreach": item["outreach"]}
                for item in osago["recommendations"]["items"]
            ],
            [
                {"stage": card["stage"], "outreach": card["outreach"]}
                for card in losshunter["cards"]
            ],
        )
        exact_fields = (
            "primary_channel",
            "fallback_channel",
            "message",
            "upsell",
            "rationale",
            "brief_template",
        )
        source_facts = {
            card[field]
            for card in losshunter["cards"]
            for field in exact_fields
            if card[field]
        }
        for product in payload["products"]:
            if product is osago:
                continue
            recommendations = product["recommendations"]
            self.assertEqual(recommendations["scope"], "schema_only")
            self.assertTrue(
                all(
                    item["source_scope"] == "schema_only"
                    for item in recommendations["items"]
                )
            )
            serialized = json.dumps(recommendations, ensure_ascii=False)
            self.assertFalse(
                [fact for fact in source_facts if fact in serialized],
                product["label"],
            )

    def test_cli_writes_analytical_and_copy_paste_files_and_their_mirrors(self):
        try:
            drafts_path = build_report.locate_input(
                None, build_report.INPUT_NAMES["drafts"]
            )
            clickstream_path = build_report.locate_input(
                None, build_report.INPUT_NAMES["clickstream"]
            )
            product_mapping_path = build_report.locate_input(
                None, build_report.INPUT_NAMES["product_mapping"]
            )
            ddi_path = build_report.locate_ddi_data(None)
            losshunter_path = build_report.locate_losshunter(None)
        except build_report.ReportBuildError as exc:
            self.skipTest(str(exc))

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            analytical = output_dir / "nested" / "analytical.html"
            copy_paste = output_dir / "nested" / "copy-paste.html"
            analytical_mirror = output_dir / "root-analytical.html"
            copy_paste_mirror = output_dir / "root-copy-paste.html"
            result = build_report.main(
                [
                    "--drafts",
                    str(drafts_path),
                    "--clickstream",
                    str(clickstream_path),
                    "--product-mapping",
                    str(product_mapping_path),
                    "--ddi-data",
                    str(ddi_path),
                    "--losshunter",
                    str(losshunter_path),
                    "--output",
                    str(analytical),
                    "--copy-output",
                    str(copy_paste),
                    "--local-output",
                    str(analytical_mirror),
                    "--local-copy-output",
                    str(copy_paste_mirror),
                ]
            )
            self.assertEqual(result, 0)
            self.assertEqual(analytical.read_bytes(), analytical_mirror.read_bytes())
            self.assertEqual(copy_paste.read_bytes(), copy_paste_mirror.read_bytes())
            self.assertNotEqual(analytical.read_bytes(), copy_paste.read_bytes())
            self.assertIn(
                'const REPORT_VARIANT = "analytical"',
                analytical.read_text(encoding="utf-8"),
            )
            copy_source = copy_paste.read_text(encoding="utf-8")
            self.assertIn('const REPORT_VARIANT = "copy_paste"', copy_source)
            self.assertIn("Копировать исходный блок", copy_source)
            self.assertIn("Копировать все исходные блоки", copy_source)
            self.assertNotIn("Заготовка ТЗ на коммуникацию", copy_source)
            self.assertNotIn("Событие в реестре", copy_source)

            payload_match = re.search(
                r"const REPORT = (.*?);\nconst REPORT_VARIANT",
                copy_source,
                flags=re.S,
            )
            self.assertIsNotNone(payload_match)
            rendered_payload = json.loads(payload_match.group(1))
            rendered_osago = next(
                product
                for product in rendered_payload["products"]
                if product["mapping"]["dd_product"] == "ОСАГО"
            )
            source_block = re.search(
                r'<section class="block-section section-filter_table">.*?</section>',
                losshunter_path.read_text(encoding="utf-8"),
                flags=re.S,
            ).group(0)
            source_page_style = re.search(
                r"<style>(.*?)</style>",
                losshunter_path.read_text(encoding="utf-8"),
                flags=re.S,
            ).group(1)
            self.assertEqual(
                rendered_osago["recommendations"]["source_html"],
                source_block,
            )
            self.assertEqual(
                rendered_osago["recommendations"]["source_page_style"],
                source_page_style,
            )
            self.assertEqual(rendered_osago["recommendations"]["items"], [])
            self.assertNotRegex(
                rendered_osago["recommendations"]["source_html"], r"<details\b"
            )
            self.assertNotIn(
                "Событие в реестре",
                rendered_osago["recommendations"]["source_html"],
            )
            self.assertTrue(
                all(
                    not product["recommendations"]["source_html"]
                    for product in rendered_payload["products"]
                    if product is not rendered_osago
                )
            )


if __name__ == "__main__":
    unittest.main()
