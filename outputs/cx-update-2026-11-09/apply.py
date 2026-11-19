import copy
import json
from pathlib import Path

root = Path('gravity-app/src/data')
out = Path('outputs/cx-update-2026-11-09')
ones = ['СБОЛ','SberPay NFC','Оплата улыбкой','SberPay Вжух','SberPay Ecom','SberID',
        'BNPL','ЗЛС','Переводы по РФ','СберKids','СберИнвестор','Пакет услуг СберПервый',
        'ОСАГО','Дебетовая карта','Конверсия','ВЗР','Платежи','Страхование залога','СберПрайм',
        'Страхование жизни','ПДС']
halves = ['Детская карта','Брокерский счет','Потребительский кредит','Пакет услуг СберПремьер',
          'Много денег (НКПЗН)','Сделка с Первичным жильём','Сделка ИЖС','Сделка вторичка',
          'КАСКО','Кредитные карты','Автокредит','Сейфы','ОМС','Кредитный потенциал','Вклады+НС',
          'POS-кредиты','СберСпасибо','НСЖ','ОПИФ','ИСЖ']
aliases = {'SberPay Вжух':'Вжух','SberPay Ecom':'SberPay QR','СберKids':'SberKids',
           'ВЗР':'Страхование путешественников','Потребительский кредит':'Потребитеский кредит',
           'Страхование жизни':'Ипотечное страхование жизни','Кредитные карты':'Кредитная карта'}
targets = {name: {'rawValue': value, 'inputName': aliases.get(name,name)}
           for value,names in [(1,ones),(0.5,halves)] for name in names}
assert len(targets) == 41
before = json.loads((out/'before.json').read_text())
identities = {p['name']:p for p in before['products']}
assert not set(targets)-identities.keys(), set(targets)-identities.keys()
(out/'targets.json').write_text(json.dumps(targets,ensure_ascii=False,indent=2)+'\n')
files = ['cx-score-metrics-q3-2026.json','domclick-cx-score-user-q3-2026.json',
         'q3-score-corrections-2026.json','ub-workbook-corrections-q3-2026.json',
         'cbp-user-corrections-q3-2026.json']
history = {}
for file in files:
    path = root/file
    data = json.loads(path.read_text())
    history[file] = copy.deepcopy(data)
    if file == files[0]:
        for name in targets:
            if not any(r['name']==name for r in data['products']):
                team = identities[name]
                data['products'].append({**{k:team[k].split('::empty::')[0] if k=='id' else team[k]
                                              for k in ['id','name','unit','type']}, 'metrics':{}})
    for row in data['products']:
        if row['name'] not in targets or ('cx.score' not in row.get('metrics',{}) and file!=files[0]):
            continue
        target = targets[row['name']]
        old = copy.deepcopy(row['metrics'].get('cx.score'))
        fact = row['metrics'].setdefault('cx.score',{})
        fact['rawValue'] = target['rawValue']
        source = copy.deepcopy(fact.get('source',{}))
        source.update(confirmedBy='user',period='III кв. 2026',date='2026-11-09')
        if file==files[0]: source['origin']='userConfirmedCxScoreList20261109'
        source['correction'] = {'origin':'userConfirmedCxScoreList20261109','confirmedBy':'user',
            'period':'III кв. 2026','date':'2026-11-09','inputName':target['inputName'],
            'rawValue':target['rawValue'],'previousAssessment':old,
            'rule':'Последняя прямая таблица пользователя по CX Score. SberPay QR сопоставлен с SberPay Ecom по явному уточнению.'}
        fact['source'] = source
    if file==files[0]:
        data['counts']={'teams':len(data['products']),
                       **{key:sum(r['metrics']['cx.score']['rawValue']==value for r in data['products'])
                          for key,value in [('ones',1),('halves',0.5),('zeros',0)]}}
        print('Primary batch:',data['counts'])
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

path = root/'metric-applicability-q3-2026.json'
data = json.loads(path.read_text())
history[path.name] = copy.deepcopy(data)
for row in data['products']:
    if row['name'] in targets and 'cx.score' in row.get('metrics',{}):
        del row['metrics']['cx.score']
data['products'] = [r for r in data['products'] if r.get('metrics')]
path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
(out/'before-overlays.json').write_text(json.dumps(history,ensure_ascii=False,indent=2)+'\n')
