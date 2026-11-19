import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';

const dir = new URL('.', import.meta.url);
const data = JSON.parse(await fs.readFile(new URL('data.json', dir), 'utf8'));
const rows = data.rows;
const products = ['СберПрайм', 'Кредитная карта'];
const periods = ['II кв. 2026', 'III кв. 2026'];
const filename = 'DDI_Прайм_и_Кредитная_карта_II_III_кварталы_2026.xlsx';
const outputPath = fileURLToPath(new URL(filename, dir));
const wb = Workbook.create();
const summary = wb.worksheets.add('Итоги');
const detail = wb.worksheets.add('Деталка');
const groups = wb.worksheets.add('Группы метрик');
const last = rows.length + 6;
const palette = {ink: '#243746', muted: '#667788', header: '#244D68', light: '#EDF3F7', green: '#E4F2EA'};

for (const sheet of [summary, detail]) {
  sheet.showGridLines = false;
  sheet.getRange(sheet === summary ? 'A1:F12' : `A1:J${last}`).format.font = {name: 'Arial', size: 10, color: palette.ink};
  sheet.getRange(sheet === summary ? 'A1:F12' : `A1:J${last}`).format.verticalAlignment = 'center';
}
summary.tabColor = palette.header;
detail.tabColor = '#6E8FA6';

function header(sheet, address) {
  sheet.getRange(address).format = {
    fill: palette.header, font: {name: 'Arial', size: 10, bold: true, color: '#FFFFFF'},
    wrapText: true, horizontalAlignment: 'center', verticalAlignment: 'center', rowHeight: 38,
    borders: {insideVertical: {style: 'thin', color: '#FFFFFF'}},
  };
}
function title(sheet, text, width) {
  sheet.getRange('A2').values = [[text]];
  sheet.getRange('A2').format.font = {name: 'Arial', size: 15, bold: true, color: palette.header};
  sheet.getRange(`A2:${width}2`).format.rowHeight = 31;
  sheet.getRange(`A2:${width}2`).format.borders = {bottom: {style: 'thin', color: '#B9CCD9'}};
}
title(summary, 'DDI: СберПрайм и кредитная карта', 'F');
summary.getRange('A3').values = [['II и III кварталы 2026']];
summary.getRange('A3:F3').format.font = {name: 'Arial', size: 10, color: palette.muted};
summary.getRange('A5:F5').values = [[
  'Продукт', 'Период', 'Баллы', 'Макс. балл', 'Процент', 'DDI в отчёте',
]];
header(summary, 'A5:F5');
const reference = column => `'Деталка'!$${column}$7:$${column}$${last}`;
const summaryAudit = [];
let summaryRow = 6;
for (const product of products) {
  for (const period of periods) {
    const total = data.totals.find(item => item.product === product && item.period === period);
    assert.ok(total, `Missing source total: ${product}, ${period}`);
    const relevant = rows.filter(row => row.product === product && row.period === period && row.inIndex);
    assert.ok(relevant.length > 0);
    assert.ok(relevant.every(row => Number.isFinite(row.value) && Number.isFinite(row.maxValue)));
    const earned = relevant.reduce((sum, row) => sum + row.value, 0);
    const maximum = relevant.reduce((sum, row) => sum + row.maxValue, 0);
    assert.ok(Math.abs(earned - total.value) < 1e-9);
    assert.ok(Math.abs(maximum - total.maxValue) < 1e-9);
    const r = summaryRow++;
    const published = Number.isFinite(total.publishedScore) ? total.publishedScore : total.ddiPercent;
    assert.equal(Math.round(earned / maximum * 100), published, 'Published DDI must reconcile with detail');
    summary.getRange(`A${r}:F${r}`).values = [[product, period, null, null, null, null]];
    const conditions = `${reference('A')},$A${r},${reference('B')},$B${r},${reference('I')},"Да"`;
    summary.getRange(`C${r}:F${r}`).formulas = [[
      `=SUMIFS(${reference('F')},${conditions})`, `=SUMIFS(${reference('G')},${conditions})`, `=C${r}/D${r}`, `=ROUND(E${r}*100,0)/100`,
    ]];
    if (product === products[1]) summary.getRange(`A${r}:F${r}`).format.fill = palette.light;
    summaryAudit.push({product, period, row: r, earned, maximum, ratio: earned / maximum, published});
  }
}
summary.getRange('C6:D9').setNumberFormat('0.00');
summary.getRange('E6:E9').setNumberFormat('0.0%');
summary.getRange('F6:F9').setNumberFormat('0%');
summary.getRange('C6:F9').format.horizontalAlignment = 'right';
summary.getRange('F6:F9').format.font = {name: 'Arial', size: 10, bold: true, color: '#245F43'};
summary.getRange('A6:F9').format.rowHeight = 32;
summary.getRange('A11').values = [['Баллы и максимум суммируются по критериям с отметкой «Да» на листе «Деталка».']];
summary.getRange('A12').values = [['Процент = баллы / максимум. DDI в отчёте показан с округлением до целого процента.']];
summary.getRange('A11:F12').format.font = {name: 'Arial', size: 10, color: palette.muted};
for (const [col, width] of Object.entries({A: 27, B: 18, C: 13, D: 14, E: 14, F: 16})) {
  summary.getRange(`${col}1:${col}12`).format.columnWidth = width;
}

