import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';
import JSZip from 'jszip';
import {previousBacklogs} from '../../gravity-app/src/deposits-survey/previous-backlogs.js';
import {teams as otherTeams} from '../../gravity-app/src/other-surveys/teams.js';
import {getPreviousHistory} from '../../gravity-app/src/other-surveys/previous-history.js';
import {getBacklogAnalyzed} from '../../gravity-app/src/other-surveys/questions.js';

const out=fileURLToPath(new URL('./',import.meta.url));
const rows=Object.entries(previousBacklogs).map(([id,history])=>({
  name:id.endsWith('¦СберЧаевые')?'Сберчаевые #B2C':id.split('¦')[1],
  url:history.links[0], type:'Продукт',
}));
for(const team of otherTeams) if(getBacklogAnalyzed({product:team.id})) {
  for(const url of getPreviousHistory(team.id).acceptedBacklogLinks) rows.push({name:team.name,url,type:team.type});
}
assert.equal(rows.length,19);assert.equal(new Set(rows.map(r=>r.name)).size,19);
assert.ok(rows.every(r=>/^https:\/\/(jira\.|sbertrack\.)/.test(r.url)));
await fs.writeFile(out+'rows.json',JSON.stringify(rows,null,2));
const wb=Workbook.create(), sheet=wb.worksheets.add('Команды и ссылки');
sheet.showGridLines=false;sheet.tabColor='#163A56';
sheet.getRange('A1:B29').format.font={name:'Arial',size:11,color:'#172B3A'};
sheet.getRange('A1:B29').format.verticalAlignment='center';
sheet.getRange('A1').values=[['Ссылки на бэклоги DA']];
sheet.getRange('A1').format.font={name:'Arial',size:16,bold:true,color:'#163A56'};
sheet.getRange('A2').values=[['19 команд: 14 продуктов, 3 сегмента, 2 канала']];
sheet.getRange('A2:B2').format.font={name:'Arial',size:10,color:'#53697B'};
sheet.getRange('A4:B23').values=[['Команда','Ссылка на Jira / SberTrack'],...rows.map(r=>[r.name,r.url])];
const table=sheet.tables.add('A4:B23',true,'DABacklogLinks');
table.showFilterButton=true;
sheet.getRange('A4:B4').format={fill:'#163A56',font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',verticalAlignment:'center',rowHeight:28};
sheet.getRange('A5:B23').format.wrapText=true;
sheet.getRange('A5:B23').format.rowHeight=42;
sheet.getRange('B5:B23').format.font={name:'Arial',size:11,color:'#175DA8',underline:'single'};
sheet.getRange('A1:A29').format.columnWidth=49;
sheet.getRange('B1:B29').format.columnWidth=120;
for(let i=0;i<rows.length;i++) if(rows[i].url.length>210) sheet.getRange(`A${i+5}:B${i+5}`).format.rowHeight=62;
sheet.getRange('A25').values=[['Уточнения']];
sheet.getRange('A25').format.font={name:'Arial',size:11,bold:true,color:'#163A56'};
sheet.getRange('A26:B29').values=[
  ['Сберчаевые #B2C','Прежняя ссылка команды «СберЧаевые». При новом ID ссылка пока не привязана: DA-вопрос в текущем опроснике показывается.'],
  ['Переводы подарков','Прежняя ссылка сохранена, но команда сейчас отсутствует в списке выбора продуктов.'],
  ['Остальные 17 команд','DA-вопрос пропускается по ранее приложенной ссылке на бэклог.'],
  ['Источник','Предыдущие ответы в опросниках DDI: Книга1(3).xlsx и Книга1(4).xlsx; ссылки сохранены полностью.'],
];
sheet.getRange('A26:B29').format.wrapText=true;
sheet.getRange('A26:B29').format.rowHeight=36;
sheet.freezePanes.freezeRows(4);
wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'\'Команды и ссылки\'!A4:B23',include:'values',tableMaxRows:3,tableMaxCols:2,maxChars:1000})).ndjson);
const preview=await wb.render({sheetName:sheet.name,range:'A1:B29',scale:1,format:'png'});
await fs.writeFile(out+'preview.png',new Uint8Array(await preview.arrayBuffer()));
const path=out+'Команды_ссылки_на_бэклоги_DA.xlsx';
await (await SpreadsheetFile.exportXlsx(wb)).save(path);
// Native Excel hyperlinks preserve long URLs without HYPERLINK formula limits.
// Artifact Tool's published API offers HYPERLINK formulas but no native link setter.
const zip=await JSZip.loadAsync(await fs.readFile(path));
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const links=rows.map((r,i)=>`<x:hyperlink ref="B${i+5}" r:id="rIdDA${i+1}"/>`).join('');
let xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
if(!xml.includes('xmlns:r='))xml=xml.replace('<x:worksheet ','<x:worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
const hyperlinks=`<x:hyperlinks xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${links}</x:hyperlinks>`;
const before=xml.match(/<x:(?:printOptions|pageMargins|pageSetup|headerFooter|drawing|legacyDrawing|tableParts|extLst)\b/);
xml=before?xml.slice(0,before.index)+hyperlinks+xml.slice(before.index):xml.replace('</x:worksheet>',hyperlinks+'</x:worksheet>');
zip.file('xl/worksheets/sheet1.xml',xml);
const relPath='xl/worksheets/_rels/sheet1.xml.rels';
let rels=zip.file(relPath)?await zip.file(relPath).async('string'):'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
rels=rels.replace('</Relationships>',rows.map((r,i)=>`<Relationship Id="rIdDA${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escape(r.url)}" TargetMode="External"/>`).join('')+'</Relationships>');
zip.file(relPath,rels);
await fs.writeFile(path,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
const saved=await JSZip.loadAsync(await fs.readFile(path));
assert.equal(((await saved.file('xl/worksheets/sheet1.xml').async('string')).match(/<x:hyperlink ref=/g)||[]).length,19);
console.log(JSON.stringify({path,teams:rows.length,hyperlinks:19}));
