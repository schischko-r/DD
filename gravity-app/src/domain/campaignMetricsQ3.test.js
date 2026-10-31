import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts,metricActualGrowth,campaignMetricNoteForPeriod} from './teamProfileSelection.js';
const actual=JSON.parse(readFileSync(new URL('../../public/report-data.json',import.meta.url),'utf8')).products;
const overlay=JSON.parse(readFileSync(new URL('../data/campaign-metrics-q3-2026.json',import.meta.url),'utf8'));
// Independently read from Книга3(2).xlsx / Лист1 A2:D64 using openpyxl, not generated overlay.
const sourceRows={"2": ["2ГИС", 1, 1, 0], "3": ["BNPL", 0, 1, 0], "4": ["OKKO", 1, 1, 0], "5": ["PB", 1, 1, 0], "6": ["PFM", 1, 1, 0], "7": ["SberPay NFC", 0, 0, 0], "8": ["SberPay QR", 0, 1, 0], "9": ["Автокредит", 1, 1, 0], "10": ["Аккредитивы", 0, 0, 0], "11": ["БПИФ", 1, 1, 0], "12": ["Брокерский счет", 1, 1, 1], "13": ["Вжух", 0, 1, 0], "14": ["ВЗР", 1, 1, 1], "15": ["Вклады+НС", 1, 1, 1], "16": ["Военная пенсия", 0, 1, 0], "17": ["Дебетовая карта", 1, 1, 1], "18": ["Дети", 0, 1, 0], "19": ["Детская карта", 1, 1, 0], "20": ["ДСЖ КК", 1, 1, 0], "21": ["ДСЖ ПК", 0, 0, 0], "22": ["Зарплатный продукт", 1, 1, 1], "23": ["Звук", 0, 1, 0], "24": ["ЗЛС", 1, 1, 1], "25": ["ЗПИФ", 0, 0, 0], "26": ["Инвесткопилка", 1, 0, 0], "27": ["КАСКО", 0, 1, 0], "28": ["Конверсия", 1, 1, 0], "29": ["Кредитные карты", 1, 1, 1], "30": ["Кредитный потенциал", 1, 0, 0], "31": ["Купер", 1, 1, 0], "32": ["МегаМаркет", 1, 1, 0], "33": ["Монеты", 0, 0, 0], "34": ["НСЖ", 1, 1, 0], "35": ["Образовательный кредит", 0, 1, 0], "36": ["Объект Авто", 0, 1, 0], "37": ["ОМС", 1, 1, 0], "38": ["ОСАГО", 1, 1, 0], "39": ["Пакет услуг СберПервый", 1, 1, 0], "40": ["Пакет услуг СберПремьер", 1, 1, 0], "41": ["ПДС", 1, 1, 1], "42": ["Пенсионный продукт", 0, 1, 0], "43": ["Переводы по РФ", 1, 1, 0], "44": ["ПИФ", 1, 1, 0], "45": ["Платежи", 1, 1, 1], "46": ["Потребительский кредит", 1, 1, 1], "47": ["Самокат", 1, 1, 0], "48": ["Сберавто", 0, 1, 0], "49": ["Сберздоровье", 1, 1, 0], "50": ["СберИнвестор", 1, 1, 0], "51": ["Сбермобайл", 0, 1, 0], "52": ["Сберправо", 1, 1, 0], "53": ["Сберпрайм", 1, 1, 0], "54": ["Сберспасибо", 1, 1, 0], "55": ["СБОЛ", 1, 1, 0], "56": ["Сейфы", 0, 0, 0], "57": ["Ситидрайв", 0, 1, 0], "58": ["Страхование залога", 0, 1, 0], "59": ["Трансграничные переводы", 1, 1, 0], "60": ["ЦФА", 0, 1, 0], "61": ["(пусто)", 0, 0, 0], "62": ["Сделка Вторичка", 1, 1, 0], "63": ["Сделка ИЖС", 1, 1, 0], "64": ["Сделка с первичным жильем", 1, 1, 0]};
const columns=[['attract.campaign_launches','B','launches_q3'],['attract.nalichie_self_service','C','self_service_q3'],['attract.nalichie_uspeshnyh_biznes_zapuskov','D','successful_business_q2']];
const metrics=p=>p.metrics.flatMap(b=>b.metrics);