title(detail, 'DDI: критерии и методология', 'I');
detail.getRange('A3').values = [['Источники: текущий отчёт DDI на 19.11.2026; методология раздела «О Data Driven», профиль «Продукт».']];
detail.getRange('A4').values = [['«Нет» в расчёте DDI: информационный, неприменимый или исключённый критерий. Пустая оценка не заменяется нулём. Цвет — по округлённому проценту.']];
detail.getRange('A3:I4').format.font = {name: 'Arial', size: 10, color: palette.muted};
detail.getRange('A6:J6').values = [[
  'Продукт', 'Период (квартал)', 'Группа метрик', 'Критерий', 'Методология',
  'Баллы в квартале', 'Макс. балл в квартале', 'Процент', 'В расчёте DDI', 'Светофор',
]];
const values = rows.map(row => [
  row.product, row.period, row.group, row.criterion, row.methodology,
  Number.isFinite(row.value) ? row.value : 'Нет данных', Number.isFinite(row.maxValue) ? row.maxValue : 'Нет данных',
  null, row.inIndex ? 'Да' : 'Нет', null,
]);
detail.getRange(`A7:J${last}`).values = values;
const formulas = rows.map((row, index) => {
  const r = index + 7;
  if (row.applicable === false || row.maxValue === 0) return ['="Не применимо"'];
  return [`=IF(OR(NOT(ISNUMBER(F${r})),NOT(ISNUMBER(G${r}))),"Нет данных",IF(G${r}=0,"Не применимо",F${r}/G${r}))`];
});
detail.getRange(`H7:H${last}`).formulas = formulas;
const table = detail.tables.add(`A6:J${last}`, true, 'DdiMetricDetails');
table.showBandedRows = false;
table.showFilterButton = true;
header(detail, 'A6:J6');
for (const [col, width] of Object.entries({A: 25, B: 17, C: 30, D: 43, E: 100, F: 14, G: 15, H: 15, I: 15, J: 24})) {
  detail.getRange(`${col}1:${col}${last}`).format.columnWidth = width;
}
detail.getRange(`C7:E${last}`).format.wrapText = true;
detail.getRange(`A7:I${last}`).format.verticalAlignment = 'top';
detail.getRange(`F7:G${last}`).setNumberFormat('0.00');
detail.getRange(`H7:H${last}`).setNumberFormat('0.0%');
detail.getRange(`F7:H${last}`).format.horizontalAlignment = 'right';
detail.getRange(`I7:I${last}`).format.horizontalAlignment = 'center';
let previousKey = '';
for (let index = 0; index < rows.length; index++) {
  const row = rows[index], r = index + 7;
  const lineCount = Math.max(...[row.criterion, row.methodology, row.group].map((text, i) =>
    String(text).split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / [40, 94, 27][i])), 0)));
  detail.getRange(`A${r}:I${r}`).format.rowHeight = Math.min(400, Math.max(35, lineCount * 13 + 10));
  const key = `${row.product}|${row.period}`;
  if (row.period === periods[1]) detail.getRange(`A${r}:I${r}`).format.fill = '#F2F6F9';
  if (key !== previousKey) detail.getRange(`A${r}:I${r}`).format.borders = {top: {style: 'medium', color: '#B9CCD9'}};
  if (!row.inIndex) detail.getRange(`I${r}`).format.font = {name: 'Arial', size: 10, color: palette.muted};
  previousKey = key;
}
detail.freezePanes.freezeRows(6);
detail.freezePanes.freezeColumns(2);

