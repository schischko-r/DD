"""Разреженные периоды и коммуникации в выгрузке пролонгации."""

import json

from openpyxl import Workbook

import build_report_data as brd


METRICS = {spec["metric"] for spec in brd.TREE}
METRICS.update(metric for _, _, metric, _ in brd.FUNNEL_STEPS)


def row(period, product, communication, value):
    result = {
        "report_dt": period + "-30" if period.endswith(("06", "09")) else period + "-31",
        "product": product,
        "communication": communication,
        "scenario_group": "ALL",
        "scenario": "ALL",
    }
    for metric in METRICS:
        result[f"{metric}_rur"] = value * 1e9
        result[f"{metric}_cnt"] = value
    return result


def test_sparse_product_and_communication_periods(tmp_path):
    rows = [
        row("2026-06", "deposit", "ALL", 100),
        row("2026-06", "deposit", "promo", 60),
        row("2026-07", "deposit", "ALL", 110),
        row("2026-07", "deposit", "no_promo", 40),
        row("2026-08", "casco", "ALL", 20),
        row("2026-08", "casco", "promo", 8),
        row("2026-08", "osago", "ALL", 30),
        row("2026-08", "osago", "no_promo", 12),
    ]
    book = Workbook()
    sheet = book.active
    sheet.title = "prolong"
    headers = list(rows[0])
    sheet.append(headers)
    for item in rows:
        sheet.append([item[column] for column in headers])
    workbook = tmp_path / "sparse.xlsx"
    book.save(workbook)

    tree_path, page_path = tmp_path / "tree.json", tmp_path / "page.json"
    brd.build(workbook, tree_path, page_path)
    tree = json.loads(tree_path.read_text())
    page = json.loads(page_path.read_text())
    assert "benchmark" not in page

    assert [period["id"] for period in page["meta"]["periods"]] == [
        "2026-08", "2026-07", "2026-06",
    ]
    products = {item["id"]: item for item in page["products"]}
    assert set(products["deposit"]["values"]) == {"2026-06", "2026-07"}
    assert set(products["casco"]["values"]) == {"2026-08"}
    assert set(products["osago"]["values"]) == {"2026-08"}
    assert set(products["casco"]["communicationValues"]["2026-08"]) == {"ALL", "promo"}
    assert set(products["osago"]["communicationValues"]["2026-08"]) == {"ALL", "no_promo"}
    assert products["casco"]["communicationValues"]["2026-08"]["promo"]["clnt"]["expected"] == 8
    assert products["casco"]["communicationValues"]["2026-08"]["promo"]["rur"]["outflow"] == 8
    assert "2026-07" not in products["casco"]["communicationValues"]
    assert "no_promo" not in products["casco"]["communicationValues"]["2026-08"]
    portfolio = next(item for item in tree["nodes"] if item["id"] == "portfolio")
    assert set(portfolio["series"]["clnt"]) == {"2026-06", "2026-07"}
    assert set(page["portfolio"]["clnt"]["total"]) == {"2026-06", "2026-07"}

    funnels = {item["id"]: item for item in page["funnels"]}
    assert set(funnels["all"]["series"]["clnt"]) == {"2026-06", "2026-07"}
    assert set(funnels["promo"]["series"]["clnt"]) == {"2026-06"}
    assert set(funnels["base"]["series"]["clnt"]) == {"2026-07"}
    assert "2026-07" not in funnels["promo"]["series"]["clnt"]
    assert "2026-08" not in funnels["all"]["series"]["clnt"]


def test_communication_rows_do_not_create_missing_all_total():
    export = brd.Export([
        row("2026-06", "deposit", "promo", 60),
        row("2026-06", "deposit", "no_promo", 50),
    ])
    assert export.periods_for("deposit", "ALL") == []
    assert export.total_series("ALL", "tree_portfolio", "clnt") == {}
    assert set(brd.build_funnels(export)[0]["series"]["clnt"]) == {"2026-06"}
