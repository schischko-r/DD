import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const before=read('outputs/chat-navigator-2026-10-30/before.json');
const q2=read('outputs/reporting-regularity-2026-10-30/q2-before.json').products;
const source=read('gravity-app/public/report-data.json').products;
const app=fs.readFileSync(new URL('gravity-app/src/app/App.jsx',root),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k=>read(`gravity-app/src/data/${imports.get(k.trim())}`));
const configs=['salary-products','reporting-regularity-missing','funnel-action-missing'].map(f=>read(`gravity-app/src/data/${f}-q3-2026.json`));
const after=buildDdiPeriodProducts(source,'III кв. 2026',overlays,...configs);
assert.deepEqual(source,q2);
assert.deepEqual(buildDdiPeriodProducts(source,'II кв. 2026',overlays,...configs),q2);
const key=p=>[p.name,p.unit,p.type].join('|');
const flatten=ps=>new Map(ps.flatMap(p=>p.metrics.flatMap(b=>b.metrics.map(m=>[`${key(p)}|${m.code}`,m]))));
const old=flatten(before),now=flatten(after);
assert.deepEqual([...old.keys()].sort(),[...now.keys()].sort());
let changed=0,unchanged=0;
for(const [k,m]of now){
 const prev=old.get(k);
 if(k==='Чат|PC|Канал|general.navigator_reporting_knowledge'){
  assert.equal(prev.value,null);assert.equal(m.value,0.5);
  assert.equal(m.max_value,prev.max_value);assert.equal(m.max_value,0.5);
  assert.equal(m.source.origin,'userConfirmedNavigatorManualAssessment');
  assert.equal(m.source.rawValue,1);changed++;
 }else{assert.deepEqual(m,prev,`Other metric changed: ${k}`);unchanged++;}
}
assert.equal(changed,1);
const result={q2Unchanged:true,exactlyOneChatNavChange:true,weightedValue:0.5,rawValue:1,max:0.5,unrelatedMetricObjectsUnchanged:unchanged};
fs.writeFileSync(new URL('./independent-validation.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
