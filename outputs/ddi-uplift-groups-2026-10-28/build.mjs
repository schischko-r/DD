import fs from 'node:fs/promises';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const dir=new URL('.',import.meta.url).pathname;
const ps=JSON.parse(await fs.readFile(new URL('../../gravity-app/public/report-data.json',import.meta.url),'utf8')).products;
const rs=JSON.parse(await fs.readFile('/tmp/ddi_uplift_results.json','utf8'));
const wb=Workbook.create();
const names=['Итоги','Группы','Юниты и группы','Команды','Команды и группы','Ответы по группам'];
const sheets=Object.fromEntries(names.map(n=>[n,wb.worksheets.add(n)]));
const inc=m=>m.is_applicabble_flg!==false&&!m.excluded_from_index&&m.dd_calculation_flg!==0&&m.max_value>0;
const sum=a=>a.reduce((s,v)=>s+v,0),avg=a=>sum(a)/a.length;
const raw=[],tg=[],ts=[];const groupNames=new Map();
const products=[...ps].sort((a,b)=>a.unit.localeCompare(b.unit)||a.name.localeCompare(b.name,'ru'));
for(const p of products){
 const responses=rs.filter(r=>r.name===p.name&&r.unit===p.unit);
 const variants=responses.length?responses:[{updates:{}}];
 const blocks=p.metrics.map(b=>({...b,metrics:b.metrics.filter(inc)})).filter(b=>b.metrics.length);
 const den=sum(blocks.flatMap(b=>b.metrics.map(m=>m.max_value)));
 const old=sum(blocks.flatMap(b=>b.metrics.map(m=>m.value)))/den*100;
 const newScores=variants.map(r=>sum(blocks.flatMap(b=>b.metrics.map(m=>r.updates[m.code]??m.value)))/den*100);
 if(responses.some((r,i)=>Math.abs(r.old-old)>1e-8||Math.abs(r.new-newScores[i])>1e-8))throw Error('Baseline changed '+p.name);
 const tr={unit:p.unit,name:p.name,count:responses.length,old,low:Math.min(...newScores),high:Math.max(...newScores),mean:avg(newScores),groupRows:[]};ts.push(tr);
 for(const b of blocks){
  groupNames.set(b.code,b.name);
  const max=sum(b.metrics.map(m=>m.max_value)),points=sum(b.metrics.map(m=>m.value));
  const refs=[];
  variants.forEach((r,i)=>{
   const next=sum(b.metrics.map(m=>r.updates[m.code]??m.value));
   refs.push(raw.length+5);raw.push({unit:p.unit,team:p.name,group:b.name,code:b.code,variant:responses.length?i+1:0,points,max,next,den,old:100*points/max,new:100*next/max,contrib:100*(next-points)/den});
  });
  const rr=refs.map(i=>raw[i-5]);const g={unit:p.unit,team:p.name,code:b.code,group:b.name,count:responses.length,refs,old:100*points/max,low:Math.min(...rr.map(r=>r.new)),high:Math.max(...rr.map(r=>r.new)),mean:avg(rr.map(r=>r.new)),contrib:avg(rr.map(r=>r.contrib))};
  tr.groupRows.push(tg.length+5);tg.push(g);
 }
}
const aggregates=[];
for(const unit of [null,...new Set(products.map(p=>p.unit))])for(const [code,name]of groupNames){
 const rows=tg.map((r,i)=>({...r,row:i+5})).filter(r=>r.code===code&&(unit===null||r.unit===unit));if(!rows.length)continue;
 const population=unit===null?ps.length:ps.filter(p=>p.unit===unit).length;
 aggregates.push({unit,code,name,rows,population,count:rows.length,oldMin:Math.min(...rows.map(r=>r.old)),oldMax:Math.max(...rows.map(r=>r.old)),oldMean:avg(rows.map(r=>r.old)),newMin:Math.min(...rows.map(r=>r.low)),newMax:Math.max(...rows.map(r=>r.high)),newMean:avg(rows.map(r=>r.mean)),contrib:sum(rows.map(r=>r.contrib))/population});
}
const top=aggregates.filter(a=>a.unit===null).sort((a,b)=>b.contrib-a.contrib);
const overall={old:avg(ts.map(t=>t.old)),low:avg(ts.map(t=>t.low)),high:avg(ts.map(t=>t.high)),mean:avg(ts.map(t=>t.mean))};
if(Math.abs(sum(top.map(a=>a.contrib))-(overall.mean-overall.old))>1e-9)throw Error('Contributions do not reconcile');
function setup(name,title,headers,widths,rowCount){const s=sheets[name];s.showGridLines=false;const e=rowCount+4;
 s.getRangeByIndexes(0,0,e,headers.length).format.font={name:'Arial',size:10,color:'#353044'};
 s.getRange('A2').values=[[title]];s.getRange('A2').format.font={name:'Arial',size:14,bold:true,color:'#71617F'};
 s.getRangeByIndexes(3,0,1,headers.length).values=[headers];s.getRangeByIndexes(3,0,1,headers.length).format={fill:'#85718F',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},rowHeight:43,wrapText:true,horizontalAlignment:'center',verticalAlignment:'center'};
 widths.forEach((w,i)=>s.getRangeByIndexes(0,i,e,1).format.columnWidth=w);
 if(e>30)s.freezePanes.freezeRows(4);
 return s;}
