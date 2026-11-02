import json
from pathlib import Path
r=json.loads(Path('gravity-app/public/report-data.json').read_text())['products']
rs=json.loads(Path('/tmp/ddi_uplift_results.json').read_text())
saved=json.loads(Path('outputs/ddi-uplift-groups-2026-10-28/analysis.json').read_text())
g=next(g for g in saved['groups']if g['code']=='voronka_onbordinga')
rows=[];facts=[]
for p in r:
 b=next((b for b in p['metrics']if b['code']=='voronka_onbordinga'),None)
 if not b:continue
 variants=[s for s in rs if s['name']==p['name']and s['unit']==p['unit']]
 assert len(variants)==1
 ms=[m for m in b['metrics']if m.get('is_applicabble_flg')is not False and not m.get('excluded_from_index')and m.get('dd_calculation_flg')!=0 and m['max_value']>0]
 den=sum(m['max_value']for m in ms);old=sum(m['value']for m in ms);new=sum(variants[0]['updates'].get(m['code'],m['value'])for m in ms)
 rows.append(dict(team=p['name'],old=old/den*100,new=new/den*100,delta=(new-old)/den*100,meanContribution=(new-old)/den*100/g['count']))
 for m in ms:
  after=variants[0]['updates'].get(m['code'],m['value'])
  if after!=m['value']:facts.append(dict(team=p['name'],code=m['code'],metric=m['name'],before=m['value'],after=after,max=m['max_value'],meanContribution=(after-m['value'])/den*100/g['count']))
assert abs(sum(x['old']for x in rows)/4-g['oldMean'])<1e-9
assert abs(sum(x['new']for x in rows)/4-g['newMean'])<1e-9
assert abs(sum(f['meanContribution']for f in facts)-(g['newMean']-g['oldMean']))<1e-9
out={'source':'outputs/ddi-uplift-groups-2026-10-28/Аплифты_DDI_группы_и_команды.xlsx','sourceSnapshot':'questionare-uplifts(5).csv; /tmp/ddi_uplift_results.json; gravity-app/public/report-data.json','group':g,'teams':rows,'changedMetrics':facts}
Path('outputs/onboarding-drivers-2026-10-29/analysis.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(out,ensure_ascii=False,indent=2))
