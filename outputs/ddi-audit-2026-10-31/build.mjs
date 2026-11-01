import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';

const dir = fileURLToPath(new URL('./', import.meta.url));
const data = JSON.parse(await fs.readFile(new URL('workbook-data.json', import.meta.url), 'utf8'));
const workbook = Workbook.create();
const summary = workbook.worksheets.add('Команды');
const details = workbook.worksheets.add('Метрики');
const headerRow = 6, first = 7;
const summaryHeaders = ['Юнит', 'Команда', 'Старый балл\nII кв. 2026', 'Новый балл\nIII кв. 2026', 'Аплифт, п.п.'];
const detailHeaders = ['Юнит', 'Команда', 'Группа метрик', 'Метрика', 'Откуда берём', 'Старый балл\nII кв. 2026', 'Новый балл\nIII кв. 2026', 'Аплифт, п.п.', 'Вопрос в опросе', 'Варианты ответа', 'Что ответил пользователь', 'Комментарий и материалы', 'ФИО проходившего опрос'];
const summaryRows = data.summaries.map(r => [r.unit, r.team, r.oldScore, r.newScore, null]);
const detailRows = data.details.map(r => [r.unit, r.team, r.group, r.metric, r.source, r.oldScore, r.newScore, null, r.question, r.options, r.answer, r.comment, r.respondent]);
for (const row of [...summaryRows, ...detailRows]) for (const value of row) if (typeof value === 'string') assert.ok(value.length <= 32767, 'Excel cell character limit');

