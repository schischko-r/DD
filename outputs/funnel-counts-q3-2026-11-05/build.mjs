import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {displayProductName} from '../../gravity-app/src/domain/report.js';

const root = new URL('../../', import.meta.url);
const dir = new URL('.', import.meta.url).pathname;
const read = async path => JSON.parse(await fs.readFile(new URL(path, root), 'utf8'));
const source = await read('gravity-app/public/report-data.json');
const app = await fs.readFile(new URL('gravity-app/src/app/App.jsx', root), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = await Promise.all(app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read('gravity-app/src/data/'+imports.get(key.trim()))));
const args = await Promise.all(['salary-products','reporting-regularity-missing','funnel-action-missing'].map(name => read(`gravity-app/src/data/${name}-q3-2026.json`)));
const products = buildDdiPeriodProducts(source.products, 'III кв. 2026', overlays, ...args, await read('gravity-app/public/backlog-data.json'));
assert.equal(products.length, 76);
assert.equal(new Set(products.map(p => p.id)).size, 76);
const definitions = [
  ['Привлечение','Настроена отчётность','attract.nastroena_otchetnostь'],
  ['Отток','Настроена отчётность','churn.nastroena_otchetnostь'],
  ['Привлечение','Полнота отчёта','attract.report_completeness'],
  ['Отток','Полнота отчёта','churn.report_completeness'],
  ['Привлечение','Комплексный анализ','attract.funnel_analysis'],
  ['Отток','Комплексный анализ','churn.funnel_analysis'],
];
const categories = ['100%','Частично','0%','Не применимо','Нет метрики','Нет оценки'];
const rows = [];
const summary = definitions.map(([funnel, label, code]) => {
  const counts = Object.fromEntries(categories.map(c => [c, 0]));
  for (const p of [...products].sort((a,b) => `${a.unit} ${a.name}`.localeCompare(`${b.unit} ${b.name}`,'ru'))) {
    const matches = p.metrics.flatMap(b => b.metrics || []).filter(m => m.code === code);
    assert.ok(matches.length <= 1, `${p.name}/${code}: duplicate metric`);
    const m = matches[0];
    let ratio = null, category;
    if (!m) category = 'Нет метрики';
    else if (m.is_applicabble_flg === false || !(m.max_value > 0)) category = 'Не применимо';
    else if (!Number.isFinite(m.value)) category = 'Нет оценки';
    else {
      ratio = m.value / m.max_value;
      assert.ok(ratio >= 0 && ratio <= 1 + 1e-9, `${p.name}/${code}: invalid ratio`);
      category = Math.abs(ratio - 1) < 1e-9 ? '100%' : ratio === 0 ? '0%' : 'Частично';
    }
    counts[category]++;
    rows.push([p.unit,displayProductName(p.name),funnel,label,m?.value ?? null,m?.max_value ?? null,ratio,category,code]);
  }
  assert.equal(Object.values(counts).reduce((a,b) => a+b,0),76);
  return {funnel, label, code, ...counts};
});
const commit = execFileSync('git',['rev-parse','--short','HEAD'],{cwd:root}).toString().trim();
await fs.writeFile(dir+'snapshot.json',JSON.stringify({period:'III кв. 2026',commit,teamCount:76,definitions,summary,rows},null,2));
console.log(JSON.stringify(summary));

