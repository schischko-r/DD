import fs from 'node:fs/promises';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {completeProductPercent, displayProductName} from '../../gravity-app/src/domain/report.js';
const root=new URL('../../',import.meta.url),dir=new URL('.',import.meta.url).pathname;
const read=async p=>JSON.parse(await fs.readFile(new URL(p,root),'utf8'));
const source=await read('gravity-app/public/report-data.json');
const app=await fs.readFile(new URL('gravity-app/src/app/App.jsx',root),'utf8');
const imports=new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m=>[m[1],m[2]]));
const overlays=await Promise.all(app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k=>read('gravity-app/src/data/'+imports.get(k.trim()))));
const args=await Promise.all(['salary-products','reporting-regularity-missing','funnel-action-missing'].map(n=>read(`gravity-app/src/data/${n}-q3-2026.json`)));
const products=buildDdiPeriodProducts(source.products,'III кв. 2026',overlays,...args,await read('gravity-app/public/backlog-data.json'));
const rows=products.map(p=>{const m=p.metrics.flatMap(b=>b.metrics).find(m=>m.code==='cx.score');return{
 id:p.id,name:p.name,displayName:displayProductName(p.name),unit:p.unit,ddi:completeProductPercent(p),cx:m?.value??null,cxMax:m?.max_value??null,
 status:!m?'Нет метрики':m.is_applicabble_flg===false||!(m.max_value>0)?'Не применимо':!Number.isFinite(m.value)?'Нет оценки':`${m.value/m.max_value*100}%`};});
const file=process.argv[2]||'after.json';
await fs.writeFile(dir+file,JSON.stringify({products,rows},null,2));
if(file!=='before.json'){
 const prior=JSON.parse(await fs.readFile(dir+'before.json','utf8'));
 const changes=rows.map(r=>({name:r.displayName,unit:r.unit,before:prior.rows.find(p=>p.id===r.id).ddi,after:r.ddi,cxBefore:prior.rows.find(p=>p.id===r.id).status,cxAfter:r.status}))
  .filter(r=>r.before!==r.after).map(r=>({...r,delta:r.after-r.before}));
 const counts={};for(const r of rows)counts[r.status]=(counts[r.status]||0)+1;
 const changesCx=rows.filter(r=>r.status!==prior.rows.find(p=>p.id===r.id).status);
 const stats={teams:rows.length,counts,changedDdi:changes.length,changedCx:changesCx.length,changes};
 await fs.writeFile(dir+'stats.json',JSON.stringify(stats,null,2));console.log(JSON.stringify(stats));
}
