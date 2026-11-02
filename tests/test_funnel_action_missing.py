import csv
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('funnel_action_missing', ROOT / 'scripts/generate-funnel-action-missing.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def test_real_regeneration_is_source_backed_and_only_fills_applicable_nulls():
    snapshot = ROOT / 'outputs/initiative-actions-2026-10-30/before.json'
    paths = [ROOT / 'questionare-responses(11).csv', ROOT / 'analysis/1/questionare-responses(8).csv',
             ROOT / 'analysis/1/questionare-responses(9).csv']
    salary = ROOT / 'gravity-app/src/data/salary-products-q3-2026.json'
    hashes = {p: generator.survey.sha(p) for p in [snapshot, salary, *paths]}
    result = generator.build(snapshot, paths, salary)
    assert result == json.loads((ROOT / 'gravity-app/src/data/funnel-action-missing-q3-2026.json').read_text())
    assert result['counts']['fills'] == 132
    assert result['counts']['byRawValue'] == {'1': 88, '0': 44}
    before = {p['id'].split('::empty::')[0]: p for p in json.loads(snapshot.read_text())}
    for product in result['products']:
        metrics = {m['code']: m for b in before[product['id']]['metrics'] for m in b['metrics']}
        for code, fact in product['metrics'].items():
            assert code in generator.CODE_QUESTIONS
            assert metrics[code]['value'] is None
            assert metrics[code]['max_value'] == fact['expectedMaxValue'] > 0
            assert metrics[code].get('is_applicabble_flg') is not False
            assert fact['rawValue'] == generator.score(fact['source']['answer'])
            assert fact['source']['sources']
    conflicts = [p for p in result['pending'] if p['reason'] == 'conflicting_responses']
    assert len(conflicts) == 2
    assert all(p['name'] == 'ОМС' for p in conflicts)
    assert result['counts']['verified'] == 4
    assert hashes == {p: generator.survey.sha(p) for p in hashes}


def test_missing_answers_become_zero_yes_needs_no_link_and_conflicts_stay_pending(tmp_path, monkeypatch):
    monkeypatch.setattr(generator, 'ROOT', tmp_path)
    monkeypatch.setattr(generator.survey, 'ROOT', tmp_path)
    code = 'attract.initiatives_list'
    names = ['No response', 'No answer', 'Yes without proof', 'Existing score', 'Conflict', 'Identical', 'Irrelevant']
    before = [{'id': name, 'name': name, 'unit': 'DB', 'type': 'Продукт', 'metrics': [{'code': 'attract', 'metrics': [
        {'code': code, 'name': 'Составлен перечень инициатив по привлечению',
         'value': 1 if name == 'Existing score' else None,
         'max_value': 0 if name == 'Irrelevant' else 1,
         'is_applicabble_flg': name != 'Irrelevant'}]}]} for name in names]
    snapshot, salary, csv_path = tmp_path / 'before.json', tmp_path / 'salary.json', tmp_path / 'responses.csv'
    snapshot.write_text(json.dumps(before))
    salary.write_text(json.dumps({'products': []}))
    with csv_path.open('w') as stream:
        writer = csv.DictWriter(stream, fieldnames=['Год опроса', 'Квартал опроса', 'Результат опроса (JSON)'], delimiter=';')
        writer.writeheader()
        for name, answer in [('No answer', None), ('Yes without proof', 'Да'), ('Existing score', 'Нет'),
                             ('Conflict', 'Да'), ('Conflict', 'Нет'), ('Identical', 'Да'), ('Identical', 'Да')]:
            payload = {'team': {'id': name, 'name': name, 'unit': 'DB'}, 'respondent': {'name': 'Коллега'},
                       'answers': {} if answer is None else {'attractDeviations': answer}}
            writer.writerow({'Год опроса': 2026, 'Квартал опроса': 3, 'Результат опроса (JSON)': json.dumps(payload)})
    result = generator.build(snapshot, [csv_path], salary)
    facts = {p['name']: p['metrics'][code] for p in result['products']}
    assert facts['No response']['rawValue'] == 0
    assert facts['No response']['source']['missingReason'] == 'missing_response'
    assert facts['No answer']['rawValue'] == 0
    assert facts['No answer']['source']['missingReason'] == 'missing_answer'
    assert facts['Yes without proof']['rawValue'] == 1
    assert facts['Yes without proof']['source']['sources'][0]['evidence'] is None
    assert facts['Identical']['rawValue'] == 1
    assert len(facts['Identical']['source']['sources']) == 2
    assert 'Existing score' not in facts
    assert result['mismatches'][0]['currentValue'] == 1
    assert result['mismatches'][0]['expectedRawValue'] == 0
    assert 'Conflict' not in facts
    assert 'Irrelevant' not in facts
