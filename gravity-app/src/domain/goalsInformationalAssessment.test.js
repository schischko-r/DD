import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {applyGoalsInformationalAssessments} from './goalsInformationalAssessment.js';
import {isDdIndexMetric, isInformationalMetric} from './report.js';
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const original = read('../../public/report-data.json').products;
const assessment = read('../data/goals-informational-q3-2026.json');
const app = fs.readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k => read(`../data/${imports.get(k.trim())}`));
const args = [read('../data/salary-products-q3-2026.json'), read('../data/reporting-regularity-missing-q3-2026.json'), read('../data/funnel-action-missing-q3-2026.json')];
const metrics = p => p.metrics.flatMap(b => b.metrics);

test('Q3 makes LУ/ЛТ informational only for the confirmed tribes and keeps other LУ/ЛТ scores in the index', () => {
  const snapshot=JSON.stringify({original,overlays});
  const before=buildDdiPeriodProducts(original,assessment.period,overlays.filter(o=>o.scope!=='goals-information-assessment'),...args);
  const after=buildDdiPeriodProducts(original,assessment.period,overlays,...args);
  const catalog=read('../data/goals-tribe-source-q3-2026.json').assignments;
  const direct=catalog.filter(p=>p.unit==='УБ'||p.unit==='CBP'&&p.catalogTribe==='Комиссионные продукты');
  assert.equal(direct.length,25);assert.deepEqual(assessment.products.map(p=>p.id).sort(),direct.map(p=>p.id).sort());
  const directIds=new Set(direct.map(p=>String(p.id).replace(/::empty::.*/,'')));
  let informationalLt=0,poIndexed=0;const distribution={};
  for(const p of after){
    const old=before.find(t=>t.id===p.id);const lt=metrics(p).filter(m=>m.code.startsWith('goals.')&&!m.code.startsWith('goals.po_'));const po=metrics(p).filter(m=>m.code.startsWith('goals.po_'));
    assert.equal(lt.length,3);assert.equal(po.length,3);
    const isDirect=directIds.has(String(p.id).replace(/::empty::.*/,''));
    for(const m of lt){const prior=metrics(old).find(x=>x.code===m.code);assert.equal(m.value,prior.value);assert.equal(m.max_value,prior.max_value);assert.equal(m.is_applicabble_flg,prior.is_applicabble_flg);assert.equal(m.hidden_from_profile,prior.hidden_from_profile);assert.deepEqual(m.source,prior.source);if(isDirect){assert.equal(isInformationalMetric(m),true);assert.equal(isDdIndexMetric(m),false);assert.equal(m.indexExclusionSource.origin,'userConfirmedInformationalTribeGoals');informationalLt++;}else{assert.equal(isInformationalMetric(m),isInformationalMetric(prior));assert.equal(isDdIndexMetric(m),isDdIndexMetric(prior));assert.equal(m.indexExclusionSource,prior.indexExclusionSource);}}
    const indexed=po.filter(isDdIndexMetric);poIndexed+=indexed.length;distribution[indexed.length]=(distribution[indexed.length]||0)+1;
    const removed=isDirect?metrics(old).filter(m=>m.code.startsWith('goals.')&&!m.code.startsWith('goals.po_')&&isDdIndexMetric(m)):[];
    assert.equal(p.indexMaxPoints,old.indexMaxPoints-removed.reduce((n,m)=>n+m.max_value,0));
    assert.deepEqual(metrics(p).filter(m=>!m.code.startsWith('goals.')),metrics(old).filter(m=>!m.code.startsWith('goals.')));
  }
  assert.equal(informationalLt,75);assert.equal(poIndexed,218);assert.deepEqual(distribution,{1:1,2:8,3:67});
  assert.deepEqual(buildDdiPeriodProducts(original,'II кв. 2026',overlays,...args),original);assert.equal(JSON.stringify({original,overlays}),snapshot);
});

test('informational assessments require exact identity and cannot exclude unrelated or future PO metrics', () => {
  const team = {id: 'x', name: 'X', unit: 'УБ', type: 'Продукт', metrics: [{code: 'goals', metrics: [
    {code: 'goals.monitored', value: 1, max_value: 1}, {code: 'goals.po_monitoring', value: null, max_value: 1},
  ]}]};
  const data = {...assessment, products: [{id: 'x', name: 'X', unit: 'УБ', type: 'Продукт', metrics: {
    'goals.monitored': {informational: true}, 'goals.po_monitoring': {informational: true},
  }}]};
  const result = applyGoalsInformationalAssessments([team], assessment.period, [data])[0];
  assert.equal(result.metrics[0].metrics[0].excluded_from_index, true);
  assert.deepEqual(result.metrics[0].metrics[1], team.metrics[0].metrics[1]);
  data.products[0].unit = 'wrong';
  assert.deepEqual(applyGoalsInformationalAssessments([team], assessment.period, [data]), [team]);
  assert.deepEqual(applyGoalsInformationalAssessments([team], 'II кв. 2026', [assessment]), [team]);
});


test('a PO template alone does not make LT informational; only exact approved team records apply',()=>{
  const p={id:'global',name:'Команда',unit:'CX',type:'Сегмент',metrics:[{code:'goals',metrics:[{code:'goals.monitored',value:.5,max_value:1,is_applicabble_flg:true},{code:'goals.forecast',value:null,max_value:0,is_applicabble_flg:false,hidden_from_profile:true},{code:'goals.po_monitoring',value:1,max_value:1,is_applicabble_flg:true}]}]};
  const template={period:'III кв. 2026',scope:'po-goals-template'};
  const result=applyGoalsInformationalAssessments([p],template.period,[template])[0];
  assert.deepEqual(result,p);
  assert.deepEqual(applyGoalsInformationalAssessments([p],'II кв. 2026',[template]),[p]);
  assert.deepEqual(applyGoalsInformationalAssessments([p],template.period,[{...template,period:'II кв. 2026'}]),[p]);
  assert.deepEqual(applyGoalsInformationalAssessments([p],template.period,[]),[p]);
});