detail.getRange('F2').values = [['Пороги, %']];
detail.getRange('F2').format.font = {name: 'Arial', size: 10, bold: true, color: palette.header};
detail.getRange('G3:H3').values = [['От, %', 'По, %']];
detail.getRange('G3:H3').format = {font: {name: 'Arial', size: 10, bold: true, color: palette.ink}, horizontalAlignment: 'center'};
detail.getRange('F4:H5').values = [['Жёлтый', 61, 80], ['Зелёный', 81, 100]];
detail.getRange('F4').format.fill = '#FFF1C2';
detail.getRange('F5').format.fill = '#E4F2EA';
detail.getRange('F4:F5').format.font = {name: 'Arial', size: 10, bold: true, color: palette.ink};
detail.getRange('F4:H5').format.rowHeight = 25;
detail.getRange('G4:H5').format = {fill: '#FFF2CC', font: {name: 'Arial', size: 10, bold: true, color: palette.ink},
  numberFormat: '0', horizontalAlignment: 'center', borders: {preset: 'all', style: 'thin', color: '#D1AC52'}};
detail.getRange('G4:H5').dataValidation = {rule: {type: 'whole', operator: 'between', formula1: 0, formula2: 100}};
detail.getRange('I3').formulas = [[
  '=IF(COUNT(G4:H5)<>4,"Заполните границы",IF(OR(MIN(G4:H5)<0,MAX(G4:H5)>100,G4>H4,G5>H5,MOD(G4,1)<>0,MOD(H4,1)<>0,MOD(G5,1)<>0,MOD(H5,1)<>0),"Проверьте границы",IF(AND(G4<=H5,G5<=H4),"Диапазоны пересекаются","")))',
]];
detail.getRange('I3').format = {wrapText: true, font: {name: 'Arial', size: 10, color: '#B33434'}};
detail.getRange('A3:J3').format.rowHeight = 28;
detail.getRange(`J7:J${last}`).format.verticalAlignment = 'top';
detail.getRange(`J7:J${last}`).formulas = rows.map((row, index) => {
  const r = index + 7;
  return [`=IF($I$3<>"","Проверьте границы",IF(NOT(ISNUMBER(H${r})),H${r},IF(AND(ROUND(H${r}*100,0)>=$G$5,ROUND(H${r}*100,0)<=$H$5),"● Зелёный",IF(AND(ROUND(H${r}*100,0)>=$G$4,ROUND(H${r}*100,0)<=$H$4),"● Жёлтый","● Красный"))))`];
});
for (const [text, fill, color] of [['Зелёный', '#E4F2EA', '#237348'], ['Жёлтый', '#FFF1C2', '#876316'], ['Красный', '#FBE6E6', '#AF3434']]) {
  const format = {fill, font: {bold: true, color}};
  detail.getRange(`J7:J${last}`).conditionalFormats.add('containsText', {text, format});
}

