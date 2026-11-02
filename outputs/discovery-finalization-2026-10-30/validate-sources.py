import csv
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
folder = Path(__file__).resolve().parent
config = json.loads((root / 'gravity-app/src/data/discovery-metrics-q3-2026.json').read_text())
backlog = json.loads((root / config['source']['backlogFile']).read_text())
assert hashlib.sha256((root / config['source']['backlogFile']).read_bytes()).hexdigest() == config['source']['backlogSha256']
csvs = {}
for file, digest in config['source']['sourceHashes'].items():
    path = root / file
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest
    with path.open(encoding='utf-8-sig', newline='') as stream:
        csvs[file] = {i: json.loads(r['Результат опроса (JSON)']) for i, r in enumerate(csv.DictReader(stream, delimiter=';'), 2)}

def grade(answer, location):
    answer = (answer or '').strip().lower()
    if '20 до 39' in answer: return 0.5
    if 'меньше 20' in answer or 'нет аналитик' in answer or 'затрудняюсь' in answer: return 0
    if '40 до 79' in answer or '80' in answer:
        location = (location or '').lower()
        return 1 if 'jira/sbertrack' in location and 'вне' not in location else 0.5
    raise AssertionError(answer)

def verify_response(r):
    payload = csvs[r['file']][r['csvRow']]
    assert payload['respondent']['name'] == r['respondent']
    assert 'чикин' not in r['respondent'].lower()
    assert payload['answers'].get('discovery') == r['answer']
    assert payload['answers'].get('discoveryBacklogType') == r['backlogType']
    return grade(r['answer'], r['backlogType'])

allowed = {'Рабочий возраст','Top Affluent','Молодежь','Объект Авто','Персональная рекомендация','КАСКО','ОСАГО','Личная защита Плюс','Переводы по РФ','SberPay Вжух','Оплата улыбкой'}
decomp, survey = [], []
for p in config['products']:
    fact = p['metrics']['hyp.discovery_40_backlog']
    s = fact['source']
    if s['origin'] == 'userConfirmedDiscoveryDecompositionAssessment':
        assert p['name'] in allowed
        decomp.append(p['name'])
        parts = s['pointer'].strip('/').split('/')
        t = backlog['teams'][int(parts[1])]
        q = t['quarters'][int(parts[3])]
        assert s['teamKey'] == t['key']
        assert s['memberTeams'] == t['memberTeams']
        assert s['sharedAssessment'] == (len(t['memberTeams']) > 1)
        assert q['key'] == s['quarterKey'] == '2026-Q3'
        for k in ('start','end','dataThrough','createdCount','discoveryCount'):
            assert s[k] == q[k]
        ratio = q['discoveryCount'] / q['createdCount'] * 100
        assert abs(s['actualShare'] - ratio) < 1e-10
        assert s['displayedShare'] == q['discoveryShare']
        assert fact['rawValue'] == (1 if ratio >= 40 else 0.5 if ratio >= 20 else 0)
        assert not s['explicitAnswerPresent']
        for r in s['surveyResponses']:
            payload = csvs[r['file']][r['csvRow']]
            assert payload['answers'].get('discovery') is None
    else:
        survey.append(p['name'])
        assert {verify_response(r) for r in s['responses']} == {fact['rawValue']}

assert set(decomp) == allowed and len(decomp) == 11
for p in config['pending']:
    assert len({verify_response(r) for r in p['responses']}) > 1

salary = json.loads((root / 'gravity-app/src/data/salary-products-q3-2026.json').read_text())
b2c = next(p for p in salary['products'] if p['name'] == 'Зарплатный продукт #B2C')
f = b2c['metrics']['hyp.discovery_40_backlog']
assert f['rawValue'] == 0.5
s = f['source']
path = root / s['file']
assert hashlib.sha256(path.read_bytes()).hexdigest() == s['sha256']
with path.open(encoding='utf-8-sig',newline='') as stream:
    row = list(csv.DictReader(stream, delimiter=';'))[s['csvRow']-2]
payload = json.loads(row['Результат опроса (JSON)'])
assert payload['respondent']['name'] == s['respondent']
assert payload['answers']['discovery'] == s['answer'] == 'От 20 до 39%'
assert b2c['respondent'] == s['respondent']

result = dict(decompositionFactsVerified=len(decomp),surveyFactsVerified=len(survey)+1,
              salaryB2cVerified=True,explicitSberIdPriorityVerified=next(p for p in config['products'] if p['name']=='SberID')['metrics']['hyp.discovery_40_backlog']['rawValue']==0.5,
              conflictingTeamsVerified=[p['name'] for p in config['pending']],csvHashesVerified=True,backlogQ3AndSharedGroupsVerified=True)
(folder / 'independent-source-validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps(result, ensure_ascii=False))
