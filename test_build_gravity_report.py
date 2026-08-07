import unittest
from unittest.mock import patch

import build_gravity_report as report


class GravityBuildCrosssellTest(unittest.TestCase):
    def setUp(self) -> None:
        self.backlog_source = patch.object(report.Path, "is_file", return_value=True)
        self.backlog_source.start()

    def tearDown(self) -> None:
        self.backlog_source.stop()

    def test_crosssell_is_enabled_by_default(self) -> None:
        args = report.parse_args([])

        with patch.object(report, "run") as run:
            report.build(args)

        report_command = run.call_args_list[0].args[0]
        self.assertIn("--crosssell", report_command)
        self.assertNotIn("--no-update-crosssell", report_command)

    def test_crosssell_can_use_local_cache(self) -> None:
        args = report.parse_args(["--no-update-crosssell"])

        with patch.object(report, "run") as run:
            report.build(args)

        report_command = run.call_args_list[0].args[0]
        self.assertIn("--crosssell", report_command)
        self.assertIn("--no-update-crosssell", report_command)

    def test_no_ai_skills_keeps_crosssell_under_the_global_switch(self) -> None:
        args = report.parse_args(["--no-ai-skills"])

        with patch.object(report, "run") as run:
            report.build(args)

        report_command = run.call_args_list[0].args[0]
        self.assertIn("--no-ai-skills", report_command)
        self.assertIn("--crosssell", report_command)

    def test_build_command_has_no_digest_or_llm_inputs(self) -> None:
        args = report.parse_args([])

        with patch.object(report, "run") as run:
            report.build(args)

        report_command = run.call_args_list[0].args[0]
        self.assertFalse(
            any("digest" in argument or "llm" in argument for argument in report_command)
        )

    def test_full_build_rebuilds_clickstream_companion_before_main_standalone(self) -> None:
        args = report.parse_args([])

        with patch.object(report, "run") as run:
            report.build(args)

        commands = [call.args[0] for call in run.call_args_list]
        self.assertIn(
            [report.NPM_COMMAND, "run", "build:clickstream"],
            commands,
        )
        self.assertLess(
            commands.index([report.NPM_COMMAND, "run", "build:clickstream"]),
            commands.index([report.NPM_COMMAND, "run", "build"]),
        )

    def test_legacy_builder_environment_defaults_are_supported(self) -> None:
        environment = {
            "INPUT_FILE": "custom-input.xlsx",
            "PERIOD": "III кв. 2026",
            "LEGACY_HTML": "custom-legacy.html",
            "REPORT_JSON": "custom-report.json",
            "STANDALONE_HTML": "custom-standalone.html",
        }

        with patch.dict(report.os.environ, environment, clear=False):
            args = report.parse_args([])

        self.assertEqual(args.input, report.ROOT / "custom-input.xlsx")
        self.assertEqual(args.period, "III кв. 2026")
        self.assertEqual(args.legacy_output, report.ROOT / "custom-legacy.html")
        self.assertEqual(args.data_output, report.ROOT / "custom-report.json")
        self.assertEqual(args.standalone_output, report.ROOT / "custom-standalone.html")

    def test_legacy_npm_environment_selects_frontend_executable(self) -> None:
        args = report.parse_args([])

        with patch.dict(report.os.environ, {"NPM": "custom-npm"}), patch.object(report, "run") as run:
            report.build(args)

        commands = [call.args[0] for call in run.call_args_list]
        self.assertIn(["custom-npm", "run", "build:clickstream"], commands)
        self.assertIn(["custom-npm", "run", "build"], commands)

    def test_full_build_rebuilds_backlog_data_from_source_by_default(self) -> None:
        args = report.parse_args([])

        with patch.object(report, "run") as run:
            report.build(args)

        commands = [call.args[0] for call in run.call_args_list]
        self.assertIn(
            [
                report.sys.executable,
                str(report.ROOT / "build_backlog_data.py"),
                "--input",
                str(report.DEFAULT_BACKLOG_INPUT),
                "--output",
                str(report.DEFAULT_BACKLOG_DATA),
            ],
            commands,
        )
        standalone_command = next(
            command
            for command in commands
            if command[1] == str(report.ROOT / "build_gravity_standalone.py")
        )
        self.assertEqual(
            standalone_command[-4:],
            [
                "--backlog-data",
                str(report.DEFAULT_BACKLOG_DATA),
                "--initiatives-data",
                str(report.DEFAULT_INITIATIVES_DATA),
            ],
        )

    def test_full_build_requires_backlog_source(self) -> None:
        args = report.parse_args([])

        with patch.object(report.Path, "is_file", return_value=False):
            with self.assertRaisesRegex(FileNotFoundError, "Backlog source not found"):
                report.build(args)


if __name__ == "__main__":
    unittest.main()
