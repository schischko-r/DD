import unittest
from unittest.mock import patch

import build_gravity_report as report


class GravityBuildCrosssellTest(unittest.TestCase):
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

    def test_full_build_rebuilds_backlog_data_when_sbertrack_source_exists(self) -> None:
        args = report.parse_args([])

        with patch.object(report.Path, "is_file", return_value=True), patch.object(report, "run") as run:
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


if __name__ == "__main__":
    unittest.main()
