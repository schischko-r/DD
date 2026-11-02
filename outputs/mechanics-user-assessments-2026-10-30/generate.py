import csv,json
from pathlib import Path
from collections import defaultdict,Counter
root=Path.cwd();folder=root/'outputs/mechanics-user-assessments-2026-10-30'
source=json.loads((root/'gravity-app/public/report-data.json').read_text())['products']
rows=[];pairs=defaultdict(list)
for index,row in enumerate(csv.DictReader((folder/'source.tsv').open(),delimiter='\t'),1):
 matches=[p for p in source if p['name']==row['product']];assert len(matches)==1,row
 team=matches[0]
 matches=[m for b in team['metrics']if b['code']=='mehaniki'for m in b['metrics']if m['name']==row['metric']];assert len(matches)==1,row
 metric=matches[0];raw=float(row['value'].replace(',','.'));assert raw in [0,.5,1]
 assert metric['max_value']>0 and metric.get('is_applicabble_flg')is not False,row
 record={'row':index,'product':row['product'],'metric':row['metric'],'metricCode':metric['code'],'rawValue':raw,**{k:team[k]for k in ['id','name','unit','type']}}
 rows.append(record);pairs[(team['id'],metric['code'])].append(record)
products={};pending=[]
for (identity,code),records in pairs.items():
 first=records[0];values=sorted(set(r['rawValue']for r in records))
 if len(values)>1:
  pending.append({**{k:first[k]for k in ['id','name','unit','type']},'metricCode':code,'rawValues':values,'sourceRows':[r['row']for r in records],'reason':'conflictingUserRows'})
  for record in records:record['status']='pending'
  continue
 team=products.setdefault(identity,{**{k:first[k]for k in ['id','name','unit','type']},'metrics':{}})
 team['metrics'][code]={'rawValue':values[0],'source':{'origin':'userConfirmedMechanicsAssessment','confirmedBy':'user','date':'2026-10-30','period':'III кв. 2026','sourceName':first['product'],'sourceMetricName':first['metric'],'sourceRows':[r['row']for r in records],'rule':'Оценка 0/0.5/1 умножается на существующий максимум. Новая оценка имеет приоритет над переносом из II квартала; применимость и веса сохраняются.'}}
 for record in records:record['status']='applied'
counts=Counter(code for p in products.values()for code in p['metrics'])
data={'period':'III кв. 2026','scope':'mechanics-user-assessment','source':{'file':'outputs/mechanics-user-assessments-2026-10-30/source.tsv','date':'2026-10-30','confirmedBy':'user','rule':'Одинаковые повторные строки дедуплицированы; конфликтующие оценки оставлены до уточнения. Меняются только явно указанные оценки механик III квартала.'},'products':list(products.values()),'sourceRows':rows,'pending':pending,'counts':{'sourceRows':len(rows),'teams':len(products),'facts':sum(counts.values()),'pendingPairs':len(pending),'byMetric':dict(counts)}}
(root/'gravity-app/src/data/mechanics-user-assessments-q3-2026.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(data['counts'],ensure_ascii=False));print('codes',list(counts))
