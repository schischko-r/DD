import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const dir=path.dirname(fileURLToPath(import.meta.url));
const data=JSON.parse(await fs.readFile(path.join(dir,'audit.json'),'utf8'));
const wb=Workbook.create(),audit=wb.worksheets.add('Сверка'),raw=wb.worksheets.add('Кампейнинг');
const fields=['quarter_start','product_name','self_service_fact','successful_self_service_fact_num','research_self_service_fact_num','successful_self_service_fact_denom','camp_fact','successful_camp_fact_num','research_camp_fact_num','successful_camp_fact_denom'];
const namesForSource=s=>data.mappings.filter(m=>m.names.includes(s.product_name)).map(m=>`${m.unit}: ${m.team}`).join('; ');
raw.getRange(`A1:K${data.source.length+1}`).values=[[...fields,'Команды DDI'],...data.source.map(s=>[...fields.map(f=>f==='quarter_start'?Date.parse(`${s[f].slice(0,10)}T00:00:00Z`)/86400000+25569:s[f]),namesForSource(s)])];
raw.getRange('M1').values=[['Источник: Кампейнинг.xlsx, Лист1, письмо от 03.11.2026']];
raw.getRange('M2').values=[[data.sourceMail]];
raw.getRange('M4').values=[[data.q3Confirmed?'quarter_start 01.04 — успешность; 01.07 — факт III квартала по сентябрь (подтверждено пользователем).':'В quarter_start только 01.04 и 01.07. Сентябрьских дат нет; сентябрьские проверки отмечены «Не проверено».']];
raw.getRange('M5').values=[['Исходные значения A:J и номера строк сохранены. K — сопоставление с командами DDI.']];
raw.getRange('M6').values=[['Пустой product_name в строке 516 сохранен, к командам не привязан.']];
raw.getRange('M7').values=[['Совместные предложения и кампании смежных продуктов не используются как однозначное подтверждение.']];
raw.getRange('M8').values=[['«Пассивы. БС» (90, 350), «КАК ЗАРПЛАТНЫЙ» (52) и «Транз Акт. Перевод ЗП/Пенсии» (214, 481) требуют уточнения привязки.']];
const rank={'Противоречие':0,'Не проверено':1,'Совпадает':2,'Вне расчета':3};
const records=[...data.audits].sort((a,b)=>rank[a.status]-rank[b.status]||a.unit.localeCompare(b.unit,'ru')||a.team.localeCompare(b.team,'ru')||a.metric.localeCompare(b.metric));
audit.getRange('A2').values=[['Кампейнинг: сверка с DDI III квартала 2026']];
audit.getRange('A3').values=[['Успешность: successful_self_service_fact_num или successful_camp_fact_num ≥1 при quarter_start 01.04.2026.']];
audit.getRange('A4').values=[[data.q3Confirmed?'Запуски: self_service_fact или camp_fact ≥1; Self-service: self_service_fact ≥1. Факт III квартала — строки 01.07.2026.':'Запуски и Self-service: нужен сентябрь 2026; в источнике нет сентябрьских дат. Проверка периода не выполнена.']];
audit.getRange('A5').values=[[`${data.mappings.length} команд; ${data.audits.filter(r=>r.included).length} метрика в расчете. Сверка не изменяет баллы. Отсутствие строки не считается нулевым фактом.`]];
const headers=['Юнит','Команда','Метрика','Балл сейчас','Противоречие в XLSX','Подтверждение','Период источника','Строки источника','Self-service fact','Camp fact','Successful SS num','Successful camp num','Балл, исходный','Максимум','Входит в DDI'];
const labels={
 'attract.campaign_launches':'Запуски кампаний за квартал',
 'attract.nalichie_self_service':'Наличие Self-service',
 'attract.nalichie_uspeshnyh_biznes_zapuskov':'Наличие успешных бизнес-запусков',
};
audit.getRange(`A7:O${records.length+7}`).values=[headers,...records.map(r=>[r.unit,r.team,labels[r.metric],r.score??'Не применимо',r.status,
 r.reason,r.sourcePeriod==='2026-04'?'Апрель 2026':r.sourcePeriod==='2026-09'?'Сентябрь 2026':'III квартал 2026',r.sourceRows.length?r.sourceRows.join(', '):'Нет строк',null,null,null,null,r.value,r.max,r.included?'Да':'Нет'])];
