import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {completeProductPercent,isDdIndexMetricForPeriod} from '../../gravity-app/src/domain/report.js';
import {discoveryDecompositionScore} from '../../gravity-app/src/domain/discoveryBacklog.js';
import {buildSummaryPeriodData} from '../../gravity-app/src/domain/summaryPeriod.js';

const root=new URL('../../',import.meta.url),dir=new URL('.',import.meta.url),files={};
async function text(p){const t=await fs.readFile(new URL(p,root),'utf8');files[p]=createHash('sha256').update(t).digest('hex');return t;}
const read=async p=>JSON.parse(await text(p));
const period='III кв. 2026',code='hyp.discovery_40_backlog';
const report=await read('gravity-app/public/report-data.json');
const app=await text('gravity-app/src/app/App.jsx');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const names=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(n=>imports.get(n.trim()));
assert.ok(names.every(Boolean));
const overlays=await Promise.all(names.map(n=>read('gravity-app/src/data/'+n)));
const args=await Promise.all(['salary-products','reporting-regularity-missing','funnel-action-missing'].map(n=>read(`gravity-app/src/data/${n}-q3-2026.json`)));
const backlog=await read('gravity-app/public/backlog-data.json');
const surveys=(await read('outputs/ddi-q3-survey-export-2026-11-11/responses.json')).responses;
const selectedResponses=surveys.filter(r=>r.year==='2026'&&r.quarter==='3'&&!r.excludedByConfirmedUserInstruction&&r.canonicalTeam?.unit==='DB'&&r.answers.discoveryBacklogType==='Задачи ведет Штаб в Jira/SberTrack');
const selectedNames=new Set(selectedResponses.map(r=>r.canonicalTeam.name));
assert.equal(selectedNames.size,6);
const current=buildDdiPeriodProducts(report.products,period,overlays,...args,backlog);
const target=current.filter(p=>p.unit==='DB'&&selectedNames.has(p.name));
assert.equal(target.length,6);
const shared=backlog.teams.find(t=>t.key==='perevody-po-rf-perevody-podarkov-sberpay-vzhuh-oplata-ulybkoi');
assert.ok(shared);
const quarter=shared.quarters.find(q=>q.key==='2026-Q3');
assert.equal(quarter.discoveryCount,49);assert.equal(quarter.createdCount,108);
const fraction=discoveryDecompositionScore(quarter.discoveryCount,quarter.createdCount);
assert.equal(fraction,1);
const discovery=p=>p.metrics.flatMap(b=>b.metrics).find(m=>m.code===code);
const currentHash=createHash('sha256').update(JSON.stringify(current)).digest('hex');
function scenarioBacklog(includeSalary){
  const copy=structuredClone(backlog),team=copy.teams.find(t=>t.key===shared.key);
  team.memberTeams.push(...target.filter(p=>includeSalary||p.name!=='Зарплатный продукт').map(p=>({name:p.name,unit:p.unit,type:p.type,period})));
  return copy;
}
// Full-team variant mirrors the existing shared-backlog rule in the report.
const wholeTeam=buildDdiPeriodProducts(report.products,period,overlays,...args,scenarioBacklog(true));
// Respondent-scoped variant preserves B2B salary and changes only its B2C cohort.
const scopedSalary=structuredClone(args[0]);
const salaryB2c=scopedSalary.products.find(p=>p.cohort==='B2C');
assert.ok(salaryB2c.metrics[code]);
salaryB2c.metrics[code]={...salaryB2c.metrics[code],rawValue:fraction,
  source:{origin:'counterfactualSharedHeadquartersBacklog',teamKey:shared.key,period,cohort:'B2C',scenarioOnly:true}};
