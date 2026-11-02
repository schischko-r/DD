import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {completeProductPercent,previousQuarterIndexDelta} from '../../gravity-app/src/domain/report.js';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const before=read('outputs/salary-return-2026-10-30/before.json');
const q2=read('outputs/reporting-regularity-2026-10-30/q2-before.json').products;
const source=read('gravity-app/public/report-data.json');
const app=fs.readFileSync(new URL('gravity-app/src/app/App.jsx',root),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k=>read(`gravity-app/src/data/${imports.get(k.trim())}`));
const configs=['salary-products','reporting-regularity-missing','funnel-action-missing'].map(f=>read(`gravity-app/src/data/${f}-q3-2026.json`));
const after=buildDdiPeriodProducts(source.products,'III кв. 2026',overlays,...configs);
assert.deepEqual(source.products,q2);
assert.deepEqual(buildDdiPeriodProducts(source.products,'II кв. 2026',overlays,...configs),q2);
assert.equal(before.length,76);assert.equal(after.length,76);
const key=p=>[p.name,p.unit,p.type].join('|');
const old=before.find(p=>p.name==='Зарплатный продукт'),now=after.find(p=>p.name==='Зарплатный продукт');
for(const p of before.filter(p=>p!==old))assert.deepEqual(after.find(x=>key(x)===key(p)),p,`Other team changed ${p.name}`);
const codes=['mehaniki.vozvrat_klientov','mehaniki.doprodazhi_up_sell'];
const metricMap=p=>new Map(p.metrics.flatMap(b=>b.metrics).map(m=>[m.code,m]));
const prev=metricMap(old),current=metricMap(now);
assert.deepEqual([...prev.keys()].sort(),[...current.keys()].sort());
let parentChanges=0,nestedChanges=0;
for(const [code,m]of current){
 const prior=prev.get(code);
 assert.equal(m.max_value,prior.max_value);assert.equal(m.is_applicabble_flg,prior.is_applicabble_flg);
 if(codes.includes(code)){
  assert.equal(m.value,code===codes[0]?1:0.5);
  if(m.value!==prior.value)parentChanges++;
 }else assert.deepEqual(m,prior,`Other merged metric changed ${code}`);
}
const nested=[];
for(const cohort of ['b2b','b2c']){
 const a=metricMap(old.salaryCohorts[cohort]),b=metricMap(now.salaryCohorts[cohort]);
 for(const [code,m]of b){
  const prior=a.get(code);
  assert.equal(m.max_value,prior.max_value);assert.equal(m.is_applicabble_flg,prior.is_applicabble_flg);
  if(codes.includes(code)){
   assert.equal(m.value,code===codes[0]?1:cohort==='b2b'?1:0);
   assert.equal(m.source.respondent,cohort==='b2b'?'Сауткин Андрей':'Королева Александра Дмитриевна');
   assert.equal(m.source.csvRow,cohort==='b2b'?5:46);
   assert.equal(m.source.questionId,'upsell');
   if(m.value!==prior.value)nestedChanges++;
   nested.push({cohort,code,value:m.value,source:m.source});
  }else assert.deepEqual(m,prior,`Other cohort metric changed ${cohort}/${code}`);
 }
}
assert.equal(parentChanges,2);assert.equal(nestedChanges,3);
assert.equal(now.indexMaxPoints,old.indexMaxPoints);assert.equal(now.indexMaxPoints,24.15);
const score=completeProductPercent(now),delta=previousQuarterIndexDelta(now,score,q2,source.title.rows);
assert.equal(score,52);assert.deepEqual(delta,{value:22,previousScore:30,previousPeriod:'II кв. 2026'});
const result={q2Unchanged:true,other75TeamsExact:true,parentScoreChanges:parentChanges,nestedScoreChanges:nestedChanges,maxUnchanged:now.indexMaxPoints,score,delta,nested};
fs.writeFileSync(new URL('./after.json',import.meta.url),JSON.stringify(after,null,2));
fs.writeFileSync(new URL('./independent-validation.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,nested:undefined}));
