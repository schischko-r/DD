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
        extra_environment: dict[str, str] | None = None,
        frontend_installed: bool = True,
        upload_path_overrides: bool = False,
    ) -> list[str]:
        with tempfile.TemporaryDirectory() as temp_dir:
            directory = Path(temp_dir)
            log_path = directory / "commands.log"
            python_stub = directory / "python"
            python_stub.write_text(
                """#!/bin/sh
printf "%s\\n" "$*" >> "$COMMAND_LOG"
if [ "${DOTENV_TEST_VALUE+x}" = x ]; then
  printf "DOTENV_TEST_VALUE:%s\\n" "$DOTENV_TEST_VALUE" >> "$COMMAND_LOG"
fi
if [ "${DOTENV_COMMAND+x}" = x ]; then
  printf "DOTENV_COMMAND:%s\\n" "$DOTENV_COMMAND" >> "$COMMAND_LOG"
fi
""",
                encoding="utf-8",
            )
            python_stub.chmod(0o755)
            npm_stub = directory / "npm"
            npm_stub.write_text(
                '#!/bin/sh\nprintf "NPM:%s\\n" "$*" >> "$COMMAND_LOG"\n',
                encoding="utf-8",
            )
            npm_stub.chmod(0o755)

            environment = {
                "HOME": str(directory / "home"),
                "PATH": f"{directory}:/usr/bin:/bin",
                "PYTHON": str(python_stub),
                "COMMAND_LOG": str(log_path),
            }
            if not frontend_installed:
                frontend_dir = directory / "gravity-app"
                frontend_dir.mkdir()
                environment.update(
                    {
                        "GRAVITY_APP_DIR": str(frontend_dir),
                        "NPM": str(npm_stub),
                    }
                )
            if dotenv is not None:
                env_file = directory / ".env"
                env_file.write_text(dotenv, encoding="utf-8")
                environment["DD_ENV_FILE"] = str(env_file)
            if upload:
                certificate_dir = directory / "home" / "Documents" / "Git" / "certs"
                certificate_dir.mkdir(parents=True)
                (certificate_dir / "21090527.p12").touch()
                (certificate_dir / "sberca-chain.pem").touch()
                environment["HTML_UPLOAD_CERT_PASSWORD"] = "test-password"
            if upload_path_overrides:
                override_dir = directory / "overrides"
                override_dir.mkdir()
                certificate = override_dir / "client.p12"
                ca_bundle = override_dir / "ca.pem"
                certificate.touch()
                ca_bundle.touch()
                environment.update(
                    {
                        "HTML_UPLOAD_CERT_PATH": str(certificate),
                        "HTML_UPLOAD_CA_BUNDLE": str(ca_bundle),
                    }
                )
            environment.update(extra_environment or {})

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
        self.assertIn("build_gravity_report.py", invocations[0])
        self.assertNotIn("upload_html.py", invocations[0])

    def test_default_build_runs_builder_then_uploader(self) -> None:
        invocations = self.run_wrapper(upload=True)

        self.assertEqual(len(invocations), 2)
        self.assertIn("build_gravity_report.py", invocations[0])
        self.assertIn("upload_html.py", invocations[1])
        self.assertIn("45678_3_test_", invocations[1])
        self.assertNotIn("test-password", "\n".join(invocations))
        self.assertNotIn("--cert-password", invocations[1])
        self.assertIn("--cert-path", invocations[1])
        self.assertIn("/Documents/Git/certs/21090527.p12", invocations[1])
        self.assertIn("--ca-bundle", invocations[1])
        self.assertIn("/Documents/Git/certs/sberca-chain.pem", invocations[1])

    def test_upload_flag_runs_builder_then_uploader(self) -> None:
        invocations = self.run_wrapper("--upload", upload=True)

        self.assertEqual(len(invocations), 2)
        self.assertIn("build_gravity_report.py", invocations[0])
        self.assertIn("upload_html.py", invocations[1])
        self.assertIn("45678_3_test_", invocations[1])
        self.assertNotIn("test-password", "\n".join(invocations))
        self.assertNotIn("--cert-password", invocations[1])
        self.assertIn("--cert-path", invocations[1])

    def test_upload_path_overrides_are_forwarded_without_prevalidation(self) -> None:
        invocations = self.run_wrapper(
            upload=True,
            upload_path_overrides=True,
        )

        self.assertIn("--cert-path", invocations[1])
        self.assertIn("/overrides/client.p12", invocations[1])
        self.assertIn("--ca-bundle", invocations[1])
        self.assertIn("/overrides/ca.pem", invocations[1])

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

    def test_existing_environment_takes_precedence_over_dotenv(self) -> None:
        invocations = self.run_wrapper(
            "--data-only",
            dotenv='DOTENV_TEST_VALUE="from dotenv"\n',
            extra_environment={"DOTENV_TEST_VALUE": "from caller"},
        )

        self.assertEqual(invocations[1], "DOTENV_TEST_VALUE:from caller")

    def test_dotenv_standalone_path_is_used_for_automatic_upload(self) -> None:
        invocations = self.run_wrapper(
            upload=True,
            dotenv="STANDALONE_HTML=final_report_from_excel.html\n",
        )

        self.assertIn(str(ROOT / "final_report_from_excel.html"), invocations[1])
        self.assertNotIn(str(ROOT / "gravity-standalone.html"), invocations[1])

    def test_custom_npm_installs_dependencies_on_a_fresh_machine(self) -> None:
        invocations = self.run_wrapper(
            "--no-upload",
            frontend_installed=False,
        )

        self.assertEqual(invocations[0], "NPM:ci")
        self.assertIn("build_gravity_report.py", invocations[1])


if __name__ == "__main__":
    unittest.main()
