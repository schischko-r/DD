import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';
import {buildDdiPeriodProducts, Q3_DB_TEAMS} from '../../gravity-app/src/domain/quarterProfiles.js';
import {displayProductName} from '../../gravity-app/src/domain/report.js';
import {displayMetricPercent} from '../../gravity-app/src/domain/metricPresentation.js';
import {GOALS_FINAL_COUNTERPARTS} from '../../gravity-app/src/domain/goalsFinalScores.js';

const root = new URL('../../', import.meta.url), dir = new URL('.', import.meta.url);
const read = async path => JSON.parse(await fs.readFile(new URL(path, root), 'utf8'));
const report = await read('gravity-app/public/report-data.json');
const app = await fs.readFile(new URL('gravity-app/src/app/App.jsx', root), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlayNames = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(x => imports.get(x.trim()));
assert.ok(overlayNames.every(Boolean));
const overlays = await Promise.all(overlayNames.map(name => read('gravity-app/src/data/' + name)));
const args = await Promise.all(['salary-products', 'reporting-regularity-missing', 'funnel-action-missing'].map(name => read(`gravity-app/src/data/${name}-q3-2026.json`)));
const previousRows = (await read('outputs/db-q3-export-2026-11-18/data.json')).rows;
const baseProducts = buildDdiPeriodProducts(report.products, 'III кв. 2026', overlays, ...args, await read('gravity-app/public/backlog-data.json'))
  .filter(p => p.unit === 'DB').sort((a,b) => a.name.localeCompare(b.name, 'ru'));
assert.deepEqual(baseProducts.map(p => p.name).sort(), [...Q3_DB_TEAMS].sort());
const products = baseProducts.flatMap(p => {
  if (p.name !== 'Зарплатный продукт') return [p];
  assert.ok(p.salaryCohorts?.b2c && p.salaryCohorts?.b2b);
  const cohorts = ['b2c','b2b'].map(key => ({...p.salaryCohorts[key],name:`Зарплатный продукт ${key.toUpperCase()}`,
    metrics:p.metrics.map(block => p.salaryToggleBlockCodes.includes(block.code)
      ? p.salaryCohorts[key].metrics.find(candidate => candidate.code === block.code) : block)}));
  return [...cohorts,{...p,name:'Зарплатный продукт — итоговый'}];
});
assert.equal(products.length,18);
assert.ok(products.every(p => p.period === 'III кв. 2026'));
const rows = [], audit = [];
const valueOf = (p,m) => m.is_applicabble_flg === false || !(m.max_value > 0) ? 'Не применимо'
  : !Number.isFinite(m.value) ? (m.code === 'hyp.ab_tests' ? 0 : 'Нет данных') : displayMetricPercent(p,m) / 100;
for (const p of products) for (const block of p.metrics) {
  const add = (m,label) => {
    const value = valueOf(p,m);
    if (typeof value === 'number') assert.ok(value >= 0 && value <= 1);
    rows.push([displayProductName(p.name),block.name,label,value]);
    audit.push({team:p.name,unit:p.unit,period:p.period,block:block.code,code:m.code,label,value,
      rawValue:m.value,maxValue:m.max_value,applicable:m.is_applicabble_flg,source:m.source,
      ...(!Number.isFinite(m.value) && value === 0 ? {exportOverride:{reason:'По указанию пользователя: нет данных в A/B-тестах означает отсутствие бонуса, 0%.',date:'2026-11-18'}} : {})});
  };
  for (const m of block.metrics) {
    const tribe = block.code === 'goals' && Object.hasOwn(GOALS_FINAL_COUNTERPARTS,m.code);
    const final = block.code === 'goals' && Object.values(GOALS_FINAL_COUNTERPARTS).includes(m.code);
    const info = m.excluded_from_index === true && m.is_applicabble_flg !== false && m.max_value > 0;
    add(m,m.name + (tribe ? ' — уровень ЛЮ/ЛТ (информационная)' : final ? ' — итоговая оценка' : info ? ' (информационная)' : ''));
  }
  for (const m of block.goalsPoLevelMetrics || []) add(m,`${m.name} — уровень PO (информационная)`);
}
assert.equal(new Set(rows.map(row=>JSON.stringify(row.slice(0,3)))).size,rows.length);
const originalRow = row => [row[0] === 'Зарплатный продукт — итоговый' ? 'Зарплатный продукт' : row[0],...row.slice(1)];
const normalizePrior = row => [...row.slice(0,3),row[2] === 'A/B-тесты' && row[3] === 'Нет данных' ? 0 : row[3]];
const priorHasSplit = previousRows.some(row => row[0] === 'Зарплатный продукт B2C');
assert.deepEqual(priorHasSplit ? rows : rows.filter(row=>!['Зарплатный продукт B2C','Зарплатный продукт B2B'].includes(row[0])).map(originalRow),previousRows.map(normalizePrior));
const wb = Workbook.create(), sheet = wb.worksheets.add('DB III квартал 2026'), last = rows.length + 6;
sheet.showGridLines = false;
sheet.tabColor = '#244D68';
sheet.getRange(`A1:D${last}`).format.font = {name:'Arial',size:10,color:'#243746'};
sheet.getRange(`A1:D${last}`).format.verticalAlignment = 'center';
sheet.getRange('A2').values = [['DB — баллы за III квартал 2026']];
sheet.getRange('A2').format.font = {name:'Arial',size:15,bold:true,color:'#244D68'};
sheet.getRange('A2:D2').format.rowHeight = 30;
sheet.getRange('A3').values = [['Значение — процент от максимума метрики, как в текущем отчёте DDI.']];
sheet.getRange('A4').values = [['Источник: текущие данные DDI с корректировками на 18.11.2026.']];
sheet.getRange('A3:D4').format.font = {name:'Arial',size:10,color:'#637584',italic:true};
sheet.getRange('A6:D6').values = [['Команда','Блок метрик','Метрика','Значение, %']];
sheet.getRange(`A7:D${last}`).values = rows;
const table = sheet.tables.add(`A6:D${last}`,true,'DbQ3Metrics');
table.showBandedRows = true;
table.showFilterButton = true;
sheet.getRange('A6:D6').format = {fill:'#244D68',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center',rowHeight:30};
[35,30,82,20].forEach((width,i) => sheet.getRange(`${String.fromCharCode(65+i)}1:${String.fromCharCode(65+i)}${last}`).format.columnWidth = width);
sheet.getRange(`A7:C${last}`).format.wrapText = true;
sheet.getRange(`A7:D${last}`).format.rowHeight = 27;
sheet.getRange(`A7:D${last}`).format.autofitRows();
sheet.getRange(`D7:D${last}`).setNumberFormat('0%');
sheet.getRange(`D7:D${last}`).format.horizontalAlignment = 'right';
sheet.freezePanes.freezeRows(6);
wb.recalculate();
assert.deepEqual(sheet.getRange(`A7:D${last}`).values,rows);
const errors = await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},maxChars:2000});
await fs.writeFile(new URL('error-scan.json',dir),JSON.stringify(errors));
const inspection = await wb.inspect({kind:'region',sheetId:sheet.name,range:'A6:D14',maxChars:4000,tableMaxRows:9,tableMaxCols:4});
await fs.writeFile(new URL('inspection.json',dir),JSON.stringify(inspection));
const preview = await wb.render({sheetName:sheet.name,range:'A1:D16',scale:1.4,format:'png'});
await fs.writeFile(new URL('preview.png',dir),new Uint8Array(await preview.arrayBuffer()));
const salaryStart = rows.findIndex(row=>row[0] === 'Зарплатный продукт B2C') + 7;
const salaryPreview = await wb.render({sheetName:sheet.name,range:`A${salaryStart}:D${salaryStart+11}`,scale:1.2,format:'png'});
await fs.writeFile(new URL('preview-salary.png',dir),new Uint8Array(await salaryPreview.arrayBuffer()));
const output = new URL('DB_баллы_III_квартал_2026.xlsx',dir);
await (await SpreadsheetFile.exportXlsx(wb)).save(fileURLToPath(output));
const validation = {output:fileURLToPath(output),teams:products.map(p=>p.name),teamCount:products.length,rows:rows.length,
  numeric:rows.filter(r=>typeof r[3]==='number').length,missing:rows.filter(r=>r[3]==='Нет данных').length,
  notApplicable:rows.filter(r=>r[3]==='Не применимо').length,overlays:overlayNames.length,
  exportOverrides:audit.filter(row=>row.exportOverride).map(row=>({team:row.team,code:row.code,value:row.value})),
  sha256:createHash('sha256').update(await fs.readFile(output)).digest('hex'),errorScan:errors.ndjson};
await fs.writeFile(new URL('data.json',dir),JSON.stringify({rows,audit,overlayNames},null,2));
await fs.writeFile(new URL('validation.json',dir),JSON.stringify(validation,null,2));
console.log(JSON.stringify(validation));
