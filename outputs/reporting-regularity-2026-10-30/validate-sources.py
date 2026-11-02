import csv
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
folder = Path(__file__).resolve().parent
config = json.loads((root / 'gravity-app/src/data/reporting-regularity-missing-q3-2026.json').read_text())
before = json.loads((folder / 'before.json').read_text())
after = json.loads((folder / 'after.json').read_text())
key = lambda p: (p['name'], p['unit'], p['type'])
old = {(key(p), m['code']): m for p in before for b in p['metrics'] for m in b['metrics']}
new = {(key(p), m['code']): m for p in after for b in p['metrics'] for m in b['metrics']}
records = {}
for source in config['source']['csvFiles']:
    path = root / source['file']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == source['sha256']
    with path.open(encoding='utf-8-sig', newline='') as stream:
        records[source['file']] = {i: json.loads(r['Результат опроса (JSON)']) for i, r in enumerate(csv.DictReader(stream, delimiter=';'), 2)}

def expected(p, code, source):
    payload = records[source['file']][source['csvRow']]
    assert payload['answers'][source['questionId']] == source['answer']
    assert payload['surveyId'] == source['surveyId']
    assert payload['respondent']['name'] == source['respondent']
    assert 'чикин' not in source['respondent'].lower()
    answer = source['answer'].strip().lower()
    regularity = 'регулярность' in old[key(p), code]['name'].lower()
    if answer.startswith('да, автоматическая'):
        return 1
    if answer == 'да, по запросу':
        return 0.5 if regularity else 1
    assert answer in ('нет', 'затрудняюсь ответить'), answer
    return 0

facts = set()
categories = {}
for p in config['products']:
    for code, fact in p['metrics'].items():
        k = key(p), code
        assert k not in facts
        facts.add(k)
        o, n = old[k], new[k]
        assert o['value'] is None
        assert o.get('is_applicabble_flg') is not False and o['max_value'] > 0
        assert fact['rawValue'] == expected(p, code, fact['source'])
        assert n['value'] == fact['rawValue'] * o['max_value']
        categories[fact['rawValue']] = categories.get(fact['rawValue'], 0) + 1

changed = {k for k in old if old[k]['value'] != new[k]['value']}
assert changed == facts
for m in config['mismatches']:
    k = key(m), m['code']
    assert old[k]['value'] is not None
    assert new[k]['value'] == old[k]['value']
    assert expected(m, m['code'], m['source']) == m['expectedRawValue']
    assert old[k]['value'] != m['expectedValue']

result = dict(csvProvenanceVerified=True, allChangedCellsBackedByFacts=True, answerClassificationVerified=True,
              chikinaExcluded=True, fills=len(facts), categories=categories, mismatchesPreserved=len(config['mismatches']))
(folder / 'independent-source-validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps(result, ensure_ascii=False))