const wb = Workbook.create();
const overview = wb.worksheets.add('Сводка');
const detail = wb.worksheets.add('Команды');
function base(sheet, end, last) {
  sheet.showGridLines = false;
  sheet.getRange(`A1:${end}${last}`).format.font = {name:'Arial',size:10,color:'#242424'};
  sheet.getRange(`A1:${end}${last}`).format.verticalAlignment = 'center';
  sheet.getRange('A2').format.font = {name:'Arial',size:14,bold:true,color:'#242424'};
  sheet.getRange(`A6:${end}6`).format = {fill:'#3F3F3F',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},
    wrapText:true,horizontalAlignment:'center',verticalAlignment:'center',rowHeight:36};
  sheet.getRange(`A7:${end}${last}`).format.rowHeight = 30;
}
const last = rows.length+6;
base(overview,'J',12); base(detail,'I',last);
overview.tabColor = '#454545'; detail.tabColor = '#A0A0A0';
overview.getRange('A2').values = [['Воронки DDI — III квартал 2026']];
overview.getRange('A3').values = [['76 команд. Частично: больше 0% и меньше 100%.']];
overview.getRange('A4').values = [['Неприменимые, отсутствующие метрики и пустые оценки показаны отдельно.']];
overview.getRange('A6:J6').values = [['Воронка','Метрика',...categories,'Всего команд','Код метрики']];
detail.getRange('A2').values = [['Оценки команд — III квартал 2026']];
detail.getRange('A3').values = [[`Источник: расчёт DDI, версия ${commit}, 05.11.2026. report-data.json и подтверждённые корректировки III квартала.`]];
detail.getRange('A4').values = [['Доля = балл / максимум. Учитываются только критерии воронок привлечения и оттока.']];
detail.getRange('A6:I6').values = [['Юнит','Команда','Воронка','Метрика','Балл','Максимум','Доля','Категория','Код метрики']];
detail.getRange(`A7:I${last}`).values = rows;
detail.getRange(`E7:F${last}`).setNumberFormat('0.00');
detail.getRange(`G7:G${last}`).setNumberFormat('0.0%');
detail.getRange(`B7:D${last}`).format.wrapText = true;
detail.getRange(`E7:G${last}`).format.horizontalAlignment = 'right';
const table = detail.tables.add(`A6:I${last}`,true,'TeamFunnelScores');
table.style = 'TableStyleMedium1';
table.showFilterButton = true;
table.showBandedRows = false;
detail.getRange('A6:I6').format.font = {name:'Arial',size:10,bold:true,color:'#FFFFFF'};
detail.freezePanes.freezeRows(6);
const overviewRows = definitions.map(([f,l,c]) => [f,l,null,null,null,null,null,null,null,c]);
overview.getRange('A7:J12').values = overviewRows;
for (let i=0;i<definitions.length;i++) {
  const r=i+7;
  overview.getRange(`C${r}:H${r}`).formulas = [categories.map((_,j) =>
    `=COUNTIFS('Команды'!$I$7:$I$${last},$J${r},'Команды'!$H$7:$H$${last},${String.fromCharCode(67+j)}$6)`)];
  overview.getRange(`I${r}`).formulas = [[`=SUM(C${r}:H${r})`]];
}
overview.getRange('B7:B12').format.wrapText = true;
overview.getRange('C7:I12').format.horizontalAlignment = 'right';
overview.getRange('C7:I12').setNumberFormat('#,##0');
for (const [sheet,widths] of [[overview,[18,30,12,12,12,17,16,15,15,48]],[detail,[12,42,18,28,12,13,13,17,48]]]) {
  widths.forEach((w,i) => sheet.getRange(`${String.fromCharCode(65+i)}6:${String.fromCharCode(65+i)}${sheet===detail?last:12}`).format.columnWidth = w);
  sheet.getRange('A3').format.font = {name:'Arial',size:10,italic:true,color:'#666666'};
  sheet.getRange('A4').format.font = {name:'Arial',size:10,italic:true,color:'#666666'};
}
wb.recalculate();
const expected = summary.map(s => [...categories.map(c=>s[c]),76]);
assert.deepEqual(overview.getRange('C7:I12').values,expected);
// Verify linked counts respond to a changed classification, then restore the source.
const testIndex = rows.findIndex(r => r[8]===definitions[0][2] && r[7]==='100%');
assert.ok(testIndex>=0);
detail.getRange(`H${testIndex+7}`).values = [['0%']]; wb.recalculate();
assert.equal(overview.getRange('C7').values[0][0],expected[0][0]-1);
assert.equal(overview.getRange('E7').values[0][0],expected[0][2]+1);
detail.getRange(`H${testIndex+7}`).values = [['100%']]; wb.recalculate();
assert.deepEqual(overview.getRange('C7:I12').values,expected);
await fs.writeFile(dir+'inspection.ndjson',(await wb.inspect({kind:'table',range:'Сводка!A6:I12',include:'values,formulas',tableMaxRows:7,tableMaxCols:9})).ndjson);
await fs.writeFile(dir+'errors.ndjson',(await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#NULL!',options:{useRegex:true,maxResults:30}})).ndjson);
for (const [sheetName,range,file] of [['Сводка','A1:I13','summary.png'],['Команды','A1:H18','detail.png']]) {
  const preview=await wb.render({sheetName,range,scale:1.5,format:'png'});
  await fs.writeFile(dir+file,new Uint8Array(await preview.arrayBuffer()));
}
await (await SpreadsheetFile.exportXlsx(wb)).save(dir+'DDI_воронки_III_квартал_2026.xlsx');
