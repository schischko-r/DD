import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {completeProductPercent,isDdIndexMetric,previousQuarterIndexDelta} from '../../gravity-app/src/domain/report.js';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const previous=read('outputs/ab-tests-q3-2026/before.json');
const q2=read('outputs/reporting-regularity-2026-10-30/q2-before.json').products;
const source=read('gravity-app/public/report-data.json');
const app=fs.readFileSync(new URL('gravity-app/src/app/App.jsx',root),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k=>read(`gravity-app/src/data/${imports.get(k.trim())}`));
const configs=['salary-products','reporting-regularity-missing','funnel-action-missing'].map(f=>read(`gravity-app/src/data/${f}-q3-2026.json`));
const after=buildDdiPeriodProducts(source.products,'III кв. 2026',overlays,...configs);
assert.deepEqual(source.products,q2);
assert.deepEqual(buildDdiPeriodProducts(source.products,'II кв. 2026',overlays,...configs),q2);
const ab=read('gravity-app/src/data/ab-tests-user-assessments-q3-2026.json');
const extra=read('gravity-app/src/data/funnel-additional-user-assessments-q3-2026.json');
const key=p=>[p.name,p.unit,p.type].join('|');
const flatten=ps=>new Map(ps.flatMap(p=>p.metrics.flatMap(b=>b.metrics.map(m=>[`${key(p)}|${m.code}`,{p,b,m}]))));
const before=flatten(previous),now=flatten(after);
const allowed=new Map([...ab.products,...extra.products].flatMap(p=>Object.entries(p.metrics).map(([code,f])=>[`${key(p)}|${code}`,f])));
assert.equal(ab.products.length,28);assert.equal(allowed.size,31);
let unchanged=0,abVerified=0,funnelVerified=0;
const added=[],changed=[],denominatorChanges=[];
for(const [k,{p,b,m}]of now){
 const old=before.get(k)?.m;
 const fact=allowed.get(k);
 if(!fact){assert.deepEqual(m,old,`Unlisted metric object changed ${k}`);unchanged++;continue;}
 assert.equal(m.value,fact.rawValue*m.max_value);
 assert.equal(m.source.origin,fact.source.origin);
 if(m.code==='hyp.ab_tests'){
  abVerified++;
  assert.equal(m.max_value,1);assert.equal(m.is_applicabble_flg,true);
  assert.equal(m.excluded_from_index,false);assert.equal(m.dd_calculation_flg,1);
  assert.equal(m.source.origin,'userConfirmedAbTestsAssessment');
 }else{
  funnelVerified++;
  assert.equal(m.max_value,old.max_value);assert.equal(m.is_applicabble_flg,old.is_applicabble_flg);
 }
 if(!old)added.push(k);
 else if(JSON.stringify(old)!==JSON.stringify(m))changed.push(k);
}
for(const k of before.keys())assert.ok(now.has(k),`Metric removed ${k}`);
for(const p of after){
 const prev=previous.find(x=>key(x)===key(p));
 const denominator=x=>x.metrics.flatMap(b=>b.metrics).filter(isDdIndexMetric).reduce((s,m)=>s+Number(m.max_value),0);
 const delta=denominator(p)-denominator(prev);
 if(delta){assert.equal(delta,1);assert.ok(ab.products.some(x=>key(x)===key(p)));denominatorChanges.push({name:p.name,delta});}
}
assert.equal(abVerified,28);assert.equal(funnelVerified,3);assert.equal(denominatorChanges.length,4);
const expectedRaw=ab.source.inputRows.split('\n').map(x=>x.split('\t'));
const seen=new Set();
for(const p of ab.products){
 const fact=p.metrics['hyp.ab_tests'];
 const row=expectedRaw[fact.source.sourceRow-1];
 assert.equal(row[0],fact.source.sourceName);
 assert.equal(Number(row[1]),fact.rawValue);
 assert.equal(ab.source.aliases[row[0]]||row[0],p.name);
 assert.ok(!seen.has(p.name));seen.add(p.name);
}
const distribution={};for(const [,v]of expectedRaw)distribution[v]=(distribution[v]||0)+1;
assert.deepEqual(distribution,{'0':1,'1':21,'0.25':4,'0.5':2});
const complete=after.map(p=>({name:p.name,unit:p.unit,type:p.type,score:completeProductPercent(p)})).filter(p=>p.score!==null);
const bnpl=after.find(p=>p.name==='BNPL');
const bnplScore=completeProductPercent(bnpl);
assert.equal(bnplScore,46);
const bnplDelta=previousQuarterIndexDelta(bnpl,bnplScore,q2,source.title.rows);
assert.deepEqual(bnplDelta,{value:-8,previousScore:54,previousPeriod:'II кв. 2026'});
for(const p of after){
 const score=completeProductPercent(p),delta=previousQuarterIndexDelta(p,score,q2,source.title.rows);
 if(delta){const row=source.title.rows.find(r=>r.name===p.name&&r.unit===p.unit);assert.equal(delta.value,score-row.score);}
}
const result={q2Unchanged:true,unlistedMetricObjectsUnchanged:unchanged,abVerified,funnelVerified,distribution,added,changed,denominatorChanges,fullyFilledCount:complete.length,fullyFilled:complete,bnplScore,bnplDelta};
fs.writeFileSync(new URL('./after.json',import.meta.url),JSON.stringify(after,null,2));
fs.writeFileSync(new URL('./independent-validation.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,changed:changed.length}));
