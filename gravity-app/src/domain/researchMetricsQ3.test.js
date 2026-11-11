import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts} from './teamProfileSelection.js';
const actual=JSON.parse(readFileSync(new URL('../../public/report-data.json',import.meta.url))).products;
const code='hyp.datadriven_rating_7_5';
const metrics=p=>p.metrics.flatMap(b=>b.metrics);
// Independent transcription of all 39 user-supplied rows, including conflicting/pending entries.
const expected=[
  [
    "PB",
    "7,5",
    1
  ],
  [
    "SberID",
    "8",
    1
  ],
  [
    "Автокредит",
    "9",
    1
  ],
  [
    "БПИФ",
    "7",
    0
  ],
  [
    "Брокерский счет",
    "7,333333333",
    0
  ],
  [
    "Вклады + НС",
    "7,75",
    1
  ],
  [
    "Выписки, справки",
    "7,333333333",
    0
  ],
  [
    "Дебетовая карта",
    "8",
    1
  ],
  [
    "Дети",
    "7,5",
    1
  ],
  [
    "Зарплатный продукт",
    "8",
    1
  ],
  [
    "ЗПИФ",
    "7",
    0
  ],
  [
    "Зрелость",
    "7,333333333",
    0
  ],
  [
    "Инвесткопилка",
    "7",
    0
  ],
  [
    "КАСКО",
    "7,333333333",
    0
  ],
  [
    "Колл-центр",
    "7,571428571",
    1
  ],
  [
    "Конверсия",
    "8",
    1
  ],
  [
    "Корпаративное страхование",
    "7",
    0
  ],
  [
    "Кредитные карты",
    "8,25",
    1
  ],
  [
    "Кредитный потенциал",
    "8,083333333",
    1
  ],
  [
    "ОПИФ",
    "7,5",
    1
  ],
  [
    "ОСАГО",
    "9",
    1
  ],
  [
    "ПДС",
    "7,5",
    1
  ],
  [
    "Переводы",
    "7",
    0
  ],
  [
    "Персональная рекомендация",
    "7,652173913",
    1
  ],
  [
    "Платежи",
    "9",
    1
  ],
  [
    "Потребительский кредит",
    "7,75",
    1
  ],
  [
    "Рабочий возраст",
    "7,666666667",
    1
  ],
  [
    "СберID",
    "7,285714286",
    0
  ],
  [
    "СберИнвестор",
    "7,625",
    1
  ],
  [
    "СберСпасибо",
    "7,818181818",
    1
  ],
  [
    "СБОЛ",
    "7,571428571",
    1
  ],
  [
    "Сделка вторичка",
    "8,2",
    1
  ],
  [
    "Сделка ИЖС",
    "8,333333333",
    1
  ],
  [
    "Сделка с Первичным жильем",
    "8,2",
    1
  ],
  [
    "Страховой брокер",
    "7,5",
    1
  ],
  [
    "Телемаркетинг",
    "8,142857143",
    1
  ],
  [
    "Торговый эквайринг",
    "8",
    1
  ],
  [
    "Уведомления",
    "8",
    1
  ],
  [
    "Чат",
    "8",
    1
  ]
];
const overlay=JSON.parse(readFileSync(new URL('../data/research-metrics-q3-2026.json',import.meta.url)));
const corrections=JSON.parse(readFileSync(new URL('../data/research-metric-corrections-q3-2026.json',import.meta.url)));
const otherOverlays=['campaign','draft','crosssell'].map(name=>JSON.parse(readFileSync(new URL(`../data/${name}-metrics-q3-2026.json`,import.meta.url))));

