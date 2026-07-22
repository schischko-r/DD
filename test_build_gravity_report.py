import unittest
from unittest.mock import patch

import build_gravity_report as report


class GravityBuildCrosssellTest(unittest.TestCase):
    def test_crosssell_is_disabled_by_default(self) -> None:
        args = report.parse_args([])

        with patch.object(report, "run") as run:
            report.build(args)

        report_command = run.call_args_list[0].args[0]
        self.assertNotIn("--crosssell", report_command)
        self.assertNotIn("--no-update-crosssell", report_command)

    def test_crosssell_can_be_enabled_with_local_cache(self) -> None:
        args = report.parse_args(["--crosssell", "--no-update-crosssell"])

        with patch.object(report, "run") as run:
            report.build(args)

        report_command = run.call_args_list[0].args[0]
        self.assertIn("--crosssell", report_command)
        self.assertIn("--no-update-crosssell", report_command)


if __name__ == "__main__":
    unittest.main()
