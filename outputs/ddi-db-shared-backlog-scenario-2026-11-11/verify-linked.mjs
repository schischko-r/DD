import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {completeProductPercent,maturityLevelName} from '../../gravity-app/src/domain/report.js';
import {buildSummaryPeriodData} from '../../gravity-app/src/domain/summaryPeriod.js';
import {backlogTeamMatchesProduct,backlogTeamOptionValue} from '../../gravity-app/src/domain/backlogTeamSelection.js';

const root=new URL('../../',import.meta.url),dir=new URL('.',import.meta.url);
const read=async p=>JSON.parse(await fs.readFile(new URL(p,root),'utf8'));
const data=await read('gravity-app/public/report-data.json');
const app=await fs.readFile(new URL('gravity-app/src/app/App.jsx',root),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const names=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(n=>imports.get(n.trim()));
const overlays=await Promise.all(names.map(n=>read('gravity-app/src/data/'+n)));
const args=await Promise.all(['salary-products','reporting-regularity-missing','funnel-action-missing'].map(n=>read(`gravity-app/src/data/${n}-q3-2026.json`)));
const backlog=await read('gravity-app/public/backlog-data.json');
const oldBacklog=structuredClone(backlog);
for(const board of oldBacklog.teams)for(const members of [board.memberTeams,board.meta?.memberTeams]){
  if(!Array.isArray(members))continue;
  for(let i=members.length-1;i>=0;i--)if(members[i]?.mappingEvidence?.origin==='userConfirmedSharedHeadquartersBacklog')members.splice(i,1);
}
const period='III кв. 2026',code='hyp.discovery_40_backlog';
const before=buildDdiPeriodProducts(data.products,period,overlays,...args,oldBacklog);
const after=buildDdiPeriodProducts(data.products,period,overlays,...args,backlog);
const desired=new Map([['Детская карта',57],['Зарплатный продукт',57],['Интернет-Эквайринг',52],['Платежи',66],['SberPay Ecom',45],['SberPay NFC',79]]);
const flat=p=>p.metrics.flatMap(b=>b.metrics),metric=p=>flat(p).find(m=>m.code===code);
const results=[];
for(let i=0;i<before.length;i++){
  const a=before[i],b=after[i];assert.equal(a.id,b.id);
  for(let bi=0;bi<a.metrics.length;bi++)for(let mi=0;mi<a.metrics[bi].metrics.length;mi++){
    const x=a.metrics[bi].metrics[mi],y=b.metrics[bi].metrics[mi];
    if(a.unit==='DB'&&desired.has(a.name)&&x.code===code){
      assert.equal(x.max_value,y.max_value);assert.equal(x.is_applicabble_flg,y.is_applicabble_flg);
      assert.equal(y.value/y.max_value,a.name==='Зарплатный продукт'?.5:1);
    }else assert.deepEqual(y,x);
  }
  if(a.unit!=='DB'||!desired.has(a.name)){assert.equal(completeProductPercent(a),completeProductPercent(b));continue;}
  assert.equal(completeProductPercent(b),desired.get(a.name));
  assert.equal(maturityLevelName(completeProductPercent(a)),maturityLevelName(completeProductPercent(b)));
  const boards=backlog.teams.filter(team=>backlogTeamMatchesProduct(team,b));assert.equal(boards.length,1);
  results.push({name:a.name,before:completeProductPercent(a),after:completeProductPercent(b),
    discoveryBefore:metric(a).value/metric(a).max_value,discoveryAfter:metric(b).value/metric(b).max_value,
    backlogKey:boards[0].key,backlogOption:backlogTeamOptionValue(boards[0],b)});
}
const salaryBefore=before.find(p=>p.name==='Зарплатный продукт'),salary=after.find(p=>p.name==='Зарплатный продукт');
assert.deepEqual(salary.salaryCohorts.b2b,salaryBefore.salaryCohorts.b2b);
assert.equal(metric(salary.salaryCohorts.b2c).value/metric(salary.salaryCohorts.b2c).max_value,1);
const shared=backlog.teams.find(t=>t.memberTeams.some(m=>m.cohort==='B2C'));
assert.equal(backlogTeamMatchesProduct(shared,salary.salaryCohorts.b2b),false);
assert.equal(backlogTeamMatchesProduct(shared,salary.salaryCohorts.b2c),true);
const quarter=shared.quarters.find(q=>q.key==='2026-Q3');
assert.equal(quarter.createdCount,108);assert.equal(quarter.discoveryCount,49);assert.equal(quarter.dataThrough,'2026-09-25');assert.equal(quarter.isComplete,false);
assert.deepEqual(buildDdiPeriodProducts(data.products,'II кв. 2026',overlays,...args,backlog),data.products);
function aggregate(products){const rows=buildSummaryPeriodData(data.products,data.title.rows,products,period).rows;assert.equal(rows.length,76);
  const mean=rows.reduce((s,r)=>s+r.score,0)/rows.length;return {count:rows.length,mean,display:Math.round(mean)};}
const validation={teams:results,b2cBefore:aggregate(before),b2cAfter:aggregate(after),
  onlySixDiscoveryScoresChanged:true,salaryB2bUnchanged:true,q2Unchanged:true,quarter:{createdCount:quarter.createdCount,discoveryCount:quarter.discoveryCount,dataThrough:quarter.dataThrough,isComplete:quarter.isComplete}};
await fs.writeFile(new URL('linked-validation.json',dir),JSON.stringify(validation,null,2));
console.log(JSON.stringify(validation,null,2));
