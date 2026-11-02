import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
import {completeProductPercent,completeBlockPercent,isDdIndexMetricForPeriod} from '../../gravity-app/src/domain/report.js';
const dir=new URL('.',import.meta.url).pathname;
const source=JSON.parse(await fs.readFile(dir+'source.json','utf8'));
const [primary,secondary]=source.teams,period=source.period;
assert.equal(primary.name,'Сделка с Первичным жильём');assert.equal(secondary.name,'Сделка вторичка');
const maps=source.teams.map(p=>new Map(p.metrics.flatMap(b=>b.metrics.map(m=>[m.code,{...m,block:b.name,blockCode:b.code}]))));
for(const [i,p] of source.teams.entries())assert.equal(maps[i].size,p.metrics.flatMap(b=>b.metrics).length,'Duplicate metric key');
const codes=[...new Set([...maps[0].keys(),...maps[1].keys()])];
const blocks=[...new Map([...primary.metrics,...secondary.metrics].map(b=>[b.code,{code:b.code,name:b.name}])).values()];
const wb=Workbook.create();const summary=wb.worksheets.add('Общая оценка'),blockSheet=wb.worksheets.add('По блокам'),detail=wb.worksheets.add('По метрикам');
const first=8,last=first+codes.length-1,blockLast=first+blocks.length-1;
function setup(sheet,end,lastRow,title,widths){
 sheet.showGridLines=false;sheet.tabColor='#626971';
 sheet.getRange(`A1:${end}${lastRow}`).format={font:{name:'Arial',size:10,color:'#30343B'},fill:'#FFFFFF',verticalAlignment:'center'};
 sheet.getRange('A2').values=[[title]];sheet.getRange('A2').format.font={name:'Arial',size:15,bold:true,color:'#30343B'};sheet.getRange('A2').format.rowHeight=28;
 sheet.getRange('A3').values=[['III квартал 2026. Разница = вторичка − первичка.']];sheet.getRange('A3').format.font={italic:true,color:'#68717A'};
 sheet.getRange(`A6:${end}6`).format.borders={bottom:{style:'thin',color:'#C7CBD0'}};
 sheet.getRange(`A7:${end}7`).format={fill:'#E7E8EA',font:{name:'Arial',size:10,bold:true,color:'#30343B'},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true,rowHeight:42};
 sheet.getRange(`A8:${end}${lastRow}`).format.rowHeight=32;
 widths.forEach((width,i)=>sheet.getRange(`${String.fromCharCode(65+i)}7:${String.fromCharCode(65+i)}${lastRow}`).format.columnWidth=width);
}
function table(sheet,end,lastRow,name){const t=sheet.tables.add(`A7:${end}${lastRow}`,true,name);t.style='TableStyleLight1';t.showBandedRows=false;sheet.getRange(`A7:${end}7`).format.fill='#E7E8EA';}
function diffStyle(sheet,address,format){const range=sheet.getRange(address);range.setNumberFormat(format);range.conditionalFormats.add('cellIs',{operator:'greaterThan',formula:0,format:{font:{color:'#297246'}}});range.conditionalFormats.add('cellIs',{operator:'lessThan',formula:0,format:{font:{color:'#A33E35'}}});}
setup(detail,'N',last,'Первичка и вторичка — по метрикам',[30,55,18,18,19,17,17,18,18,19,18,18,24,24]);
detail.getRange('A4').values=[['Баллы приведены с действующими весами. В общий DDI входят только строки с отметкой «Да».']];
detail.getRange('A5').values=[['Пустая оценка не заменяется нулём; неприменимые и информационные строки сохранены со статусом.']];
detail.getRange('A7:N7').values=[['Блок','Метрика','Первичка, баллы','Вторичка, баллы','Разница, баллы','Первичка, вес','Вторичка, вес','Первичка, %','Вторичка, %','Разница, п.п.','В DDI первички','В DDI вторички','Статус первички','Статус вторички']];
const metricRows=[];
for(const code of codes){const a=maps[0].get(code),b=maps[1].get(code),m=a||b;const indexed=[a,b].map(x=>Boolean(x&&isDdIndexMetricForPeriod(x,period)));const status=x=>!x?'Нет метрики':x.is_applicabble_flg===false||!(x.max_value>0)?'Неприменимо':!Number.isFinite(x.value)?'Нет оценки; вне DDI':'Вне индекса';metricRows.push([m.block,m.name,Number.isFinite(a?.value)?a.value:null,Number.isFinite(b?.value)?b.value:null,null,a?.max_value??null,b?.max_value??null,null,null,null,indexed[0]?'Да':'Нет',indexed[1]?'Да':'Нет',status(a),status(b)]);}
detail.getRange(`A8:N${last}`).values=metricRows;
detail.getRange(`A8:B${last}`).format.wrapText=true;
const df=codes.map((code,i)=>{const r=first+i;return [`=IF(AND(ISNUMBER(C${r}),ISNUMBER(D${r})),D${r}-C${r},"")`];});detail.getRange(`E8:E${last}`).formulas=df;
detail.getRange(`H8:J${last}`).formulas=codes.map((_,i)=>{const r=first+i;return [`=IF(AND(ISNUMBER(C${r}),ISNUMBER(F${r}),F${r}>0),C${r}/F${r},"")`,`=IF(AND(ISNUMBER(D${r}),ISNUMBER(G${r}),G${r}>0),D${r}/G${r},"")`,`=IF(AND(ISNUMBER(H${r}),ISNUMBER(I${r})),(I${r}-H${r})*100,"")`];});
for(let i=0;i<codes.length;i++){const r=first+i;for(const [flag,points,col,index]of [['K','C','M',12],['L','D','N',13]])if(metricRows[i][flag==='K'?10:11]==='Да')detail.getRange(`${col}${r}`).formulas=[[`=IF(ISNUMBER(${points}${r}),"В индексе","Нет оценки")`]];}
detail.getRange(`C8:G${last}`).setNumberFormat('0.####');detail.getRange(`H8:I${last}`).setNumberFormat('0.0%');diffStyle(detail,`E8:E${last}`,'+0.####;-0.####;0');diffStyle(detail,`J8:J${last}`,'+0.0;-0.0;0.0');
table(detail,'N',last,'HousingMetrics');detail.freezePanes.freezeRows(7);detail.freezePanes.freezeColumns(2);
setup(blockSheet,'I',blockLast,'Первичка и вторичка — по блокам',[34,20,20,21,20,20,20,20,21]);blockSheet.getRange('A4').values=[['В суммы входят только индексные метрики; проценты округлены как в дашборде.']];
blockSheet.getRange('A7:I7').values=[['Блок','Первичка, баллы','Вторичка, баллы','Разница, баллы','Первичка, максимум','Вторичка, максимум','Первичка, DDI','Вторичка, DDI','Разница, п.п.']];
blockSheet.getRange(`A8:A${blockLast}`).values=blocks.map(b=>[b.name]);
const range=(col)=>`'По метрикам'!$${col}$8:$${col}$${last}`;
blockSheet.getRange(`B8:I${blockLast}`).formulas=blocks.map((_,i)=>{const r=first+i;return [
 `=IF(COUNTIFS(${range('A')},$A${r},${range('K')},"Да",${range('M')},"Нет оценки")>0,"",SUMIFS(${range('C')},${range('A')},$A${r},${range('K')},"Да"))`,
 `=IF(COUNTIFS(${range('A')},$A${r},${range('L')},"Да",${range('N')},"Нет оценки")>0,"",SUMIFS(${range('D')},${range('A')},$A${r},${range('L')},"Да"))`,
 `=IF(AND(ISNUMBER(B${r}),ISNUMBER(C${r})),C${r}-B${r},"")`,
 `=SUMIFS(${range('F')},${range('A')},$A${r},${range('K')},"Да")`,
 `=SUMIFS(${range('G')},${range('A')},$A${r},${range('L')},"Да")`,
 `=IF(AND(ISNUMBER(B${r}),E${r}>0),ROUND(B${r}/E${r}*100,0)/100,"")`,
 `=IF(AND(ISNUMBER(C${r}),F${r}>0),ROUND(C${r}/F${r}*100,0)/100,"")`,
 `=IF(AND(ISNUMBER(G${r}),ISNUMBER(H${r})),(H${r}-G${r})*100,"")`];});
