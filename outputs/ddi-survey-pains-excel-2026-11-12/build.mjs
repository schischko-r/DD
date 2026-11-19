import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';

const root = new URL('../../', import.meta.url);
const out = new URL('.', import.meta.url);
const read = async file => JSON.parse(await fs.readFile(new URL(file, root), 'utf8'));
const source = await read('outputs/ddi-q3-survey-export-2026-11-11/responses.json');
const report = await read('outputs/ddi-survey-pains-q3-2026-11-11/reviewed.json');
const htmlData = await read('outputs/ddi-survey-pains-q3-2026-11-11/report-app/src/data.json');
for (const file of source.files) {
  assert.equal(createHash('sha256').update(await fs.readFile(new URL(file.file, root))).digest('hex'), file.sha256, file.file);
}
assert.equal(source.errors.length, 0);
assert.deepEqual(htmlData.queries.team_pains.rows, report.analysis.teamRows);
const definitions = [
  ['Жалобы на T2M витрин', 'Трудоемкий процесс вывода витрин'],
  ['Нехватка аналитических ресурсов (DA/DS/DE)', 'Нехватка аналитических ресурсов (DA/DS/DE)'],
  ['Технические ограничения BI-платформы', 'Технические ограничения BI-платформы'],
  ['Отсутствие алертов, нет авто-мониторинга', 'Отсутствие алертов, нет авто-мониторинга'],
  ['Низкая автоматизация отчетности, долгие сроки', 'Низкая автоматизация отчетности, долгие сроки'],
  ['Инструментарий платформы A/B', 'Инструментарий платформы A/B'],
  ['Низкое качество данных', 'Низкое качество данных'],
  ['Отсутствие Self-Service BI', 'Отсутствие Self-Service BI'],
  ['Другое', 'Другое'],
];
const valid = source.responses.filter(row => row.year === '2026' && row.quarter === '3' && !row.excludedByConfirmedUserInstruction);
assert.equal(valid.length, 79);
assert.equal(new Set(valid.map(row => row.payloadSha256)).size, 79);
const names = new Map(report.analysis.teamRows.map(team => [team.teamId, team.team]));
const unitOrder = ['DB', 'CBP', 'УБ', 'CX', 'Data', 'DP', 'PC', 'ДомКлик'];
valid.sort((a, b) => unitOrder.indexOf(a.canonicalTeam.unit) - unitOrder.indexOf(b.canonicalTeam.unit)
  || names.get(a.canonicalTeam.id).localeCompare(names.get(b.canonicalTeam.id), 'ru')
  || String(a.respondent).localeCompare(String(b.respondent), 'ru') || a.completedAt.localeCompare(b.completedAt));
const rows = valid.map(row => {
  assert.ok(names.has(row.canonicalTeam.id));
  assert.ok(row.respondent.trim());
  assert.ok(row.answers.support.every(label => definitions.some(([, full]) => full === label)));
  const flags = definitions.map(([, label]) => Number(row.answers.support.includes(label)));
  const comment = flags.at(-1) ? String(row.answers.supportOther || '') : '';
  assert.equal(Boolean(comment.trim()), Boolean(flags.at(-1)));
  return [row.canonicalTeam.unit, names.get(row.canonicalTeam.id), row.respondent.trim(), ...flags, comment];
});
const totals = definitions.map((_, i) => rows.reduce((sum, row) => sum + row[i + 3], 0));
assert.deepEqual(totals, [48, 42, 31, 24, 22, 19, 12, 11, 10]);
assert.equal(new Set(valid.map(row => row.canonicalTeam.id)).size, 76);
for (const team of report.analysis.teamRows) {
  const records = valid.filter(row => row.canonicalTeam.id === team.teamId);
  assert.deepEqual(definitions.slice(0, 8).map(([, label]) => Number(records.some(row => row.answers.support.includes(label)))),
    report.analysis.painDefinitions.map(def => Number(team.painIds.includes(def.id))));
}

