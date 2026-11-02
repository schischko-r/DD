import json
from pathlib import Path
from collections import Counter
root=Path.cwd()
report=json.loads((root/'gravity-app/public/report-data.json').read_text())
# Columns: product | attraction benchmark | churn benchmark | business alert | system alert | UX/UI alert.
# A dash is not an instruction to change a metric. '?' denotes conflicting user rows.
rows='''Телемаркетинг|-|-|1|-|-
СБОЛ|0|0|0|-|1
СберKids|0.5|0|0|-|-
СберИнвестор|0|0|0.5|-|1
Уведомления|0.5|0|0|-|1
Единый личный кабинет (ЕЛК)|-|0|0|-|0.5
Оплата улыбкой|-|-|1|-|-
SberID|-|-|1|-|0.5
Зарплатный продукт|0|0|1|0.5|-
Сделка ИЖС|-|-|0|0.5|-
Много денег (НКПЗН)|-|-|1|-|-
Дебетовая карта|1|1|1|-|-
Объект Авто|-|-|0|0|-
ОМС|0|0|?|0.5|-
Слитки|0|0|?|0.5|-
Интернет-Эквайринг|-|0|1|-|-
Пакет услуг СберПервый|0|0|1|-|-
Сделка с Первичным жильём|-|-|0|-|-
Выписки, справки|0|-|-|-|-
SberPay Ecom|?|0|-|-|-
Трансграничные переводы #B2C|0|0|0|0.5|-
Почта, Диск, Календарь|-|-|0|-|-
СберПрайм|-|-|0.5|0.5|-
Сберчаевые #B2C|-|0|0.5|0.5|-
НСЖ|1|1|1|-|-
ИСЖ|1|1|1|-|-
BNPL|0|0|0|-|-
ВЗР|1|1|1|-|-
Автокредит|1|-|0.5|-|-
Сделка вторичка|-|-|0.5|0.5|-
Вжух|0|0|1|-|-
Пакет услуг СберПремьер|-|-|0|-|-
Платежи|-|-|0|-|-
Брокерский счет|0|0|0|-|-
Кредитные карты|0|0|-|-|-
Трансграничный эквайринг #B2C|0|-|0|0.5|-
Монеты|0|1|0|-|-
ДСЖ КК|-|-|1|0.5|-
Сейфы|0|0|0|-|-
Страхование залога|-|-|1|-|-
ЗПИФ|-|-|1|0.5|-
ОПИФ|-|-|1|0.5|-
СберСпасибо|0|0|0.5|-|-
Детская карта|1|0|0|-|-
Кредитный потенциал|1|0|0.5|0.5|-
ПДС|1|0|0.5|-|-
Переводы по РФ|0|1|1|-|-
БПИФ|1|1|0|-|-
Залоговое страхование (корпоративное страхование)|1|1|1|-|-
Конверсия|-|-|0|0.5|-
Вклады+НС|0|0|0|-|-
ЦФА|-|0|0|-|-
ЗЛС|1|0|1|-|-
ИнвестКопилка|-|-|1|-|-
СберСова|-|-|1|-|-
Пенсионный продукт|0|0|0|-|-
Личная защита Плюс|-|-|1|0.5|-
Страхование жизни|0|0|-|-|-
Рабочий возраст|0|0|0.5|-|-
МВС|0|0|1|-|-
Зрелость|0|0|1|-|-
Молодежь|-|-|0|-|-
Дети/подростки|0|0|0.5|-|-'''
codes=['attract.benchmarks','churn.benchmarks','alerts.business_metrics','alerts.system_failures','alerts.opovescheniya_po_problemam_svyazannym_s_ux_ui']
labels=['Бенчмарки по привлечению','Бенчмарки по оттокам','Алерты по бизнес-метрикам','Алерты по системным-метрикам','Алерты по проблемам, связанным с UX/UI']
aliases={'Дети/подростки':'Дети','Сберчаевые #B2C':'СберЧаевые','Трансграничные переводы #B2C':'Трансграничные переводы','Трансграничный эквайринг #B2C':'Трансграничный эквайринг','Вжух':'SberPay Вжух'}
products={}
def team(name):
 matches=[p for p in report['products'] if p['name']==aliases.get(name,name)]
 assert len(matches)==1,(name,len(matches))
 p=matches[0]
 return products.setdefault(p['id'],{**{k:p[k] for k in ['id','name','unit','type']},'metrics':{}}),p