test('43 product matches preserve all 129 literal source cells and previous-quarter provenance',()=>{
  assert.equal(overlay.period,'III кв. 2026');assert.equal(overlay.products.length,43);
  assert.equal(new Set(overlay.products.map(p=>p.id)).size,43);
  let cells=0;
  for(const p of overlay.products){
    const source=actual.find(s=>s.id===p.id);assert.ok(source);assert.equal(source.type,'Продукт');assert.equal(p.type,'Продукт');assert.equal(p.name,source.name);assert.equal(p.unit,source.unit);
    const row=sourceRows[p.sourceRow];assert.ok(row);assert.equal(p.sourceName,row[0]);
    for(const [index,[code,column,label]]of columns.entries()){
      const fact=p.metrics[code];assert.equal(fact.rawValue,row[index+1]);
      assert.deepEqual(fact.source,{file:'Книга3(2).xlsx',sheet:'Лист1',cell:`${column}${p.sourceRow}`,columnLabel:`Сумма по полю ${label}`});cells++;
    }
  }
  assert.equal(cells,129);assert.match(overlay.source.successfulBusinessPeriodNote,/Q−1/);
});

test('overlay scales 114 applicable values by original maxima, keeps four positive conflicts unknown, and never changes Q2',()=>{
  const original=JSON.stringify(actual),rawOriginal=JSON.stringify(overlay);
  const next=buildTeamProfileProducts(actual,'III кв. 2026',overlay);
  let assessed=0,unknown=0,positiveConflicts=0;
  for(const product of actual){
    const q3=next.find(t=>t.name===product.name&&t.unit===product.unit&&t.type===product.type);assert.ok(q3);
    const factProduct=overlay.products.find(p=>p.id===product.id);
    for(const old of metrics(product)){
      const metric=metrics(q3).find(m=>m.code===old.code);assert.ok(metric);assert.equal(metric.max_value,old.max_value);
      for(const key of ['is_applicabble_flg','excluded_from_index','dd_calculation_flg'])assert.equal(metric[key],old[key]);
      const fact=factProduct?.metrics[old.code];
      if(!fact){assert.equal(metric.value,null);continue;}
      assert.deepEqual(metric.source,{...fact.source,rawValue:fact.rawValue});
      if(old.is_applicabble_flg!==false&&Number(old.max_value)>0){assert.equal(metric.value,fact.rawValue*old.max_value);assessed++;}
      else{assert.equal(metric.value,null);unknown++;if(fact.rawValue===1)positiveConflicts++;}
    }
    if(product.type!=='Продукт')assert.ok(metrics(q3).every(m=>m.value===null&&!m.source));
  }
  assert.equal(assessed,114);assert.equal(unknown,15);assert.equal(positiveConflicts,4);
  assert.equal(JSON.stringify(actual),original);assert.equal(JSON.stringify(overlay),rawOriginal);
  const q2=buildTeamProfileProducts(actual,'II кв. 2026',overlay);assert.equal(q2.length,83);
  q2.forEach(p=>assert.equal(p,actual.find(a=>a.id===p.id)));
});

test('binary one means the full fractional rubric maximum rather than an invented one point',()=>{
  const source={id:'fraction',name:'Дробный максимум',unit:'DB',type:'Продукт',period:'II кв. 2026',metrics:[{code:'attract',name:'Воронка',metrics:[{code:columns[0][0],name:'Запуски',value:0,max_value:.5,dd_calculation_flg:1,is_applicabble_flg:true}]}]};
  const facts={period:'III кв. 2026',products:[{id:source.id,name:source.name,unit:source.unit,type:source.type,metrics:{[columns[0][0]]:{rawValue:1,source:{file:'fixture',sheet:'Лист1',cell:'B2',columnLabel:'launches_q3'}}}}]};
  const q3=buildTeamProfileProducts([source],facts.period,facts)[0];assert.equal(metrics(q3)[0].value,.5);assert.equal(metrics(q3)[0].max_value,.5);assert.equal(q3.indexMaxPoints,.5);assert.equal(source.metrics[0].metrics[0].value,0);
});