// The source sheet keeps original row coordinates, so every aggregate can be traced to the attachment.
for(let i=0;i<records.length;i++){
 const r=records[i],row=i+8;
 if(r.sourceRows.length){
  const cols=['C','G','D','H'];
  audit.getRange(`I${row}:L${row}`).formulas=[cols.map(col=>`=SUM(${r.sourceRows.map(n=>`'Кампейнинг'!${col}${n}`).join(',')})`)];
 }
}
const ends=records.length+7;
for(const [sheet,range] of [[audit,`A1:O${ends}`],[raw,`A1:K${data.source.length+1}`]]){
 sheet.showGridLines=false;sheet.getRange(range).format.font={name:'Arial',size:10,color:'#242424'};
 sheet.getRange(range).format.verticalAlignment='center';
 sheet.getRange(range).format.rowHeight=32;
}
audit.getRange('A2').format.font={name:'Arial',size:15,bold:true};
audit.getRange('A3:A5').format.font={name:'Arial',size:10,color:'#666666'};
audit.getRange('A7:O7').format={fill:'#363636',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},rowHeight:42,wrapText:true,horizontalAlignment:'center',verticalAlignment:'center'};
raw.getRange('A1:K1').format={fill:'#363636',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},rowHeight:58,wrapText:true,horizontalAlignment:'center',verticalAlignment:'center'};
for(const [col,width] of Object.entries({A:10,B:34,C:38,D:14,E:24,F:57,G:18,H:24,I:15,J:13,K:17,L:18,M:15,N:13,O:16}))audit.getRange(`${col}7:${col}${ends}`).format.columnWidth=width;
audit.getRange(`B8:C${ends}`).format.wrapText=true;
audit.getRange(`F8:H${ends}`).format.wrapText=true;
audit.getRange(`A8:O${ends}`).format.rowHeight=46;
audit.getRange(`D8:D${ends}`).setNumberFormat('0%');
audit.getRange(`I8:L${ends}`).setNumberFormat('#,##0');
audit.getRange(`M8:N${ends}`).setNumberFormat('0.##');
audit.getRange(`E8:E${ends}`).conditionalFormats.add('containsText',{text:'Противоречие',format:{fill:'#FCE8E6',font:{color:'#A12622',bold:true}}});
audit.getRange(`E8:E${ends}`).conditionalFormats.add('containsText',{text:'Не проверено',format:{fill:'#FFF3D6',font:{color:'#725000'}}});
raw.getRange(`A1:A${data.source.length+1}`).format.columnWidth=30;
raw.getRange(`A2:A${data.source.length+1}`).setNumberFormat('dd.mm.yyyy');
raw.getRange(`B1:B${data.source.length+1}`).format.columnWidth=73;
raw.getRange(`C1:J${data.source.length+1}`).format.columnWidth=21;
raw.getRange(`K1:K${data.source.length+1}`).format.columnWidth=50;
raw.getRange(`K2:K${data.source.length+1}`).format.wrapText=true;
raw.getRange('M1:M8').format.font={name:'Arial',size:10,color:'#666666'};
audit.tables.add(`A7:O${ends}`,true,'CampaignAudit').style='TableStyleLight1';
raw.tables.add(`A1:K${data.source.length+1}`,true,'CampaignSource').style='TableStyleLight1';
audit.freezePanes.freezeRows(7);raw.freezePanes.freezeRows(1);
wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'Сверка!A7:L13',tableMaxRows:7,tableMaxCols:12,maxChars:2600})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#SPILL!',options:{useRegex:true,maxResults:10},maxChars:1200})).ndjson);
for(const [sheet,range,file] of [['Сверка','A7:H17','preview-audit.png'],['Кампейнинг','A1:F8','preview-source.png']]){
 const p=await wb.render({sheetName:sheet,range,scale:1.5,format:'png'});await fs.writeFile(path.join(dir,file),new Uint8Array(await p.arrayBuffer()));
}
const xlsx=await SpreadsheetFile.exportXlsx(wb);await xlsx.save(path.join(dir,'Сверка_кампейнинг_DDI_III_2026.xlsx'));
