from __future__ import annotations

import io
import os
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from typing import Any
from unittest.mock import patch

from upload_html import (
    DEFAULT_BOOTSTRAP_URL,
    default_credential_directories,
    main,
    origin_from_url,
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


class UnauthorizedResponse:
    status_code = 401

    def raise_for_status(self) -> None:
        raise AssertionError("401 should have a QRS-specific error")


class TemporaryFailureResponse:
    status_code = 504

    def raise_for_status(self) -> None:
        raise AssertionError("504 should only be raised after retries are exhausted")


class FakeSession:
    def __init__(
        self,
        *,
        bootstrap_response: Any = None,
        post_response: Any = None,
        cookies: Any = None,
    ) -> None:
        self.cert: Any = None
        self.verify: Any = None
        self.cookies = {"session": "created"} if cookies is None else cookies
        self.bootstrap_response = bootstrap_response or FakeResponse()
        self.post_response = post_response or FakeResponse()
        self.calls: list[tuple[str, str, dict[str, Any]]] = []

    def get(self, url: str, **kwargs: Any) -> Any:
        self.calls.append(("GET", url, kwargs))
        return self.bootstrap_response

    def post(self, url: str, **kwargs: Any) -> FakeResponse:
        kwargs["body"] = kwargs["data"].read()
        self.calls.append(("POST", url, kwargs))
        return self.post_response


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

    def test_bootstrap_url_requires_http_origin(self) -> None:
        with self.assertRaisesRegex(ValueError, "HTTP\(S\) origin"):
            origin_from_url("/prom/dev-hub/mashup-editor/")

    def test_upload_bootstraps_shared_certificate_session_before_binary_post(self) -> None:

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

        session = FakeSession()

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
                user_agent="test-browser-agent",
                session_factory=lambda: session,
                credential_writer=write_credentials,
            )

        self.assertEqual(status, 201)
        self.assertEqual([call[0] for call in session.calls], ["GET", "POST"])
        get_call, post_call = session.calls
        self.assertEqual(get_call[1], DEFAULT_BOOTSTRAP_URL)
        self.assertTrue(get_call[2]["allow_redirects"])
        self.assertEqual(get_call[2]["timeout"], 45)
        self.assertEqual(get_call[2]["headers"]["User-Agent"], "test-browser-agent")
        self.assertEqual(get_call[2]["headers"]["Accept-Language"], "en-US,en;q=0.9")
        self.assertEqual(
            post_call[2]["headers"],
            {
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "en-US",
                "Content-Type": "text/html",
                "Origin": "https://oko-qs.sigma.sbrf.ru",
                "Referer": DEFAULT_BOOTSTRAP_URL,
                "User-Agent": "test-browser-agent",
                "X-Qlik-Xrfkey": "1234567890abcdef",
            },
        )
        self.assertEqual(post_call[2]["body"], b"<html>report</html>")
        self.assertEqual(post_call[2]["timeout"], 45)
        self.assertEqual(session.verify, str(ca_bundle))
        self.assertEqual(
            tuple(Path(item).name for item in session.cert),
            ("client.pem", "key.pem"),
        )

    def test_custom_bootstrap_url_sets_get_referer_and_post_origin(self) -> None:
        session = FakeSession()
        bootstrap_url = "https://custom.example.test:8443/bootstrap/path?view=editor"

        with tempfile.TemporaryDirectory() as temp_dir:
            directory = Path(temp_dir)
            html_path = directory / "report.html"
            certificate_path = directory / "client.p12"
            html_path.write_text("<html>report</html>", encoding="utf-8")
            certificate_path.touch()

            status = upload_html(
                html_path,
                "https://example.test/upload?xrfkey=1234567890abcdef",
                certificate_path,
                "secret",
                bootstrap_url=bootstrap_url,
                session_factory=lambda: session,
                credential_writer=lambda _certificate, _password, output_dir: (
                    output_dir / "client.pem",
                    output_dir / "key.pem",
                ),
            )

        self.assertEqual(status, 201)
        get_call, post_call = session.calls
        self.assertEqual(get_call[1], bootstrap_url)
        self.assertEqual(post_call[2]["headers"]["Referer"], bootstrap_url)
        self.assertEqual(post_call[2]["headers"]["Origin"], "https://custom.example.test:8443")
        self.assertEqual(
            tuple(Path(item).name for item in session.cert),
            ("client.pem", "key.pem"),
        )
        self.assertEqual(session.cookies, {"session": "created"})

    def test_upload_requires_cookie_created_by_bootstrap(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            directory = Path(temp_dir)
            html_path = directory / "report.html"
            certificate_path = directory / "client.p12"
            html_path.write_text("<html>report</html>", encoding="utf-8")
            certificate_path.touch()

            with self.assertRaisesRegex(RuntimeError, "without creating a session cookie"):
                upload_html(
                    html_path,
                    "https://example.test/upload?xrfkey=1234567890abcdef",
                    certificate_path,
                    "secret",
                    session_factory=lambda: FakeSession(cookies={}),
                    credential_writer=lambda _certificate, _password, output_dir: (
                        output_dir / "client.pem",
                        output_dir / "key.pem",
                    ),
                )

    def test_upload_401_identifies_upload_phase(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            directory = Path(temp_dir)
            html_path = directory / "report.html"
            certificate_path = directory / "client.p12"
            html_path.write_text("<html>report</html>", encoding="utf-8")
            certificate_path.touch()

            with self.assertRaisesRegex(RuntimeError, "QRS upload rejected"):
                upload_html(
                    html_path,
                    "https://example.test/upload?xrfkey=1234567890abcdef",
                    certificate_path,
                    "secret",
                    session_factory=lambda: FakeSession(post_response=UnauthorizedResponse()),
                    credential_writer=lambda _certificate, _password, output_dir: (
                        output_dir / "client.pem",
                        output_dir / "key.pem",
                    ),
                )

    def test_upload_retries_temporary_gateway_failures_with_fresh_file_handles(self) -> None:
        session = FakeSession()
        responses = [TemporaryFailureResponse(), TemporaryFailureResponse(), FakeResponse()]

        def post(_url: str, **kwargs: Any) -> Any:
            kwargs["body"] = kwargs["data"].read()
            session.calls.append(("POST", _url, kwargs))
            return responses.pop(0)

        session.post = post  # type: ignore[method-assign]
        delays: list[float] = []
        with tempfile.TemporaryDirectory() as temp_dir:
            directory = Path(temp_dir)
            html_path = directory / "report.html"
            certificate_path = directory / "client.p12"
            html_path.write_text("<html>report</html>", encoding="utf-8")
            certificate_path.touch()

            status = upload_html(
                html_path,
                "https://example.test/upload?xrfkey=1234567890abcdef",
                certificate_path,
                "secret",
                retries=2,
                retry_delay=1.5,
                sleeper=delays.append,
                session_factory=lambda: session,
                credential_writer=lambda _certificate, _password, output_dir: (
                    output_dir / "client.pem",
                    output_dir / "key.pem",
                ),
            )

        self.assertEqual(status, 201)
        self.assertEqual(delays, [1.5, 3.0])
        post_calls = [call for call in session.calls if call[0] == "POST"]
        self.assertEqual(len(post_calls), 3)
        self.assertTrue(all(call[2]["body"] == b"<html>report</html>" for call in post_calls))

    def test_upload_does_not_retry_non_temporary_failure(self) -> None:
        session = FakeSession(post_response=UnauthorizedResponse())
        with tempfile.TemporaryDirectory() as temp_dir:
            directory = Path(temp_dir)
            html_path = directory / "report.html"
            certificate_path = directory / "client.p12"
            html_path.write_text("<html>report</html>", encoding="utf-8")
            certificate_path.touch()

            with self.assertRaisesRegex(RuntimeError, "QRS upload rejected"):
                upload_html(
                    html_path,
                    "https://example.test/upload?xrfkey=1234567890abcdef",
                    certificate_path,
                    "secret",
                    retries=2,
                    sleeper=lambda _delay: self.fail("Unexpected retry"),
                    session_factory=lambda: session,
                    credential_writer=lambda _certificate, _password, output_dir: (
                        output_dir / "client.pem",
                        output_dir / "key.pem",
                    ),
                )
        self.assertEqual(len([call for call in session.calls if call[0] == "POST"]), 1)

    def test_upload_401_explains_qrs_authorization_rejection(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            directory = Path(temp_dir)
            html_path = directory / "report.html"
            certificate_path = directory / "client.p12"
            html_path.write_text("<html>report</html>", encoding="utf-8")
            certificate_path.touch()

            with self.assertRaisesRegex(RuntimeError, "client certificate authorization"):
                upload_html(
                    html_path,
                    "https://example.test/upload?xrfkey=1234567890abcdef",
                    certificate_path,
                    "secret",
                    session_factory=lambda: FakeSession(bootstrap_response=UnauthorizedResponse()),
                    credential_writer=lambda _certificate, _password, output_dir: (
                        output_dir / "client.pem",
                        output_dir / "key.pem",
                    ),
                )

    def test_main_forwards_bootstrap_environment(self) -> None:
        output = io.StringIO()
        with (
            patch.dict(os.environ, {"HTML_UPLOAD_CERT_PASSWORD": "test-password", "HTML_UPLOAD_BOOTSTRAP_URL": "https://example.test/bootstrap"}, clear=True),
            patch("upload_html.resolve_certificate_path", return_value=Path("/certs/client.p12")),
            patch("upload_html.resolve_ca_bundle", return_value=None),
            patch("upload_html.upload_html", return_value=201) as upload,
            patch("sys.argv", ["upload_html.py", "report.html", "https://example.test/upload?xrfkey=1234567890abcdef"]),
            redirect_stdout(output),
        ):
            main()

        self.assertEqual(upload.call_args.args[2], Path("/certs/client.p12"))
        self.assertEqual(upload.call_args.kwargs["bootstrap_url"], "https://example.test/bootstrap")
        self.assertNotIn("test-password", output.getvalue())


if __name__ == "__main__":
    unittest.main()