test('actual growth requires a positive comparable included metric and a complete index denominator',()=>{
  const known={value:.5,max_value:.5,previousValue:0,previousMaxValue:.5,previousPeriod:'II кв. 2026',is_applicabble_flg:true,dd_calculation_flg:1};
  const growth=metricActualGrowth(known,26.25,'III кв. 2026');
  assert.ok(growth);assert.equal(growth.pointsDelta,.5);assert.equal(growth.metricPctDelta,100);
  assert.ok(Math.abs(growth.indexPctDelta-1.9047619047619047)<1e-12);
  for(const patch of [{value:0},{value:null},{previousValue:null},{previousMaxValue:1},{is_applicabble_flg:false},{excluded_from_index:true},{dd_calculation_flg:0},{previousPeriod:'III кв. 2026'},{value:.75},{previousValue:-1}]){
    assert.equal(metricActualGrowth({...known,...patch},26.25,'III кв. 2026'),null,JSON.stringify(patch));
  }
  assert.equal(metricActualGrowth(known,0,'III кв. 2026'),null);
});

test('deposits have exactly one actual Q3 growth of 1.9 index points and never change Q2 scores',()=>{
  const before=JSON.stringify(actual);const prior=actual.find(p=>p.name==='Вклады+НС');assert.ok(prior);
  const current=buildTeamProfileProducts(actual,overlay.period,overlay).find(p=>p.name===prior.name&&p.unit===prior.unit);
  assert.equal(current.indexMaxPoints,26.25);
  const grown=metrics(current).map(metric=>({metric,growth:metricActualGrowth(metric,current.indexMaxPoints,current.period)})).filter(row=>row.growth);
  assert.equal(grown.length,1);assert.equal(grown[0].metric.code,'attract.nalichie_uspeshnyh_biznes_zapuskov');
  assert.equal(grown[0].metric.previousValue,0);assert.equal(grown[0].metric.previousMaxValue,.5);assert.equal(grown[0].metric.previousPeriod,'II кв. 2026');
  assert.equal(Math.round(grown[0].growth.indexPctDelta*10)/10,1.9);
  for(const code of ['attract.campaign_launches','attract.nalichie_self_service']){
    const metric=metrics(current).find(m=>m.code===code);assert.equal(metric.previousValue,.5);assert.equal(metricActualGrowth(metric,current.indexMaxPoints,current.period),null);
  }
  for(const p of buildTeamProfileProducts(actual,overlay.period,overlay))for(const metric of metrics(p)){
    if(metric.is_applicabble_flg===false || !(metric.max_value>0) || metric.value===null)assert.equal(metricActualGrowth(metric,p.indexMaxPoints,p.period),null);
  }
  assert.equal(JSON.stringify(actual),before);
});


test('digital trace quarter matches the assessment except successful business launches use the previous quarter',()=>{
  const codes=['attract.campaign_launches','attract.nalichie_self_service','attract.chernoviki_v_sbol_70','attract.nalichie_uspeshnyh_biznes_zapuskov'];
  for(const [period,expected]of [['II кв. 2026',[2,2,2,1]],['III кв. 2026',[3,3,3,2]],['I кв. 2027',[1,1,1,4]]]){
    codes.forEach((code,index)=>assert.equal(campaignMetricNoteForPeriod(code,period,'Проверено на цифровых следах за 1Q'),`Проверено на цифровых следах за ${expected[index]}Q`));
  }
  assert.equal(campaignMetricNoteForPeriod(codes[2],'III кв. 2026','Проверено на цифровых следах'),'Проверено на цифровых следах за 3Q');
  assert.equal(campaignMetricNoteForPeriod('goals.monitored','III кв. 2026','Проверено на цифровых следах в мастер-дешах'),'Проверено на цифровых следах в мастер-дешах');
});
