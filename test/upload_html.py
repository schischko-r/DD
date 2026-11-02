#!/usr/bin/env python3
"""Upload an HTML file to Qlik Sense mashup editor via its upload API.

Аутентификация — через p12-сертификат (как в clickstream_funnels.py).

Использование:
    python3 upload_html.py <input_path> <destination_url> [--login LOGIN] [--cert-password PASSWORD] [--certs-path PATH]
"""

from __future__ import annotations

import argparse
import logging
import sys
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import requests

from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
)
from cryptography.hazmat.primitives.serialization.pkcs12 import (
    load_key_and_certificates,
)

# ---------------------------------------------------------------------------
# Константы
# ---------------------------------------------------------------------------

DEFAULT_CERTS_PATH = "/Users/21090527/Documents/Git/certs"

LOG = logging.getLogger("upload_html")

HEADERS: dict[str, str] = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/147.0.0.0 Safari/537.36 SberBrowser/38.0.0.0"
    ),
    "sec-ch-ua": '"Chromium";v="147", "Not.A/Brand";v="8"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
}


# ---------------------------------------------------------------------------
# TLS-сессия (как в clickstream_funnels.py)
# ---------------------------------------------------------------------------

def build_tls_session(login: str, cert_password: str, certs_path: Path) -> requests.Session:
    LOG.info("Собираю TLS-сессию: login=%s, certs_path=%s", login, certs_path)

    p12_file = certs_path / f"{login}.p12"
    if not p12_file.exists():
        raise FileNotFoundError(f"Сертификат не найден: {p12_file}")

    LOG.debug("Загружаю p12: %s", p12_file)
    key, cert, _ = load_key_and_certificates(
        p12_file.read_bytes(), cert_password.encode("utf-8")
    )

    tmp = Path(tempfile.mkdtemp(prefix="upload_html_"))
    key_path = tmp / "private_key.pem"
    cert_path = tmp / "certificate.pem"
    key_path.write_bytes(
        key.private_bytes(
            encoding=Encoding.PEM,
            format=PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=NoEncryption(),
        )
    )
    cert_path.write_bytes(cert.public_bytes(encoding=Encoding.PEM))

    verify = str(certs_path / "sberca-chain.pem")
    LOG.debug("cert=%s, key=%s, verify=%s", cert_path, key_path, verify)

    session = requests.Session()
    session.headers.update(HEADERS)
    session.cert = (str(cert_path), str(key_path))
    session.verify = verify
    LOG.info("TLS-сессия готова")
    return session


# ---------------------------------------------------------------------------
# Загрузка
# ---------------------------------------------------------------------------

def upload_html(
    input_path: str,
    destination_url: str,
    login: str,
    cert_password: str,
    certs_path: Path,
    referer: str | None = None,
    origin: str | None = None,
) -> dict[str, Any]:
    """Читает HTML-файл и POST'ит на destination_url через TLS-сессию.

    Возвращает JSON-ответ сервера, распарсенный в dict.
    """
    with open(input_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    session = build_tls_session(login, cert_password, certs_path)

    # Прогрев: GET на referer-страницу (она же — точка входа в редактор),
    # чтобы получить cookie сессии (как _warmup в FunnelClient).
    # Referer по умолчанию: https://oko-qs.sigma.sbrf.ru/prom/dev-hub/mashup-editor/
    warmup_url = referer or destination_url
    LOG.debug("Warmup GET: %s", warmup_url)
    session.get(warmup_url, timeout=(10, 30))

    # Добавляем заголовки, специфичные для upload-запроса
    session.headers["content-type"] = "text/html"
    if referer:
        session.headers["Referer"] = referer
    if origin:
        session.headers["Origin"] = origin

    # X-Qlik-XrfKey — берём из query-параметра xrfkey URL (должны совпадать)
    qs = parse_qs(urlparse(destination_url).query)
    xrf = (qs.get("xrfkey") or [None])[0]
    if xrf:
        session.headers["X-Qlik-XrfKey"] = xrf
        LOG.debug("X-Qlik-XrfKey: %s", xrf)
    else:
        LOG.warning("xrfkey не найден в URL — XSRF-защита может сбросить запрос")

    print(f"Uploading {input_path} ({len(html_content)} bytes) → {destination_url}")
    LOG.info("POST %s (%s bytes)", destination_url, len(html_content))
    resp = session.post(
        destination_url,
        data=html_content.encode("utf-8"),
        timeout=(10, 120),
    )
    LOG.info("HTTP %s %s", resp.status_code, resp.reason)
    if not resp.ok:
        LOG.error("Response body (first 500): %s", resp.text[:500])
        print(f"Response: {resp.text}", file=sys.stderr)
        sys.exit(1)

    try:
        return resp.json()
    except Exception:
        print(f"Response text: {resp.text}")
        return {"raw_text": resp.text}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    parser = argparse.ArgumentParser(
        description="Upload an HTML file to Qlik mashup editor (TLS p12)."
    )
    parser.add_argument("input_path", help="Path to the local HTML file")
    parser.add_argument("destination_url", help="Full upload URL")
    parser.add_argument("--login", default="21090527", help="User login (p12 filename stem)")
    parser.add_argument("--cert-password", default=None, help="p12 password (fallback: secret_data)")
    parser.add_argument("--certs-path", default=DEFAULT_CERTS_PATH, help="Directory with *.p12 and sberca-chain.pem")
    parser.add_argument("--referer", help="Referer header (auto-detect from URL if omitted)")
    parser.add_argument("--origin", help="Origin header (auto-detect from URL if omitted)")
    args = parser.parse_args()

    # Пароль по умолчанию — из локального секрета (как в FunnelClient)
    cert_password = args.cert_password
    if cert_password is None:
        try:
            from secret_data import cert_password as _pwd  # type: ignore[import-untyped]

            cert_password = _pwd
        except ImportError:
            print("ERROR: --cert-password не указан и secret_data не найден", file=sys.stderr)
            sys.exit(1)

    # Referer / Origin по умолчанию из destination_url
    # (схема://хост + стандартный путь)
    url = args.destination_url
    if not args.referer:
        # берём схему+хост
        from urllib.parse import urlparse

        parsed = urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        args.referer = f"{base}/prom/dev-hub/mashup-editor/"
        args.origin = base

    result = upload_html(
        input_path=args.input_path,
        destination_url=args.destination_url,
        login=args.login,
        cert_password=cert_password,
        certs_path=Path(args.certs_path),
        referer=args.referer,
        origin=args.origin,
    )
    print(f"Response JSON: {result}")


if __name__ == "__main__":
    main()