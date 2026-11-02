import fs from 'node:fs';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {excludeRemovedTeams,isDdIndexMetric,isInformationalMetric} from '../../gravity-app/src/domain/report.js';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const source=excludeRemovedTeams(read('gravity-app/public/report-data.json')).products;
const app=fs.readFileSync(new URL('gravity-app/src/app/App.jsx',root),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k=>read(`gravity-app/src/data/${imports.get(k.trim())}`));
const salary=read('gravity-app/src/data/salary-products-q3-2026.json');
const reporting=read('gravity-app/src/data/reporting-regularity-missing-q3-2026.json');
const actions=read('gravity-app/src/data/funnel-action-missing-q3-2026.json');
const products=buildDdiPeriodProducts(source,'III кв. 2026',overlays,salary,reporting,actions);
const rows=[],na=[],filled=[],info=[];
const survey=read('gravity-app/src/data/crosssell-after-purchase-q3-2026.json');
const afterMissing=[];
for(const p of products){const metric=p.metrics.flatMap(b=>b.metrics).find(m=>m.code==='mehaniki.cross_sell');if(!isDdIndexMetric(metric))continue;
if(metric.crossSellComponents?.after)continue;
const responses=survey.products.find(t=>t.id===p.id.replace(/::empty::.*/,'')&&t.name===p.name&&t.unit===p.unit&&t.type===p.type)?.responses||[];
afterMissing.push({name:p.name,unit:p.unit,responses:responses.map(r=>r.answer)});}

for(const p of products)for(const b of p.metrics)for(const m of b.metrics){
 const row={team:p.name,unit:p.unit,type:p.type,block:b.code,blockName:b.name,code:m.code,name:m.name,value:m.value,max:m.max_value,informational:isInformationalMetric(m),excluded:!!m.excluded_from_index,tbd:!!m.tbd};
 if(m.is_applicabble_flg===false||!(Number(m.max_value)>0)){na.push(row);continue;}
 if(Number.isFinite(m.value)){filled.push(row);continue;}
 if(isDdIndexMetric(m))rows.push(row);else info.push(row);
}
const groups=new Map();
for(const r of rows){
 const g=groups.get(r.code)||{code:r.code,name:r.name,block:r.block,blockName:r.blockName,count:0,teams:[]};
 g.count++;g.teams.push({name:r.team,unit:r.unit,type:r.type});groups.set(r.code,g);
}
const byCode=[...groups.values()].sort((a,b)=>b.count-a.count||a.block.localeCompare(b.block)||a.name.localeCompare(b.name,'ru'));
const byBlock=Object.values(rows.reduce((a,r)=>{const b=a[r.block]||={code:r.block,name:r.blockName,count:0,teams:new Set()};b.count++;b.teams.add(r.team);return a;},{})).map(b=>({...b,teams:b.teams.size}));
const result={afterPurchaseMissingAssessment:afterMissing,period:'III кв. 2026',teamCount:products.length,blankIndexValues:rows.length,teamsWithBlankIndexValues:new Set(rows.map(r=>r.team)).size,filledValues:filled.length,notApplicableValues:na.length,blankNonIndexValues:info.length,byBlock,byCode,rows,nonIndexRows:info};
fs.writeFileSync(new URL('./analysis.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({teams:products.length,blankIndexValues:rows.length,metricCodes:byCode.length,blankNonIndexValues:info.length,afterMissing},null,2));
