import csv,json,hashlib
from collections import defaultdict,Counter
from pathlib import Path
root=Path.cwd();period='III кв. 2026';code='hyp.discovery_40_backlog'
source=json.loads((root/'gravity-app/public/report-data.json').read_text())['products']
aliases={'Трансграничный эквайринг #B2C':'Трансграничный эквайринг','Трансграничные переводы #B2C':'Трансграничные переводы','Сберчаевые #B2C':'СберЧаевые','Дети/подростки':'Дети','Персональная рекомендация (кампейнинг)':'Персональная рекомендация'}
inside=['Собственный бэклог в Jira/SberTrack','Задачи ведет Штаб в Jira/SberTrack']
rule='«Нет аналитиков»/«Затрудняюсь ответить»/доля меньше 20% = 0. Доля 20–39% = 0.5 независимо от места бэклога. Доля от 40% и выбранный Jira/SberTrack = 1; от 40% и бэклог вне Jira/SberTrack = 0.5. Для 11 явно указанных команд без ответа разрешена декомпозиция III квартала: >=40% = 1; >=20% = 0.5; <20% = 0. Конфликтующие анкеты отложены; явный ответ не заменяется декомпозицией.'
fallback_names=['Рабочий возраст','Top Affluent','Молодежь','Объект Авто','Персональная рекомендация','КАСКО','ОСАГО','Личная защита Плюс','Переводы по РФ','SberPay Вжух','Оплата улыбкой']
def score_explicit(answer,backlog_type):
 if answer in ['Нет аналитиков','Затрудняюсь ответить','Меньше 20%']:return 0
 if answer=='От 20 до 39%':return 0.5
 if answer in ['От 40 до 79%','Больше 80%']:
  if backlog_type in inside:return 1
  if backlog_type=='Бэклог ведется вне Jira/SberTrack':return 0.5
 return None
def score_decomposition(discovery_count,created_count):
 if not isinstance(discovery_count,(int,float)) or not isinstance(created_count,(int,float)) or created_count<=0 or not 0<=discovery_count<=created_count:return None
 return 1 if discovery_count*100>=created_count*40 else .5 if discovery_count*100>=created_count*20 else 0
records=defaultdict(list);excluded=[];sources={};pending=[];all_answers=defaultdict(list);salary_split_exclusions=[]
for path in sorted((root/'analysis/1').glob('questionare-responses*.csv')):
 sources[str(path.relative_to(root))]=hashlib.sha256(path.read_bytes()).hexdigest()
 for row_index,row in enumerate(csv.DictReader(path.open(encoding='utf-8-sig'),delimiter=';'),2):
  if row['Год опроса']!='2026' or row['Квартал опроса']!='3':continue
  d=json.loads(row['Результат опроса (JSON)']);a=d.get('answers',{});fio=d.get('respondent',{}).get('name')or a.get('name','')
  if 'чикин'in fio.casefold():
   excluded.append({'file':str(path.relative_to(root)),'csvRow':row_index,'team':d['team']['name'],'respondent':fio});continue
  answer=a.get('discovery');backlog_type=a.get('discoveryBacklogType')
  name=aliases.get(d['team']['name'],d['team']['name'])
  all_answers[name].append({'file':str(path.relative_to(root)),'csvRow':row_index,'respondent':fio,'answer':answer})
  raw=score_explicit(answer,backlog_type)
  if raw is None:continue
  if name=='Зарплатный продукт' and answer=='От 20 до 39%':
   salary_split_exclusions.append({'file':str(path.relative_to(root)),'csvRow':row_index,'respondent':fio,'answer':answer,'rawValue':raw,'reason':'B2C respondent is assessed in salary-products-q3-2026.json; do not merge with B2B.'});continue
  matches=[p for p in source if p['name']==name and p['unit']==d['team']['unit']]
  assert len(matches)==1,name
  p=matches[0];metric=next(m for b in p['metrics']for m in b['metrics']if m['code']==code)
  assert metric['max_value']>0 and metric.get('is_applicabble_flg')is not False,name
  records[p['id']].append({'file':str(path.relative_to(root)),'csvRow':row_index,'respondent':fio,'answer':answer,'backlogType':backlog_type,'backlogLink':a.get('backlog'),'backlogComment':a.get('discoveryBacklogComment'),'rawValue':raw})
products=[]
for identity,responses in records.items():
 p=next(p for p in source if p['id']==identity);team={k:p[k]for k in ['id','name','unit','type']}
 values=sorted(set(r['rawValue']for r in responses))
 if len(values)>1:
  pending.append({**team,'metricCode':code,'rawValues':values,'responses':responses,'reason':'conflictingBacklogLocations'});continue
 products.append({**team,'metrics':{code:{'rawValue':values[0],'source':{'origin':'userConfirmedDiscoveryAssessment','confirmedBy':'user','date':'2026-10-30','period':period,'questionId':'discovery','rule':rule,'responses':responses}}}})