const workbook = Workbook.create();
const sheet = workbook.worksheets.add('Боли команд');
sheet.showGridLines = false;
sheet.tabColor = '#263445';
const headers = ['Юнит', 'Команда', 'ФИО', ...definitions.map(([header]) => header), 'Комментарий (Другое)'];
const lastRow = rows.length + 6;
const area = sheet.getRange(`A2:M${lastRow}`);
area.format.font = {name: 'Arial', size: 11, color: '#25313F'};
area.format.verticalAlignment = 'center';
area.format.rowHeight = 38;
sheet.getRange('A1:M1').format.rowHeight = 10;
sheet.getRange('A2').values = [['Боли команд B2C']];
sheet.getRange('A2:M2').format.font = {name: 'Arial', size: 15, bold: true, color: '#1F2937'};
sheet.getRange('A2:M2').format.rowHeight = 28;
sheet.getRange('A3').values = [['III квартал 2026. 79 анкет, 76 команд. 1 — пункт выбран, 0 — не выбран. Одна строка — одна анкета.']];
sheet.getRange('A4').values = [['Источник: опрос DDI, ответы 15–28 октября 2026. Те же анкеты, что в HTML-отчёте по болям.']];
sheet.getRange('A3:M4').format.font = {name: 'Arial', size: 10, color: '#657184'};
sheet.getRange('A3:M4').format.rowHeight = 20;
sheet.getRange('A3:M4').format.wrapText = false;
sheet.getRange('A5:M5').format.rowHeight = 8;
sheet.getRange(`A6:M${lastRow}`).values = [headers, ...rows];
const table = sheet.tables.add(`A6:M${lastRow}`, true, 'SurveyPainResponses');
table.showFilterButton = true;
table.style = 'TableStyleLight9';
sheet.getRange(`A7:M${lastRow}`).format.wrapText = true;
sheet.getRange(`A7:M${lastRow}`).format.verticalAlignment = 'top';
sheet.getRange(`A7:C${lastRow}`).format.horizontalAlignment = 'left';
sheet.getRange(`M7:M${lastRow}`).format.horizontalAlignment = 'left';
sheet.getRange(`D7:L${lastRow}`).setNumberFormat('0');
sheet.getRange(`D7:L${lastRow}`).format.horizontalAlignment = 'center';
sheet.getRange(`D7:L${lastRow}`).format.verticalAlignment = 'center';
sheet.getRange(`D7:L${lastRow}`).conditionalFormats.add('cellIs', {
  operator: 'equal', formula: 1, format: {fill: '#E8F2FA', font: {bold: true, color: '#215C87'}},
});
sheet.dataValidations.add({range: `D7:L${lastRow}`, rule: {type: 'whole', operator: 'between', formula1: 0, formula2: 1}});
sheet.getRange(`A2:A${lastRow}`).format.columnWidth = 10;
sheet.getRange(`B2:B${lastRow}`).format.columnWidth = 36;
sheet.getRange(`C2:C${lastRow}`).format.columnWidth = 35;
sheet.getRange(`D2:K${lastRow}`).format.columnWidth = 23;
sheet.getRange(`L2:L${lastRow}`).format.columnWidth = 13;
sheet.getRange(`M2:M${lastRow}`).format.columnWidth = 76;
sheet.getRange('A6:M6').format = {
  fill: '#263445', font: {name: 'Arial', size: 11, bold: true, color: '#FFFFFF'},
  wrapText: true, horizontalAlignment: 'center', verticalAlignment: 'center', rowHeight: 58,
  borders: {insideVertical: {style: 'thin', color: '#FFFFFF'}},
};
for (let i = 0; i < rows.length; i++) {
  const textLines = Math.max(1, Math.ceil(rows[i][1].length / 32), Math.ceil(rows[i][2].length / 31), Math.ceil(rows[i][12].length / 70));
  sheet.getRange(`A${i + 7}:M${i + 7}`).format.rowHeight = Math.max(28, textLines * 14 + 6);
}
sheet.freezePanes.freezeRows(6);
sheet.freezePanes.freezeColumns(3);
workbook.recalculate();
const values = sheet.getRange(`A7:M${lastRow}`).values;
assert.deepEqual(values, rows);
assert.ok(values.every(row => row.slice(3, 12).every(flag => flag === 0 || flag === 1)));
const inspection = await workbook.inspect({kind: 'table', range: 'Боли команд!A6:M10', include: 'values,formulas', tableMaxRows: 5, tableMaxCols: 13, maxChars: 5500});
await fs.writeFile(new URL('inspection.ndjson', out), inspection.ndjson);
const errors = await workbook.inspect({kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: {useRegex: true, maxResults: 100}, summary: 'Final formula error scan'});
await fs.writeFile(new URL('error-scan.ndjson', out), errors.ndjson);
for (const [file, range] of [['preview-left.png', 'A6:G14'], ['preview-right.png', 'H6:M14']]) {
  const preview = await workbook.render({sheetName: sheet.name, range, scale: 1.5, format: 'png'});
  await fs.writeFile(new URL(file, out), new Uint8Array(await preview.arrayBuffer()));
}
const longest = rows.reduce((best, row, i) => row[12].length > rows[best][12].length ? i : best, 0) + 7;
const commentPreview = await workbook.render({sheetName: sheet.name, range: `L${longest}:M${longest}`, scale: 1.5, format: 'png'});
await fs.writeFile(new URL('preview-comment.png', out), new Uint8Array(await commentPreview.arrayBuffer()));
const file = new URL('Боли_команд_B2C_III_квартал_2026.xlsx', out);
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(fileURLToPath(file));
await fs.writeFile(new URL('rows.json', out), JSON.stringify({headers, rows, recordIds: valid.map(row => row.recordId), definitions, totals}, null, 2));
await fs.writeFile(new URL('validation.json', out), JSON.stringify({rows: rows.length, teams: 76, columns: 13, closedFlags: 8, otherFlag: 1, comments: 10, totals, range: `A6:M${lastRow}`, sourceHashes: source.files.map(({file, sha256}) => ({file, sha256})), xlsx: fileURLToPath(file)}, null, 2));
await fs.rm(file.pathname, {force: true});
await fs.rm(file.pathname + '.inspect.ndjson', {force: true});
console.log(JSON.stringify({file: fileURLToPath(file), rows: rows.length, columns: headers.length, totals, longestCommentRow: longest}, null, 2));
