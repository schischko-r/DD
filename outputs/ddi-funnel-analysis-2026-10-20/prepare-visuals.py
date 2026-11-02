import csv,json
from pathlib import Path
out=Path(__file__).parent
data=json.loads((out/'analysis.json').read_text())
rows_for_export=[]
for code,title in [('attract','Воронка привлечения'),('churn','Воронка оттока')]:
 block=data['blocks'][code]
 source={
  'label':'DDI standalone — исходная оценка',
  'files':[{'label':'gravity-standalone.html'}],
  'filters':['Период: II квартал 2026','Одна оценка на команду',f'Блок: {title}', 'Блок существует, применим и имеет положительный максимум'],
  'metricDefinitions':[{'label':'Выполнение блока','definition':'Процент выполнения блока равен сумме его баллов, делённой на сумму максимумов, с округлением до целого процента — как в интерфейсе DDI.'}],
  'caveats':['83 команды исходного standalone; отдельной метки первого прохождения в данных нет.',f'Для блока включены {block["n"]} команд; {len(block["excluded"])} отсутствующих или неприменимых оценок не заменены нулём.','Баллы разных команд могут совпадать: такие команды посчитаны отдельно.','Перцентили вычислены линейной интерполяцией по округлённым процентам DDI. Одинаковые баллы не разделены между квартильными группами.'],
  'evidenceFlow':[{'kind':'source','title':'Источник','detail':'Использован JSON, встроенный непосредственно в gravity-standalone.html; новые ответы опросников и обновления API не добавлялись.'},{'kind':'calculation','title':'Подсчёт','detail':'Гистограмма: интервалы [0,10), [10,20), …, [90,100]. Уровни: менее 40%, от 40% до 80% включительно, более 80%.'},{'kind':'validation','title':'Проверка выборки','detail':f'У всех 83 команд уникальны ID и пара юнит–название; повторов кодов метрик внутри блоков нет. Сумма частот гистограммы равна {block["n"]}.'}]
 }
 chart={'schemaVersion':1,'id':f'ddi-{code}-distribution','queryId':f'ddi_{code}_distribution','title':f'{title}: распределение {block["n"]} команд','description':'X — выполнение блока, %. Y — количество команд. Интервалы по 10 п.п.; 100% включено в последний.','chart':{'type':'bar','x':'range','y':'count','xLabel':'Выполнение блока, %','yLabel':'Количество команд','distribution':True,'showValues':True,'showLegend':False,'valueDecimals':0,'sort':'none'},'rows':block['bins'],'columns':['range','count','share'],'source':source,'height':390,'theme':'codex-classic'}
 (out/f'{code}-chart.json').write_text(json.dumps(chart,ensure_ascii=False,indent=2))
 receipt={'schemaVersion':1,'items':[{'id':f'{code}-evidence','title':title,'queries':[{'id':f'{code}-scores','source':source,'reportingPeriod':'II квартал 2026','rows':[{k:r[k] for k in ['team','unit','type','earned','max','pct','status']} for r in block['rows']],'columns':[{'field':k,'label':label}for k,label in [('team','Команда'),('unit','Юнит'),('type','Тип команды'),('earned','Баллы блока'),('max','Максимум'),('pct','Выполнение, %'),('status','Группа')]]}]}]}
 (out/f'{code}-sources.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2))
 for r in sorted(block['rows'],key=lambda r:(r['pct'],r['unit'],r['team'])):
  quartile=1+sum(r['pct']>block['percentiles'][p] for p in ['P25','P50','P75'])
  rank=100*sum(x['pct']<=r['pct']for x in block['rows'])/block['n']
  rows_for_export.append([title,r['unit'],r['team'],r['type'],r['earned'],r['max'],r['pct'],r['status'],quartile,round(rank,4)])
with (out/'Распределение_команд.csv').open('w',encoding='utf-8-sig',newline='')as f:
 w=csv.writer(f,delimiter=';');w.writerow(['Блок','Юнит','Команда','Тип','Балл','Максимум','Выполнение, %','Группа','Квартильная группа','Доля команд с баллом не выше, %']);w.writerows(rows_for_export)
print('Prepared two chart inputs, two source receipts and full team breakdown')