backlog_path=root/'gravity-app/public/backlog-data.json'
backlog=json.loads(backlog_path.read_text());backlog_hash=hashlib.sha256(backlog_path.read_bytes()).hexdigest()
for name in fallback_names:
 if any(r['answer']not in [None,'']for r in all_answers[name]):raise ValueError(('Explicit discovery answer blocks decomposition fallback',name))
 matches=[p for p in source if p['name']==name];assert len(matches)==1,name
 p=matches[0];assert not any(t['id']==p['id']for t in products),name
 hits=[(i,t)for i,t in enumerate(backlog['teams'])if name in t.get('memberTeams',[])]
 assert len(hits)==1,('Ambiguous backlog membership',name)
 index,team_backlog=hits[0]
 quarter_hits=[(i,q)for i,q in enumerate(team_backlog['quarters'])if q['key']=='2026-Q3']
 assert len(quarter_hits)==1,name
 quarter_index,quarter=quarter_hits[0]
 raw=score_decomposition(quarter.get('discoveryCount'),quarter.get('createdCount'));assert raw is not None,name
 products.append({**{k:p[k]for k in ['id','name','unit','type']},'metrics':{code:{'rawValue':raw,'source':{
  'origin':'userConfirmedDiscoveryDecompositionAssessment','confirmedBy':'user','date':'2026-10-30','period':period,
  'rule':rule,'explicitAnswerPresent':False,'surveyResponses':all_answers[name],
  'file':str(backlog_path.relative_to(root)),'sha256':backlog_hash,'pointer':f'/teams/{index}/quarters/{quarter_index}',
  'teamKey':team_backlog['key'],'teamLabel':team_backlog['label'],'memberTeams':team_backlog.get('memberTeams',[]),
  'sharedAssessment':len(team_backlog.get('memberTeams',[]))>1,
  'quarterKey':quarter['key'],'start':quarter.get('start'),'end':quarter.get('end'),'dataThrough':quarter.get('dataThrough'),
  'createdCount':quarter['createdCount'],'discoveryCount':quarter['discoveryCount'],
  'actualShare':quarter['discoveryCount']/quarter['createdCount']*100,'displayedShare':quarter.get('discoveryShare'),
 }}}})
manual_names=['Сделка ИЖС','Сделка вторичка','Сделка с Первичным жильём','Много денег (НКПЗН)','ОМС','Слитки','Пакет услуг СберПервый','Единый личный кабинет (ЕЛК)']
resolved_conflicts=[{**p,'resolution':{'rawValue':1,'confirmedBy':'user','date':'2026-10-30'}}for p in pending if p['name']in manual_names]
pending=[p for p in pending if p['name']not in manual_names]
for name in manual_names:
 matches=[p for p in source if p['name']==name];assert len(matches)==1,name
 p=matches[0];assert not any(t['id']==p['id']for t in products),name
 products.append({**{k:p[k]for k in ['id','name','unit','type']},'metrics':{code:{'rawValue':1,'source':{
  'origin':'userConfirmedDiscoveryManualAssessment','confirmedBy':'user','date':'2026-10-30','period':period,
  'reason':'Прямая оценка пользователя: Discovery = 1 за III квартал.',
  'resolvedConflicts':[r for r in resolved_conflicts if r['name']==name],
 }}}})
counts=Counter(p['metrics'][code]['rawValue']for p in products)
result={'period':period,'scope':'discovery-assessment','source':{'confirmedBy':'user','date':'2026-10-30','sourceHashes':sources,'aliases':aliases,'excludedRespondentMatch':'чикин (ФИО респондента, без учёта регистра)','backlogLocationSource':'Выбранный ответ discoveryBacklogType; ссылки и комментарии сохранены отдельно и не подменяют ответ.','rule':rule,'decompositionFallbackNames':fallback_names,'backlogFile':str(backlog_path.relative_to(root)),'backlogSha256':backlog_hash},'excludedRespondents':excluded,'salarySplitExclusions':salary_split_exclusions,'products':products,'pending':pending,'resolvedConflicts':resolved_conflicts,'counts':{'teams':len(products),'facts':len(products),'zeros':counts[0],'halves':counts[0.5],'ones':counts[1],'pendingTeams':len(pending)}}
(root/'gravity-app/src/data/discovery-metrics-q3-2026.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result['counts'],ensure_ascii=False))
print('half',[p['name']for p in products if p['metrics'][code]['rawValue']==.5])
print('pending',[(p['name'],p['rawValues'])for p in pending])