const groupAudit = [];
for (const period of periods) for (const product of products) {
  const names = [...new Set(rows.filter(row => row.product === product && row.period === period).map(row => row.group))];
  for (const group of names) {
    const metrics = rows.filter(row => row.product === product && row.period === period && row.group === group && row.inIndex);
    groupAudit.push({period, product, group,
      earned: metrics.reduce((sum, metric) => sum + metric.value, 0),
      maximum: metrics.reduce((sum, metric) => sum + metric.maxValue, 0)});
  }
}
const groupLast = groupAudit.length + 9;
groups.showGridLines = false;
groups.tabColor = '#3D7862';
groups.getRange(`A1:G${groupLast}`).format.font = {name: 'Arial', size: 10, color: palette.ink};
groups.getRange(`A1:G${groupLast}`).format.verticalAlignment = 'center';
title(groups, 'DDI по группам метрик', 'G');
groups.getRange('A3').values = [['II и III кварталы 2026. Измените границы в выделенных ячейках.']];
groups.getRange('A3:G3').format.font = {name: 'Arial', size: 10, color: palette.muted};
groups.getRange('A4:F5').values = [
  ['Жёлтый', 'От, %', 'По, %', 'Зелёный', 'От, %', 'По, %'],
  [null, 61, 80, null, 81, 100],
];
groups.getRange('A4:C4').format.fill = '#FFF1C2';
groups.getRange('D4:F4').format.fill = '#E4F2EA';
groups.getRange('A4:F4').format.font = {name: 'Arial', size: 10, bold: true, color: palette.ink};
groups.getRange('A4:F5').format.rowHeight = 27;
for (const address of ['B5:C5', 'E5:F5']) {
  groups.getRange(address).format = {fill: '#FFF2CC', font: {name: 'Arial', size: 10, bold: true, color: palette.ink},
    numberFormat: '0', horizontalAlignment: 'center', borders: {preset: 'outside', style: 'thin', color: '#D1AC52'}};
  groups.getRange(address).dataValidation = {rule: {type: 'whole', operator: 'between', formula1: 0, formula2: 100}};
}
groups.getRange('G5').formulas = [[
  '=IF(COUNT(B5:C5,E5:F5)<>4,"Заполните границы",IF(OR(MIN(B5:C5,E5:F5)<0,MAX(B5:C5,E5:F5)>100,B5>C5,E5>F5,MOD(B5,1)<>0,MOD(C5,1)<>0,MOD(E5,1)<>0,MOD(F5,1)<>0),"Проверьте границы",IF(AND(B5<=F5,E5<=C5),"Диапазоны пересекаются","")))',
]];
groups.getRange('G5').format = {wrapText: true, font: {name: 'Arial', size: 10, color: '#B33434'}};
groups.getRange('A7').values = [['Процент округлён до целого. Вне жёлтого и зелёного диапазонов — красный.']];
groups.getRange('A7:G7').format.font = {name: 'Arial', size: 10, color: palette.muted};
groups.getRange('A9:G9').values = [[
  'Квартал', 'Команда', 'Группа метрик', 'Сумма баллов', 'Сумма макс. баллов', '%', 'Светофор',
]];
groups.getRange(`A10:G${groupLast}`).values = groupAudit.map(item => [item.period, item.product, item.group, null, null, null, null]);
for (const [index, item] of groupAudit.entries()) {
  const r = index + 10;
  const conditions = `${reference('B')},$A${r},${reference('A')},$B${r},${reference('C')},$C${r},${reference('I')},"Да"`;
  groups.getRange(`D${r}:G${r}`).formulas = [[
    `=SUMIFS(${reference('F')},${conditions})`, `=SUMIFS(${reference('G')},${conditions})`,
    `=IF(E${r}=0,"Не применимо",ROUND(D${r}/E${r}*100,0)/100)`,
    `=IF($G$5<>"","Проверьте границы",IF(NOT(ISNUMBER(F${r})),"Не применимо",IF(AND(F${r}>=$E$5/100,F${r}<=$F$5/100),"● Зелёный",IF(AND(F${r}>=$B$5/100,F${r}<=$C$5/100),"● Жёлтый","● Красный"))))`,
  ]];
  groups.getRange(`A${r}:G${r}`).format.rowHeight = 32;
  if (item.period === periods[1]) groups.getRange(`A${r}:G${r}`).format.fill = palette.light;
  if (index === 0 || item.product !== groupAudit[index - 1].product || item.period !== groupAudit[index - 1].period) {
    groups.getRange(`A${r}:G${r}`).format.borders = {top: {style: 'medium', color: '#B9CCD9'}};
  }
}
const groupTable = groups.tables.add(`A9:G${groupLast}`, true, 'DdiGroupTotals');
groupTable.showFilterButton = true;
groupTable.showBandedRows = false;
header(groups, 'A9:G9');
for (const [col, width] of Object.entries({A: 18, B: 26, C: 33, D: 17, E: 21, F: 16, G: 24})) {
  groups.getRange(`${col}1:${col}${groupLast}`).format.columnWidth = width;
}
groups.getRange(`D10:E${groupLast}`).setNumberFormat('0.00');
groups.getRange(`F10:F${groupLast}`).setNumberFormat('0%');
groups.getRange(`D10:F${groupLast}`).format.horizontalAlignment = 'right';
groups.getRange(`C10:C${groupLast}`).format.wrapText = true;
for (const [text, fill, color] of [['Зелёный', '#E4F2EA', '#237348'], ['Жёлтый', '#FFF1C2', '#876316'], ['Красный', '#FBE6E6', '#AF3434']]) {
  groups.getRange(`G10:G${groupLast}`).conditionalFormats.add('containsText', {text, format: {fill, font: {bold: true, color}}});
}
groups.freezePanes.freezeRows(9);
groups.freezePanes.freezeColumns(2);

