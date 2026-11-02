import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('reporting_missing', ROOT / 'scripts/generate-reporting-regularity-missing.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def test_explicit_answer_categories_do_not_confuse_absent_with_no():
    for answer in ['Да, автоматическая (monthly/weekly)', 'Да, автоматическая (daily/weekly)']:
        assert generator.classify_answer(answer) == (1, 1)
    assert generator.classify_answer('Да, по запросу') == (1, .5)
    for answer in ['Нет', 'Затрудняюсь ответить']:
        assert generator.classify_answer(answer) == (0, 0)
    for answer in [None, '', 'Да', 'Отчет в формате Excel']:
        assert generator.classify_answer(answer) is None


def test_real_regeneration_preserves_sources_and_all_facts_fill_only_missing_values():
    snapshot = ROOT / 'outputs/reporting-regularity-2026-10-30/before.json'
    csvs = [ROOT / 'questionare-responses(11).csv', ROOT / 'analysis/1/questionare-responses(8).csv',
            ROOT / 'analysis/1/questionare-responses(9).csv']
    salary = ROOT / 'gravity-app/src/data/salary-products-q3-2026.json'
    hashes = {path: generator.sha(path) for path in [snapshot, salary, *csvs]}
    result = generator.build(snapshot, csvs, salary)
    assert result == json.loads((ROOT / 'gravity-app/src/data/reporting-regularity-missing-q3-2026.json').read_text())
    assert hashes == {path: generator.sha(path) for path in hashes}
    assert result['counts']['fills'] == 53
    assert result['counts']['mismatches'] == 14
    assert len(result['source']['excludedRespondents']) == 2
    before = {p['id'].split('::empty::')[0]: p for p in json.loads(snapshot.read_text())}
    for product in result['products']:
        prior = {m['code']: m for block in before[product['id']]['metrics'] for m in block['metrics']}
        for code, fact in product['metrics'].items():
            assert prior[code]['value'] is None
            assert prior[code]['max_value'] == fact['expectedMaxValue'] > 0
            assert prior[code].get('is_applicabble_flg') is not False
            expected = generator.classify_answer(fact['source']['answer'])
            assert fact['rawValue'] == expected[0 if code.endswith('.nastroena_otchetnostь') else 1]
    for mismatch in result['mismatches']:
        assert mismatch['currentRawValue'] != mismatch['expectedRawValue']
        assert mismatch['action'] == 'preserve_existing_score'
    assert all(row['reason'] in {'missing_answer', 'missing_response', 'ambiguous_response',
                                'not_applicable', 'unsupported_answer'} for row in result['pending'])