def add(name,code,value,label):
 t,p=team(name)
 ms=[m for b in p['metrics'] for m in b['metrics'] if m['code']==code]
 
 if len(ms)!=1:
  assert name=='СберСпасибо' and code=='churn.benchmarks'
  ms=[{'max_value':0.5,'is_applicabble_flg':True}]
 
 if ms[0].get('is_applicabble_flg') is False or ms[0]['max_value']<=0:
  print('NA',name,code);return
 assert code not in t['metrics'],(name,code,'duplicate')
 t['metrics'][code]={'rawValue':value,'source':{'origin':'userConfirmedMetricAssessment','confirmedBy':'user','date':'2026-10-29','period':'III кв. 2026','sourceName':name,'sourceMetricName':label,'rule':'Оценка пользователя 0/0.5/1 умножается на существующий вес метрики. Применимость и максимум сохраняются.'}}

for row in rows.splitlines():
 name,*values=row.split('|')
 assert len(values)==5
 for code,label,value in zip(codes,labels,values):
  if value not in ['-','?']:add(name,code,float(value),label)

general={
 'Активная клиентская база':'general.aktivnaya_klientskaya_baza',
 'Кол-во Major клиентов':'general.kol_vo_major_klientov',
 'Кол-во клиентов с 2+ нефин. сервисов':'general.kol_vo_klientov_s_2_nefin_servisov',
 'Кол-во получателей ЗП':'general.kol_vo_poluchateley_zp',
 'Объем зачислений ФОТ':'general.obъem_zachisleniy_fot',
 'Средний дохода на клиента':'general.sredniy_dohoda_na_klienta'}
for name,indices in [('Рабочий возраст',[0,1,2,3,4]),('Top Affluent',[0,1,2,5]),('МВС',[0,1,2,5]),('Зрелость',[0,1,2]),('Молодежь',[0,1,2]),('Дети/подростки',[0,1])]:
 for index in indices:
  label,code=list(general.items())[index];add(name,code,1,label)
pending=[]
for name,code,values in [('ОМС','alerts.business_metrics',[1,0.5]),('Слитки','alerts.business_metrics',[0.5,1]),('SberPay Ecom','attract.benchmarks',[1,0])]:
 t,_=team(name)
 pending.append({**{k:t[k]for k in ['id','name','unit','type']},'metricCode':code,'rawValues':values,'reason':'conflictingUserRows','status':'awaitingClarification'})
for code,value in zip(codes[:4],[0,0,0,0.5]):
 pending.append({'name':'Трансграничный эквайринг #B2B','metricCode':code,'rawValues':[value],'reason':'separateB2BTeamNotInCatalog','status':'awaitingClarification'})
counts=Counter(code for p in products.values()for code in p['metrics'])
data={'period':'III кв. 2026','scope':'user-metric-assessment','source':{'origin':'userConfirmedMetricAssessment','confirmedBy':'user','date':'2026-10-29','aliases':aliases,'rule':'Только явно указанные оценки. Повторяющиеся одинаковые строки дедуплицированы; противоречащие значения и несуществующая команда B2B отложены до уточнения. II квартал, веса и применимость не изменяются.'},'products':list(products.values()),'pending':pending,'counts':{'teams':len(products),'facts':sum(counts.values()),'byMetric':dict(counts),'pendingPairs':len(pending)}}
(root/'gravity-app/src/data/user-metric-assessments-q3-2026.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(data['counts'],ensure_ascii=False))
