import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
import {completeProductPercent,displayProductName,isDdIndexMetric} from '../../gravity-app/src/domain/report.js';
const dir=new URL('.',import.meta.url).pathname;
const {raw,q3}=JSON.parse(await fs.readFile(dir+'source.json','utf8'));
const key=p=>JSON.stringify([p.name,p.unit,p.type]);
const q2=raw.products.filter(p=>p.period==='II кв. 2026');
const two=new Map(q2.map(p=>[key(p),p])),three=new Map(q3.map(p=>[key(p),p]));
assert.equal(two.size,q2.length);assert.equal(three.size,q3.length);
const keys=[...new Set([...two.keys(),...three.keys()])].sort((a,b)=>{const x=two.get(a)||three.get(a),y=two.get(b)||three.get(b);return `${x.unit} ${x.name} ${x.type}`.localeCompare(`${y.unit} ${y.name} ${y.type}`,'ru');});
const summary=[],detail=[],controls=[];
for(const k of keys){
 const a=two.get(k),b=three.get(k),p=b||a;
 const title=raw.title.rows.filter(r=>r.name===a?.name&&r.unit===a?.unit&&(!r.type||r.type.toLocaleLowerCase('ru')===a.type.toLocaleLowerCase('ru')));
 assert.ok(title.length<=1,`Ambiguous Q2 row: ${k}`);
 const score2=a?title[0]?.score??null:null,score3=b?completeProductPercent(b):null;
 if(a) assert.equal(title.length,1,`Missing Q2 row: ${k}`);
 const missing=b?b.metrics.flatMap(x=>x.metrics).filter(isDdIndexMetric).filter(m=>!Number.isFinite(m.value)).length:null;
 summary.push([displayProductName(p.name),p.unit,p.type,Number.isFinite(score2)?score2/100:null,score3===null?null:score3/100,null,
 !b?'Нет команды в III квартале':!a?'Нет команды во II квартале':score3===null?`Не заполнено метрик III кв.: ${missing}`:'']);
 const map=p=>new Map((p?.metrics||[]).flatMap(block=>(block.metrics||[]).map(m=>[m.code,{...m,block:block.name}])));
 const ma=map(a),mb=map(b);
 for(const code of new Set([...ma.keys(),...mb.keys()])){
  const x=ma.get(code),y=mb.get(code),m=y||x;
  detail.push([displayProductName(p.name),p.unit,p.type,m.block,m.name,null,null,null,
   Number.isFinite(x?.value)?x.value:null,Number.isFinite(x?.max_value)?x.max_value:null,
   Number.isFinite(y?.value)?y.value:null,Number.isFinite(y?.max_value)?y.max_value:null,
   x?isDdIndexMetric(x)?'Да':'Нет':'Нет метрики',y?isDdIndexMetric(y)?'Да':'Нет':'Нет метрики']);
 }
 controls.push({name:p.name,score2,score3,missing});
}
const wb=Workbook.create();const sum=wb.worksheets.add('Общий'),det=wb.worksheets.add('По метрикам');
const first=7;
function sheet(s,headers,rows,widths){
 const last=first+rows.length-1,end=String.fromCharCode(64+headers.length);
 s.showGridLines=false;s.tabColor='#087FBD';
 s.getRange(`A1:${end}${last}`).format.font={name:'Arial',size:10,color:'#253446'};
 s.getRange(`A1:${end}${last}`).format.verticalAlignment='center';
 s.getRange('A2').values=[['DDI — II и III кварталы 2026']];s.getRange('A2').format.font={size:15,bold:true,color:'#087FBD'};
 s.getRange(`A3:${end}3`).format.borders={bottom:{style:'thin',color:'#B8D9EB'}};
 s.getRange('A4').values=[['Аплифт = III − II, процентные пункты. Пусто — нет оценки или метрика неприменима.']];
 s.getRange('A4').format.font={size:10,color:'#657385',italic:true};s.getRange('A4').format.wrapText=false;
 s.getRange(`A6:${end}6`).values=[headers];
 s.getRange(`A${first}:${end}${last}`).values=rows;
 const t=s.tables.add(`A6:${end}${last}`,true,s.name==='Общий'?'DdiTeams':'DdiMetrics');t.showBandedRows=true;
 s.getRange(`A6:${end}6`).format={fill:'#126C96',font:{name:'Arial',size:10,color:'#FFFFFF',bold:true},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center',rowHeight:34};
 s.getRange(`A${first}:${end}${last}`).format.rowHeight=30;
 widths.forEach((w,i)=>s.getRange(`${String.fromCharCode(65+i)}6:${String.fromCharCode(65+i)}${last}`).format.columnWidth=w);
 s.getRange(`A${first}:C${last}`).format.wrapText=true;
 s.freezePanes.freezeRows(6);s.freezePanes.freezeColumns(s.name==='Общий'?1:3);
 return last;
}
const sl=sheet(sum,['Команда','Юнит','Тип','DDI II кв.','DDI III кв.','Аплифт, п.п.','Статус'],summary,[45,12,14,16,16,18,42]);
const dl=sheet(det,['Команда','Юнит','Тип','Блок','Метрика','DDI II кв.','DDI III кв.','Аплифт, п.п.','Баллы II кв.','Вес II кв.','Баллы III кв.','Вес III кв.','В DDI II кв.','В DDI III кв.'],detail,[42,11,13,29,65,16,16,18,15,14,15,14,16,16]);
sum.getRange(`D7:E${sl}`).setNumberFormat('0.0%');sum.getRange(`F7:F${sl}`).setNumberFormat('+0.0;-0.0;0.0');
sum.getRange(`F7:F${sl}`).formulas=summary.map((_,i)=>{const r=i+7;return [`=IF(AND(ISNUMBER(D${r}),ISNUMBER(E${r})),(E${r}-D${r})*100,"")`];});
det.getRange('A5').values=[['Для метрики DDI = баллы / вес. Информационные метрики показаны отдельно от включения в индекс.']];det.getRange('A5').format.font={color:'#657385',italic:true};
det.getRange(`D7:E${dl}`).format.wrapText=true;
det.getRange(`F7:G${dl}`).setNumberFormat('0.0%');det.getRange(`H7:H${dl}`).setNumberFormat('+0.0;-0.0;0.0');det.getRange(`I7:L${dl}`).setNumberFormat('0.####');
det.getRange(`F7:H${dl}`).formulas=detail.map((_,i)=>{const r=i+7;return [`=IF(AND(ISNUMBER(I${r}),ISNUMBER(J${r}),J${r}>0),I${r}/J${r},"")`,`=IF(AND(ISNUMBER(K${r}),ISNUMBER(L${r}),L${r}>0),K${r}/L${r},"")`,`=IF(AND(ISNUMBER(F${r}),ISNUMBER(G${r})),(G${r}-F${r})*100,"")`];});
for(const [s,c,last]of [[sum,'F',sl],[det,'H',dl]]){
 s.getRange(`${c}7:${c}${last}`).conditionalFormats.add('cellIs',{operator:'greaterThan',formula:0,format:{font:{color:'#137343'},fill:'#E8F4ED'}});
 s.getRange(`${c}7:${c}${last}`).conditionalFormats.add('cellIs',{operator:'lessThan',formula:0,format:{font:{color:'#B3261E'},fill:'#FCECE9'}});
}
wb.recalculate();
for(const [s,range,name]of [[sum,'A1:G15','preview-summary.png'],[det,'A1:H15','preview-metrics.png']]){
 const blob=await wb.render({sheetName:s.name,range,scale:1.5,format:'png'});await fs.writeFile(dir+name,new Uint8Array(await blob.arrayBuffer()));
}
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:10},summary:'formula errors'});
await fs.writeFile(dir+'error-scan.json',JSON.stringify(errors));
const output=dir+'DDI_II_III_кварталы_2026.xlsx';await(await SpreadsheetFile.exportXlsx(wb)).save(output);
await fs.writeFile(dir+'validation.json',JSON.stringify({q2:q2.length,q3:q3.length,summaryRows:summary.length,metricRows:detail.length,completeQ3:controls.filter(c=>c.score3!==null).length,output,controls},null,2));
console.log(JSON.stringify({output,summaryRows:summary.length,metricRows:detail.length,scan:errors.ndjson,summary:sum.getRange('D7:F10').values}));
