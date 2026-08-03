from __future__ import annotations

import os
import shlex
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent


class BuildWithLlmShellTest(unittest.TestCase):
    def run_script(
        self,
        *,
        run_outside_root: bool = False,
    ) -> tuple[str, Path]:
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
                "HTML_UPLOAD_CERT_PASSWORD": "test-password",
            }
            working_directory = root
            if run_outside_root:
                working_directory = root / "external-caller" / "nested"
                working_directory.mkdir(parents=True)

            subprocess.run(
                ["/bin/bash", str(root / "build_with_llm.sh")],
                cwd=working_directory,
                env=env,
                check=True,
                capture_output=True,
                text=True,
            )
            return log_path.read_text(encoding="utf-8"), root

    def test_default_build_enables_crosssell(self) -> None:
        log, _ = self.run_script()
        build_command = next(line for line in log.splitlines() if "build_calc_report.py" in line)

        self.assertIn("--crosssell", build_command)
        self.assertIn("--update-crosssell", build_command)

    def test_upload_uses_absolute_paths_from_the_script_root(self) -> None:
        log, root = self.run_script()
        upload_command = next(line for line in log.splitlines() if "upload_html.py" in line)
        upload_args = shlex.split(upload_command)

        self.assertEqual(Path(upload_args[0]), root / "upload_html.py")
        self.assertEqual(Path(upload_args[1]), root / "gravity-standalone.html")
        self.assertTrue(Path(upload_args[0]).is_absolute())
        self.assertTrue(Path(upload_args[1]).is_absolute())

    def test_script_can_be_invoked_outside_its_root_directory(self) -> None:
        log, root = self.run_script(run_outside_root=True)
        upload_command = next(line for line in log.splitlines() if "upload_html.py" in line)
        upload_args = shlex.split(upload_command)

        self.assertIn("build_calc_report.py", log)
        self.assertEqual(Path(upload_args[0]), root / "upload_html.py")
        self.assertEqual(Path(upload_args[1]), root / "gravity-standalone.html")


if __name__ == "__main__":
    unittest.main()