test('all 39 user rows retain literal averages and authoritative last-column scores, including four pending rows',()=>{
  assert.equal(overlay.scope,'research-assessment');assert.equal(overlay.period,'III кв. 2026');
  assert.deepEqual(overlay.sourceRows.map(r=>[r.sourceName,r.averageScoreText,r.points]),expected);
  assert.equal(overlay.products.length,82);assert.equal(new Set(overlay.products.map(p=>p.id)).size,82);
  assert.deepEqual(overlay.counts,{sourceRows:39,mappedTeams:82,ones:36,zeros:46,pendingRows:4,byTeamType:{'Сегмент':7,'Продукт':66,'Канал':9},carriedForwardTeams:47});
  assert.deepEqual(overlay.pending.map(r=>r.sourceRow),[2,23,28,35]);
  const pending=new Set(overlay.pending.map(r=>r.sourceRow));
  assert.deepEqual([...overlay.products.filter(p=>p.metrics[code].source.origin!=='priorQuarterCarryForward').map(p=>p.metrics[code].source.sourceRow),...pending].sort((a,b)=>a-b),Array.from({length:39},(_,i)=>i+1));
  for(const team of overlay.products.filter(p=>p.metrics[code].source.origin!=='priorQuarterCarryForward')){
    const fact=team.metrics[code],source=fact.source,row=expected[source.sourceRow-1];
    assert.deepEqual([source.sourceName,source.averageScoreText,source.lastPoints],row);
    assert.equal(source.averageScore,Number(row[1].replace(',','.')));assert.equal(fact.rawValue,row[2]);
    assert.equal(fact.rawValue,source.averageScore>=7.5?1:0,'Threshold sanity agrees with the supplied last column');
    assert.ok(!pending.has(source.sourceRow));assert.deepEqual(Object.keys(team.metrics),[code]);
  }
});

test('research facts apply across all 82 included teams without changing Q2, maxima or other Q3 metrics',()=>{
  const original=JSON.stringify(actual),raw=JSON.stringify(overlay);
  const before=buildTeamProfileProducts(actual,overlay.period,otherOverlays);
  const current=buildTeamProfileProducts(actual,overlay.period,[...otherOverlays,overlay]);
  let assessed=0;
  for(const product of current){
    const prior=before.find(p=>p.name===product.name&&p.unit===product.unit&&p.type===product.type);
    const old=actual.find(p=>p.name===product.name&&p.unit===product.unit&&p.type===product.type);
    const fact=overlay.products.find(p=>p.id===old.id)?.metrics[code];
    assert.equal(product.indexMaxPoints,prior.indexMaxPoints);
    for(const metric of metrics(product)){
      const unchanged=metrics(prior).find(m=>m.code===metric.code);assert.equal(metric.max_value,unchanged.max_value);
      if(metric.code!==code){assert.deepEqual(metric,unchanged);continue;}
      if(fact){assert.equal(metric.value,fact.rawValue*unchanged.max_value);assert.deepEqual(metric.source,{...fact.source,rawValue:fact.rawValue});assessed++;
        assert.deepEqual((metric.recommendation_items||[]).map(i=>[i.recommendation,i.group,i.recommendation_difficulty]),(metrics(old).find(m=>m.code===code).recommendation_items||[]).map(i=>[i.recommendation,i.group,i.recommendation_difficulty]));
      }else assert.deepEqual(metric,unchanged);
    }
  }
  assert.equal(assessed,82);
  for(const name of ['Трансграничные переводы']){const p=current.find(p=>p.name===name);if(p)assert.equal(metrics(p).find(m=>m.code===code)?.value,0);}
  assert.equal(JSON.stringify(actual),original);assert.equal(JSON.stringify(overlay),raw);
  buildTeamProfileProducts(actual,'II кв. 2026',[...otherOverlays,overlay]).forEach(p=>assert.equal(p,actual.find(old=>old.id===p.id)));
});

test('only the named research metric may cross the product-only overlay boundary',()=>{
  const other='attract.campaign_launches';
  for(const type of ['Канал','Сегмент']){
    const input={id:type,name:type,unit:'DB',type,period:'II кв. 2026',metrics:[{code:'hyp',metrics:[{code,value:0,max_value:.5,is_applicabble_flg:true},{code:other,value:0,max_value:1,is_applicabble_flg:true}]}]};
    const record={id:type,name:type,unit:'DB',type,metrics:{[code]:{rawValue:1,source:{fixture:'research'}},[other]:{rawValue:1,source:{fixture:'must not leak'}}}};
    const fact={period:overlay.period,scope:'research-assessment',metricMaxOverrides:{[code]:10},products:[record]};
    const q3=buildTeamProfileProducts([input],overlay.period,fact)[0];assert.equal(metrics(q3)[0].value,.5);assert.equal(metrics(q3)[0].max_value,.5);assert.equal(metrics(q3)[1].value,null);assert.equal(metrics(q3)[1].source,undefined);
    const unauthorized=buildTeamProfileProducts([input],overlay.period,{...fact,scope:'campaign'})[0];assert.equal(metrics(unauthorized)[0].value,null);assert.equal(metrics(unauthorized)[1].value,null);
  }
});

