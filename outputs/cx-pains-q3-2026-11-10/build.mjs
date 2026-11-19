import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const dir = path.dirname(fileURLToPath(import.meta.url));
const rows = JSON.parse(await fs.readFile(path.join(dir, 'rows.json'), 'utf8'));
const workbook = Workbook.create();
const sheet = workbook.worksheets.add('Боли CX — III кв. 2026');
sheet.showGridLines = false;
sheet.tabColor = '#245745';
const endRow = 6 + rows.length;
sheet.getRange(`A1:D${endRow}`).format.font = {name: 'Arial', size: 11, color: '#202A35'};
sheet.getRange('A2').values = [['Боли команд CX — III квартал 2026']];
sheet.getRange('A2').format.font = {name: 'Arial', size: 16, bold: true, color: '#245745'};
sheet.getRange('A2:D2').format.rowHeight = 29;
sheet.getRange('A3').values = [['11 команд. Пустой комментарий — текст не указан в анкете.']];
sheet.getRange('A3').format.font = {name: 'Arial', size: 10, color: '#66737C'};
sheet.getRange('A4').values = [['Источник: ddi_3q_response/questionare-responses(11).csv и (12).csv; поля support и supportOther.']];
sheet.getRange('A4').format.font = {name: 'Arial', size: 10, color: '#66737C'};
const headers = ['Юнит', 'Команда', 'Выбранные боли', 'Комментарий'];
const data = rows.map(row => [row.unit, row.team, row.selected.join('\n'), row.comment || null]);
sheet.getRange(`A6:D${endRow}`).values = [headers, ...data];
const table = sheet.tables.add(`A6:D${endRow}`, true, 'CXPainsQ32026');
table.showFilterButton = true;
sheet.getRange('A6:D6').format = {
  fill: '#245745', font: {name: 'Arial', size: 11, bold: true, color: '#FFFFFF'},
  horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true, rowHeight: 30,
  borders: {insideVertical: {style: 'thin', color: '#FFFFFF'}},
};
sheet.getRange(`A7:D${endRow}`).format.verticalAlignment = 'top';
sheet.getRange(`A7:D${endRow}`).format.wrapText = true;
sheet.getRange(`A1:A${endRow}`).format.columnWidth = 10;
sheet.getRange(`B1:B${endRow}`).format.columnWidth = 31;
sheet.getRange(`C1:C${endRow}`).format.columnWidth = 61;
sheet.getRange(`D1:D${endRow}`).format.columnWidth = 53;
for (let i = 0; i < rows.length; i++) {
  const row = i + 7;
  if (i % 2 === 0) sheet.getRange(`A${row}:D${row}`).format.fill = '#F1F6F3';
  sheet.getRange(`A${row}:D${row}`).format.rowHeight = Math.max(46, rows[i].selected.length * 17 + 18);
}
sheet.freezePanes.freezeRows(6);
workbook.recalculate();
assert.deepEqual(sheet.getRange(`A7:D${endRow}`).values.map(r => r.map(v => v ?? '')), data.map(r => r.map(v => v ?? '')));
const inspection = await workbook.inspect({kind: 'table', range: `'${sheet.name}'!A6:D${endRow}`, include: 'values,formulas', tableMaxRows: 12, tableMaxCols: 4, tableMaxCellChars: 500, maxChars: 12000});
await fs.writeFile(path.join(dir, 'inspection.ndjson'), inspection.ndjson);
const errors = await workbook.inspect({kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: {useRegex: true, maxResults: 20}, maxChars: 2000});
await fs.writeFile(path.join(dir, 'formula-errors.ndjson'), errors.ndjson);
const preview = await workbook.render({sheetName: sheet.name, range: `A1:D${endRow}`, scale: 1.4, format: 'png'});
await fs.writeFile(path.join(dir, 'preview.png'), new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
const file = path.join(dir, 'Боли_команд_CX_III_квартал_2026.xlsx');
await output.save(file);
console.log(JSON.stringify({output: file, teams: rows.length, formulaScan: errors.ndjson}));