function makeSheet(sheet, headers, rows, endCol, title, note, tableName) {
  const last = headerRow + rows.length;
  sheet.showGridLines = false;
  sheet.getRange(`A2:${endCol}${last}`).format.font = {name: 'Arial', size: 10, color: '#203246'};
  sheet.getRange(`A2:${endCol}${last}`).format.verticalAlignment = 'center';
  sheet.getRange('A2').values = [[title]];
  sheet.getRange('A2').format.font = {name: 'Arial', size: 15, bold: true, color: '#17324D'};
  sheet.getRange(`A3:${endCol}3`).format.borders = {bottom: {style: 'thin', color: '#CBD5DF'}};
  sheet.getRange('A4').values = [[note]];
  sheet.getRange('A4').format.font = {name: 'Arial', size: 10, italic: true, color: '#52657A'};
  sheet.getRange(`A${headerRow}:${endCol}${headerRow}`).values = [headers];
  sheet.getRangeByIndexes(headerRow, 0, rows.length, headers.length).values = rows;
  const table = sheet.tables.add(`A${headerRow}:${endCol}${last}`, true, tableName);
  table.style = 'TableStyleMedium2';
  const header = sheet.getRange(`A${headerRow}:${endCol}${headerRow}`);
  header.format = {fill: '#17324D', font: {name: 'Arial', size: 10, bold: true, color: '#FFFFFF'},
    wrapText: true, horizontalAlignment: 'center', verticalAlignment: 'center', rowHeight: 38};
  header.format.borders = {insideVertical: {style: 'thin', color: '#FFFFFF'}};
  sheet.getRange(`A${first}:${endCol}${last}`).format.wrapText = true;
  sheet.freezePanes.freezeRows(headerRow);
  sheet.freezePanes.freezeColumns(2);
  return last;
}
const lastSummary = makeSheet(summary, summaryHeaders, summaryRows, 'E', 'DDI: оценки команд', 'Баллы в процентах. Аплифт = III квартал − II квартал, в процентных пунктах.', 'TeamScores');
const lastDetail = makeSheet(details, detailHeaders, detailRows, 'M', 'DDI: метрики и ответы', 'II и III кварталы 2026. Пустой балл означает отсутствие отдельной оценки или неприменимость; пояснение — в комментарии.', 'MetricScores');
summary.tabColor = '#17324D';
details.tabColor = '#54799C';
for (const [col, width] of [['A',14],['B',42],['C',19],['D',19],['E',20]]) summary.getRange(`${col}:${col}`).format.columnWidth = width;
const widths = [14,36,30,47,25,17,17,18,66,58,75,120,43];
for (let i = 0; i < widths.length; i++) details.getRange(`${String.fromCharCode(65+i)}:${String.fromCharCode(65+i)}`).format.columnWidth = widths[i];
summary.getRange(`C${first}:D${lastSummary}`).setNumberFormat('0.0%');
details.getRange(`F${first}:G${lastDetail}`).setNumberFormat('0.0%');
const upliftFormat = '+0.0" п.п.";-0.0" п.п.";0.0" п.п."';
summary.getRange(`E${first}:E${lastSummary}`).setNumberFormat(upliftFormat);
details.getRange(`H${first}:H${lastDetail}`).setNumberFormat(upliftFormat);
summary.getRange(`C${first}:E${lastSummary}`).format.horizontalAlignment = 'right';
details.getRange(`F${first}:H${lastDetail}`).format.horizontalAlignment = 'right';
summary.getRange(`E${first}:E${lastSummary}`).formulas = summaryRows.map((_, i) => [`=(D${first+i}-C${first+i})*100`]);
details.getRange(`H${first}:H${lastDetail}`).formulas = detailRows.map((_, i) => [`=IF(AND(ISNUMBER(F${first+i}),ISNUMBER(G${first+i})),(G${first+i}-F${first+i})*100,"")`]);
for (const [sheet, col, last] of [[summary,'E',lastSummary],[details,'H',lastDetail]]) {
  const range = sheet.getRange(`${col}${first}:${col}${last}`);
  range.conditionalFormats.add('cellIs', {operator:'greaterThan',formula:0,format:{font:{color:'#167042'},fill:'#EAF6ED'}});
  range.conditionalFormats.add('cellIs', {operator:'lessThan',formula:0,format:{font:{color:'#B52842'},fill:'#FFF0F1'}});
}
summary.getRange(`A${first}:E${lastSummary}`).format.rowHeight = 32;
details.getRange(`A${first}:M${lastDetail}`).format.verticalAlignment = 'top';
// Fit variable survey text rather than discarding or abbreviating attachments.
for (let i = 0; i < detailRows.length; i++) {
  const row = detailRows[i];
  const lines = row.map((value, j) => typeof value === 'string'
    ? value.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / (widths[j] * 0.85))), 0) : 1);
  details.getRange(`A${first+i}:M${first+i}`).format.rowHeight = Math.min(409, Math.max(32, Math.max(...lines) * 13 + 10));
}
// Check that editable input cells recalculate their displayed uplift, then restore.
const saved = summary.getRange('D7').values[0][0];
summary.getRange('D7').values = [[saved + 0.01]];
assert.ok(Math.abs(summary.getRange('E7').values[0][0] - ((saved + 0.01) - summaryRows[0][2]) * 100) < 1e-8);
summary.getRange('D7').values = [[saved]];
workbook.recalculate();
for (let i = 0; i < summaryRows.length; i++) assert.ok(Math.abs(summary.getRange(`E${first+i}`).values[0][0] - (summaryRows[i][3]-summaryRows[i][2])*100) < 1e-8);
for (const i of [0,Math.floor(detailRows.length/2),detailRows.length-1]) {
  const [old,now] = detailRows[i].slice(5,7), expected = Number.isFinite(old) && Number.isFinite(now) ? (now-old)*100 : '';
  assert.equal(typeof details.getRange(`H${first+i}`).values[0][0], typeof expected);
  if (typeof expected === 'number') assert.ok(Math.abs(details.getRange(`H${first+i}`).values[0][0]-expected)<1e-8);
}
const errorScan = await workbook.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},maxChars:3000});
await fs.writeFile(`${dir}/formula-errors.ndjson`, errorScan.ndjson);
const inspected = await workbook.inspect({kind:'region',sheetId:'Команды',range:'A6:E12',tableMaxRows:7,tableMaxCols:5,maxChars:2500});
await fs.writeFile(`${dir}/inspect.ndjson`, inspected.ndjson);
for (const [sheetName,range,file] of [['Команды','A1:E14','preview-teams.png'],['Метрики','A1:H9','preview-metrics-scores.png'],['Метрики','I6:M9','preview-metrics-evidence.png']]) {
  const preview = await workbook.render({sheetName,range,scale:1,format:'png'});
  await fs.writeFile(`${dir}/${file}`,new Uint8Array(await preview.arrayBuffer()));
}
const outputPath = `${dir}/DDI_II_III_2026_команды_и_метрики.xlsx`;
await (await SpreadsheetFile.exportXlsx(workbook)).save(outputPath);
console.log(JSON.stringify({file:outputPath,teams:summaryRows.length,metrics:detailRows.length,formulaErrorScan:errorScan.ndjson}));
