import csv
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
config = json.loads((ROOT/'gravity-app/src/data/goals-tribe-source-q3-2026.json').read_text())
by_id = {p['id']: p for p in config['assignments']}
rows, excluded, errors = [], [], []
for file in sorted((ROOT/'ddi_3q_response').glob('*.csv')):
    with file.open(encoding='utf-8-sig', newline='') as handle:
        for line, row in enumerate(csv.DictReader(handle, delimiter=';'), 2):
            try:
                payload = json.loads(row['Результат опроса (JSON)'])
            except (KeyError, ValueError) as error:
                errors.append({'file': file.name, 'row': line, 'error': str(error)})
                continue
            respondent = payload.get('respondent', {}).get('name', '').strip()
            team = payload.get('team', {})
            answers = payload.get('answers', {})
            record = {'file': str(file.relative_to(ROOT)), 'fileSha256': hashlib.sha256(file.read_bytes()).hexdigest(),
                      'csvRow': line, 'completedAt': payload.get('completedAt'), 'respondent': respondent,
                      'team': team, 'year': row.get('Год опроса'), 'quarter': row.get('Квартал опроса'),
                      'answers': {key: value for key, value in answers.items() if key.lower().startswith('goals')},
                      'sources': {key: value for key, value in payload.get('questionSources', {}).items() if key.lower().startswith('goals')}}
            if 'чикин' in respondent.lower():
                record['reason'] = 'Excluded by earlier user instruction: do not use Chikina answers'
                excluded.append(record)
                continue
            if str(record['quarter']) != '3' or str(record['year']) != '2026':
                record['reason'] = 'Not Q3 2026'; excluded.append(record); continue
            mapped = by_id.get(team.get('id'))
            if not mapped:
                aliases = {'Трансграничные переводы #B2C': 'Трансграничные переводы', 'Сберчаевые #B2C': 'СберЧаевые', 'Трансграничный эквайринг #B2C': 'Трансграничный эквайринг'}
                name = aliases.get(team.get('name'), team.get('name'))
                matches = [p for p in config['assignments'] if p['name'] == name and p['unit'] == team.get('unit')]
                mapped = matches[0] if len(matches) == 1 else None
            record['mappedTeam'] = mapped['name'] if mapped else None
            record['catalogUnit'] = mapped['unit'] if mapped else None
            record['sourceTribe'] = mapped['sourceTribe'] if mapped else None
            if mapped:
                target = next(r for r in config['rows'] if r['unit']==mapped['sourceUnit'] and r['tribe']==mapped['sourceTribe'])
                record['currentTribeScores'] = target['scores']
            if record['mappedTeam'] == 'Зарплатный продукт':
                record['cohort'] = 'B2B' if 'сауткин' in respondent.lower() else 'B2C' if 'королева' in respondent.lower() else None
            rows.append(record)
questions = ['goalsMonitoring', 'goalsForecast', 'goalsFactorAnalysis']
groups = defaultdict(list)
for r in rows:
    groups[r['mappedTeam'] or r['team'].get('name')].append(r)
repeats = {team: [{'respondent': r['respondent'], 'completedAt': r['completedAt'], 'answers': {q:r['answers'].get(q) for q in questions}} for r in rs] for team,rs in groups.items() if len(rs)>1}
missing = [p['name'] for p in config['assignments'] if p['name'] not in groups]
summary = {'rawRows': len(rows)+len(excluded)+len(errors), 'includedRows': len(rows), 'excludedRows': len(excluded),
           'mappedTeams': len({r['mappedTeam'] for r in rows if r['mappedTeam']}), 'unmappedRows': len([r for r in rows if not r['mappedTeam']]),
           'distribution': {q: dict(Counter(r['answers'].get(q, '(нет ответа)') for r in rows)) for q in questions},
           'teamsWithoutResponse': missing, 'repeatedTeams': repeats, 'errors': errors}
result = {'summary': summary, 'rows': rows, 'excluded': excluded}
(Path(__file__).parent/'analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(summary,ensure_ascii=False,indent=2))
