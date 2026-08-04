from __future__ import annotations

import os
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SCRIPT = ROOT / "build_gravity_report.sh"


class BuildGravityReportShellTest(unittest.TestCase):
    def run_wrapper(
        self,
        *arguments: str,
        upload: bool = False,
        dotenv: str | None = None,
    ) -> list[str]:
        with tempfile.TemporaryDirectory() as temp_dir:
            directory = Path(temp_dir)
            log_path = directory / "uv.log"
            uv_stub = directory / "uv"
            uv_stub.write_text(
                """#!/bin/sh
printf "%s\\n" "$*" >> "$UV_STUB_LOG"
if [ "${DOTENV_TEST_VALUE+x}" = x ]; then
  printf "DOTENV_TEST_VALUE:%s\\n" "$DOTENV_TEST_VALUE" >> "$UV_STUB_LOG"
fi
if [ "${DOTENV_COMMAND+x}" = x ]; then
  printf "DOTENV_COMMAND:%s\\n" "$DOTENV_COMMAND" >> "$UV_STUB_LOG"
fi
""",
                encoding="utf-8",
            )
            uv_stub.chmod(0o755)
            npm_stub = directory / "npm"
            npm_stub.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            npm_stub.chmod(0o755)

            environment = {
                "PATH": f"{directory}:/usr/bin:/bin",
                "UV_STUB_LOG": str(log_path),
            }
            if dotenv is not None:
                env_file = directory / ".env"
                env_file.write_text(dotenv, encoding="utf-8")
                environment["DD_ENV_FILE"] = str(env_file)
            if upload:
                certificate = directory / "client.p12"
                ca_bundle = directory / "ca.pem"
                certificate.touch()
                ca_bundle.touch()
                environment.update(
                    {
                        "HTML_UPLOAD_CERT_PASSWORD": "test-password",
                        "HTML_UPLOAD_CERT_PATH": str(certificate),
                        "HTML_UPLOAD_CA_BUNDLE": str(ca_bundle),
                    }
                )

            subprocess.run(
                ["/bin/bash", str(SCRIPT), *arguments],
                cwd=ROOT,
                env=environment,
                check=True,
                capture_output=True,
                text=True,
            )
            return log_path.read_text(encoding="utf-8").splitlines()

    def test_no_upload_with_no_forwarded_arguments_runs_builder_once(self) -> None:
        invocations = self.run_wrapper("--no-upload")

        self.assertEqual(len(invocations), 1)
        self.assertIn("python build_gravity_report.py", invocations[0])
        self.assertNotIn("upload_html.py", invocations[0])

    def test_default_build_runs_builder_then_uploader(self) -> None:
        invocations = self.run_wrapper(upload=True)

        self.assertEqual(len(invocations), 2)
        self.assertIn("python build_gravity_report.py", invocations[0])
        self.assertIn("python upload_html.py", invocations[1])
        self.assertIn("45678_3_test_", invocations[1])
        self.assertNotIn("test-password", "\n".join(invocations))

    def test_data_only_never_uploads(self) -> None:
        invocations = self.run_wrapper("--data-only")

        self.assertEqual(len(invocations), 1)
        self.assertIn("--data-only", invocations[0])
        self.assertNotIn("upload_html.py", invocations[0])

    def test_dotenv_ignores_non_assignment_lines_without_executing_them(self) -> None:
        invocations = self.run_wrapper(
            "--data-only",
            dotenv=(
                'DOTENV_TEST_VALUE="hello world"\n'
                'DOTENV_COMMAND=$(printf "must not execute")\n'
                "title: ignored metadata\n"
            ),
        )

        self.assertEqual(len(invocations), 3)
        self.assertIn("--data-only", invocations[0])
        self.assertEqual(invocations[1], "DOTENV_TEST_VALUE:hello world")
        self.assertEqual(
            invocations[2],
            'DOTENV_COMMAND:$(printf "must not execute")',
        )


if __name__ == "__main__":
    unittest.main()