function numeric(s,range){s.getRange(range).setNumberFormat('0.0');}
function formula(s,row,col,formulas){s.getRangeByIndexes(row-1,col,1,formulas.length).formulas=[formulas];}
const source=setup('Ответы по группам','Взвешенные баллы групп по каждому ответу',['Юнит','Команда','Группа метрик','Вариант','Баллы были','Макс. баллы','Баллы стали','Макс. команды','Было, 0–100','Стало, 0–100','Вклад DDI, п.п.'],[12,54,39,11,14,14,14,16,15,15,17],raw.length);
raw.forEach((r,i)=>{const n=i+5;source.getRange(`A${n}:H${n}`).values=[[r.unit,r.team,r.group,r.variant,r.points,r.max,r.next,r.den]];formula(source,n,8,[`=E${n}/F${n}*100`,`=G${n}/F${n}*100`,`=(G${n}-E${n})/H${n}*100`]);});numeric(source,`E5:K${raw.length+4}`);source.getRange(`E5:H${raw.length+4}`).setNumberFormat('0.00');
source.getRange('M4:N8').values=[['Источник','Данные'],['report-data.json','Метрики и баллы II кв. 2026'],['questionare-uplifts(5).csv','Каналы'],['questionare-uplifts(6).csv','Сегменты'],['questionare-uplifts(7).csv','Продукты']];source.getRange('M4:N8').format.columnWidth=40;
const detail=setup('Команды и группы','Было и стало по каждой группе команды',['Юнит','Команда','Группа метрик','Ответов','Было, 0–100','Стало мин.','Стало макс.','Стало среднее','Изменение сред., п.п.','Вклад в DDI, п.п.'],[12,54,39,10,15,15,15,17,20,20],tg.length);
tg.forEach((r,i)=>{const n=i+5;detail.getRange(`A${n}:D${n}`).values=[[r.unit,r.team,r.group,r.count]];const refs=c=>r.refs.map(k=>`'Ответы по группам'!${c}${k}`).join(',');formula(detail,n,4,[`='Ответы по группам'!I${r.refs[0]}`,`=MIN(${refs('J')})`,`=MAX(${refs('J')})`,`=AVERAGE(${refs('J')})`,`=H${n}-E${n}`,`=AVERAGE(${refs('K')})`]);});numeric(detail,`E5:J${tg.length+4}`);
const team=setup('Команды','DDI команды по полным наборам ответов',['Юнит','Команда','Ответов','DDI был','DDI стал мин.','DDI стал макс.','DDI стал сред.','Аплифт мин.','Аплифт макс.','Аплифт сред.','Статус'],[12,54,10,14,17,17,17,15,15,15,28],ts.length);
ts.forEach((r,i)=>{const n=i+5;team.getRange(`A${n}:F${n}`).values=[[r.unit,r.name,r.count,r.old,r.low,r.high]];const refs=r.groupRows.map(k=>`'Команды и группы'!J${k}`).join(',');formula(team,n,6,[`=D${n}+SUM(${refs})`,`=E${n}-D${n}`,`=F${n}-D${n}`,`=G${n}-D${n}`]);team.getRange(`K${n}`).values=[[r.count===0?'Прежний DDI сохранён':r.count>1?'Два полных ответа':'Ответ учтён']];});numeric(team,'D5:J87');
const aggHeaders=['Группа метрик','Команд','Было мин.','Было макс.','Было сред.','Стало мин.','Стало макс.','Стало сред.','Изм. сред., п.п.','Вклад DDI, п.п.'];
function aggregateSheet(name,title,list,withUnit){const s=setup(name,title,withUnit?['Юнит',...aggHeaders]:aggHeaders,withUnit?[12,39,10,14,14,15,14,14,16,18,18]:[39,10,14,14,15,14,14,16,18,18],list.length);
 list.forEach((a,i)=>{const n=i+5;const refs=c=>a.rows.map(r=>`'Команды и группы'!${c}${r.row}`).join(',');s.getRangeByIndexes(n-1,0,1,withUnit?3:2).values=[withUnit?[a.unit,a.name,a.count]:[a.name,a.count]];formula(s,n,withUnit?3:2,[`=MIN(${refs('E')})`,`=MAX(${refs('E')})`,`=AVERAGE(${refs('E')})`,`=MIN(${refs('F')})`,`=MAX(${refs('G')})`,`=AVERAGE(${refs('H')})`,`=AVERAGE(${refs('I')})`,`=SUM(${refs('J')})/${a.population}`]);});numeric(s,`${withUnit?'D':'C'}5:${withUnit?'K':'J'}${list.length+4}`);return s;}
