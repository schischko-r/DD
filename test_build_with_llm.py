import os
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent


class BuildWithLlmShellTest(unittest.TestCase):
    def run_script(self, crosssell_enabled: str | None = None) -> str:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "build_with_llm.sh").write_text(
                (ROOT / "build_with_llm.sh").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            for filename in (
                "flat_table.xlsx",
                "ai_skill_digest_export.xlsx",
                "ai_product_mapping.xlsx",
                ".env",
            ):
                (root / filename).touch()
            (root / "gravity-app" / "node_modules").mkdir(parents=True)
            log_path = root / "commands.log"
            stub_path = root / "stub.sh"
            stub_path.write_text(
                '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$COMMAND_LOG"\n',
                encoding="utf-8",
            )
            stub_path.chmod(0o755)
            env = {
                **os.environ,
                "PYTHON": str(stub_path),
                "NPM": str(stub_path),
                "COMMAND_LOG": str(log_path),
            }
            if crosssell_enabled is not None:
                env["CROSSSELL_ENABLED"] = crosssell_enabled

            subprocess.run(
                ["/bin/bash", str(root / "build_with_llm.sh")],
                cwd=root,
                env=env,
                check=True,
                capture_output=True,
                text=True,
            )
            return log_path.read_text(encoding="utf-8")

    def test_default_build_explicitly_skips_crosssell(self) -> None:
        log = self.run_script()
        build_command = next(line for line in log.splitlines() if "build_calc_report.py" in line)

        self.assertIn("--skip-crosssell", build_command)
        self.assertNotIn("--crosssell", build_command)

    def test_crosssell_can_be_explicitly_enabled(self) -> None:
        log = self.run_script("1")
        build_command = next(line for line in log.splitlines() if "build_calc_report.py" in line)

        self.assertIn("--crosssell", build_command)
        self.assertIn("--update-crosssell", build_command)
        self.assertNotIn("--skip-crosssell", build_command)


if __name__ == "__main__":
    unittest.main()