wb.recalculate();
const changeIndex = rows.findIndex(row => row.inIndex && row.value + 0.05 <= row.maxValue);
assert.ok(changeIndex >= 0);
const changedSource = rows[changeIndex];
const changedTotal = summaryAudit.find(item => item.product === changedSource.product && item.period === changedSource.period);
detail.getRange(`F${changeIndex + 7}`).values = [[changedSource.value + 0.05]];
wb.recalculate();
assert.ok(Math.abs(summary.getRange(`C${changedTotal.row}`).values[0][0] - (changedTotal.earned + 0.05)) < 1e-8);
assert.ok(Math.abs(detail.getRange(`H${changeIndex + 7}`).values[0][0] - (changedSource.value + 0.05) / changedSource.maxValue) < 1e-8);
detail.getRange(`F${changeIndex + 7}`).values = [[changedSource.value]];
wb.recalculate();
for (const [index, item] of groupAudit.entries()) {
  const [earned, maximum, ratio] = groups.getRange(`D${index + 10}:F${index + 10}`).values[0];
  assert.ok(Math.abs(earned - item.earned) < 1e-8 && Math.abs(maximum - item.maximum) < 1e-8);
  if (maximum > 0) assert.ok(Math.abs(ratio - Math.round(item.earned / item.maximum * 100) / 100) < 1e-8);
}
// Exercise a representative row and every inclusive boundary, then restore its formulas and controls.
const savedGroupFormula = groups.getRange('F10').formulas[0][0];
const thresholdCases = [];
for (const [percent, expected] of [[60, 'Красный'], [61, 'Жёлтый'], [80, 'Жёлтый'], [81, 'Зелёный'], [100, 'Зелёный']]) {
  groups.getRange('F10').values = [[percent / 100]];
  wb.recalculate();
  const status = groups.getRange('G10').values[0][0];
  assert.ok(status.includes(expected), `${percent}% should be ${expected}, got ${status}`);
  thresholdCases.push({percent, expected});
}
groups.getRange('F10').values = [[0.60]];
groups.getRange('B5').values = [[60]];
wb.recalculate();
assert.ok(groups.getRange('G10').values[0][0].includes('Жёлтый'));
groups.getRange('B5').values = [[61]];
groups.getRange('F10').values = [[0.71]];
groups.getRange('C5').values = [[70]];
wb.recalculate();
assert.ok(groups.getRange('G10').values[0][0].includes('Красный'));
groups.getRange('C5').values = [[80]];
groups.getRange('F10').values = [[0.81]];
groups.getRange('E5').values = [[90]];
wb.recalculate();
assert.ok(groups.getRange('G10').values[0][0].includes('Красный'));
groups.getRange('E5').values = [[81]];
groups.getRange('F10').values = [[0.93]];
groups.getRange('F5').values = [[90]];
wb.recalculate();
assert.ok(groups.getRange('G10').values[0][0].includes('Красный'));
groups.getRange('F5').values = [[100]];
wb.recalculate();
assert.ok(groups.getRange('G10').values[0][0].includes('Зелёный'));
groups.getRange('C5').values = [[81]];
wb.recalculate();
assert.equal(groups.getRange('G5').values[0][0], 'Диапазоны пересекаются');
assert.equal(groups.getRange('G10').values[0][0], 'Проверьте границы');
groups.getRange('C5').values = [[80]];
groups.getRange('E5').values = [[101]];
wb.recalculate();
assert.equal(groups.getRange('G5').values[0][0], 'Проверьте границы');
groups.getRange('E5').values = [[81]];
groups.getRange('B5').values = [[61.5]];
wb.recalculate();
assert.equal(groups.getRange('G5').values[0][0], 'Проверьте границы');
assert.equal(groups.getRange('G10').values[0][0], 'Проверьте границы');
groups.getRange('B5').values = [[61]];
groups.getRange('F10').formulas = [[savedGroupFormula]];
wb.recalculate();
assert.equal(groups.getRange('G5').values[0][0], '');
const savedDetailFormula = detail.getRange('H7').formulas[0][0];
for (const [percent, expected] of [[60, 'Красный'], [61, 'Жёлтый'], [80, 'Жёлтый'], [81, 'Зелёный'], [100, 'Зелёный']]) {
  detail.getRange('H7').values = [[percent / 100]];
  wb.recalculate();
  assert.ok(detail.getRange('J7').values[0][0].includes(expected));
}
for (const [address, changed, percent, expected] of [['G4', 60, 60, 'Жёлтый'], ['H4', 70, 71, 'Красный'], ['G5', 90, 81, 'Красный'], ['H5', 90, 93, 'Красный']]) {
  const original = detail.getRange(address).values[0][0];
  detail.getRange(address).values = [[changed]];
  detail.getRange('H7').values = [[percent / 100]];
  wb.recalculate();
  assert.ok(detail.getRange('J7').values[0][0].includes(expected));
  assert.deepEqual(groups.getRange('B5:C5').values, [[61, 80]]);
  assert.deepEqual(groups.getRange('E5:F5').values, [[81, 100]]);
  detail.getRange(address).values = [[original]];
}
for (const [address, changed] of [['G4', 61.5], ['G5', 101], ['H4', 81]]) {
  const original = detail.getRange(address).values[0][0];
  detail.getRange(address).values = [[changed]];
  wb.recalculate();
  assert.ok(detail.getRange('I3').values[0][0]);
  assert.equal(detail.getRange('J7').values[0][0], 'Проверьте границы');
  detail.getRange(address).values = [[original]];
}
for (const marker of ['Нет данных', 'Не применимо']) {
  detail.getRange('H7').values = [[marker]];
  wb.recalculate();
  assert.equal(detail.getRange('J7').values[0][0], marker);
}
detail.getRange('H7').formulas = [[savedDetailFormula]];
wb.recalculate();
assert.equal(detail.getRange('I3').values[0][0], '');
for (const item of summaryAudit) {
  const actual = summary.getRange(`C${item.row}:F${item.row}`).values[0];
  for (const [index, expected] of [item.earned, item.maximum, item.ratio, item.published / 100].entries()) {
    assert.ok(typeof actual[index] === 'number' && Math.abs(actual[index] - expected) < 1e-8,
      `${item.product} / ${item.period}: expected ${expected}, got ${actual[index]}`);
  }
}
const inspection = await wb.inspect({kind: 'table', range: 'Итоги!A5:F9', include: 'values,formulas', tableMaxRows: 5, tableMaxCols: 6, maxChars: 4500});
await fs.writeFile(new URL('inspection.ndjson', dir), inspection.ndjson);
const errors = await wb.inspect({kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: {useRegex: true, maxResults: 100}, maxChars: 2000});
await fs.writeFile(new URL('error-scan.ndjson', dir), errors.ndjson);
for (const [sheetName, range, name] of [['Итоги', 'A1:F12', 'preview-summary.png'], ['Деталка', 'A1:J13', 'preview-detail.png'], ['Деталка', 'F1:J13', 'preview-detail-signals.png'], ['Группы метрик', 'A1:G18', 'preview-groups.png']]) {
  const preview = await wb.render({sheetName, range, scale: 1.5, format: 'png'});
  await fs.writeFile(new URL(name, dir), new Uint8Array(await preview.arrayBuffer()));
}
const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(outputPath);
await fs.writeFile(new URL('build-validation.json', dir), JSON.stringify({sheets: ['Итоги', 'Деталка', 'Группы метрик'], detailRows: rows.length, recalculationChangeAndRestore: true, totals: summaryAudit,
  groupTotals: groupAudit, thresholdCases, thresholdEditRecalculated: true, invalidThresholdsBlocked: true,
  detailThresholdEditRecalculated: true, detailThresholdIndependent: true, detailMissingAndNaNeutral: true}, null, 2));
console.log(JSON.stringify({file: outputPath, detailRows: rows.length, groupRows: groupAudit.length, totals: summaryAudit}));
