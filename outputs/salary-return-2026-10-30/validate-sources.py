import csv
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
folder = Path(__file__).resolve().parent
config = json.loads((root / 'gravity-app/src/data/salary-products-q3-2026.json').read_text())
validated = []
for p in config['products']:
    for code in ['mehaniki.vozvrat_klientov', 'mehaniki.doprodazhi_up_sell']:
        fact = p['metrics'][code]
        s = fact['source']
        path = root / s['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == s['sha256']
        with path.open(encoding='utf-8-sig', newline='') as stream:
            row = list(csv.DictReader(stream, delimiter=';'))[s['csvRow']-2]
        payload = json.loads(row['Результат опроса (JSON)'])
        assert payload['surveyId'] == s['surveyId']
        assert payload['respondent']['name'].strip() == s['respondent'] == p['respondent']
        assert payload['answers']['upsell'] == s['answer']
        assert s['questionId'] == 'upsell'
        answer = payload['answers']['upsell']
        expected = int(('Возврат клиентов' in answer) if code == 'mehaniki.vozvrat_klientov' else any('upsell' in x.lower() or 'up-sell' in x.lower() for x in answer))
        assert fact['rawValue'] == expected
        assert s['csvRow'] == (5 if p['cohort'] == 'B2B' else 46)
        assert code not in p.get('unassignedAggregateMetricCodes', [])
        validated.append({'cohort':p['cohort'], 'code':code, 'csvRow':s['csvRow'], 'rawValue':fact['rawValue']})
result = {'allFourFactsSourceVerified':True, 'sourceShaVerified':True, 'validated':validated}
(folder / 'independent-source-validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps(result, ensure_ascii=False))
