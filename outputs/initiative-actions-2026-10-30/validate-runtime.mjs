import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const old=read('outputs/initiative-actions-2026-10-30/before.json');
const original=read('outputs/reporting-regularity-2026-10-30/q2-before.json').products;
const source=read('gravity-app/public/report-data.json').products;
const app=fs.readFileSync(new URL('gravity-app/src/app/App.jsx',root),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k=>read(`gravity-app/src/data/${imports.get(k.trim())}`));
const salary=read('gravity-app/src/data/salary-products-q3-2026.json');
const reporting=read('gravity-app/src/data/reporting-regularity-missing-q3-2026.json');
const config=read('gravity-app/src/data/funnel-action-missing-q3-2026.json');
const after=buildDdiPeriodProducts(source,'III кв. 2026',overlays,salary,reporting,config);
assert.deepEqual(source,original);
assert.deepEqual(buildDdiPeriodProducts(source,'II кв. 2026',overlays,salary,reporting,config),original);
const key=p=>[p.name,p.unit,p.type].join('|');
const flatten=ps=>new Map(ps.flatMap(p=>p.metrics.flatMap(b=>b.metrics.map(m=>[`${key(p)}|${m.code}`,{p,b,m}]))));
const before=flatten(old),now=flatten(after);
assert.deepEqual([...before.keys()].sort(),[...now.keys()].sort());
let finite=0,na=0;
const changes=[];
for(const [k,{p,b,m}] of before){
 const n=now.get(k).m;
 assert.equal(n.max_value,m.max_value,`Max changed ${k}`);
 assert.equal(n.is_applicabble_flg,m.is_applicabble_flg,`Applicability changed ${k}`);
 if(Number.isFinite(m.value)){assert.equal(n.value,m.value,`Prior finite changed ${k}`);finite++;}
 else if(m.is_applicabble_flg===false||!(Number(m.max_value)>0)){assert.equal(n.value,m.value,`NA changed ${k}`);na++;}
 else if(n.value!==m.value){
  assert.ok(['attract.initiatives_list','churn.deviation_actions'].includes(m.code),`Other code changed ${k}`);
  assert.equal(m.value,null);
  changes.push({name:p.name,unit:p.unit,type:p.type,code:m.code,old:m.value,new:n.value,max:n.max_value,source:n.source});
 }
}
fs.writeFileSync(new URL('./after.json',import.meta.url),JSON.stringify(after,null,2));
const result={q2Unchanged:true,metricSetUnchanged:true,previousFiniteUnchanged:finite,notApplicableUnchanged:na,newFills:changes.length,changes};
fs.writeFileSync(new URL('./independent-runtime-validation.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,changes:undefined}));
