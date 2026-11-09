import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {completeProductPercent} from './report.js';

const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const source=read('../../public/report-data.json').products;
const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k=>read(`../data/${imports.get(k.trim())}`));
const args=['salary-products','reporting-regularity-missing','funnel-action-missing'].map(n=>read(`../data/${n}-q3-2026.json`));
const backlog=read('../../public/backlog-data.json');
const build=(period,facts)=>buildDdiPeriodProducts(source,period,facts,...args,backlog);
const metrics=p=>p.metrics.flatMap(b=>b.metrics);
const full=['СБОЛ','SberPay NFC','Оплата улыбкой','SberPay Вжух','SberPay Ecom','SberID','BNPL','ЗЛС',
 'Переводы по РФ','СберKids','СберИнвестор','Пакет услуг СберПервый','ОСАГО','Дебетовая карта',
 'Конверсия','ВЗР','Платежи','Страхование залога','СберПрайм','Страхование жизни','ПДС'];
const half=['Детская карта','Брокерский счет','Потребительский кредит','Пакет услуг СберПремьер',
 'Много денег (НКПЗН)','Сделка с Первичным жильём','Сделка ИЖС','Сделка вторичка','КАСКО','Кредитные карты',
 'Автокредит','Сейфы','ОМС','Кредитный потенциал','Вклады+НС','POS-кредиты','СберСпасибо','НСЖ','ОПИФ','ИСЖ'];
const expected=new Map([...full.map(n=>[n,1]),...half.map(n=>[n,0.5])]);

function previousAssessments() {
 const prior=structuredClone(overlays);
 const initial=prior.find(o=>o.scope==='cx-score-assessment' && o.products.some(p=>p.name==='Оплата улыбкой'));
 const smile=initial.products.find(p=>p.name==='Оплата улыбкой');
 const oldApplicability=smile.metrics['cx.score'].source.correction.previousApplicability;
 for(const overlay of prior) if(Array.isArray(overlay.products)) {
  overlay.products=overlay.products.filter(team=>{
   const fact=team.metrics?.['cx.score'];
   const correction=fact?.source?.correction;
   if(correction?.origin!=='userConfirmedCxScoreList20261109')return true;
   if(correction.previousAssessment)team.metrics['cx.score']=correction.previousAssessment;
   else delete team.metrics['cx.score'];
   return Object.keys(team.metrics).length>0;
  });
 }
 prior.find(o=>o.scope==='metric-applicability-assessment'&&!o.applyAfterReporting).products.push({
  id:smile.id,name:smile.name,unit:smile.unit,type:smile.type,metrics:{'cx.score':oldApplicability},
 });
 return prior;
}

test('latest CX list sets all 41 exact teams, preserves every non-CX metric and Q2, and changes only 20 DDI indices',()=>{
 assert.equal(expected.size,41);
 const beforeFacts=previousAssessments();
 const before=build('III кв. 2026',beforeFacts),after=build('III кв. 2026',overlays);
 assert.equal(after.length,76);
 let checked=0,changed=0,increased=0,decreased=0;
 for(const product of after) {
  const old=before.find(p=>p.id===product.id);
  if(!expected.has(product.name)){assert.deepEqual(product,old);continue;}
  checked++;
  const cx=metrics(product).find(m=>m.code==='cx.score');
  assert.equal(cx.value,expected.get(product.name),product.name);
  assert.equal(cx.max_value,1,product.name);
  assert.equal(cx.is_applicabble_flg,true,product.name);
  assert.equal(cx.excluded_from_index,false,product.name);
  assert.deepEqual(metrics(product).filter(m=>m.code!=='cx.score'),metrics(old).filter(m=>m.code!=='cx.score'),product.name);
  assert.equal(product.indexMaxPoints,old.indexMaxPoints+(product.name==='Оплата улыбкой'?1:0),product.name);
  const delta=completeProductPercent(product)-completeProductPercent(old);
  if(delta){changed++;if(delta>0)increased++;else decreased++;}
 }
 assert.deepEqual([checked,changed,increased,decreased],[41,20,16,4]);
 assert.deepEqual(build('II кв. 2026',overlays),build('II кв. 2026',beforeFacts));
});
