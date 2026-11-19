import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
csv.field_size_limit(100_000_000)
records = {}
for filename in ['questionare-responses(11).csv', 'questionare-responses(12).csv', 'questionare-responses(13).csv']:
    source = ROOT / 'ddi_3q_response' / filename
    with source.open(encoding='utf-8-sig', newline='') as stream:
        for line, row in enumerate(csv.reader(stream, delimiter=';'), 1):
            if row[3:5] != ['2026', '3']:
                continue
            payloads = []
            for cell in row:
                if not cell.startswith('{'):
                    continue
                try:
                    data = json.loads(cell)
                except ValueError:
                    continue
                if isinstance(data, dict) and data.get('team', {}).get('unit') == 'CX':
                    payloads.append(data)
            assert len(payloads) <= 1
            for data in payloads:
                team = data['team']
                answers = data['answers']
                selected = answers.get('support')
                assert isinstance(selected, list) and selected, team
                record = {
                    'unit': team['unit'], 'team': team['name'],
                    'selected': selected, 'comment': answers.get('supportOther', ''),
                    'teamId': team['id'], 'completedAt': data['completedAt'],
                    'source': str(source.relative_to(ROOT)), 'sourceRecord': line,
                }
                assert team['id'] not in records, f"Multiple responses: {team['name']}"
                records[team['id']] = record
rows = sorted(records.values(), key=lambda row: row['team'].casefold())
assert len(rows) == 11
assert sum(bool(row['comment']) for row in rows) == 1
(OUT / 'rows.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'teams': len(rows), 'selections': sum(len(r['selected']) for r in rows), 'comments': sum(bool(r['comment']) for r in rows)}, ensure_ascii=False))
