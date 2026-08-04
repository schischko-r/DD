#!/usr/bin/env python3
"""Upload a standalone HTML report to the Qlik Repository Service."""

from __future__ import annotations

import argparse
import os
import tempfile
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html", type=Path)
    parser.add_argument("url")
    parser.add_argument("--cert-path", type=Path, required=True)
    parser.add_argument("--ca-bundle", type=Path)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--insecure", action="store_true")
    parser.add_argument(
        "--cert-password-env",
        default="HTML_UPLOAD_CERT_PASSWORD",
        help="Environment variable containing the PKCS#12 password",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    password = os.getenv(args.cert_password_env, "")
    if not password:
        raise SystemExit(f"Set {args.cert_password_env} before uploading")
    status_code = upload_html(
        args.html,
        args.url,
        args.cert_path,
        password,
        ca_bundle=args.ca_bundle,
        timeout=args.timeout,
        insecure=args.insecure,
    )
    print(f"Uploaded {args.html} (HTTP {status_code})")


if __name__ == "__main__":
    main()
