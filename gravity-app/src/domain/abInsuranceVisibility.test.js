import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {isDdIndexMetric} from './report.js';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const source=read('../../public/report-data.json').products;
const data=read('../data/ab-tests-insurance-visibility-q3-2026.json');
const app=fs.readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k=>read(`../data/${imports.get(k.trim())}`));
const args=[read('../data/salary-products-q3-2026.json'),read('../data/reporting-regularity-missing-q3-2026.json'),read('../data/funnel-action-missing-q3-2026.json')];
const metrics=p=>p.metrics.flatMap(b=>b.metrics);

test('only two insurance AB rows are hidden in Q3 while InvestKopilka is fully scored and Q2 is unchanged',()=>{
  const before=buildDdiPeriodProducts(source,data.period,overlays.filter(o=>o.source?.origin!==data.source.origin),...args);
  const after=buildDdiPeriodProducts(source,data.period,overlays,...args);
  let hidden=0;
  for(const p of after){
    const old=before.find(t=>t.id===p.id);
    if(!data.products.some(t=>t.id===p.id.split('::empty::')[0])){assert.deepEqual(p,old);continue;}
    const metric=metrics(p).find(m=>m.code==='hyp.ab_tests');
    assert.equal(metric.hidden_from_profile,true);assert.equal(metric.value,null);assert.equal(metric.max_value,0);
    assert.equal(isDdIndexMetric(metric),false);assert.equal(p.indexMaxPoints,old.indexMaxPoints);
    assert.deepEqual(metrics(p).filter(m=>m.code!==metric.code),metrics(old).filter(m=>m.code!==metric.code));hidden++;
  }
  assert.equal(hidden,2);
  const invest=metrics(after.find(p=>p.name==='ИнвестКопилка')).find(m=>m.code==='hyp.ab_tests');
  assert.equal(invest.value,1);assert.equal(invest.max_value,1);assert.equal(isDdIndexMetric(invest),true);
  assert.notEqual(invest.hidden_from_profile,true);
  assert.deepEqual(buildDdiPeriodProducts(source,'II кв. 2026',overlays,...args),source);
});
