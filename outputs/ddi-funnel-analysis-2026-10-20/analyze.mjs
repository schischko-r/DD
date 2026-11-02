import fs from 'node:fs';
import crypto from 'node:crypto';
import {blockPercent} from '../../gravity-app/src/domain/report.js';
const out=new URL('./',import.meta.url);
const sourceFile=new URL('../../gravity-standalone.html',import.meta.url);
const snapshot=fs.readFileSync(sourceFile);
const data=JSON.parse(fs.readFileSync(new URL('standalone-data.json',out),'utf8'));
const products=data.products;
if(new Set(products.map(p=>p.id)).size!==products.length)throw new Error('Duplicate team IDs');
if(new Set(products.map(p=>`${p.unit}|${p.name}`)).size!==products.length)throw new Error('Duplicate team identities');
const quantile=(values,p)=>{const a=[...values].sort((x,y)=>x-y),h=(a.length-1)*p,l=Math.floor(h);return a[l]+(a[Math.min(l+1,a.length-1)]-a[l])*(h-l);};
const ratio=(n,d)=>100*n/d;
const records=[],summary={source:'gravity-standalone.html',sha256:crypto.createHash('sha256').update(snapshot).digest('hex'),periods:[...new Set(products.map(p=>p.period))],totalTeams:products.length,deduplication:'One observation per team ID; equal scores across teams are retained',cohortNote:'All 83 teams in the user-specified standalone snapshot; no first-response flag is present',thresholds:{poor:'<40%',middle:'40–80% inclusive',good:'>80%'},blocks:{}};
for(const code of ['attract','churn']) {
 const rows=[],excluded=[];
 for(const p of products) {
  const b=p.metrics.find(b=>b.code===code);
  if(!b){excluded.push({team:p.name,unit:p.unit,type:p.type,reason:'Блок отсутствует'});continue;}
  const codes=b.metrics.map(m=>m.code);
  if(new Set(codes).size!==codes.length)throw new Error(`Duplicate metric ${p.name}/${code}`);
  const earned=b.metrics.reduce((a,m)=>a+Number(m.value||0),0),max=b.metrics.reduce((a,m)=>a+Number(m.max_value||0),0);
  if(max<=0||!b.metrics.some(m=>m.is_applicabble_flg!==false)) {excluded.push({team:p.name,unit:p.unit,type:p.type,reason:'Блок неприменим, максимум 0'});continue;}
  const pct=blockPercent(b),rawPct=ratio(earned,max);
  if(!Number.isFinite(pct)||rawPct<0||rawPct>100.00001)throw new Error('Invalid percentage');
  const status=pct>80?'Хорошо':pct<40?'Плохо':'Посередине';
  rows.push({id:p.id,team:p.name,unit:p.unit,type:p.type,period:p.period,earned,max,rawPct,pct,status});
 }
 const vals=rows.map(r=>r.pct),n=rows.length;
 const percentiles=Object.fromEntries([0,10,25,50,75,90,95,100].map(p=>[`P${p}`,quantile(vals,p/100)]));
 const bins=Array.from({length:10},(_,i)=>{const from=i*10,to=(i+1)*10,count=vals.filter(v=>v>=from&&(i===9?v<=to:v<to)).length;return {range:`${from}–${to}`,from,to,count,share:ratio(count,n)};});
 const levels=['Плохо','Посередине','Хорошо'].map(label=>{const count=rows.filter(r=>r.status===label).length;return{label,count,share:ratio(count,n),teams:rows.filter(r=>r.status===label).map(r=>r.team)};});
 const quartiles=[
  {range:`≤${percentiles.P25}%`,from:null,to:percentiles.P25,rows:rows.filter(r=>r.pct<=percentiles.P25)},
  {range:`>${percentiles.P25}–${percentiles.P50}%`,from:percentiles.P25,to:percentiles.P50,rows:rows.filter(r=>r.pct>percentiles.P25&&r.pct<=percentiles.P50)},
  {range:`>${percentiles.P50}–${percentiles.P75}%`,from:percentiles.P50,to:percentiles.P75,rows:rows.filter(r=>r.pct>percentiles.P50&&r.pct<=percentiles.P75)},
  {range:`>${percentiles.P75}%`,from:percentiles.P75,to:null,rows:rows.filter(r=>r.pct>percentiles.P75)},
 ].map(({rows,...rest},index)=>({...rest,quartile:index+1,count:rows.length,share:ratio(rows.length,n),teams:rows.map(r=>r.team)}));
 if(bins.reduce((s,b)=>s+b.count,0)!==n||quartiles.reduce((s,q)=>s+q.count,0)!==n)throw new Error('Counts do not reconcile');
 const frequencies=[...new Set(vals)].sort((a,b)=>a-b).map(pct=>({pct,count:vals.filter(v=>v===pct).length}));
 const types=[...new Set(rows.map(r=>r.type))].map(type=>({type,n:rows.filter(r=>r.type===type).length}));
 summary.blocks[code]={n,excluded,types,mean:vals.reduce((a,b)=>a+b,0)/n,percentiles,zeroCount:vals.filter(v=>v===0).length,fullCount:vals.filter(v=>v===100).length,uniquePercentValues:frequencies.length,levels,bins,quartiles,frequencies,rows};
 records.push(...rows.map(r=>({...r,block:code})));
}
fs.writeFileSync(new URL('analysis.json',out),JSON.stringify(summary,null,2));
const headers=['block','unit','team','type','period','earned','max','rawPct','pct','status'];
const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
fs.writeFileSync(new URL('team-scores.csv',out),'\ufeff'+[headers.join(';'),...records.map(r=>headers.map(h=>quote(r[h])).join(';'))].join('\n'));
console.log(JSON.stringify(Object.fromEntries(Object.entries(summary.blocks).map(([k,v])=>[k,{n:v.n,mean:v.mean,percentiles:v.percentiles,levels:v.levels.map(({teams,...r})=>r),bins:v.bins,quartiles:v.quartiles.map(({teams,...r})=>r),unique:v.uniquePercentValues,types:v.types,excluded:v.excluded}])),null,2));
