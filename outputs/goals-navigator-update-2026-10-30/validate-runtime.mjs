import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const previous=read('outputs/goals-navigator-update-2026-10-30/before.json');
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
 else if(m.value!==n.value){
  assert.equal(m.value,null);
  assert.ok(m.code==='general.navigator_reporting_knowledge'||(p.name==='BNPL'&&['goals.monitored','goals.factor_analysis_l1_l2','goals.forecast'].includes(m.code)),`Other metric changed ${k}`);
  changes.push({name:p.name,unit:p.unit,type:p.type,code:m.code,value:n.value,max:n.max_value,source:n.source});
 }
}
const navCode='general.navigator_reporting_knowledge';
const markets=['general.obъem_celevogo_rynka_v_rossii'];
let qualified=0,existing=0,eligibleBlanks=0;
for(const p of previous){
 const metrics=p.metrics.flatMap(b=>b.metrics);
 const market=markets.map(c=>metrics.find(m=>m.code===c));
 const isFull=market.every(m=>m&&m.is_applicabble_flg!==false&&Number(m.max_value)>0&&Number.isFinite(m.value)&&m.value/Number(m.max_value)===1);
 if(!isFull)continue;
 qualified++;
 const old=metrics.find(m=>m.code===navCode);
 if(!old||old.is_applicabble_flg===false||!(old.max_value>0))continue;
 if(old.value===null){
  eligibleBlanks++;
  assert.equal(now.get(`${key(p)}|${navCode}`).m.value,old.max_value);
 }else existing++;
}
assert.equal(qualified,45);
assert.equal(existing,28);
assert.equal(eligibleBlanks,17);
assert.equal(changes.length,20);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
for(const f of ['goals-user-carry-forward','navigator-market-knowledge']){
 const config=read(`gravity-app/src/data/${f}-q3-2026.json`);
 for(const p of config.products)for(const [code,fact]of Object.entries(p.metrics)){
  const s=fact.source;
  assert.equal(sha(s.file),s.sha256,'Source hash mismatch');
  const sourceProduct=f==='goals-user-carry-forward'
   ?q2.find(o=>o.id===s.sourceTeamId):previous.find(o=>key(o)===key(p));
  assert.ok(sourceProduct,'Provenance team absent');
  const sourceMetric=sourceProduct.metrics.flatMap(b=>b.metrics).find(m=>m.code===s.sourceMetricCode);
  assert.equal(sourceMetric.value,s.sourceValue);
  assert.equal(sourceMetric.max_value,s.sourceMaxValue);
  assert.equal(fact.rawValue,sourceMetric.value/sourceMetric.max_value);
  if(f==='navigator-market-knowledge'){
   assert.equal(s.sourceMetricCode,markets[0]);
   assert.equal(s.sourceValue,0.2);
   assert.equal(s.sourceMaxValue,0.2);
   assert.equal(s.sourceRawValue,1);
   assert.equal(s.sourcePeriod,'III кв. 2026');
   assert.deepEqual(s.marketSource,sourceMetric.source);
  }else assert.equal(s.fromPeriod,'II кв. 2026');
 }
}
const bnplQ2=q2.find(p=>p.name==='BNPL').metrics.flatMap(b=>b.metrics);
for(const code of ['goals.monitored','goals.factor_analysis_l1_l2','goals.forecast']){
 const b=changes.find(x=>x.name==='BNPL'&&x.code===code);
 assert.equal(b.value,bnplQ2.find(m=>m.code===code).value);
}
const result={q2Unchanged:true,metricSetUnchanged:true,priorFiniteUnchanged:finite,notApplicableUnchanged:na,newFills:changes.length,qualifiedMarketTeams:qualified,priorNavFilled:existing,newNav:eligibleBlanks,sourceHashesAndValuesVerified:true,marketRussiaNormalizedRuleVerified:true,changes};
fs.writeFileSync(new URL('./after.json',import.meta.url),JSON.stringify(after,null,2));
fs.writeFileSync(new URL('./independent-runtime-validation.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,changes:undefined}));
