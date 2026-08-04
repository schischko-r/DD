from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from typing import Any

from upload_html import upload_html, xrf_key_from_url


class FakeResponse:
    status_code = 201

    def raise_for_status(self) -> None:
        return None


class UploadHtmlTest(unittest.TestCase):
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
