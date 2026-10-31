import fs from 'node:fs/promises';
import {SpreadsheetFile,Workbook} from '@oai/artifact-tool';
const dir='/Users/roman/Documents/Codex/DD-dev/outputs/ddi-final-file-2026-10-30';
const data=JSON.parse(await fs.readFile(`${dir}/workbook-data.json`,'utf8'));
const headers=['Команда','Метрика','Вопрос (анкета)','Ответ III кв.','Варианты ответа','Подтверждение','Ссылка','Балл II кв., %','Балл III кв., %','Аплифт, п.п.','Флаг внимания'];
const workbook=Workbook.create();
const products=workbook.worksheets.add('По продуктам');
const details=workbook.worksheets.add('Детализация');
const goals=workbook.worksheets.add('Цели');
for(const sheet of [products,details,goals]){sheet.showGridLines=false;sheet.getRange('A1:K1').values=[headers];sheet.getRange('A1:K1').format={fill:'#123C5A',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,verticalAlignment:'center'};sheet.getRange('A1:K1').format.rowHeight=42;sheet.freezePanes.freezeRows(1);}
const summaryRows=data.products.map(r=>[r.team,r.metric,'','','',r.confirmation,'',r.score2,r.score3,r.uplift,r.attention]);
const detailRows=data.metrics.map(r=>[r.team,r.metric,r.question,r.answer,r.options,r.confirmation,r.link,r.score2,r.score3,r.uplift,r.attention]);
const goalCodes=['goals.monitored','goals.factor_analysis_l1_l2','goals.forecast','goals.po_monitoring','goals.po_factor_analysis','goals.po_forecast'];
const goalNames={
 'goals.monitored':'Цели выведены на мониторинг',
 'goals.factor_analysis_l1_l2':'Факторный анализ - драйверы 1-2 ур.',
 'goals.forecast':'Прогноз по целям',
 'goals.po_monitoring':'Цели выведены на мониторинг',
 'goals.po_factor_analysis':'Факторный анализ - драйверы 1-2 ур.',
 'goals.po_forecast':'Прогноз по целям',
};
const goalProducts=new Map();
for(const metric of data.metrics.filter(r=>r.code.startsWith('goals.'))){const key=`${metric.team}¦${metric.unit}¦${metric.type}`;if(!goalProducts.has(key))goalProducts.set(key,{team:metric.team,unit:metric.unit,type:metric.type,metrics:new Map()});goalProducts.get(key).metrics.set(metric.code,metric);}
const scoreGoals=(rows,period)=>{const flag=period==='q2'?'index2':'index3',score=period==='q2'?'score2':'score3',max=period==='q2'?'max2':'max3';const applicable=rows.filter(r=>r?.[flag]);if(!applicable.length||applicable.some(r=>r[score]===null||!Number.isFinite(r[score])))return null;const denominator=applicable.reduce((s,r)=>s+Number(r[max]||0),0);return denominator?applicable.reduce((s,r)=>s+r[score]*Number(r[max]||0),0)/denominator:null;};
const goalRows=[];
for(const product of [...goalProducts.values()].sort((a,b)=>a.team.localeCompare(b.team,'ru')||String(a.unit).localeCompare(String(b.unit),'ru')||String(a.type).localeCompare(String(b.type),'ru'))){
 const rows=goalCodes.map(code=>product.metrics.get(code)||{team:product.team,metric:goalNames[code],question:'',answer:'',options:'',confirmation:'Нет отдельной оценки в данных периода.',link:'',score2:null,score3:null,uplift:null,attention:'Нет оценки',code,unit:product.unit,type:product.type,max2:null,max3:null,index2:false,index3:false});
 const q2=scoreGoals(rows,'q2'),q3=scoreGoals(rows,'q3'),uplift=q2!==null&&q3!==null?q3-q2:null;
 const finalAttention=q3===null?'Неполная оценка целей':uplift===null?'Нет сопоставимой оценки II квартала':Math.abs(uplift)<1e-6?'Без изменения':uplift>0?'Рост':'Снижение';
 const final={team:product.team,metric:'Конечная оценка целей',question:'',answer:'',options:'',confirmation:'Расчёт: средневзвешенная доля по индексным метрикам блока «Цели»; информационные и неприменимые метрики исключены. Если применимая индексная метрика не оценена, итог оставлен пустым.',link:'',score2:q2,score3:q3,uplift,attention:finalAttention};
 const section=(title)=>[product.team,title,'','','','','',null,null,null,''];
 const metricRow=r=>[r.team,r.metric,r.question,r.answer,r.options,r.confirmation,r.link,r.score2,r.score3,r.uplift,r.attention];
 goalRows.push(section('Цели уровня ЛЮ/ЛТ'),...rows.slice(0,3).map(metricRow),section('Цели уровня PO'),...rows.slice(3).map(metricRow),metricRow(final));
}
products.getRangeByIndexes(1,0,summaryRows.length,11).values=summaryRows;
details.getRangeByIndexes(1,0,detailRows.length,11).values=detailRows;
goals.getRangeByIndexes(1,0,goalRows.length,11).values=goalRows;
products.tables.add(`A1:K${summaryRows.length+1}`,true,'ProductSummary');
details.tables.add(`A1:K${detailRows.length+1}`,true,'MetricDetails');
goals.tables.add(`A1:K${goalRows.length+1}`,true,'GoalsByProduct');
for(const [sheet,rows] of [[products,summaryRows],[details,detailRows],[goals,goalRows]]){
 sheet.getRange(`H2:J${rows.length+1}`).format.numberFormat='0.0%';
 sheet.getRange(`A2:K${rows.length+1}`).format.font={name:'Arial',size:10,color:'#172B3A'};
 sheet.getRange(`C2:G${rows.length+1}`).format.wrapText=true;
 sheet.getRange(`K2:K${rows.length+1}`).format.wrapText=true;
 sheet.getRange(`H2:J${rows.length+1}`).format.horizontalAlignment='center';
 sheet.getRange('A:A').format.columnWidth=31;
 sheet.getRange('B:B').format.columnWidth=43;
 sheet.getRange('C:C').format.columnWidth=58;
 sheet.getRange('D:D').format.columnWidth=48;
 sheet.getRange('E:E').format.columnWidth=44;
 sheet.getRange('F:F').format.columnWidth=48;
 sheet.getRange('G:G').format.columnWidth=48;
 sheet.getRange('H:J').format.columnWidth=16;
 sheet.getRange('K:K').format.columnWidth=29;
}
products.getRange(`A2:K${summaryRows.length+1}`).format.rowHeight=28;
details.getRange(`A2:K${detailRows.length+1}`).format.rowHeight=34;
goals.getRange(`A2:K${goalRows.length+1}`).format.rowHeight=34;
workbook.recalculate();
for(const [sheetName,range,file] of [['По продуктам',`A1:K${Math.min(summaryRows.length+1,24)}`,'preview-products.png'],['Детализация','A1:K14','preview-details.png'],['Цели','A1:K10','preview-goals.png']]){
 const image=await workbook.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(`${dir}/${file}`,new Uint8Array(await image.arrayBuffer()));
}
const inspect=await workbook.inspect({kind:'workbook,sheet,table',maxChars:2500,tableMaxRows:3,tableMaxCols:11});await fs.writeFile(`${dir}/inspect.ndjson`,inspect.ndjson);
const output=await SpreadsheetFile.exportXlsx(workbook);await output.save(`${dir}/DDI_II_III_quarters_products_and_metrics.xlsx`);
console.log(JSON.stringify({products:summaryRows.length,metrics:detailRows.length,goalRows:goalRows.length,goalProducts:goalProducts.size,file:`${dir}/DDI_II_III_quarters_products_and_metrics.xlsx`}));
