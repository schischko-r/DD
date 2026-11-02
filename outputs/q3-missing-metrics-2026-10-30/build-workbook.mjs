import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {Workbook, SpreadsheetFile, FileBlob} from '@oai/artifact-tool';
import {displayProductName} from '../../gravity-app/src/domain/report.js';

const dir = new URL('.', import.meta.url).pathname;
const input = await fs.readFile(`${dir}analysis.json`, 'utf8');
const data = JSON.parse(input);
const digest = crypto.createHash('sha256').update(input).digest('hex');
const rows = [...data.rows.map(r => ({...r, index:'Да'})), ...data.nonIndexRows.map(r => ({...r, index:'Нет'}))]
  .sort((a,b) => `${a.unit}\t${a.team}\t${a.blockName}\t${a.name}`.localeCompare(`${b.unit}\t${b.team}\t${b.blockName}\t${b.name}`, 'ru'));
if (rows.length !== data.blankIndexValues + data.blankNonIndexValues) throw Error('Source totals mismatch');
if (rows.some(r => r.value !== null)) throw Error('Audit contains a nonblank value');
const groups = new Map();
for (const r of rows) {
 const key=`${r.index}|${r.code}`;
 if (!groups.has(key)) groups.set(key,{...r, teams:[]});
 groups.get(key).teams.push(`${displayProductName(r.team)} (${r.unit})`);
}
const metrics = [...groups.values()].sort((a,b) => a.index.localeCompare(b.index,'ru') || b.teams.length-a.teams.length || a.name.localeCompare(b.name,'ru'));
const wb = Workbook.create();
const sum = wb.worksheets.add('По метрикам');
const det = wb.worksheets.add('Пустые оценки');
const last=rows.length+8, ml=metrics.length+10;
const purple='#6B587E', pale='#F1EDF5', ink='#30293A', muted='#756D80';
function base(s, range) {
 s.showGridLines=false;
 s.getRange(range).format.font={name:'Arial',size:10,color:ink};
 s.getRange(range).format.verticalAlignment='center';
 s.tabColor=purple;
}
function title(s,text,end) {
 s.getRange('A2').values=[[text]];
 s.getRange('A2').format.font={name:'Arial',size:15,bold:true,color:purple};
 s.getRange(`A3:${end}3`).format.borders={bottom:{style:'thin',color:'#B9A9CA'}};
 s.getRange('A2').format.rowHeight=28;
}
function header(s,r) {
 s.getRange(r).format={fill:purple,font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center',rowHeight:33};
}
base(sum,`A1:F${ml}`);base(det,`A1:J${last}`);
title(sum,'DDI · Пустые оценки · III квартал 2026','F');
sum.getRange('A4:B8').values=[['Команд в проверке',data.teamCount],['Пустых индексных оценок',null],['Пустых информационных оценок',null],['Всего пустых оценок',null],['Команд с пустыми индексными оценками',data.teamsWithBlankIndexValues]];
sum.getRange('B5:B7').formulas=[[
 `=COUNTIFS('Пустые оценки'!$E$9:$E$${last},"Да")`
],[`=COUNTIFS('Пустые оценки'!$E$9:$E$${last},"Нет")`],['=SUM(B5:B6)']];
sum.getRange('B4:B8').format.font={bold:true,color:purple};
sum.getRange('D4').values=[['Проверены все команды текущего состава Q3.']];
sum.getRange('D5').values=[['Пустая оценка отличается от 0 и «не применимо».']];
sum.getRange('D6').values=[['Информационные метрики не входят в индекс DDI.']];
sum.getRange('D4:D6').format.font={color:muted,size:10};
sum.getRange('A10:F10').values=[['Блок','Метрика','В индексе DDI','Команд без оценки','Команды','Код метрики']];
header(sum,'A10:F10');
const mr=metrics.map(m=>[m.blockName,m.name,m.index,null,m.teams.join('; '),m.code]);
sum.getRange(`A11:F${ml}`).values=mr;
sum.getRange(`D11:D${ml}`).formulas=metrics.map((m,i)=>[`=COUNTIFS('Пустые оценки'!$J$9:$J$${last},F${i+11},'Пустые оценки'!$E$9:$E$${last},C${i+11})`]);
for (let i=0;i<metrics.length;i++) {
 const row=i+11;
 sum.getRange(`A${row}:F${row}`).format.rowHeight=Math.max(42,Math.ceil(metrics[i].teams.join('; ').length/125)*13+12);
 if(i%2===0)sum.getRange(`A${row}:F${row}`).format.fill=pale;
}
sum.getRange(`A11:F${ml}`).format.wrapText=true;
sum.getRange(`A11:F${ml}`).format.verticalAlignment='top';
sum.getRange(`D11:D${ml}`).setNumberFormat('0');
const sw=[48,46,13,16,105,43];sw.forEach((w,i)=>sum.getRangeByIndexes(0,i,ml,1).format.columnWidth=w);
sum.freezePanes.freezeRows(10);
sum.tables.add(`A10:F${ml}`,true,'MissingByMetric').showFilterButton=true;

title(det,'DDI · Команды и метрики без оценки','J');
det.getRange('A4').values=[['Источник: текущие данные DDI за III кв. 2026; analysis.json, срез 30.10.2026.']];
det.getRange('A5').values=[['Отобраны только незаполненные значения; 0 и «не применимо» в список не входят.']];
det.getRange('A6').values=[['Баллы в колонке G оставлены пустыми. Максимум — в исходных единицах метрики (баллы).']];
det.getRange('A4:A6').format.font={name:'Arial',size:10,color:muted};
det.getRange('A8:J8').values=[['Юнит','Продукт / команда','Блок','Метрика','В индексе DDI','Макс., баллы','Оценка Q3, баллы','Статус','Тип команды','Код метрики']];
header(det,'A8:J8');
det.getRange(`A9:J${last}`).values=rows.map(r=>[r.unit,displayProductName(r.team),r.blockName,r.name,r.index,r.max,null,'Нет оценки',r.type,r.code]);
det.getRange(`A9:J${last}`).format.wrapText=true;
det.getRange(`A9:J${last}`).format.rowHeight=44;
for(let i=9;i<=last;i++)if(i%2===1)det.getRange(`A${i}:J${i}`).format.fill=pale;
det.getRange(`F9:G${last}`).setNumberFormat('0.00');
det.getRange(`G9:G${last}`).format.fill='#E5DCEC';
const dw=[13,38,28,52,13,14,14,16,14,44];dw.forEach((w,i)=>det.getRangeByIndexes(0,i,last,1).format.columnWidth=w);
det.freezePanes.freezeRows(8);
det.tables.add(`A8:J${last}`,true,'MissingScores').showFilterButton=true;
wb.recalculate();
const before=sum.getRange('B5:B7').values.flat();
if(JSON.stringify(before)!==JSON.stringify([data.blankIndexValues,data.blankNonIndexValues,rows.length]))throw Error(`Bad summary ${before}`);
const metricCounts=sum.getRange(`D11:D${ml}`).values.flat();
if(metricCounts.some((v,i)=>v!==metrics[i].teams.length))throw Error('Metric reconciliation failed');
// Check that the summary responds to a changed input, then restore the snapshot.
const original=det.getRange('E9').values[0][0];
det.getRange('E9').values=[[original==='Да'?'Нет':'Да']];
const shifted=sum.getRange('B5:B6').values.flat();
if(shifted[0]!==before[0]+(original==='Да'?-1:1)||shifted[1]!==before[1]+(original==='Да'?1:-1))throw Error('Recalculation failed');
det.getRange('E9').values=[[original]];
wb.recalculate();
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:50},maxChars:2500});
await fs.writeFile(`${dir}workbook-error-scan.ndjson`,errors.ndjson);
for(const [s,r,f] of [['По метрикам','A1:E15','preview-summary.png'],['Пустые оценки','A1:H16','preview-detail.png']]){
 const p=await wb.render({sheetName:s,range:r,scale:1.4,format:'png'});
 await fs.writeFile(`${dir}${f}`,new Uint8Array(await p.arrayBuffer()));
}
const outputPath=`${dir}Пустые_оценки_DDI_III_квартал_2026.xlsx`;
await(await SpreadsheetFile.exportXlsx(wb)).save(outputPath);
const reopened=await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
const reread=reopened.worksheets.getItem('Пустые оценки').getRange(`A9:J${last}`).values;
if(reread.length!==rows.length||reread.some(r=>r[6]!==null&&r[6]!==''))throw Error('Readback blank mismatch');
await fs.writeFile(`${dir}workbook-validation.json`,JSON.stringify({sha256:digest,teams:data.teamCount,index:data.blankIndexValues,informational:data.blankNonIndexValues,rows:rows.length,metricGroups:metrics.length,summary:sum.getRange('B5:B7').values.flat(),readbackRows:reread.length,recalculation:true,outputPath},null,2));
console.log(JSON.stringify({outputPath,rows:rows.length,metrics:metrics.length,summary:before,errorScan:errors.ndjson}));