aggregateSheet('Группы','Группы метрик: разброс между командами и средние',top,false);
aggregateSheet('Юниты и группы','Группы метрик внутри каждого юнита',aggregates.filter(a=>a.unit!==null),true);
const units=['УБ','CX','PC','ДомКлик','CBP','DB','DP','Data'];
const main=setup('Итоги','Аплифты DDI по группам метрик',['Юнит','Ответили','Всего','DDI был','Стало мин.','Стало макс.','Стало сред.','Аплифт сред., п.п.'],[18,13,12,15,17,17,17,21],42);
units.forEach((u,i)=>{const n=i+5;const rows=ts.map((r,k)=>({...r,row:k+5})).filter(r=>r.unit===u);const refs=c=>rows.map(r=>`'Команды'!${c}${r.row}`).join(',');main.getRange(`A${n}:C${n}`).values=[[u,rows.filter(r=>r.count>0).length,rows.length]];formula(main,n,3,[...['D','E','F','G','J'].map(c=>`=AVERAGE(${refs(c)})`)]);});
main.getRange('A14').values=[['Все команды']];formula(main,14,1,['=SUM(B5:B12)','=SUM(C5:C12)',...['D','E','F','G','J'].map(c=>`=AVERAGE('Команды'!${c}5:${c}87)`)]);numeric(main,'D5:H14');main.getRange('A14:H14').format.fill='#EEE8F1';
const fmt=n=>n.toFixed(1).replace('.',',');
const insights=[
 `Средний DDI: ${fmt(overall.old)} → ${fmt(overall.mean)}. Средний аплифт: +${fmt(overall.mean-overall.old)} п.п. Диапазон новых средних: ${fmt(overall.low)}–${fmt(overall.high)}.`,
 ...top.slice(0,3).map(a=>`${a.name}: вклад в общий DDI +${fmt(a.contrib)} п.п. Средний балл группы: ${fmt(a.oldMean)} → ${fmt(a.newMean)} из 100.`),
 `${top[0].name}: ${fmt(top[0].contrib/(overall.mean-overall.old)*100)}% среднего аплифта DDI.`,
 `Команд со снижением среднего DDI: ${ts.filter(t=>t.mean<t.old-1e-8).length}. Снижения включены в итоги.`
];
const notes=[
 'База — II кв. 2026. Учтены только анкеты, без остальных цифровых следов III квартала. DDI не изменён.',
 'Было/стало по группам — баллы 0–100: сумма взвешенных баллов группы / её применимый максимум × 100.',
 'На листах «Группы» и «Юниты и группы» минимум/максимум — разброс баллов между применимыми командами.',
 'Для одной команды «стало мин./макс.» — границы ответов. «Стало среднее» — среднее её полных ответов, не прогноз.',
 'Средние групп считаются по применимым командам. Вклад в общий DDI усредняется по всем командам популяции.',
 'Сумма средних вкладов групп равна среднему аплифту DDI. Границы отдельных групп суммировать нельзя.',
 '71 из 83 команд имеют сопоставимые ответы. У 12 команд сохранены прежние оценки. Пустые ответы не заменены нулём.',
 'У ОМС, Слитков, Зарплатного продукта и SberPay Ecom по два набора ответов. Средние по ответам не взвешены.',
 'Новые команды без базы исключены: Трансграничные переводы #B2C, Сберчаевые #B2C, Трансграничный эквайринг #B2C и #B2B.'
];
main.getRange('A17').values=[['Инсайты']];main.getRange('A17').format.font.bold=true;
[...insights,'',...notes].forEach((t,i)=>{const n=i+18;main.getRange(`A${n}:H${n}`).merge();main.getRange(`A${n}`).values=[[t]];main.getRange(`A${n}:H${n}`).format.wrapText=true;main.getRange(`A${n}:H${n}`).format.rowHeight=31;});
for(const [name,col] of [['Группы','J'],['Юниты и группы','K'],['Команды и группы','J'],['Ответы по группам','K']]){
 const count=name==='Группы'?top.length:name==='Юниты и группы'?aggregates.filter(a=>a.unit!==null).length:name==='Команды и группы'?tg.length:raw.length;
 sheets[name].getRange(`${col}5:${col}${count+4}`).setNumberFormat('0.00');
}
wb.recalculate();
const original=source.getRange('G5').values[0][0];const prior=main.getRange('H14').values[0][0];source.getRange('G5').values=[[original+0.1]];const changed=main.getRange('H14').values[0][0];if(Math.abs(changed-prior)<1e-10)throw Error('Recalculation failed');source.getRange('G5').values=[[original]];wb.recalculate();
if(Math.abs(main.getRange('H14').values[0][0]-(overall.mean-overall.old))>1e-8)throw Error('Summary mismatch');
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#SPILL!',options:{useRegex:true,maxResults:20},maxChars:1500});console.log(errors.ndjson);
for(const [s,r] of [['Итоги','A1:H25'],['Группы','A1:J20'],['Юниты и группы','A1:K13'],['Команды','A1:K13'],['Команды и группы','A1:J13'],['Ответы по группам','A1:K13']]){const b=await wb.render({sheetName:s,range:r,scale:1.2,format:'png'});await fs.writeFile(`${dir}${s}.png`,new Uint8Array(await b.arrayBuffer()));}
await(await SpreadsheetFile.exportXlsx(wb)).save(`${dir}Аплифты_DDI_группы_и_команды.xlsx`);
await fs.writeFile(`${dir}analysis.json`,JSON.stringify({overall,groups:top.map(({rows,...a})=>a),insights,counts:{teams:ts.length,comparable:ts.filter(t=>t.count).length,teamGroups:tg.length,raw:raw.length}},null,2));
console.log(JSON.stringify({overall,insights,groups:top.map(a=>({group:a.name,old:a.oldMean,new:a.newMean,contrib:a.contrib})),rows:{raw:raw.length,teams:ts.length,groups:tg.length}}));
