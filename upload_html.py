#!/usr/bin/env python3
"""Upload a standalone HTML report to the Qlik Repository Service."""

from __future__ import annotations

import argparse
import getpass
import os
import tempfile
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse


LEGACY_CERTIFICATE_NAME = "21090527"
CA_BUNDLE_NAME = "sberca-chain.pem"


def default_credential_directories(
    *,
    repository_dir: Path | None = None,
    home: Path | None = None,
) -> tuple[Path, ...]:
    repository_dir = (
        repository_dir
        if repository_dir is not None
        else Path(__file__).resolve().parent
    )
    home = home if home is not None else Path.home()
    return (
        repository_dir.parent / "certs",
        home / "Documents" / "Git" / "certs",
        home / "Sandbox" / "certs",
    )


def resolve_certificate_path(
    explicit_path: Path | None = None,
    *,
    environ: Mapping[str, str] = os.environ,
    username: str | None = None,
    directories: tuple[Path, ...] | None = None,
) -> Path:
    if explicit_path is not None:
        return explicit_path.expanduser()

    environment_path = environ.get("HTML_UPLOAD_CERT_PATH")
    if environment_path:
        return Path(environment_path).expanduser()

    username = username or getpass.getuser()
    directories = (
        directories if directories is not None else default_credential_directories()
    )
    certificate_names = (
        f"{username}.p12",
        f"{username}.pfx",
        f"{LEGACY_CERTIFICATE_NAME}.p12",
        f"{LEGACY_CERTIFICATE_NAME}.pfx",
    )
    candidates = tuple(
        directory / name for name in certificate_names for directory in directories
    )
    for candidate in candidates:
        if candidate.is_file():
            return candidate

    checked = ", ".join(str(path) for path in candidates)
    raise FileNotFoundError(f"Client certificate not found; checked: {checked}")


def resolve_ca_bundle(
    explicit_path: Path | None = None,
    *,
    environ: Mapping[str, str] = os.environ,
    directories: tuple[Path, ...] | None = None,
) -> Path | None:
    if explicit_path is not None:
        return explicit_path.expanduser()

    environment_path = environ.get("HTML_UPLOAD_CA_BUNDLE")
    if environment_path:
        return Path(environment_path).expanduser()

    directories = (
        directories if directories is not None else default_credential_directories()
    )
    for directory in directories:
        candidate = directory / CA_BUNDLE_NAME
        if candidate.is_file():
            return candidate
    return None


def xrf_key_from_url(url: str) -> str:
    values = parse_qs(urlparse(url).query).get("xrfkey", [])
    if len(values) != 1 or len(values[0]) != 16:
        raise ValueError("Upload URL must contain one 16-character xrfkey query parameter")
    return values[0]


def write_client_credentials(
    certificate_path: Path,
    password: str,
    output_dir: Path,
) -> tuple[Path, Path]:
    try:
        from cryptography.hazmat.primitives.serialization import (
            Encoding,
            NoEncryption,
            PrivateFormat,
        )
        from cryptography.hazmat.primitives.serialization.pkcs12 import (
            load_key_and_certificates,
        )
    except ModuleNotFoundError as error:
        raise RuntimeError("Python package 'cryptography' is required for upload") from error

    private_key, certificate, additional_certificates = load_key_and_certificates(
        certificate_path.read_bytes(),
        password.encode("utf-8"),
    )
    if private_key is None or certificate is None:
        raise ValueError(f"PKCS#12 file has no client key or certificate: {certificate_path}")

    key_path = output_dir / "client-key.pem"
    certificate_pem_path = output_dir / "client-certificate.pem"
    key_path.write_bytes(
        private_key.private_bytes(
            encoding=Encoding.PEM,
            format=PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=NoEncryption(),
        )
    )
    key_path.chmod(0o600)
    certificate_pem_path.write_bytes(
        certificate.public_bytes(Encoding.PEM)
        + b"".join(
            item.public_bytes(Encoding.PEM) for item in additional_certificates or []
        )
    )
    return certificate_pem_path, key_path


def upload_html(
    html_path: Path,
    url: str,
    certificate_path: Path,
    certificate_password: str,
    *,
    ca_bundle: Path | None = None,
    timeout: int = 120,
    insecure: bool = False,
    request_post: Callable[..., Any] | None = None,
    credential_writer: Callable[[Path, str, Path], tuple[Path, Path]] | None = None,
) -> int:
    if not html_path.is_file():
        raise FileNotFoundError(f"HTML file not found: {html_path}")
    if not certificate_path.is_file():
        raise FileNotFoundError(f"Client certificate not found: {certificate_path}")
    if not insecure and ca_bundle is not None and not ca_bundle.is_file():
        raise FileNotFoundError(f"CA bundle not found: {ca_bundle}")
    if not certificate_password:
        raise ValueError("Client certificate password is empty")

    if request_post is None:
        try:
            import requests
        except ModuleNotFoundError as error:
            raise RuntimeError("Python package 'requests' is required for upload") from error
        request_post = requests.post

    credential_writer = credential_writer or write_client_credentials
    verify: bool | str = False if insecure else str(ca_bundle) if ca_bundle else True
    headers = {
        "Accept": "application/json",
        "Content-Type": "text/html",
        "X-Qlik-Xrfkey": xrf_key_from_url(url),
    }

    with tempfile.TemporaryDirectory(prefix="dd-html-upload-") as temp_dir:
        certificate_pem, key_pem = credential_writer(
            certificate_path,
            certificate_password,
            Path(temp_dir),
        )
        with html_path.open("rb") as html_file:
            response = request_post(
                url,
                headers=headers,
                data=html_file,
                cert=(str(certificate_pem), str(key_pem)),
                verify=verify,
                timeout=timeout,
            )
        response.raise_for_status()
        return int(response.status_code)


def parse_args(arguments: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html", type=Path)
    parser.add_argument("url")
    parser.add_argument("--cert-password")
    parser.add_argument("--cert-path", type=Path)
    parser.add_argument("--ca-bundle", type=Path)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--insecure", action="store_true")
    parser.add_argument(
        "--cert-password-env",
        default="HTML_UPLOAD_CERT_PASSWORD",
        help="Environment variable containing the PKCS#12 password",
    )
    return parser.parse_args(arguments)


def main() -> None:
    args = parse_args()
    password = args.cert_password or os.getenv(args.cert_password_env, "")
    if not password:
        raise SystemExit(
            f"Pass --cert-password or set {args.cert_password_env} before uploading"
        )
    status_code = upload_html(
        args.html,
        args.url,
        resolve_certificate_path(args.cert_path),
        password,
        ca_bundle=resolve_ca_bundle(args.ca_bundle),
        timeout=args.timeout,
        insecure=args.insecure,
    )
    print(f"Uploaded {args.html} (HTTP {status_code})")


if __name__ == "__main__":
    main()
