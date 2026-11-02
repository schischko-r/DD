import json,re,hashlib
from pathlib import Path
from collections import defaultdict,Counter
from openpyxl import load_workbook
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent
workbook=ROOT/'Книга4(1) 2.xlsx';sheet=load_workbook(workbook,read_only=True,data_only=True).active
rows=[{'row':i,'team':r[0],'metric':r[1],'question':r[2],'verified':r[5]} for i,r in enumerate(sheet.iter_rows(min_row=2,values_only=True),2)]
profiles=json.loads((OUT/'before.json').read_text());cohorts=json.loads((OUT/'cohorts-before.json').read_text())
aliases={'Вжух':'SberPay Вжух','Дети/подростки':'Дети','Кредитная карта':'Кредитные карты','Персональная рекомендация (кампейнинг)':'Персональная рекомендация','Сберчаевые #B2C':'СберЧаевые','Трансграничные переводы #B2C':'Трансграничные переводы','Трансграничный эквайринг #B2C':'Трансграничный эквайринг','Страхование путешественников':'ВЗР'}
normalize=lambda s: re.sub(r'\s+',' ',str(s or '').strip()).lower().replace('ё','е')
def context(r):
 text=normalize(r['question'])
 for phrase,block in [('оттока','churn'),('онбординга','voronka_onbordinga'),('входа в канал','voronka_vhoda_v_kanal'),('продаж','voronka_prodazh'),('привлечения','attract'),('использования','usage'),('отклонений по метрикам','analiz_effektivnostь')]:
  if phrase in text:return block
 return None
mapped=[];errors=[]
for r in rows:
 if r['verified'] is None:continue
 assert type(r['verified']) in [int,float] and r['verified'] in [0,.5,1],r
 name=aliases.get(r['team'],r['team'])
 if name=='Зарплатный продукт':
  # These two survey blocks are identified by their already confirmed Q3 cohort answers.
  name+=' #B2C' if r['row']<530 else ' #B2B'
 t=next((t for t in cohorts if t['name']==name),None)
 if not t:errors.append({'kind':'team',**r});continue
 candidates=[(b,m) for b in t['metrics'] for m in b['metrics'] if normalize(m['name'])==normalize(r['metric'])]
 c=context(r)
 if len(candidates)>1:
  if c is None:
   neighbors=sorted((n for n in rows if n['team']==r['team'] and 0<abs(n['row']-r['row'])<=4 and context(n)),key=lambda n:abs(n['row']-r['row']))
   c=context(neighbors[0]) if neighbors else None
  if c=='usage':c='attract' if t['name']=='Почта, Диск, Календарь' else 'voronka_ispolьzovaniya'
  candidates=[(b,m) for b,m in candidates if b['code']==c]
 if len(candidates)!=1:errors.append({'kind':'metric','candidates':[m['code'] for b,m in candidates],'context':c,**r});continue
 b,m=candidates[0];mapped.append({**r,'id':t['id'].split('::empty::')[0],'name':t['name'],'unit':t['unit'],'type':t['type'],'code':m['code'],'block':b['code'],'beforeValue':m['value'],'maxValue':m['max_value'],'applicable':m.get('is_applicabble_flg') is not False and m['max_value']>0})
(OUT/'mapped-rows.json').write_text(json.dumps(mapped,ensure_ascii=False,indent=2)+'\n');(OUT/'mapping-errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2)+'\n')
print('mapped',len(mapped),'errors',len(errors),'NA',sum(not r['applicable'] for r in mapped),'teamcount',len(set(r['name'] for r in mapped)))
for r in errors:print(r)
for r in mapped:
 if not r['applicable']:print('NA',r['row'],r['team'],r['code'],r['verified'])
