import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const previous=read('outputs/crosssell-missing-zero-2026-10-30/before.json');
const q2=read('outputs/reporting-regularity-2026-10-30/q2-before.json').products;
const raw=read('gravity-app/public/report-data.json').products;
const app=fs.readFileSync(new URL('gravity-app/src/app/App.jsx',root),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k=>read(`gravity-app/src/data/${imports.get(k.trim())}`));
const configs=['salary-products','reporting-regularity-missing','funnel-action-missing'].map(f=>read(`gravity-app/src/data/${f}-q3-2026.json`));
const after=buildDdiPeriodProducts(raw,'III кв. 2026',overlays,...configs);
assert.deepEqual(raw,q2,'Q2 raw source changed');
assert.deepEqual(buildDdiPeriodProducts(raw,'II кв. 2026',overlays,...configs),q2,'Q2 runtime changed');
const key=p=>[p.name,p.unit,p.type].join('|');
const flatten=ps=>new Map(ps.flatMap(p=>p.metrics.flatMap(b=>b.metrics.map(m=>[`${key(p)}|${m.code}`,{p,b,m}]))));
const before=flatten(previous),now=flatten(after);
assert.deepEqual([...before.keys()].sort(),[...now.keys()].sort());
let finite=0,na=0;
const changes=[];
for(const [k,{p,b,m}]of before){
 const n=now.get(k).m;
 assert.equal(n.max_value,m.max_value,`Max changed ${k}`);
 assert.equal(n.is_applicabble_flg,m.is_applicabble_flg,`Applicability changed ${k}`);
 if(Number.isFinite(m.value)){assert.equal(n.value,m.value,`Prior filled changed ${k}`);finite++;}
 else if(m.is_applicabble_flg===false||!(Number(m.max_value)>0)){assert.equal(n.value,m.value,`NA changed ${k}`);na++;}
 if(m.value!==n.value){
  assert.equal(m.code,'mehaniki.cross_sell');
  assert.ok(['Зарплатный продукт #B2C','Зарплатный продукт #B2B'].includes(p.name));
  assert.equal(m.value,null);assert.equal(n.value,0.25);assert.equal(n.max_value,1);
  assert.equal(m.crossSellComponents.during.value,null);
  assert.equal(n.crossSellComponents.during.value,0);
  assert.deepEqual(n.crossSellComponents.after,m.crossSellComponents.after);
  assert.equal(n.crossSellComponents.after.rawValue,0.5);
  assert.equal(n.crossSellComponents.after.value,0.25);
  assert.equal(n.source.origin,'crossSellComponentSum');
  assert.deepEqual(n.source.defaultedComponents,['during']);
  const s=n.crossSellComponents.during.source;
  assert.equal(s.origin,'userConfirmedCrossSellMissingAsZero');
  assert.equal(s.confirmedBy,'user');
  assert.equal(s.period,'III кв. 2026');
  assert.deepEqual(s.previousSource,m.crossSellComponents.during.source);
  assert.deepEqual(n.source.previousSource,m.source);
  assert.deepEqual(p.metric_recommendations,now.get(k).p.metric_recommendations,'Raw API recommendations changed');
  changes.push({name:p.name,value:n.value,max:n.max_value,during:n.crossSellComponents.during,after:n.crossSellComponents.after});
 }else assert.deepEqual(n,m,`Unrelated metric object changed ${k}`);
}
assert.equal(changes.length,2);
const result={q2Unchanged:true,metricSetUnchanged:true,allOtherMetricObjectsUnchanged:true,priorFiniteUnchanged:finite,notApplicableUnchanged:na,newFills:changes.length,manualOriginAndOriginalApiPreserved:true,changes};
fs.writeFileSync(new URL('./after.json',import.meta.url),JSON.stringify(after,null,2));
fs.writeFileSync(new URL('./independent-runtime-validation.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,changes:undefined}));
