import csv, json, hashlib
from pathlib import Path
root=Path.cwd();period='III кв. 2026';source_path=root/'questionare-responses(11).csv'
report=json.loads((root/'gravity-app/public/report-data.json').read_text())
base=next(p for p in report['products']if p['name']=='Зарплатный продукт'and p['unit']=='DB')
base_id=base['id'];rubric={m['code']:m for b in base['metrics']for m in b['metrics']}
rows=[]
for i,row in enumerate(csv.DictReader(source_path.open(encoding='utf-8-sig'),delimiter=';'),2):
 d=json.loads(row['Результат опроса (JSON)'])
 if d.get('team',{}).get('name')=='Зарплатный продукт':rows.append((i,row,d))
assert len(rows)==2
products=[];survey_audit=[]
def norm_report(value):
 return 1 if value=='Да, автоматическая (monthly/weekly)'else .5 if value=='Да, по запросу'else 0
def norm_list(value):
 if not isinstance(value,list):return 0
 if 'Все перечисленное выше'in value:return 1
 positive=[v for v in value if v not in ['Затрудняюсь ответить','Не проводился','Нет']]
 return .5 if positive else 0
for i,row,d in rows:
 a=d['answers'];name=d['respondent']['name'].strip()
 cohort='B2B'if 'сауткин'in name.casefold()else 'B2C'if 'королева'in name.casefold()else None
 assert cohort,name
 child_id=f'{base_id}::{cohort.casefold()}'
 source={'file':'questionare-responses(11).csv','sha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),'csvRow':i,'surveyId':d.get('surveyId'),'completedAt':d.get('completedAt'),'respondent':name,'originalTeamId':d['team']['id'],'originalTeamName':d['team']['name']}
 facts={}
 def add(code,value,question,rule):
  assert code in rubric and rubric[code]['max_value']>0,code
  facts[code]={'rawValue':value,'source':{'origin':'salarySplitSurveyAssessment','confirmedBy':'user','period':period,'date':'2026-10-30',**source,'questionId':question,'answer':a.get(question),'rule':rule}}
 add('general.klienty_s_produktom',1 if a.get('clients')not in [None,'']else 0,'clients','Наличие числового ответа о клиентах: 1; иначе 0.')
 add('general.mau_produkta',0 if a.get('mauUnknown')or a.get('mau')in[None,'']else 1,'mau','Неизвестный MAU = 0; числовой ответ = 1. Не смешивается с другим респондентом.')
 for prefix in ['attract','churn']:
  add(prefix+'.nastroena_otchetnostь',norm_report(a.get(prefix+'Configured')),prefix+'Configured','Автоматическая отчётность = 1; по запросу = 0.5; отсутствие/затруднение = 0.')
  add(prefix+'.report_completeness',norm_list(a.get(prefix+'Includes')),prefix+'Includes','Все положительные пункты = 1; часть = 0.5; нет положительных пунктов/затруднение = 0.')
  add(prefix+'.funnel_analysis',norm_list(a.get(prefix+'Analysis')),prefix+'Analysis','Все перечисленное выше = 1; часть положительных пунктов = 0.5; не проводился/затруднение = 0.')
  add(prefix+'.benchmarks',1 if a.get('benchmarks'+prefix.title())=='Да'else 0,'benchmarks'+prefix.title(),'Да = 1; Нет = 0.')
 add('attract.initiatives_list',1 if a.get('attractDeviations')=='Да'else 0,'attractDeviations','Явный ответ Да = 1; Нет = 0.')
 add('churn.deviation_actions',1 if a.get('deviations')=='Да'else 0,'deviations','Явный ответ Да = 1; Нет = 0.')
 discovery=0 if a.get('discovery')in['Нет аналитиков','Затрудняюсь ответить','Меньше 20%']else .5 if a.get('discovery')=='От 20 до 39%'else None
 add('hyp.discovery_40_backlog',discovery,'discovery','Подтверждённое пользователем правило: Нет аналитиков/Затрудняюсь/Меньше 20% = 0. Ответ 20–39% = 0.5 независимо от места бэклога. Оценка относится только к этому респонденту.')
 # The latest instruction resolves the former unattributed manual 0/1 using each respondent's survey.
 add('mehaniki.vozvrat_klientov',1 if 'Возврат клиентов'in(a.get('upsell')or[])else 0,'upsell','Последнее указание пользователя: выставить баллы по ответам каждого респондента. Выбрано Возврат клиентов = 1; не выбрано = 0. Прежняя неопределённость общих ручных 0/1 разрешена.')
 add('mehaniki.doprodazhi_up_sell',1 if 'Допродажи (upsell)'in(a.get('upsell')or[])else 0,'upsell','Последнее указание пользователя: выбранные Допродажи (upsell) = 1; не выбраны = 0. Оценка относится только к этому респонденту.')
 products.append({'id':child_id,'name':f'Зарплатный продукт #{cohort}','unit':'DB','type':'Продукт','baseTeamId':base_id,'cohort':cohort,'respondent':name,'respondentSource':source,'metrics':facts,'resetMetricCodes':(['hyp.discovery_40_backlog']if discovery is None else []),'crossSellAfterPurchase':{'rawValue':0.5,'applicable':True,'source':{'origin':'salarySplitSharedManualAssessment','confirmedBy':'user','period':period,'inheritedFrom':'crosssell-after-purchase-scores-q3-2026.json','answer':a.get('crossSellAfter'),'confirmation':a.get('crossSellAfterProduct'),'respondent':name,'rule':'Ранее явно заданная ручная оценка 0.5 для общего продукта сохраняется как общая; обе анкеты отвечают Да. Это не новая оценка 1 из факта ответа Да.'}},'unassignedAggregateMetricCodes':['mehaniki.cross_sell']})
 survey_audit.append({'cohort':cohort,'source':source,'answers':a,'resultMetrics':d['result']['metrics']})
products.sort(key=lambda p:p['cohort'],reverse=True) # B2C first.
api=json.loads((root/'crosssell_export.json').read_text())
api_index,api_product=next((i,p)for i,p in enumerate(api['products_response']['products'])if p['name']=='Зарплатный продукт')
pending=[{'code':'mehaniki.cross_sell','component':'during','teams':[p['id']for p in products],'reason':'LossHunter catalogue has only unsplit Зарплатный продукт. Aggregate incoming count is not independently attributable to B2B/B2C.','apiReference':{'file':'crosssell_export.json','pointer':f'/products_response/products/{api_index}','uid':api_product.get('uid'),'seen_in_n':api_product.get('seen_in_n'),'seen_out_n':api_product.get('seen_out_n')},'recommendation':'Leave during score unresolved for both until source attribution is confirmed; descriptions about salary-card consumers suggest B2C but are not explicit cohort metadata.'}]
data={'period':period,'source':{'file':'questionare-responses(11).csv','sha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),'date':'2026-10-30','confirmedBy':'user','respondentMapping':{'B2B':'Сауткин Андрей','B2C':'Королева Александра Дмитриевна'},'baseTeamId':base_id,'rule':'Q2 keeps the unsplit product. Q3 clones only its rubric/shared confirmed assessments, then applies respondent-specific overrides. Shared assessments retain original provenance. Null rawValue explicitly clears the inherited value. Individual Q2 baselines must not be invented for the new cohorts.'},'products':products,'pending':pending,'inheritancePolicy':{'inheritSharedConfirmedValues':True,'doNotInheritCodes':['hyp.discovery_40_backlog','mehaniki.vozvrat_klientov','mehaniki.cross_sell'],'cxScore':'No explicit parent Q3 CX assessment exists; do not populate 0.5 from its Q2 baseline.','unsegmentedOtherInputs':'Campaign/research and draft source names are unsplit. If inherited, mark shared aggregate provenance rather than claim independently measured cohort values.'}}
data['resolvedAssessments']=[{'code':'mehaniki.vozvrat_klientov','previousUnattributedManualValues':[0,1],'status':'resolved_by_user_confirmation','date':'2026-10-30','rule':'Latest user confirmation assigns each respondent their own survey mechanics; both B2B and B2C explicitly selected Возврат клиентов.'}]
(root/'gravity-app/src/data/salary-products-q3-2026.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
audit={'source':data['source'],'q2Rubric':base,'respondentSurveys':survey_audit,'parentOverlayFacts':{},'lossHunter':{'catalogueIndex':api_index,'uid':api_product.get('uid'),'seen_in_n':api_product.get('seen_in_n'),'seen_out_n':api_product.get('seen_out_n'),'anl_reason':api_product.get('anl_reason'),'pairs':api_product.get('pairs'),'judgements':api_product.get('judgements'),'incoming':api_product.get('incoming')},'pending':pending}
for path in (root/'gravity-app/src/data').glob('*q3-2026.json'):
 if path.name=='salary-products-q3-2026.json':continue
 try:x=json.loads(path.read_text())
 except ValueError:continue
 hits=[p for p in x.get('products',[])if p.get('id')==base_id]
 if hits:audit['parentOverlayFacts'][path.name]=hits
(root/'outputs/salary-split-2026-10-30/audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
print([(p['name'],len(p['metrics']),p['resetMetricCodes'])for p in products]);print('pending',len(pending))
