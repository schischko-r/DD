import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const source=read('../../public/report-data.json').products;
const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k=>read('../data/'+imports.get(k.trim())));
const extra=read('../data/funnel-additional-user-assessments-q3-2026.json');
const salary=read('../data/salary-products-q3-2026.json'),reporting=read('../data/reporting-regularity-missing-q3-2026.json'),actions=read('../data/funnel-action-missing-q3-2026.json');
test('three exact manual funnel facts fill only their Q3 gaps with original weights and leave Q2 unchanged',()=>{
  const before=buildDdiPeriodProducts(source,extra.period,overlays.filter(o=>o.source?.origin!==extra.source.origin),salary,reporting,actions);
  const after=buildDdiPeriodProducts(source,extra.period,overlays,salary,reporting,actions);
  const expected=new Map([['Много денег (НКПЗН)|churn.report_completeness',1],['Сделка ИЖС|attract.funnel_analysis',1],['Сделка с Первичным жильём|churn.funnel_analysis',.5]]);
  let changes=0;
  for(const p of after){const old=before.find(t=>t.id===p.id);assert.equal(p.indexMaxPoints,old.indexMaxPoints);const oldMetrics=old.metrics.flatMap(b=>b.metrics);for(const m of p.metrics.flatMap(b=>b.metrics)){const prior=oldMetrics.find(t=>t.code===m.code),value=expected.get(p.name+'|'+m.code);if(value===undefined){assert.deepEqual(m,prior);continue;}assert.equal(prior.value,null);assert.equal(m.value,value*m.max_value);assert.equal(m.max_value,prior.max_value);assert.equal(m.is_applicabble_flg,prior.is_applicabble_flg);changes++;}}
  assert.equal(changes,3);assert.equal(extra.products.length,3);
  assert.deepEqual(buildDdiPeriodProducts(source,'II кв. 2026',overlays,salary,reporting,actions),source);
});
