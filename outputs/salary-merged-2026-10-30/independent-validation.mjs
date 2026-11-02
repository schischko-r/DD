import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildDdiPeriodProducts,buildDdiCohortProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {isDdIndexMetric} from '../../gravity-app/src/domain/report.js';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const before=read('outputs/salary-merged-2026-10-30/before.json');
const q2=read('outputs/reporting-regularity-2026-10-30/q2-before.json').products;
const source=read('gravity-app/public/report-data.json').products;
const app=fs.readFileSync(new URL('gravity-app/src/app/App.jsx',root),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k=>read(`gravity-app/src/data/${imports.get(k.trim())}`));
const configs=['salary-products','reporting-regularity-missing','funnel-action-missing'].map(f=>read(`gravity-app/src/data/${f}-q3-2026.json`));
const after=buildDdiPeriodProducts(source,'III кв. 2026',overlays,...configs);
const legacy=buildDdiCohortProducts(source,'III кв. 2026',overlays,...configs);
const laterFiles=new Set(['navigator-mau-knowledge-q3-2026.json','digital-channel-actions-q3-2026.json','digital-channel-return-q3-2026.json','oms-key-metrics-assessment-q3-2026.json','oms-goals-assessment-q3-2026.json','oms-funnel-user-assessment-q3-2026.json','oms-user-metric-assessment-q3-2026.json','oms-mechanics-user-assessment-q3-2026.json']);
const priorOverlays=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').filter(k=>!laterFiles.has(imports.get(k.trim()))).map(k=>read(`gravity-app/src/data/${imports.get(k.trim())}`));
const reproducedBefore=buildDdiCohortProducts(source,'III кв. 2026',priorOverlays,...configs);
assert.deepEqual(reproducedBefore,before,'Original 77-profile snapshot not reproduced');
assert.deepEqual(source,q2,'Q2 raw source changed');
assert.deepEqual(buildDdiPeriodProducts(source,'II кв. 2026',overlays,...configs),q2,'Q2 runtime changed');
assert.equal(after.length,76);assert.equal(after.filter(p=>p.unit==='DB').length,16);
const merged=after.find(p=>p.name==='Зарплатный продукт');assert.ok(merged);
assert.ok(!after.some(p=>p.name.includes('Зарплатный продукт #')));
const b2b=legacy.find(p=>p.name==='Зарплатный продукт #B2B');
const b2c=legacy.find(p=>p.name==='Зарплатный продукт #B2C');
assert.deepEqual(merged.salaryCohorts.b2b,b2b);assert.deepEqual(merged.salaryCohorts.b2c,b2c);
assert.deepEqual(b2b,before.find(p=>p.name===b2b.name));assert.deepEqual(b2c,before.find(p=>p.name===b2c.name));
const key=p=>[p.name,p.unit,p.type].join('|');
for(const p of legacy.filter(x=>x!==b2b&&x!==b2c))assert.deepEqual(after.find(x=>key(x)===key(p)),p,`Other profile changed ${p.name}`);
const blocks=['general','attract','churn','mehaniki','hyp'];
assert.deepEqual(merged.salaryToggleBlockCodes,blocks);
const avg=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?(a+b)/2:null;
const appMetric=m=>m.is_applicabble_flg!==false&&m.max_value>0;
const verified=[];
for(const block of merged.metrics){
 const c=b2c.metrics.find(b=>b.code===block.code),b=b2b.metrics.find(x=>x.code===block.code);
 if(!blocks.includes(block.code)){assert.deepEqual(block,c);continue;}
 assert.equal(block.source.origin,'salaryCohortAverage');
 assert.equal(block.metrics.length,c.metrics.length);assert.equal(block.metrics.length,b.metrics.length);
 for(const m of block.metrics){
  const left=b.metrics.find(x=>x.code===m.code),right=c.metrics.find(x=>x.code===m.code);
  const compatible=appMetric(left)&&appMetric(right)&&left.max_value===right.max_value;
  assert.equal(m.value,compatible?avg(left.value,right.value):null,`Wrong mean ${m.code}`);
  for(const f of ['max_value','is_applicabble_flg','excluded_from_index','dd_calculation_flg'])assert.equal(m[f],right[f]);
  assert.equal(m.source.origin,'salaryCohortAverage');
  assert.deepEqual(m.source.cohorts.b2b.source,left.source);assert.deepEqual(m.source.cohorts.b2c.source,right.source);
  assert.equal(m.source.cohorts.b2b.value,left.value);assert.equal(m.source.cohorts.b2c.value,right.value);
  for(const item of m.recommendation_items||[]){
   assert.equal(item.value,m.value);assert.equal(item.max_value,m.max_value);
   assert.equal(item.gap,m.value===null?null:Math.max(0,m.max_value-m.value));
  }
  if(m.code==='mehaniki.cross_sell')for(const part of ['during','after']){
   const l=left.crossSellComponents[part],r=right.crossSellComponents[part],n=m.crossSellComponents[part];
   assert.equal(n.value,avg(l.value,r.value));
   if(part==='after'){assert.equal(n.rawValue,avg(l.rawValue,r.rawValue));assert.equal(n.applicable,true);}
  }
  verified.push({block:block.code,code:m.code,b2b:left.value,b2c:right.value,mean:m.value,max:m.max_value});
 }
}
const hypCount=merged.metrics.find(b=>b.code==='hyp').metrics.length;
assert.deepEqual(merged.metrics.find(b=>b.code==='hyp').metrics.map(m=>m.code),b2c.metrics.find(b=>b.code==='hyp').metrics.map(m=>m.code));
assert.equal(merged.indexMaxPoints,merged.metrics.flatMap(b=>b.metrics).filter(isDdIndexMetric).reduce((s,m)=>s+m.max_value,0));
const result={q2Unchanged:true,legacy77SnapshotReproducedWithoutLaterOverlays:true,currentOther75ProfilesExact:true,mergedRoster:76,mergedDbRoster:16,originalCohortsExact:true,fiveBlocksVerified:blocks,allHypothesisMetricsVerified:hypCount,averagedMetricCount:verified.length,verified};
fs.writeFileSync(new URL('./after.json',import.meta.url),JSON.stringify(after,null,2));
fs.writeFileSync(new URL('./independent-validation.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,verified:undefined}));
