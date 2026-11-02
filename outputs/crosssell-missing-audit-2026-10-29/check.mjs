import fs from 'node:fs';
import {buildTeamProfileProducts} from '../../gravity-app/src/domain/teamProfileSelection.js';
import {isDdIndexMetric, displayProductName} from '../../gravity-app/src/domain/report.js';
import {crossSellAfterPurchaseResponses, crossSellAfterPurchaseStatus} from '../../gravity-app/src/domain/crossSellDecomposition.js';
const root=new URL('../../',import.meta.url);
const read=path=>JSON.parse(fs.readFileSync(new URL(path,root)));
const source=read('gravity-app/public/report-data.json');
const app=fs.readFileSync(new URL('gravity-app/src/app/App.jsx',root),'utf8');
const overlayVariables=app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(x=>x.trim());
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=overlayVariables.map(v=>read(`gravity-app/src/data/${imports.get(v)}`));
const afterSurvey=read('gravity-app/src/data/crosssell-after-purchase-q3-2026.json');
const q3=buildTeamProfileProducts(source.products,'III кв. 2026',overlays);
const metrics=p=>p.metrics.flatMap(b=>b.metrics);
const rows=[];
for(const p of source.products){
 const old=metrics(p).find(m=>m.code==='mehaniki.cross_sell');
 if(!old||!isDdIndexMetric(old)||!(old.value>0))continue;
 const current=q3.find(t=>t.name===p.name&&t.unit===p.unit&&t.type===p.type);
 const metric=metrics(current).find(m=>m.code===old.code);
 const during=metric.crossSellComponents?.during||metric;
 const after=metric.crossSellComponents?.after;
 const responses=crossSellAfterPurchaseResponses(current,afterSurvey);
 const row={unit:p.unit,name:p.name,displayName:displayProductName(p.name),q2Value:old.value,q2Max:old.max_value,
  q3Total:metric.value,q3Max:metric.max_value,
  duringValue:during.value,duringUI:Number.isFinite(during.value)&&metric.max_value>0?Math.min(100,Math.round(during.value/(metric.max_value/2)*100)):null,
  apiMatched:during.source?.matched??null,apiUid:during.source?.catalogUid??null,
  afterNumeric:after?.applicable===false?'NA':after?.rawValue??null,
  afterUI:after?.applicable===false?'Не применимо':after?`${after.rawValue*100}%`:crossSellAfterPurchaseStatus(responses).label,
  afterAnswers:responses.map(r=>r.answer),afterSourceRecords:responses.map(r=>r.sourceRecord),
  afterMissing:!after&&responses.length===0,duringMissing:!Number.isFinite(during.value),
  earlierFull:old.value===old.max_value};
 rows.push(row);
}
const result={periods:['II кв. 2026','III кв. 2026'],activeQ2:rows.length,
 missing:rows.filter(r=>r.afterMissing||r.duringMissing),
 activeThenZero:rows.filter(r=>r.q3Total===0),
 unmatchedAPI:rows.filter(r=>r.apiMatched===false),
 rows};
fs.writeFileSync(new URL('./results.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
