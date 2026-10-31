import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const source=read('../../public/report-data.json').products;
const data=read('../data/corporate-churn-completeness-q3-2026.json');
const app=fs.readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k=>read(`../data/${imports.get(k.trim())}`));
const args=[read('../data/salary-products-q3-2026.json'),read('../data/reporting-regularity-missing-q3-2026.json'),read('../data/funnel-action-missing-q3-2026.json')];
const metrics=p=>p.metrics.flatMap(b=>b.metrics);

test('only corporate churn completeness receives the full Q3 half-point maximum; attraction, other teams and Q2 are unchanged',()=>{
  const before=buildDdiPeriodProducts(source,data.period,overlays.filter(o=>o.source?.origin!==data.source.origin),...args);
  const after=buildDdiPeriodProducts(source,data.period,overlays,...args);
  const target=data.products[0];let checked=0;
  for(const p of after){
    const old=before.find(t=>t.id===p.id);
    if(p.id.split('::empty::')[0]!==target.id){assert.deepEqual(p,old);continue;}
    const metric=metrics(p).find(m=>m.code==='churn.report_completeness');
    assert.equal(metric.value,.5);assert.equal(metric.max_value,.5);assert.equal(metric.value/metric.max_value,1);
    assert.equal(metric.is_applicabble_flg,true);assert.equal(p.indexMaxPoints,old.indexMaxPoints);
    assert.deepEqual(metrics(p).filter(m=>m.code!==metric.code),metrics(old).filter(m=>m.code!==metric.code));checked++;
  }
  assert.equal(checked,1);
  assert.deepEqual(buildDdiPeriodProducts(source,'II кв. 2026',overlays,...args),source);
});
