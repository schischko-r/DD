import json,csv,re,hashlib
from pathlib import Path
from collections import Counter,defaultdict
root=Path.cwd();sources=sorted((root/'analysis/1').glob('questionare-responses*.csv'))
catalog=[p for p in json.loads((root/'gravity-app/public/report-data.json').read_text())['products']if p['name']!='ДУ']
aliases={'Вжух':'SberPay Вжух','Дети/подростки':'Дети','Персональная рекомендация (кампейнинг)':'Персональная рекомендация','Сберчаевые #B2C':'СберЧаевые','Трансграничные переводы #B2C':'Трансграничные переводы','Трансграничный эквайринг #B2C':'Трансграничный эквайринг'}
rows=[];excluded=[];unmatched=[]
for path in sources:
 for index,row in enumerate(csv.DictReader(path.open(encoding='utf-8-sig'),delimiter=';'),2):
  if row['Год опроса']!='2026' or row['Квартал опроса']!='3':continue
  d=json.loads(row['Результат опроса (JSON)']);a=d.get('answers',{});t=d['team'];fio=d.get('respondent',{}).get('name')or a.get('name','')
  record={'file':str(path.relative_to(root)),'csvRow':index,'sourceTeam':t['name'],'unit':t['unit'],'fio':fio,'answer':a.get('discovery'),'backlogType':a.get('discoveryBacklogType'),'backlogLink':a.get('backlog'),'backlogComment':a.get('discoveryBacklogComment')}
  if 'чикин' in fio.casefold():excluded.append(record);continue
  matches=[p for p in catalog if p['name']==aliases.get(t['name'],t['name'])and p['unit']==t['unit']]
  if len(matches)!=1:unmatched.append(record);continue
  p=matches[0];record.update({k:p[k]for k in ['id','name','unit','type']})
  m=next((m for m in d.get('result',{}).get('metrics',[])if m['code']=='hyp.discovery_40_backlog'),{})
  record['surveyResult']={k:m.get(k)for k in ['baselineValue','value','maxValue','source','rule','questionId']}
  rows.append(record)
byTeam=defaultdict(list)
for r in rows:byTeam[r['id']].append(r)
teams=[]
for key,rs in byTeam.items():
 answers=sorted(set(r['answer']for r in rs if r['answer']))
 proposed=sorted(set(1 if a in ['Больше 80%','От 40 до 79%']else 0 for a in answers))
 teams.append({**{k:rs[0][k]for k in ['id','name','unit','type']},'answers':answers,'proposedScoresBySurveyRule':proposed,'records':rs})
counts={'rawResponses':len(rows)+len(excluded)+len(unmatched),'excludedRespondentResponses':len(excluded),'includedResponses':len(rows),'mappedTeams':len(teams),'explicitAnswerResponses':sum(r['answer']is not None for r in rows),'noAnswerResponses':sum(r['answer']is None for r in rows),'teamsWithAnswer':sum(bool(t['answers'])for t in teams),'teamsWithoutAnswer':sum(not t['answers']for t in teams),'positiveTeams':sum(t['proposedScoresBySurveyRule']==[1]for t in teams),'zeroTeams':sum(t['proposedScoresBySurveyRule']==[0]for t in teams),'scoreConflicts':sum(len(t['proposedScoresBySurveyRule'])>1 for t in teams),'answerDistribution':dict(Counter(r['answer']or '<нет отдельного ответа>'for r in rows)),'backlogTypeDistribution':dict(Counter(r['backlogType']or '<нет отдельного ответа>'for r in rows)),'withBacklogLinkResponses':sum(bool(r['backlogLink'])for r in rows),'withBacklogCommentResponses':sum(bool(r['backlogComment'])for r in rows),'unmatched':len(unmatched)}
missing=[{k:p[k]for k in ['id','name','unit','type']}for p in catalog if p['id']not in byTeam]
result={'counts':counts,'sourceHashes':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest()for p in sources},'excluded':excluded,'unmatched':unmatched,'teamsWithoutSurvey':missing,'teams':teams}
(root/'outputs/discovery-answers-2026-10-30/analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(counts,ensure_ascii=False,indent=2))
print('excluded',[(r['sourceTeam'],r['fio'],r['answer'])for r in excluded])
print('positive',[t['name']for t in teams if t['proposedScoresBySurveyRule']==[1]])
print('negative',[t['name']for t in teams if t['proposedScoresBySurveyRule']==[0]])
print('no answer',[t['name']for t in teams if not t['answers']])
print('no survey',[t['name']for t in missing])
