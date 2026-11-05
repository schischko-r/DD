import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {isDdIndexMetric} from './report.js';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(n=>read(`../data/${imports.get(n.trim())}`));
const raw=read('../../public/report-data.json').products;
const args=['salary-products','reporting-regularity-missing','funnel-action-missing'].map(n=>read(`../data/${n}-q3-2026.json`));
const fa='goals.po_factor_analysis',fc='goals.po_forecast';
const targets=[
 ['ДомКлик','Сделка вторичка',fc,.5],['ДомКлик','Сделка ИЖС',fa,.5],
 ['ДомКлик','Сделка с Первичным жильём',fa,.5],['ДомКлик','Сделка с Первичным жильём',fc,.5],
 ...['Автокредит','Вклады+НС','Образовательный кредит','BNPL','POS-кредиты'].map(n=>['CBP',n,fa,0]),
 ['CX','Пакет услуг СберПервый',fa,0],['Data','Единый личный кабинет (ЕЛК)',fa,1],['Data','Единый личный кабинет (ЕЛК)',fc,1],
 ['Data','Персональная рекомендация',fa,0],['Data','Почта, Диск, Календарь',fa,0],['Data','Почта, Диск, Календарь',fc,0],
 ['Data','SberID',fa,0],['Data','SberID',fc,.5],['DB','Зарплатный продукт',fa,.5],['DB','Интернет-Эквайринг',fa,0],
 ['DB','Кредитные карты',fa,0],['DB','Кредитные карты',fc,0],['DB','Платежи',fa,0],['DB','Трансграничные переводы',fa,0],['DB','SberPay Ecom',fa,.5],
];
const expected=new Map(targets.map(([u,n,c,v])=>[`${u}|${n}|${c}`,v]));
const earlier=structuredClone(overlays);
for(const o of earlier){
 if(o.scope==='goals-final-scores')for(const p of o.products)for(const [code,correction]of Object.entries(p.finalCorrections||{})){
  if(correction.group==='finalGoalsTable20261103')p.final[code]=correction.previousValue;
 }
 if(['cbp-user-corrections','cx-user-corrections'].includes(o.scope))for(const p of o.products)for(const [code,f]of Object.entries(p.metrics)){
  if(f.source?.correction?.group==='finalGoalsTable20261103')p.metrics[code]=f.source.correction.previousAssessment;
 }
}
const build=(period,facts)=>buildDdiPeriodProducts(raw,period,facts,...args,read('../../public/backlog-data.json'));
const withoutComparison=m=>{const {previousValue,previousMaxValue,previousPeriod,...rest}=m;return rest;};
test('the 24 requested final Q3 goal scores override earlier unit corrections and preserve other scores and detail levels',()=>{
 const before=build('III кв. 2026',earlier),after=build('III кв. 2026',overlays);
 assert.equal(expected.size,24);let seen=0;
 for(const p of after){
  const old=before.find(t=>t.id===p.id);assert.ok(old);
  const {metrics,indexMaxPoints,...meta}=p,{metrics:oldBlocks,indexMaxPoints:oldMax,...oldMeta}=old;
  assert.deepEqual(meta,oldMeta);
  for(const block of metrics){
   const prior=oldBlocks.find(b=>b.code===block.code);
   if(block.code!=='goals'){assert.deepEqual(block,prior);continue;}
   assert.deepEqual(block.goalsPoLevelMetrics.map(withoutComparison),prior.goalsPoLevelMetrics.map(withoutComparison),
    'PO detail scores stay intact; activating a final criterion may restore its known Q2 comparison');
   const {metrics:entries,goalsFinalScores,goalsPoLevelMetrics,...bm}=block,
    {metrics:oldEntries,goalsFinalScores:oldFinal,goalsPoLevelMetrics:oldPo,...oldBm}=prior;
   assert.deepEqual(bm,oldBm);
   for(const m of entries){
    const previous=oldEntries.find(x=>x.code===m.code),key=`${p.unit}|${p.name}|${m.code}`;
    if(!expected.has(key)){
     const finalCode=m.code==='goals.factor_analysis_l1_l2'?fa:m.code==='goals.forecast'?fc:null;
     if(expected.has(`${p.unit}|${p.name}|${finalCode}`))assert.deepEqual(withoutComparison(m),withoutComparison(previous),key);
     else assert.deepEqual(m,previous,key);
     continue;
    }
    seen++;assert.equal(m.value,expected.get(key),key);assert.equal(m.max_value,1,key);
    assert.equal(isDdIndexMetric(m),true,key);assert.equal(m.source.level,'final');
    const base=m.code===fa?'goals.factor_analysis_l1_l2':'goals.forecast';assert.equal(goalsFinalScores[base],expected.get(key));
   }
   for(const code of Object.keys(oldFinal)){
    const key=`${p.unit}|${p.name}|${code==='goals.factor_analysis_l1_l2'?fa:code==='goals.forecast'?fc:'goals.po_monitoring'}`;
    if(!expected.has(key))assert.equal(goalsFinalScores[code],oldFinal[code]);
   }
  }
  if(p.name!=='Кредитные карты')assert.equal(indexMaxPoints,oldMax);
  else assert.equal(indexMaxPoints,oldMax+1,'explicit zero forecast becomes an applicable final criterion');
 }
 assert.equal(seen,24);
 assert.deepEqual(build('II кв. 2026',overlays),build('II кв. 2026',earlier));
});
