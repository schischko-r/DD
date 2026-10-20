import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock

import pytest

import archive_outflow_report as archive
import build_gravity_report as gravity
import prolongation_from_excel as excel


@pytest.mark.parametrize("synthetic,folder", [(True, "synthetic"), (False, "from-excel"), (None, "unknown"), ("true", "unknown")])
def test_archive_preserves_bytes_and_separates_data_sources(tmp_path, monkeypatch, synthetic, folder):
    class FrozenClock:
        @staticmethod
        def now(tz):
            return datetime(2026, 10, 20, 12, 30, tzinfo=timezone.utc)

    monkeypatch.setattr(archive, "datetime", FrozenClock)
    page = tmp_path / "prolongation.html"
    payload = b"<!doctype html>\r\n<script>const report='\xd0\xbe\xd1\x82\xd1\x82\xd0\xbe\xd0\xba';</script>\n"
    page.write_bytes(payload)
    data = tmp_path / "data.json"
    data.write_text(json.dumps({"scenarios": {"synthetic": synthetic}}), encoding="utf-8")
    root = tmp_path / "archive"
    first = archive.archive_report(page, data, root)
    second = archive.archive_report(page, data, root)
    assert first != second
    assert first.parent == second.parent == root / folder
    assert first.suffix == second.suffix == ".html"
    assert first.read_bytes() == second.read_bytes() == page.read_bytes() == payload
    page.write_bytes(b"next build")
    assert first.read_bytes() == payload, "Later rebuilds cannot mutate previous reports"


def test_missing_synthetic_marker_is_not_labeled_as_excel(tmp_path):
    page = tmp_path / "page.html"
    page.write_bytes(b"report")
    data = tmp_path / "data.json"
    data.write_text("{}", encoding="utf-8")
    saved = archive.archive_report(page, data, tmp_path / "archive")
    assert saved.parent.name == "unknown"


@pytest.mark.parametrize("mode", [[], ["--outflow-from-excel"], ["--html-only"]])
def test_gravity_excel_build_archives_after_page_before_embedding(tmp_path, monkeypatch, mode):
    workbook = tmp_path / "source.xlsx"
    workbook.touch()
    page = tmp_path / "page.html"
    data = tmp_path / "data.json"
    root = tmp_path / "archive"
    data.write_text('{"scenarios":{"synthetic":false}}', encoding="utf-8")
    monkeypatch.setattr(gravity, "DEFAULT_PROLONGATION_WORKBOOK", workbook)
    monkeypatch.setattr(gravity, "DEFAULT_PROLONGATION_PAGE", page)
    monkeypatch.setattr(gravity, "DEFAULT_PROLONGATION_DATA", data)
    monkeypatch.setenv("AI_HTML_API_BASE_URL", "https://example.test")
    monkeypatch.setenv("AI_HTML_TOKEN", "test-token")
    monkeypatch.setenv("AI_HTML_BUILD_FROM_FILES", "0")
    monkeypatch.setenv("NODE_OPTIONS", "--max-old-space-size=1024")
    args = gravity.parse_args([*mode, "--backlog-input", str(workbook)])
    events = []

    def run(command, **kwargs):
        name = Path(command[1]).name if command[0] == gravity.sys.executable else command[-1]
        events.append(name)
        if name == "build_prolongation.py":
            page.write_bytes(b"fresh report from Excel")
        if name == "build_gravity_standalone.py" and mode != ["--html-only"]:
            assert len(list(root.rglob("*.html"))) == 1

    def save(page_arg, data_arg):
        assert page_arg == page and data_arg == data
        events.append("archive")
        return archive.archive_report(page_arg, data_arg, root)

    saver = Mock(side_effect=save)
    monkeypatch.setattr(gravity, "run", run)
    monkeypatch.setattr(gravity, "archive_report", saver)
    gravity.build(args)
    if mode == ["--html-only"]:
        saver.assert_not_called()
        assert not root.exists()
    else:
        saver.assert_called_once()
        assert events.index("build_prolongation.py") < events.index("archive") < events.index("build_gravity_standalone.py")
        assert events.index("archive") < events.index("build")
        assert events.index("build_report_data.py") < events.index("build_prolongation.py")
        saved = list((root / "from-excel").glob("*.html"))
        assert len(saved) == 1 and saved[0].read_bytes() == page.read_bytes()


@pytest.mark.parametrize("synthetic,folder", [(False, "from-excel"), (True, "synthetic")])
def test_direct_excel_pipeline_archives_the_fresh_page(tmp_path, monkeypatch, synthetic, folder):
    workbook = tmp_path / "source.xlsx"
    workbook.touch()
    page = tmp_path / "custom.html"
    data = tmp_path / "data.json"
    root = tmp_path / "archive"
    events = []
    monkeypatch.setattr(excel.build_report_data, "DEFAULT_PAGE", data)
    monkeypatch.setattr(excel.build_prolongation, "DEFAULT_DATA", data)

    def build_data(source, tree, output):
        assert source == workbook
        events.append("data")
        output.write_text(json.dumps({"scenarios": {"synthetic": synthetic}}), encoding="utf-8")

    def build_tree(*args):
        events.append("tree")

    def build_page(template, output, tree, source):
        assert output == page and source == data
        events.append("page")
        output.write_bytes(b"complete standalone report\n")
        return output.stat().st_size

    def save(output, source):
        events.append("archive")
        return archive.archive_report(output, source, root)

    monkeypatch.setattr(excel.build_report_data, "build", build_data)
    monkeypatch.setattr(excel.build_outflow_v3, "build", build_tree)
    monkeypatch.setattr(excel.build_prolongation, "build", build_page)
    monkeypatch.setattr(excel, "archive_report", save)
    excel.main([str(workbook), "--output", str(page)])
    assert events == ["data", "tree", "page", "archive"]
    saved = list((root / folder).glob("*.html"))
    assert len(saved) == 1 and saved[0].read_bytes() == page.read_bytes()


def test_failed_page_build_never_archives_stale_html(tmp_path, monkeypatch):
    page = tmp_path / "old.html"
    page.write_bytes(b"old report")
    monkeypatch.setattr(excel.build_report_data, "build", Mock())
    monkeypatch.setattr(excel.build_outflow_v3, "build", Mock())
    monkeypatch.setattr(excel.build_prolongation, "build", Mock(side_effect=RuntimeError("page build failed")))
    saver = Mock()
    monkeypatch.setattr(excel, "archive_report", saver)
    with pytest.raises(RuntimeError, match="page build failed"):
        excel.main([str(tmp_path / "source.xlsx"), "--output", str(page)])
    saver.assert_not_called()
    assert page.read_bytes() == b"old report"
