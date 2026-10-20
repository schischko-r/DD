"""Save each newly built Excel outflow report before it is embedded elsewhere."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


DEFAULT_ARCHIVE_ROOT = Path(__file__).resolve().parent / "outputs" / "outflow"


def archive_report(
    page: Path,
    data: Path,
    archive_root: Path = DEFAULT_ARCHIVE_ROOT,
) -> Path:
    """Copy the standalone HTML unchanged, keeping synthetic sources separate."""
    payload = json.loads(data.read_text(encoding="utf-8"))
    synthetic = payload.get("scenarios", {}).get("synthetic")
    source_type = (
        "synthetic" if synthetic is True
        else "from-excel" if synthetic is False
        else "unknown"
    )
    content = page.read_bytes()
    directory = archive_root / source_type
    directory.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    destination = directory / f"prolongation-{timestamp}-{uuid4().hex}.html"
    with destination.open("xb") as output:
        output.write(content)
    return destination
