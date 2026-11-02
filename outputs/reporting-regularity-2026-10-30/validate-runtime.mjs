import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
const base=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,base),'utf8'));
const before=read('outputs/reporting-regularity-2026-10-30/before.json');
const q2Before=read('outputs/reporting-regularity-2026-10-30/q2-before.json');
const source=read('gravity-app/public/report-data.json').products;
const app=fs.readFileSync(new URL('gravity-app/src/app/App.jsx',base),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k=>read(`gravity-app/src/data/${imports.get(k.trim())}`));
const salary=read('gravity-app/src/data/salary-products-q3-2026.json');
const rules=read('gravity-app/src/data/reporting-regularity-missing-q3-2026.json');
const after=buildDdiPeriodProducts(source,'III кв. 2026',overlays,salary,rules);
assert.deepEqual(buildDdiPeriodProducts(source,'II кв. 2026',overlays,salary,rules),q2Before.products,'Q2 runtime changed');
assert.deepEqual(source,q2Before.products,'Q2 source changed');
const pkey=p=>[p.name,p.unit,p.type].join('|');
const flatten=ps=>new Map(ps.flatMap(p=>p.metrics.flatMap(b=>b.metrics.map(m=>[`${pkey(p)}|${m.code}`,{p,b,m}]))));
const old=flatten(before),cur=flatten(after);
assert.deepEqual([...cur.keys()].sort(),[...old.keys()].sort(),'Roster or metric set changed');
const preserved=[],filled=[],unfilled=[],na=[];
for(const [key,{m}]of old){
 const n=cur.get(key).m;
 if(Number.isFinite(m.value)){
  assert.equal(n.value,m.value,`Filled Q3 metric changed: ${key}`);
  preserved.push(key);
 } else if(m.is_applicabble_flg===false||!(Number(m.max_value)>0)){
  assert.equal(n.value,m.value,`NA metric changed: ${key}`);na.push(key);
 } else if(Number.isFinite(n.value))filled.push({key,before:m.value,after:n.value,max:n.max_value,source:n.source});
 else unfilled.push(key);
 assert.equal(n.max_value,m.max_value,`Max changed: ${key}`);
 assert.equal(n.is_applicabble_flg,m.is_applicabble_flg,`Applicability changed: ${key}`);
}
const output={q2Unchanged:true,metricSetUnchanged:true,allPriorFilledUnchanged:true,priorFilled:preserved.length,naUnchanged:na.length,newlyFilled:filled.length,remainingNull:unfilled.length,filled,remaining:unfilled,sourceSha256:crypto.createHash('sha256').update(JSON.stringify(rules)).digest('hex')};
fs.writeFileSync(new URL('./independent-validation.json',import.meta.url),JSON.stringify(output,null,2));
fs.writeFileSync(new URL('./after.json',import.meta.url),JSON.stringify(after,null,2));
console.log(JSON.stringify({...output,filled:undefined,remaining:undefined}));
