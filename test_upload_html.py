from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from typing import Any

from upload_html import (
    default_credential_directories,
    parse_args,
    resolve_ca_bundle,
    resolve_certificate_path,
    upload_html,
    xrf_key_from_url,
)


class FakeResponse:
    status_code = 201

    def raise_for_status(self) -> None:
        return None


class UploadHtmlTest(unittest.TestCase):
    def test_default_credential_directories_cover_repo_parent_and_sandbox(self) -> None:
        repository_dir = Path("/workspace/repo")
        home = Path("/Users/alice")

        self.assertEqual(
            default_credential_directories(
                repository_dir=repository_dir,
                home=home,
            ),
            (
                Path("/workspace/certs"),
                Path("/Users/alice/Documents/Git/certs"),
                Path("/Users/alice/Sandbox/certs"),
            ),
        )

    def test_legacy_invocation_requires_only_certificate_password(self) -> None:
        args = parse_args(
            [
                "report.html",
                "https://example.test/upload?xrfkey=1234567890abcdef",
                "--cert-password",
                "secret",
            ]
        )

        self.assertEqual(args.cert_password, "secret")
        self.assertIsNone(args.cert_path)
        self.assertIsNone(args.ca_bundle)

    def test_credentials_are_discovered_by_username_then_legacy_name(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            directory = Path(temp_dir)
            repo_certs = directory / "certs"
            sandbox_certs = directory / "home" / "Sandbox" / "certs"
            repo_certs.mkdir()
            sandbox_certs.mkdir(parents=True)
            current_user_certificate = sandbox_certs / "alice.p12"
            legacy_certificate = repo_certs / "21090527.p12"
            ca_bundle = sandbox_certs / "sberca-chain.pem"
            current_user_certificate.touch()
            legacy_certificate.touch()
            ca_bundle.touch()
            directories = (repo_certs, sandbox_certs)

            self.assertEqual(
                resolve_certificate_path(
                    environ={}, username="alice", directories=directories
                ),
                current_user_certificate,
            )
            current_user_certificate.unlink()
            self.assertEqual(
                resolve_certificate_path(
                    environ={}, username="alice", directories=directories
                ),
                legacy_certificate,
            )
            self.assertEqual(
                resolve_ca_bundle(environ={}, directories=directories), ca_bundle
            )

    def test_cli_and_environment_paths_override_discovery(self) -> None:
        cli_path = Path("~/cli-client.p12")
        env_certificate = "/env/client.p12"
        env_ca_bundle = "/env/ca.pem"

        self.assertEqual(
            resolve_certificate_path(
                cli_path,
                environ={"HTML_UPLOAD_CERT_PATH": env_certificate},
                directories=(),
            ),
            cli_path.expanduser(),
        )
        self.assertEqual(
            resolve_certificate_path(
                environ={"HTML_UPLOAD_CERT_PATH": env_certificate}, directories=()
            ),
            Path(env_certificate),
        )
        self.assertEqual(
            resolve_ca_bundle(
                environ={"HTML_UPLOAD_CA_BUNDLE": env_ca_bundle}, directories=()
            ),
            Path(env_ca_bundle),
        )

    def test_xrf_key_is_read_from_upload_url(self) -> None:
        self.assertEqual(
            xrf_key_from_url("https://example.test/upload?xrfkey=1234567890abcdef"),
            "1234567890abcdef",
        )

    def test_invalid_xrf_key_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "16-character xrfkey"):
            xrf_key_from_url("https://example.test/upload?xrfkey=short")

    def test_upload_uses_binary_body_and_client_certificate(self) -> None:
        captured: dict[str, Any] = {}

        def write_credentials(
            certificate_path: Path,
            password: str,
            output_dir: Path,
        ) -> tuple[Path, Path]:
            self.assertEqual(certificate_path.name, "client.p12")
            self.assertEqual(password, "secret")
            certificate = output_dir / "client.pem"
            key = output_dir / "key.pem"
            certificate.touch()
            key.touch()
            return certificate, key

        def post(url: str, **kwargs: Any) -> FakeResponse:
            captured["url"] = url
            captured.update(kwargs)
            captured["content"] = kwargs["data"].read()
            return FakeResponse()

        with tempfile.TemporaryDirectory() as temp_dir:
            directory = Path(temp_dir)
            html_path = directory / "report.html"
            certificate_path = directory / "client.p12"
            ca_bundle = directory / "ca.pem"
            html_path.write_text("<html>report</html>", encoding="utf-8")
            certificate_path.touch()
            ca_bundle.touch()

            status = upload_html(
                html_path,
                "https://example.test/upload?xrfkey=1234567890abcdef",
                certificate_path,
                "secret",
                ca_bundle=ca_bundle,
                timeout=45,
                request_post=post,
                credential_writer=write_credentials,
            )

        self.assertEqual(status, 201)
        self.assertEqual(captured["headers"]["X-Qlik-Xrfkey"], "1234567890abcdef")
        self.assertEqual(captured["headers"]["Content-Type"], "text/html")
        self.assertEqual(captured["content"], b"<html>report</html>")
        self.assertEqual(captured["verify"], str(ca_bundle))
        self.assertEqual(captured["timeout"], 45)
        self.assertEqual(
            tuple(Path(item).name for item in captured["cert"]),
            ("client.pem", "key.pem"),
        )


if __name__ == "__main__":
    unittest.main()
