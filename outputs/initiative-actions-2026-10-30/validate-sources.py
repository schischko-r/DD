import csv
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
folder = Path(__file__).resolve().parent
config = json.loads((root / 'gravity-app/src/data/funnel-action-missing-q3-2026.json').read_text())
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

def verify_source(source, code):
    payload = records[source['file']][source['csvRow']]
    assert payload['answers'].get(source['questionId']) == source['answer']
    assert payload['surveyId'] == source['surveyId']
    assert payload['respondent']['name'] == source['respondent']
    assert 'чикин' not in source['respondent'].lower()
    assert source['questionId'] in (['attractDeviations'] if code.startswith('attract.') else ['deviations', 'churnDeviations'])
    answer = (source['answer'] or '').strip().lower()
    assert answer in ('да', 'нет', 'затрудняюсь ответить', ''), answer
    return int(answer == 'да')

facts = set()
by_value = {}
by_code = {}
no_proof_yes = 0
missing = 0
for p in config['products']:
    for code, fact in p['metrics'].items():
        k = key(p), code
        assert k not in facts
        facts.add(k)
        o, n = old[k], new[k]
        assert o['value'] is None
        assert o.get('is_applicabble_flg') is not False and o['max_value'] > 0
        sources = fact['source']['sources']
        if sources:
            expected = {verify_source(s, code) for s in sources}
            assert len(expected) == 1
            assert fact['rawValue'] == next(iter(expected))
            if all(s['answer'] is None for s in sources):
                assert fact['source']['missingReason'] == 'missing_answer'
                missing += 1
            else:
                assert fact['source']['missingReason'] is None
        else:
            assert fact['source']['missingReason'] == 'missing_response'
            assert fact['rawValue'] == 0
            missing += 1
        assert n['value'] == fact['rawValue'] * o['max_value']
        by_value[fact['rawValue']] = by_value.get(fact['rawValue'], 0) + 1
        by_code[code] = by_code.get(code, 0) + 1
        no_proof_yes += fact['rawValue'] == 1 and not any(s['evidence'] for s in sources)

assert facts == {k for k in old if old[k]['value'] != new[k]['value']}
for p in config['pending']:
    k = key(p), p['code']
    assert old[k]['value'] == new[k]['value']
    if p['reason'] == 'conflicting_responses':
        assert old[k]['value'] is None
        assert len({verify_source(s, p['code']) for s in p['sources']}) > 1
    elif p['reason'] == 'not_applicable':
        assert old[k].get('is_applicabble_flg') is False or old[k]['max_value'] <= 0
    else:
        raise AssertionError(p)
for p in config['mismatches']:
    assert new[key(p), p['code']]['value'] == old[key(p), p['code']]['value']

result = dict(csvProvenanceVerified=True, allChangedCellsBackedByFacts=True, answerClassificationVerified=True,
              chikinaExcluded=True, fills=len(facts), byValue=by_value, byCode=by_code, missingReasonFacts=missing,
              yesWithoutProofAccepted=no_proof_yes, pendingReasonsVerified=len(config['pending']), mismatchesPreserved=len(config['mismatches']))
(folder / 'independent-source-validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps(result, ensure_ascii=False))
