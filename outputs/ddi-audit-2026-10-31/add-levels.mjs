import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {FileBlob, SpreadsheetFile} from '@oai/artifact-tool';
import {maturityLevelName} from '../../gravity-app/src/domain/report.js';

const dir = new URL('./', import.meta.url);
const path = new URL('DDI_II_III_2026_команды_и_метрики.xlsx', dir);
const outputPath = new URL('DDI_II_III_2026_обновлено.xlsx', dir);
await fs.copyFile(path, new URL('../../.runtime/ddi-before-levels.bin', dir));
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(fileURLToPath(path)));
const sheet = workbook.worksheets.getItem('Команды');
const metrics = workbook.worksheets.getItem('Метрики');
const beforeSummary = sheet.getRange('A1:E82').values;
const beforeMetrics = metrics.getRange('A1:M3308').values;
const beforeMetricFormulas = metrics.getRange('H7:H3308').formulas;
const oldCarryNote = 'Подтверждённая оценка: priorQuarterCarryForward; Пара команда–метрика отсутствует в файле; полностью набранная применимая оценка Q2 переносится по явному правилу пользователя. Присутствующие текстовые или конфликтующие строки отсутствием не считаются.; file: gravity-app/public/report-data.json; fromPeriod: II кв. 2026';
const newCarryNote = 'В прошлом периоде получили макс. балл, не спрашиваем';
const carryCore = oldCarryNote.split('; file:')[0];
const simplifyCarryComment = value => typeof value !== 'string' ? value : value.split('\n').map(line => line.includes(carryCore)
  ? line.replaceAll(carryCore, newCarryNote).replaceAll('; file: gravity-app/public/report-data.json', '').replaceAll('; fromPeriod: II кв. 2026', '') : line).join('\n');
const comments = metrics.getRange('L7:L3308').values;
let replacedComments = 0;
for (const row of comments) if (typeof row[0] === 'string' && row[0].includes(carryCore)) {
  row[0] = simplifyCarryComment(row[0]); replacedComments++;
}
assert.equal(replacedComments, 204);
metrics.getRange('L7:L3308').values = comments;
const scores = sheet.getRange('C7:D82').values;
const formulaFor = cell => `=IF(ISNUMBER(${cell}),IF(${cell}<0.4,"Требуют внимания",IF(${cell}<=0.6,"Развивающиеся",IF(${cell}<=0.8,"Зрелые","Лидеры Data Driven"))),"")`;
sheet.getRange('F6:G6').values = [['Уровень\nII кв. 2026', 'Уровень\nIII кв. 2026']];
sheet.getRange('F7:G82').formulas = scores.map((_, i) => [formulaFor(`C${i+7}`), formulaFor(`D${i+7}`)]);
const table = sheet.tables.items.find(t => t.name === 'TeamScores');
assert.ok(table);
const style = table.style;
table.delete();
sheet.tables.add('A6:G82', true, 'TeamScores').style = style;
sheet.getRange('F6:G6').format = {fill:'#17324D',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center'};
sheet.getRange('F6:G6').format.borders = {insideVertical:{style:'thin',color:'#FFFFFF'}};
sheet.getRange('F7:G82').format = {font:{name:'Arial',size:10,color:'#203246'},wrapText:true,verticalAlignment:'center',horizontalAlignment:'left'};
sheet.getRange('F:G').format.columnWidth = 25;
sheet.getRange('C:D').format.columnWidth = 28;
metrics.getRange('F:G').format.columnWidth = 28;
sheet.getRange('F3:G3').format.borders = {bottom:{style:'thin',color:'#CBD5DF'}};
for (const [tab, lastColumn, lastRow] of [[sheet,'G',82],[metrics,'M',3308]]) {
  tab.getRange(`A1:${lastColumn}${lastRow}`).format.wrapText = false;
  tab.getRange(`A7:${lastColumn}${lastRow}`).format.rowHeight = 22;
  const headers = tab.getRange(`A6:${lastColumn}6`);
  headers.values = headers.values.map(row => row.map(value => typeof value === 'string' ? value.replaceAll('\n',' — ') : value));
  headers.format.rowHeight = 28;
}
// Boundary checks use the displayed score cells, then restore every source value.
for (const [value, expected] of [[0.39,'Требуют внимания'],[0.4,'Развивающиеся'],[0.6,'Развивающиеся'],[0.61,'Зрелые'],[0.8,'Зрелые'],[0.81,'Лидеры Data Driven']]) {
  sheet.getRange('C7').values = [[value]];
  assert.equal(sheet.getRange('F7').values[0][0], expected);
}
sheet.getRange('C7').values = [[scores[0][0]]];
workbook.recalculate();
const afterSummary = sheet.getRange('A1:E82').values;
for (let r=0; r<beforeSummary.length; r++) for (let c=0; c<5; c++) {
  const expected = r===5 && typeof beforeSummary[r][c]==='string' ? beforeSummary[r][c].replaceAll('\n',' — ') : beforeSummary[r][c];
  if (!Object.is(afterSummary[r][c], expected)) throw new Error(`Unexpected summary change at ${r+1}/${c+1}`);
}
const afterMetrics = metrics.getRange('A1:M3308').values;
for (let r=0; r<beforeMetrics.length; r++) for (let c=0; c<13; c++) {
  let before = beforeMetrics[r][c]; const after = afterMetrics[r][c];
  if (r === 5 && typeof before === 'string') before = before.replaceAll('\n',' — ');
  if (c === 11 && typeof before === 'string') before = simplifyCarryComment(before);
  const sameEmptyFormulaResult = r >= 6 && c === 7 && (before === null || before === '') && (after === null || after === '');
  if (!Object.is(before, after) && !sameEmptyFormulaResult) throw new Error(`Unexpected metric change at row ${r+1}, column ${c+1}`);
}
assert.deepEqual(metrics.getRange('H7:H3308').formulas, beforeMetricFormulas);
const levels = sheet.getRange('F7:G82').values;
for (let i=0; i<scores.length; i++) assert.deepEqual(levels[i], scores[i].map(x => maturityLevelName(x*100)));
const scan = await workbook.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},maxChars:1000});
await fs.writeFile(new URL('levels-check.ndjson',dir), scan.ndjson);
const preview = await workbook.render({sheetName:'Команды',range:'A1:G14',scale:1,format:'png'});
await fs.writeFile(new URL('preview-teams-levels.png',dir),new Uint8Array(await preview.arrayBuffer()));
await (await SpreadsheetFile.exportXlsx(workbook)).save(fileURLToPath(outputPath));
console.log(JSON.stringify({file:fileURLToPath(outputPath),teams:scores.length,levels:levels.length*2,replacedComments,unrelatedValuesPreserved:true,wrapText:false,formulaErrors:scan.ndjson}));
