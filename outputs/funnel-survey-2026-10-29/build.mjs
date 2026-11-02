import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';

const dir=new URL('./',import.meta.url);
const data=JSON.parse(await fs.readFile(new URL('extracted.json',dir),'utf8'));
const wb=Workbook.create();
const main=wb.worksheets.add('Все метрики');
const source=wb.worksheets.add('Исходные ответы');
const palette={ink:'#302B3D',purple:'#756588',light:'#F4F1F7',line:'#DCD5E5'};
const text=v=>Array.isArray(v)?v.join('; '):v==null?'':typeof v==='object'?JSON.stringify(v):String(v);
function base(sheet,headers,values,widths,tableName){
 const end=String.fromCharCode(64+headers.length);
 const last=values.length+6;
 sheet.showGridLines=false;
 sheet.tabColor=palette.purple;
 sheet.getRange(`A6:${end}${last}`).values=[headers,...values];
 sheet.getRange(`A1:${end}${last}`).format.font={name:'Arial',size:10,color:palette.ink};
 sheet.getRange(`A6:${end}${last}`).format.verticalAlignment='top';
 sheet.getRange(`A6:${end}${last}`).format.wrapText=true;
 for(let i=0;i<widths.length;i++)sheet.getRangeByIndexes(0,i,last,1).format.columnWidth=widths[i];
 sheet.getRange(`A6:${end}6`).format={fill:palette.purple,font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},rowHeight:32,wrapText:true,horizontalAlignment:'center',verticalAlignment:'center'};
 sheet.getRange(`A6:${end}6`).format.borders={preset:'inside',style:'thin',color:'#FFFFFF'};
 sheet.tables.add(`A6:${end}${last}`,true,tableName);
 sheet.freezePanes.freezeRows(6);
 sheet.freezePanes.freezeColumns(2);
 for(let i=0;i<values.length;i++){
  const lines=Math.max(...values[i].map((v,j)=>text(v).split('\n').reduce((n,s)=>n+Math.max(1,Math.ceil(s.length/Math.max(8,widths[j]-2))),0)));
  sheet.getRange(`A${i+7}:${end}${i+7}`).format.rowHeight=Math.min(400,Math.max(40,lines*13+8));
 }
 sheet.getRange('A2').values=[[sheet===main?'Все метрики DDI. Оценки 0 / 0,5 / 1':'Исходные поля анкет']];
 sheet.getRange('A2').format.font={name:'Arial',size:14,bold:true,color:palette.ink};
 return {last,end};
}
const headers=['Продукт','ФИО проходившего','Метрика','Вопрос','Балл до','Балл после','Комментарий к ответу','Аплифт','Подтверждение','Единицы измерения','Комментарий к подтверждению','Блок метрик','Юнит','Тип команды','Дата прохождения (UTC)','Участник','ID команды','Исходный максимум','Включена в DDI','Источник балла','Код метрики','Ключ вопроса','Файл источника','Строка CSV','Исходный балл до','Исходный балл после'];
const rows=data.rows.map(r=>[r.product,r.fio,r.metric,r.question,r.before,r.after,r.comment,null,r.evidence,r.units,r.proofComment,r.direction,r.unit,r.type,r.date,r.login,r.teamId,r.max,r.included?'Да':'Нет',r.scoreSource,r.code,r.questionId,r.file,r.csvRow,r.sourceBefore??null,r.sourceAfter??null]);
const layout=base(main,headers,rows,[28,31,42,60,11,11,65,11,95,18,70,25,12,17,26,31,45,19,17,28,48,36,35,13,18,18],'FunnelAnswers');
main.getRange('A3').values=[[`${data.summary.records} анкета · ${data.summary.teams} команд · II → III квартал 2026. Повторные прохождения сохранены отдельно.`]];
main.getRange('A4').values=[['Новый балл: нет — 0; часть — 0,5; все пункты — 1. Балл до = исходный балл / исходный максимум. Аплифт = после − до.']];
main.getRange('A5').values=[['Если вопрос не задавался, сохранённая оценка переведена в новую шкалу. Неприменимые метрики без оценки. Все исходные ответы и веса сохранены.']];
main.getRange('A3:X5').format.font={name:'Arial',size:10,italic:true,color:palette.purple};
const formulas=data.rows.map((r,i)=>[typeof r.before==='number'&&typeof r.after==='number'?`=F${i+7}-E${i+7}`:'']);
main.getRange(`H7:H${layout.last}`).formulas=formulas;
for(const col of ['E','F','H','R','Y','Z']){
 main.getRange(`${col}7:${col}${layout.last}`).setNumberFormat('0.0000;[Color13]-0.0000;0.0000');
 main.getRange(`${col}7:${col}${layout.last}`).format.horizontalAlignment='right';
}
main.getRange(`H7:H${layout.last}`).conditionalFormats.add('cellIs',{operator:'greaterThan',formula:0,format:{fill:'#EDE5F5',font:{bold:true,color:'#67517B'}}});
const rawHeaders=['Продукт','ФИО проходившего','Блок метрик','Ключ поля','Формулировка вопроса','Исходное значение','Юнит','Тип команды','Дата прохождения (UTC)','Участник','ID команды','Файл источника','Строка CSV','Источник вопроса в анкете'];
base(source,rawHeaders,data.raw.map(r=>[r.product,r.fio,r.direction,r.key,r.question,Array.isArray(r.value)?JSON.stringify(r.value):text(r.value),r.unit,r.type,r.date,r.login,r.teamId,r.file,r.csvRow,r.source]),[28,31,19,41,62,110,12,17,26,31,45,35,13,60],'RawFunnelFields');
source.getRange('A3').values=[[`${data.raw.length} полей из трёх исходных CSV. Массивы ответов сохранены в JSON без изменения структуры.`]];
source.getRange('A4').values=[['Источник: analysis/1/questionare-responses(7).csv, questionare-responses(8).csv, questionare-responses(9).csv.']];
source.getRange('A5').values=[['Точные ключи, принадлежность анкете и строки CSV сохранены для сверки.']];
source.getRange('A3:N5').format.font={name:'Arial',size:10,italic:true,color:palette.purple};
wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'Все метрики!A6:K9',include:'values,formulas',tableMaxRows:4,tableMaxCols:11,maxChars:2200})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:10},maxChars:1000})).ndjson);
for(const [sheetName,range,file] of [['Все метрики','A6:K8','preview.png'],['Исходные ответы','A6:F8','raw-preview.png']]){
 const img=await wb.render({sheetName,range,scale:1,format:'png'});
 await fs.writeFile(new URL(file,dir),new Uint8Array(await img.arrayBuffer()));
}
const out=await SpreadsheetFile.exportXlsx(wb);
await out.save(fileURLToPath(new URL('Все_метрики_DDI_2026-10-29.xlsx',dir)));
console.log('Exported',data.summary);