blockSheet.getRange(`A8:A${blockLast}`).format.wrapText=true;blockSheet.getRange(`B8:F${blockLast}`).setNumberFormat('0.####');blockSheet.getRange(`G8:H${blockLast}`).setNumberFormat('0%');diffStyle(blockSheet,`D8:D${blockLast}`,'+0.####;-0.####;0');diffStyle(blockSheet,`I8:I${blockLast}`,'+0.0;-0.0;0.0');table(blockSheet,'I',blockLast,'HousingBlocks');blockSheet.freezePanes.freezeRows(7);
setup(summary,'D',11,'Первичка и вторичка — общая оценка',[40,23,23,25]);summary.getRange('A4').values=[['Первичка: Сделка с Первичным жильём']];summary.getRange('A5').values=[['Вторичка: Сделка вторичка']];
summary.getRange('A7:D11').values=[['Показатель','Первичка','Вторичка','Разница'],['DDI',null,null,null],['Набрано баллов',null,null,null],['Максимум баллов',null,null,null],['Метрик в DDI',null,null,null]];
summary.getRange('B8:D11').formulas=[
 ['=IF(AND(ISNUMBER(B9),B10>0),ROUND(B9/B10*100,0)/100,"")','=IF(AND(ISNUMBER(C9),C10>0),ROUND(C9/C10*100,0)/100,"")','=IF(AND(ISNUMBER(B8),ISNUMBER(C8)),(C8-B8)*100,"")'],
 [`=IF(COUNTIFS(${range('K')},"Да",${range('M')},"Нет оценки")>0,"",SUM('По блокам'!B8:B${blockLast}))`,`=IF(COUNTIFS(${range('L')},"Да",${range('N')},"Нет оценки")>0,"",SUM('По блокам'!C8:C${blockLast}))`,'=IF(AND(ISNUMBER(B9),ISNUMBER(C9)),C9-B9,"")'],
 [`=SUM('По блокам'!E8:E${blockLast})`,`=SUM('По блокам'!F8:F${blockLast})`,'=C10-B10'],
 [`=COUNTIFS(${range('K')},"Да")`,`=COUNTIFS(${range('L')},"Да")`,'=C11-B11']];
