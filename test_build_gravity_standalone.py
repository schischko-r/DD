import base64
import json
import tempfile
import unittest
from pathlib import Path

from build_gravity_standalone import (
    BASE64_CHUNK_SIZE,
    DEFAULT_BACKLOG_DATA,
    DEFAULT_OUTPUT,
    _load_json,
    build,
)


class BuildGravityStandaloneTest(unittest.TestCase):
    def test_repository_standalone_embeds_backlog_data_for_file_opening(self) -> None:
        result = DEFAULT_OUTPUT.read_text(encoding="utf-8")
        backlog_data = json.loads(DEFAULT_BACKLOG_DATA.read_text(encoding="utf-8"))
        meta = backlog_data["meta"]

        self.assertNotIn("./backlog-data.json", result)
        self.assertIn(_load_json(DEFAULT_BACKLOG_DATA), result)
        self.assertIn(f'"historyEnd":"{meta["historyEnd"]}"', result)
        self.assertIn(f'"includedTickets":{meta["includedTickets"]}', result)

    def test_vite_config_deduplicates_react_for_standalone_charts(self) -> None:
        vite_config = DEFAULT_OUTPUT.parent / "gravity-app" / "vite.config.js"
        source = vite_config.read_text(encoding="utf-8")

        self.assertIn("dedupe: ['react', 'react-dom']", source)

    def test_embeds_data_for_no_store_fetch(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template = root / "index.html"
            data = root / "report-data.json"
            output = root / "standalone.html"
            template.write_text(
                '<script>fetch("./report-data.json",{cache:"no-store"}).then(load)</script>',
                encoding="utf-8",
            )
            data.write_text(
                json.dumps({"products": [{"name": "Тест\n</script>"}]}),
                encoding="utf-8",
            )

            build(template, data, output)

            result = output.read_text(encoding="utf-8")
            self.assertNotIn("fetch(\"./report-data.json\"", result)
            self.assertIn(
                'Promise.resolve({ok: true, json: () => Promise.resolve({"products":[{"name":"Тест\\n\\u003c/script\\u003e"}]})})',
                result,
            )
            self.assertNotIn('"name":"Тест\n', result)

    def test_embeds_and_escapes_backlog_data_when_the_bundle_fetches_both_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template = root / "index.html"
            data = root / "report-data.json"
            backlog_data = root / "backlog-data.json"
            output = root / "standalone.html"
            template.write_text(
                '<script>fetch("./report-data.json", {cache: "no-store"}).then(load);'
                "fetch('./backlog-data.json', {cache: 'no-store'}).then(loadBacklog)</script>",
                encoding="utf-8",
            )
            data.write_text(json.dumps({"products": []}), encoding="utf-8")
            backlog_data.write_text(
                json.dumps(
                    {
                        "months": [{"label": "Опасно </script>&> "}],
                        "teams": [
                            {
                                "key": "sberchai",
                                "label": "СберЧаевые",
                                "months": [],
                                "quarters": [{"key": "2026-Q2", "totalActive": 12}],
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )

            build(template, data, output, backlog_data_path=backlog_data)

            result = output.read_text(encoding="utf-8")
            self.assertNotIn('fetch("./report-data.json"', result)
            self.assertNotIn("fetch('./backlog-data.json'", result)
            self.assertIn('Promise.resolve({ok: true, json: () => Promise.resolve({"products":[]})})', result)
            self.assertIn('"label":"Опасно \\u003c/script\\u003e\\u0026\\u003e\\u2028"', result)
            self.assertIn(
                '"teams":[{"key":"sberchai","label":"СберЧаевые","months":[],"quarters":[{"key":"2026-Q2","totalActive":12}]}]',
                result,
            )
            self.assertNotIn("</script>&>", result)

    def test_requires_backlog_fetch_marker_only_when_backlog_data_is_requested(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template = root / "index.html"
            data = root / "report-data.json"
            backlog_data = root / "backlog-data.json"
            output = root / "standalone.html"
            template.write_text(
                '<script>fetch("./report-data.json").then(load)</script>',
                encoding="utf-8",
            )
            data.write_text(json.dumps({"products": []}), encoding="utf-8")
            backlog_data.write_text(json.dumps({"months": []}), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "backlog-data fetch marker"):
                build(template, data, output, backlog_data_path=backlog_data)

    def test_preserves_external_sibling_report_url_without_embedding_report(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template = root / "index.html"
            data = root / "report-data.json"
            output = root / "gravity-standalone.html"
            template.write_text(
                (
                    '<iframe src="./neighbor-report.html"></iframe>'
                    '<script>fetch("./report-data.json",{cache:"no-store"}).then(load)</script>'
                ),
                encoding="utf-8",
            )
            data.write_text(json.dumps({"products": []}), encoding="utf-8")
            (root / "neighbor-report.html").write_text(
                '<script>var _ALL_DATA = {"large":"external-only"};</script>',
                encoding="utf-8",
            )

            build(template, data, output)

            result = output.read_text(encoding="utf-8")
            self.assertIn('src="./neighbor-report.html"', result)
            self.assertNotIn("external-only", result)
            self.assertEqual(
                (output.parent / "neighbor-report.html").resolve(),
                (root / "neighbor-report.html").resolve(),
            )

    def test_embeds_sibling_html_pages_incrementally_from_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template = root / "index.html"
            data = root / "report-data.json"
            output = root / "gravity-standalone.html"
            report = root / "neighbor-report.html"
            report_bytes = b"<html><body>" + b"x" * (BASE64_CHUNK_SIZE + 2) + b"</body></html>"
            template.write_text(
                (
                    '<script id="ddi-html-page-manifest" type="application/json">'
                    '{"neighbor":"neighbor-report.html","missing":"missing-report.html"}'
                    "</script>"
                    '<iframe src="./missing-report.html"></iframe>'
                    '<script>fetch("./report-data.json").then(load)</script>'
                ),
                encoding="utf-8",
            )
            data.write_text(json.dumps({"products": []}), encoding="utf-8")
            report.write_bytes(report_bytes)

            build(template, data, output, root)

            result = output.read_text(encoding="utf-8")
            encoded_report = base64.b64encode(report_bytes).decode("ascii")
            self.assertNotIn("ddi-html-page-manifest", result)
            self.assertIn(
                (
                    '<script type="application/octet-stream" '
                    'data-ddi-html-page-id="neighbor">'
                    f"{encoded_report}</script>"
                ),
                result,
            )
            self.assertNotIn('data-ddi-html-page-id="missing"', result)
            self.assertIn('src="./missing-report.html"', result)

    def test_rejects_nested_paths_in_html_page_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template = root / "index.html"
            data = root / "report-data.json"
            output = root / "gravity-standalone.html"
            template.write_text(
                (
                    '<script id="ddi-html-page-manifest" type="application/json">'
                    '{"unsafe":"../report.html"}'
                    "</script>"
                    '<script>fetch("./report-data.json").then(load)</script>'
                ),
                encoding="utf-8",
            )
            data.write_text(json.dumps({"products": []}), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "invalid entry"):
                build(template, data, output, root)

    def test_preserves_literal_html_entities_in_manifest_values(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template = root / "index.html"
            data = root / "report-data.json"
            output = root / "gravity-standalone.html"
            report = root / "a&amp;.html"
            report_bytes = b"<html>literal entity filename</html>"
            template.write_text(
                (
                    '<script id="ddi-html-page-manifest" type="application/json">'
                    '{"skill&amp;":"a&amp;.html"}'
                    "</script>"
                    '<script>fetch("./report-data.json").then(load)</script>'
                ),
                encoding="utf-8",
            )
            data.write_text(json.dumps({"products": []}), encoding="utf-8")
            report.write_bytes(report_bytes)

            build(template, data, output, root)

            result = output.read_text(encoding="utf-8")
            self.assertIn('data-ddi-html-page-id="skill&amp;amp;"', result)
            self.assertIn(
                base64.b64encode(report_bytes).decode("ascii"),
                result,
            )


if __name__ == "__main__":
    unittest.main()
