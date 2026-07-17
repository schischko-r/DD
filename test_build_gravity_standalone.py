from __future__ import annotations

import json
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch

from build_gravity_report import NPM_COMMAND, build as build_report
from build_gravity_standalone import build as build_standalone


class BuildGravityStandaloneTest(unittest.TestCase):
    def write_fixture(
        self,
        root: Path,
        template_html: str,
        payload: dict | None = None,
    ) -> tuple[Path, Path, Path]:
        template = root / "index.html"
        data = root / "report-data.json"
        output = root / "standalone.html"
        template.write_text(template_html, encoding="utf-8")
        data.write_text(
            json.dumps(payload or {"products": []}, ensure_ascii=False),
            encoding="utf-8",
        )
        return template, data, output

    def test_embeds_data_safely_and_uses_viewer_mode_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template, data, output = self.write_fixture(
                root,
                (
                    '<html><head><meta name="dd-app-mode" content="viewer" /></head>'
                    '<body><script>fetch("./report-data.json",{cache:"no-store"})'
                    ".then(load)</script></body></html>"
                ),
                {"products": [{"name": "Тест\n</script>&>\u2028\u2029"}]},
            )

            build_standalone(template, data, output)

            result = output.read_text(encoding="utf-8")
            self.assertNotIn('fetch("./report-data.json"', result)
            self.assertIn("Promise.resolve({ok: true, status: 200, json:", result)
            self.assertIn(
                "\\u003c/script\\u003e\\u0026\\u003e\\u2028\\u2029",
                result,
            )
            self.assertNotIn('"name":"Тест\n', result)
            self.assertEqual(
                result.count('<meta name="dd-app-mode" content="viewer" />'),
                1,
            )

    def test_switches_existing_marker_to_constructor_mode(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template, data, output = self.write_fixture(
                root,
                (
                    '<html><head><meta name="dd-app-mode" content="viewer" /></head>'
                    "<body><script>fetch('./report-data.json').then(load)</script>"
                    "</body></html>"
                ),
            )

            build_standalone(template, data, output, mode="constructor")

            result = output.read_text(encoding="utf-8")
            self.assertIn('<meta name="dd-app-mode" content="constructor" />', result)
            self.assertNotIn('<meta name="dd-app-mode" content="viewer" />', result)

    def test_inserts_viewer_marker_into_head_when_template_has_none(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template, data, output = self.write_fixture(
                root,
                (
                    "<!doctype html><html><head><title>Gravity</title></head>"
                    '<body><script>fetch("./report-data.json")</script></body></html>'
                ),
            )

            build_standalone(template, data, output)

            result = output.read_text(encoding="utf-8")
            head = result[result.index("<head>") : result.index("</head>")]
            self.assertIn('<meta name="dd-app-mode" content="viewer" />', head)

    def test_rejects_template_without_report_data_fetch(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template, data, output = self.write_fixture(
                root,
                "<html><head></head><body><script>loadData()</script></body></html>",
            )

            with self.assertRaisesRegex(ValueError, "report-data fetch marker"):
                build_standalone(template, data, output)

            self.assertFalse(output.exists())

    def test_rejects_missing_head_when_mode_marker_must_be_inserted(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template, data, output = self.write_fixture(
                root,
                '<script>fetch("./report-data.json")</script>',
            )

            with self.assertRaisesRegex(ValueError, "<head> element"):
                build_standalone(template, data, output)

            self.assertFalse(output.exists())

    def test_rejects_unknown_mode(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template, data, output = self.write_fixture(
                root,
                (
                    "<html><head></head><body>"
                    '<script>fetch("./report-data.json")</script></body></html>'
                ),
            )

            with self.assertRaisesRegex(ValueError, "Unsupported app mode"):
                build_standalone(template, data, output, mode="admin")

            self.assertFalse(output.exists())


class BuildGravityReportTest(unittest.TestCase):
    def test_builds_both_modes_after_one_vite_build(self) -> None:
        root = Path("/tmp/gravity-build-test")
        args = Namespace(
            input=root / "flat_table.xlsx",
            period="II кв. 2026",
            legacy_output=root / "legacy.html",
            data_output=root / "report-data.json",
            standalone_output=root / "viewer.html",
            constructor_output=root / "constructor.html",
            ai_digest_xlsx=root / "digest.xlsx",
            ai_product_map=root / "mapping.xlsx",
            no_ai_skills=False,
            skip_ai_digest=False,
            data_only=False,
        )

        with patch("build_gravity_report.run") as run:
            build_report(args)

        commands = [call.args[0] for call in run.call_args_list]
        self.assertEqual(len(commands), 4)
        self.assertEqual(commands[1], [NPM_COMMAND, "run", "build"])
        self.assertEqual(commands[2][-2:], ["--mode", "viewer"])
        self.assertEqual(commands[3][-2:], ["--mode", "constructor"])
        self.assertIn(str(args.standalone_output), commands[2])
        self.assertIn(str(args.constructor_output), commands[3])


if __name__ == "__main__":
    unittest.main()
