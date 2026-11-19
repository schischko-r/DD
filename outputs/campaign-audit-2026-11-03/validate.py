import json
from pathlib import Path
from collections import Counter
from datetime import datetime
import openpyxl

out = Path(__file__).resolve().parent
audit = json.loads((out / 'audit.json').read_text())
source = openpyxl.load_workbook(out / 'Кампейнинг.xlsx', data_only=True).active
result = openpyxl.load_workbook(out / 'Сверка_кампейнинг_DDI_III_2026.xlsx', data_only=True)
raw = result['Кампейнинг']
assert source.max_row == 516
for row in source.iter_rows():
    for cell in row:
        actual = raw.cell(cell.row, cell.column).value
        if cell.column == 1 and cell.row > 1:
            expected = datetime.fromisoformat(cell.value).date()
            assert isinstance(actual, datetime) and actual.date() == expected, (cell.coordinate, actual)
        else:
            assert actual == cell.value, (cell.coordinate, cell.value, actual)

labels = {'attract.campaign_launches':'Запуски кампаний за квартал', 'attract.nalichie_self_service':'Наличие Self-service',
          'attract.nalichie_uspeshnyh_biznes_zapuskov':'Наличие успешных бизнес-запусков'}
by_key = {(r['unit'], r['team'], labels[r['metric']]): r for r in audit['audits']}
assert len(by_key) == 228
sheet = result['Сверка']
seen = set()
for row in sheet.iter_rows(min_row=8, max_row=235, values_only=True):
    key = row[:3]
    assert key not in seen
    seen.add(key)
    r = by_key[key]
    assert row[3] == (r['score'] if r['score'] is not None else 'Не применимо')
    assert row[4] == r['status']
    assert row[12:15] == (r['value'], r['max'], 'Да' if r['included'] else 'Нет')
    rows = r['sourceRows']
    expected_sums = tuple(sum(source.cell(i,c).value for i in rows) for c in [3,7,4,8]) if rows else (None,)*4
    assert row[8:12] == expected_sums, (key, row[8:12], expected_sums)
    for i in rows:
        assert source.cell(i,1).value.startswith(r['sourcePeriod'])
        assert source.cell(i,2).value in r['sourceNames']
    if rows:
        vals = [source.cell(i,3).value for i in rows] if r['metric'].endswith('nalichie_self_service') else [source.cell(i,c).value for i in rows for c in ([4,8] if r['sourcePeriod']=='2026-04' else [3,7])]
        fact = int(any(v >= 1 for v in vals))
        assert fact == r['fact']
        if r['included']:
            assert (r['status']=='Противоречие') == (fact != r['score'])
    elif r['included']:
        assert r['status']=='Не проверено'
assert seen == set(by_key)
assert len(result.worksheets)==2
assert len(sheet.tables)==1 and len(raw.tables)==1
assert sheet.freeze_panes=='A8' and raw.freeze_panes=='A2'
errors = [c.coordinate for ws in result for row in ws for c in row if c.data_type=='e']
assert not errors, errors
conflicts=[r for r in audit['audits'] if r['status']=='Противоречие']
print(json.dumps({'teams':len(audit['mappings']),'metrics':len(seen),'included':sum(r['included'] for r in audit['audits']),
 'sourceRowsVerified':515,'statuses':dict(Counter(r['status'] for r in audit['audits'])),
 'conflictTeams':len(set(r['id'] for r in conflicts)),'errors':errors}, ensure_ascii=False))
