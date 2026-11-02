import fs from 'node:fs/promises';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const dir=new URL('.',import.meta.url).pathname;
const products=JSON.parse(await fs.readFile(new URL('../../gravity-app/public/report-data.json',import.meta.url),'utf8')).products;
const responses=JSON.parse(await fs.readFile('/tmp/ddi_uplift_results.json','utf8'));
const wb=Workbook.create();
const summary=wb.worksheets.add('Юниты');
const teams=wb.worksheets.add('Команды');
const answers=wb.worksheets.add('Ответы');
const included=m=>m.is_applicabble_flg!==false&&!m.excluded_from_index&&m.dd_calculation_flg!==0&&m.max_value>0;
const metrics=p=>p.metrics.flatMap(b=>b.metrics).filter(included);
const baseline=p=>{const ms=metrics(p);return {points:ms.reduce((s,m)=>s+m.value,0),max:ms.reduce((s,m)=>s+m.max_value,0)}};
function setup(s,title,headers,widths){
 s.showGridLines=false;s.getRange('A2').values=[[title]];
 s.getRangeByIndexes(3,0,1,headers.length).values=[headers];
 s.getRangeByIndexes(0,0,120,headers.length).format.font={name:'Arial',size:10,color:'#24344A'};
 s.getRange('A2').format.font={name:'Arial',size:14,bold:true,color:'#17385C'};
 const h=s.getRangeByIndexes(3,0,1,headers.length);h.format={fill:'#24476A',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,rowHeight:36,verticalAlignment:'center',horizontalAlignment:'center'};
 widths.forEach((v,i)=>s.getRangeByIndexes(0,i,120,1).format.columnWidth=v);
}
setup(summary,'Аплифты DDI по юнитам',['Юнит','Ответили','Всего команд','DDI был','Новый DDI мин.','Новый DDI макс.','Аплифт мин., п.п.','Аплифт макс., п.п.'],[17,12,15,13,17,17,18,18]);
setup(teams,'DDI команд после применения анкет',['Юнит','Команда','Наборов ответов','DDI был','Новый DDI мин.','Новый DDI макс.','Аплифт мин., п.п.','Аплифт макс., п.п.','Статус'],[13,56,16,13,17,17,18,18,34]);
setup(answers,'Расчёт по наборам ответов',['Юнит','Команда','Вариант','Баллы были','Максимум','Баллы новые','DDI был','DDI новый','Аплифт, п.п.'],[13,56,12,15,13,16,14,14,17]);
const responseRows=new Map();
responses.forEach((r,i)=>{
 const row=i+5;const p=products.find(p=>p.name===r.name&&p.unit===r.unit);const b=baseline(p);
 const pp=metrics(p).reduce((s,m)=>s+(r.updates[m.code]??m.value),0);
 const key=p.name;const refs=responseRows.get(key)||[];refs.push(row);responseRows.set(key,refs);
 answers.getRange(`A${row}:F${row}`).values=[[p.unit,p.name,refs.length,b.points,b.max,pp]];
 answers.getRange(`G${row}:I${row}`).formulas=[[`=D${row}/E${row}*100`,`=F${row}/E${row}*100`,`=H${row}-G${row}`]];
});
const sorted=[...products].sort((a,b)=>a.unit.localeCompare(b.unit)||a.name.localeCompare(b.name,'ru'));
sorted.forEach((p,i)=>{
 const row=i+5;const b=baseline(p);const rr=responseRows.get(p.name)||[];
 teams.getRange(`A${row}:D${row}`).values=[[p.unit,p.name,rr.length,100*b.points/b.max]];
 const refs=rr.map(r=>`'Ответы'!H${r}`).join(',');
 teams.getRange(`E${row}:H${row}`).formulas=[[rr.length?`=MIN(${refs})`:`=D${row}`,rr.length?`=MAX(${refs})`:`=D${row}`,`=E${row}-D${row}`,`=F${row}-D${row}`]];
 teams.getRange(`I${row}`).values=[[rr.length>1?'Два ответа: показан диапазон':rr.length?'Ответ учтён':'Прежний DDI сохранён']];
});
const units=['УБ','CX','PC','ДомКлик','CBP','DB','DP','Data'];
const end=sorted.length+4;
units.forEach((u,i)=>{
 const row=i+5;summary.getRange(`A${row}`).values=[[u]];
 summary.getRange(`B${row}:H${row}`).formulas=[[
 `=COUNTIFS('Команды'!$A$5:$A$${end},A${row},'Команды'!$C$5:$C$${end},">0")`,
 `=COUNTIFS('Команды'!$A$5:$A$${end},A${row})`,
 ...['D','E','F'].map(c=>`=AVERAGEIFS('Команды'!$${c}$5:$${c}$${end},'Команды'!$A$5:$A$${end},A${row})`),
 `=E${row}-D${row}`,`=F${row}-D${row}`]];
});
summary.getRange('A14').values=[['Все команды']];
summary.getRange('B14:H14').formulas=[['=SUM(B5:B12)','=SUM(C5:C12)',...['D','E','F'].map(c=>`=AVERAGE('Команды'!${c}5:${c}${end})`),'=E14-D14','=F14-D14']];
summary.getRange('A14:H14').format.fill='#E8EFF6';summary.getRange('A14:H14').format.font.bold=true;
const notes=[
 'База: II кв. 2026. Сценарий учитывает только ответы анкет, без остальных цифровых следов III квартала.',
 'Среднее по юниту — простое среднее DDI всех его команд. У 12 команд без сопоставимых ответов прежний DDI сохранён.',
 'У ОМС, Слитков, Зарплатного продукта и SberPay Ecom по два ответа. Диапазон построен по полным ответам.',
 'Снижения баллов учтены. Пустые новые значения сохраняют прежние баллы. Исключённые метрики не входят в DDI.',
 'Четыре новые команды ниже не включены: в выгрузке отсутствует прежняя оценка. Аплифт для них не определён.'
];
notes.forEach((t,i)=>{summary.getRange(`A${17+i}`).values=[[t]];summary.getRange(`A${17+i}:H${17+i}`).merge();summary.getRange(`A${17+i}:H${17+i}`).format.wrapText=true;summary.getRange(`A${17+i}:H${17+i}`).format.rowHeight=30;});
summary.getRange('A24:C28').values=[['Новые команды','Юнит','Причина исключения'],['Трансграничные переводы #B2C','DB','Нет прежней оценки'],['Сберчаевые #B2C','DB','Нет прежней оценки'],['Трансграничный эквайринг #B2C','DB','Нет прежней оценки'],['Трансграничный эквайринг #B2B','DB','Нет прежней оценки']];
summary.getRange('A24:C28').format.wrapText=true;summary.getRange('A24:C28').format.rowHeight=45;
answers.getRange('K4:L8').values=[['Источники','Назначение'],['report-data.json','Баллы, веса и юниты II кв. 2026'],['questionare-uplifts(5).csv','Анкеты каналов'],['questionare-uplifts(6).csv','Анкеты сегментов'],['questionare-uplifts(7).csv','Анкеты продуктов']];
answers.getRange('K4:L8').format.columnWidth=43;
for(const s of [summary,teams,answers]){
 s.getRange(s===answers?'D5:I79':s===teams?'D5:H87':'D5:H14').setNumberFormat('0.0');
 if(s!==summary)s.freezePanes.freezeRows(4);
}
wb.recalculate();
const expected=[[67.125,67.125],[62.309,62.309],[84.358,84.358],[73.568,73.568],[55.342,56.689],[50.001,50.632],[58.673,58.673],[62.274,62.274]];
const vals=summary.getRange('E5:F12').values;
vals.forEach((rr,i)=>rr.forEach((v,j)=>{if(Math.abs(v-expected[i][j])>.001)throw Error(`Summary mismatch ${i} ${j}: ${v}`)}));
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#SPILL!',options:{useRegex:true,maxResults:20},maxChars:1500})).ndjson);
for(const [s,range] of [['Юниты','A1:H22'],['Команды','A1:I15'],['Ответы','A1:I15']]){
 const b=await wb.render({sheetName:s,range,scale:1.5,format:'png'});await fs.writeFile(`${dir}${s}.png`,new Uint8Array(await b.arrayBuffer()));
}
const x=await SpreadsheetFile.exportXlsx(wb);await x.save(`${dir}Аплифты_DDI_по_юнитам.xlsx`);
console.log('EXPORTED',JSON.stringify(vals));