summary.getRange('B8:C8').setNumberFormat('0%');summary.getRange('B8:D8').format.font={name:'Arial',size:15,bold:true};summary.getRange('B9:C11').setNumberFormat('0.####');diffStyle(summary,'D8','+0.0" п.п.";-0.0" п.п.";0.0" п.п."');diffStyle(summary,'D9:D10','+0.####;-0.####;0');diffStyle(summary,'D11','+0;-0;0');
summary.getRange('A13').values=[['DDI округлён как в дашборде. Разница DDI — процентные пункты; остальные разницы — баллы и количество.']];summary.getRange('A14').values=[['Источник: текущие оценки DDI за III квартал 2026, снимок от 02.11.2026.']];summary.getRange('A13:A14').format.font={name:'Arial',size:10,color:'#68717A',italic:true};
wb.recalculate();
assert.equal(summary.getRange('B8').values[0][0],completeProductPercent(primary)/100);assert.equal(summary.getRange('C8').values[0][0],completeProductPercent(secondary)/100);
for(let i=0;i<blocks.length;i++){const r=first+i;for(const [p,col]of [[primary,'G'],[secondary,'H']]){const b=p.metrics.find(b=>b.code===blocks[i].code);const expected=b?completeBlockPercent(b,period):null;const actual=blockSheet.getRange(`${col}${r}`).values[0][0];assert.equal(actual,expected===null?'':expected/100);}}
// Verify blank-vs-zero dependencies without changing the delivered inputs.
const editable=codes.findIndex(code=>metricRows[codes.indexOf(code)][10]==='Да');const cell=`C${first+editable}`,saved=detail.getRange(cell).values[0][0];detail.getRange(cell).values=[[null]];assert.ok([null,''].includes(summary.getRange('B8').values[0][0]));detail.getRange(cell).values=[[0]];assert.ok(Number.isFinite(summary.getRange('B8').values[0][0]));detail.getRange(cell).values=[[saved]];wb.recalculate();
assert.equal(summary.getRange('B8').values[0][0],completeProductPercent(primary)/100);
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:10}});
for(const [s,range,name]of [[summary,'A1:D14','summary.png'],[blockSheet,`A1:I${blockLast}`,'blocks.png'],[detail,'A1:J16','metrics.png']]){const blob=await wb.render({sheetName:s.name,range,scale:1.4,format:'png'});await fs.writeFile(dir+name,new Uint8Array(await blob.arrayBuffer()));}
const output=dir+'DDI_Первичка_Вторичка_III_квартал_2026.xlsx';await(await SpreadsheetFile.exportXlsx(wb)).save(output);
const validation={output,period,teams:source.teams.map(p=>p.name),metrics:codes.length,blocks:blocks.length,summary:summary.getRange('A8:D11').values,errorScan:errors.ndjson,recalculation:'blank -> unavailable; zero -> numeric; original restored',sourceMatched:true};await fs.writeFile(dir+'validation.json',JSON.stringify(validation,null,2));console.log(JSON.stringify(validation));