const scoped=buildDdiPeriodProducts(report.products,period,overlays,scopedSalary,...args.slice(1),scenarioBacklog(false));
const baselineSalary=current.find(p=>p.name==='Зарплатный продукт'&&p.unit==='DB');
const scopedSalaryProduct=scoped.find(p=>p.name==='Зарплатный продукт'&&p.unit==='DB');
assert.equal(discovery(baselineSalary.salaryCohorts.b2b).value,discovery(scopedSalaryProduct.salaryCohorts.b2b).value);
assert.equal(discovery(scopedSalaryProduct.salaryCohorts.b2c).value/discovery(scopedSalaryProduct.salaryCohorts.b2c).max_value,1);
const mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
function aggregate(products,unit){
  const rows=buildSummaryPeriodData(report.products,report.title.rows,products,period).rows.filter(r=>!unit||r.unit===unit);
  assert.ok(rows.every(r=>Number.isFinite(r.score)));
  return {count:rows.length,meanOfRounded:mean(rows.map(r=>r.score)),display:Math.round(mean(rows.map(r=>r.score)))};
}
function score(p){const ms=p.metrics.flatMap(b=>b.metrics).filter(m=>isDdIndexMetricForPeriod(m,period));
  const points=ms.reduce((s,m)=>s+m.value,0),max=ms.reduce((s,m)=>s+m.max_value,0);
  assert.equal(completeProductPercent(p),Math.round(points/max*100));
  const d=discovery(p);
  return {ddi:completeProductPercent(p),rawDdi:points/max*100,points,maxPoints:max,discovery:d.value/d.max_value*100,discoverySource:d.source};}
const rows=target.map(p=>({unit:p.unit,name:p.name,current:score(p),scoped:score(scoped.find(q=>q.id===p.id)),wholeTeam:score(wholeTeam.find(q=>q.id===p.id))}));
for(const after of [scoped,wholeTeam]) {
  assert.equal(after.length,current.length);
  for(let i=0;i<current.length;i++){
    const a=current[i],b=after[i];assert.equal(a.id,b.id);
    for(let bi=0;bi<a.metrics.length;bi++)for(let mi=0;mi<a.metrics[bi].metrics.length;mi++){
      const am=a.metrics[bi].metrics[mi],bm=b.metrics[bi].metrics[mi];
      if(target.some(t=>t.id===a.id)&&am.code===code){assert.equal(am.max_value,bm.max_value);assert.equal(am.is_applicabble_flg,bm.is_applicabble_flg);}
      else assert.deepEqual(bm,am);
    }
  }
}
assert.equal(createHash('sha256').update(JSON.stringify(current)).digest('hex'),currentHash);
for(const [p,hash] of Object.entries(files))assert.equal(createHash('sha256').update(await fs.readFile(new URL(p,root))).digest('hex'),hash);
const result={assumption:'Only the six DB teams that explicitly chose headquarters-owned Jira/SberTrack backlog; salary respondent-scoped and whole-product alternatives are kept separate.',
  project:'DBB2DTANLC',backlogTeamKey:shared.key,quarter:{key:quarter.key,dataThrough:quarter.dataThrough,isComplete:quarter.isComplete,createdCount:quarter.createdCount,discoveryCount:quarter.discoveryCount,share:quarter.discoveryCount/quarter.createdCount*100,score:fraction},
  selectedResponses:selectedResponses.map(r=>({name:r.canonicalTeam.name,cohort:r.cohort,respondent:r.respondent,recordId:r.recordId,answer:r.answers.discovery})),
  rows,aggregate:{b2c:{current:aggregate(current),scoped:aggregate(scoped),wholeTeam:aggregate(wholeTeam)},DB:{current:aggregate(current,'DB'),scoped:aggregate(scoped,'DB'),wholeTeam:aggregate(wholeTeam,'DB')}},
  sourceHashes:files,validation:{unchangedCanonicalInputs:true,unchangedOtherMetrics:true,unchangedSalaryB2b:true}};
await fs.writeFile(new URL('scenario.json',dir),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,sourceHashes:undefined,selectedResponses:undefined,rows:rows.map(r=>({...r,current:{...r.current,discoverySource:undefined},scoped:{...r.scoped,discoverySource:undefined},wholeTeam:{...r.wholeTeam,discoverySource:undefined}}))},null,2));