test('nine user-approved Q2 ones and 38 missing Q2 zeros are carried without inventing Q3 averages',()=>{
  const names=['Много денег (НКПЗН)','Переводы по РФ','Сейфы','SberPay Ecom','ОМС','СберПрайм','SberPay NFC','Оплата улыбкой','SberID'];
  const carried=overlay.products.filter(p=>p.metrics[code].source.origin==='priorQuarterCarryForward'&&p.metrics[code].rawValue===1);
  assert.deepEqual(carried.map(p=>p.name).sort(),[...names].sort());
  const current=buildTeamProfileProducts(actual,overlay.period,[...otherOverlays,overlay]);
  for(const factTeam of carried){
    const fact=factTeam.metrics[code],source=fact.source;
    const prior=metrics(actual.find(p=>p.id===factTeam.id)).find(m=>m.code===code);
    assert.equal(prior.value,1);assert.equal(prior.max_value,1);assert.notEqual(prior.is_applicabble_flg,false);
    assert.equal(fact.rawValue,1);assert.equal(source.sourceValue,1);assert.equal(source.sourceMaxValue,1);
    assert.equal(source.confirmedBy,'user');assert.equal(source.fromPeriod,'II кв. 2026');assert.equal(source.period,'III кв. 2026');
    for(const key of ['averageScore','averageScoreText','sourceRow','lastPoints'])assert.equal(source[key],undefined,'No Q3 average or source-table value is invented');
    const result=metrics(current.find(p=>p.name===factTeam.name)).find(m=>m.code===code);assert.equal(result.value,1);assert.equal(result.max_value,1);
  }
  assert.deepEqual(overlay.products.filter(p=>p.metrics[code].rawValue===0&&p.metrics[code].source.origin!=='priorQuarterCarryForward').map(p=>p.metrics[code].source.sourceRow).sort((a,b)=>a-b),[4,5,7,11,12,13,14,17]);
  for(const name of ['Выписки, справки','Зрелость']){const team=overlay.products.find(p=>p.name===name);assert.ok(team);assert.equal(team.metrics[code].rawValue,0);assert.notEqual(team.metrics[code].source.origin,'priorQuarterCarryForward');}
  const zeroCarried=overlay.products.filter(p=>p.metrics[code].source.origin==='priorQuarterCarryForward'&&p.metrics[code].rawValue===0);
  assert.equal(zeroCarried.length,38);
  assert.deepEqual(zeroCarried.map(p=>p.name==='ВЗР'?'Страхование путешественников':p.name==='SberPay Вжух'?'Вжух':p.name),overlay.source.zeroCarryForwardPolicy.teams);
  for(const factTeam of zeroCarried){
    const prior=metrics(actual.find(p=>p.id===factTeam.id)).find(m=>m.code===code);
    assert.equal(prior.value,0);assert.equal(prior.max_value,1);
    const fact=factTeam.metrics[code];assert.equal(fact.source.sourceValue,0);assert.equal(fact.source.confirmedBy,'user');
    assert.equal(fact.source.averageScore,undefined);assert.equal(fact.source.averageScoreText,undefined);
    assert.equal(metrics(current.find(p=>p.name===factTeam.name&&p.unit===factTeam.unit)).find(m=>m.code===code).value,0);
  }
});

test('user-confirmed research corrections override the old carry-forward for only the named Q3 teams',()=>{
  const products=buildTeamProfileProducts(actual,overlay.period,[...otherOverlays,overlay,corrections]);
  const expected=new Map([['Автокредит',0],['Конверсия',0.5],['ОМС',0],['Сейфы',0],['Дети',0.5],['SberID',0],['Оплата улыбкой',1],['Детская карта',1],['SberPay NFC',0]]);
  assert.equal(corrections.products.length,expected.size);
  for(const [name,value] of expected){
    const product=products.find(p=>p.name===name);
    const metric=metrics(product).find(m=>m.code===code);
    assert.equal(metric.value,value,`${name} / III кв. 2026`);
    assert.equal(metric.max_value,1);
    assert.equal(metric.source.origin,'userConfirmedResearchMetricCorrection');
  }
});
