from pathlib import Path

import pandas as pd
import pytest

import build_calc_report as report


ATTRACT = "Воронка привлечения"
CHURN = "Воронка оттока"
BENCHMARK = "Наличие бенчмарков"


def row(group, name="Настроена отчетность", value=0, maximum=1, unit="Юнит", product="Продукт", entity="продукт"):
    return dict(entity_type=entity, _unit_key=unit, _product_key=product,
                metric_group=group, metric_name_clean=name, metric_subgroup="Анализ",
                value_num=value, max_value_num=maximum, value=value, max_value=maximum)


@pytest.mark.parametrize("named", [False, True])
@pytest.mark.parametrize("attract_max,churn_max,expected", [
    (1, 0, {ATTRACT: (1, 1)}),
    (0, 1, {CHURN: (1, 1)}),
    (1, 1, {ATTRACT: (0.5, 0.5), CHURN: (0.5, 0.5)}),
    (0, 0, {ATTRACT: (0.5, 0.5), CHURN: (0.5, 0.5)}),
])
def test_shared_and_named_benchmark_use_nonbenchmark_positive_max_and_preserve_totals(named, attract_max, churn_max, expected):
    source = pd.DataFrame([row(CHURN if named else "BENCHMARKS", BENCHMARK, 1, 1),
                           row(ATTRACT, value=0, maximum=attract_max),
                           row(CHURN, value=0, maximum=churn_max),
                           row("Цели", "Прогноз", value=0.25, maximum=1)])
    result = (report.split_named_funnel_benchmarks if named else report.route_benchmark_rows)(source)
    benchmarks = result[result.metric_name_clean.eq(BENCHMARK)]
    actual = {record.metric_group: (record.value_num, record.max_value_num) for record in benchmarks.itertuples()}
    assert actual == expected
    assert result.value_num.sum() == source.value_num.sum()
    assert result.max_value_num.sum() == source.max_value_num.sum()
    pd.testing.assert_frame_equal(result[~result.metric_name_clean.eq(BENCHMARK)].reset_index(drop=True), source[~source.metric_name_clean.eq(BENCHMARK)].reset_index(drop=True), check_dtype=False)


def test_applicability_does_not_leak_between_same_names_units_or_entity_types():
    source = pd.DataFrame([
        row("BENCHMARKS", BENCHMARK, 1, 1), row(ATTRACT, maximum=1), row(CHURN, maximum=0),
        row(CHURN, maximum=1, unit="Другой юнит"),
        row(CHURN, maximum=1, entity="сегмент"),
        row(CHURN, maximum=1, product="Другой продукт"),
    ])
    result = report.route_benchmark_rows(source)
    benchmark = result[result.metric_name_clean.eq(BENCHMARK)]
    assert benchmark.metric_group.tolist() == [ATTRACT]
    assert benchmark.value_num.tolist() == benchmark.max_value_num.tolist() == [1]


def test_existing_named_benchmarks_in_both_funnels_are_not_split_again():
    source = pd.DataFrame([row(ATTRACT, BENCHMARK, 0.5, 0.5), row(CHURN, BENCHMARK, 0.5, 0.5), row(ATTRACT)])
    result = report.split_named_funnel_benchmarks(source)
    pd.testing.assert_frame_equal(result, source)


@pytest.mark.parametrize("product,expected_value", [("СберСова", 1), ("СберСпасибо", 0)])
def test_actual_excel_products_keep_full_benchmark_in_the_only_applicable_funnel(product, expected_value):
    source = pd.read_excel(Path(__file__).with_name("flat_table.xlsx"))
    rows = report.normalize_flat_metric_rows(report.normalize_flat_table_frame(source))
    team = rows[rows._product_key.eq(product)]
    benchmark = team[team.metric_name_clean.eq(BENCHMARK)]
    assert benchmark.metric_group.tolist() == [ATTRACT]
    assert benchmark.value_num.tolist() == [expected_value]
    assert benchmark.max_value_num.tolist() == [1]
    assert team.loc[~team.metric_name_clean.eq(BENCHMARK) & team.metric_group.eq(CHURN), "max_value_num"].sum() == 0


def test_existing_custom_inapplicable_benchmark_keeps_its_prior_half_weight():
    source = pd.read_excel(Path(__file__).with_name("flat_table.xlsx"))
    rows = report.normalize_flat_metric_rows(report.normalize_flat_table_frame(source))
    data, _ = report.build_report_data_from_metric_rows(rows, "II кв. 2026")
    team = next(team for team in data["products"] if team["name"] == "Выписки, справки")
    benchmarks = {metric["code"]: metric for block in team["metrics"] for metric in block["metrics"] if "benchmarks" in metric["code"]}
    assert benchmarks["attract.benchmarks"]["value"] == 0
    assert benchmarks["attract.benchmarks"]["max_value"] == 0.5
    if "churn.benchmarks" in benchmarks:
        assert benchmarks["churn.benchmarks"]["is_applicabble_flg"] is False
        assert benchmarks["churn.benchmarks"]["max_value"] == 0
