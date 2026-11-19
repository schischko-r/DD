import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {displayProductName} from '../../gravity-app/src/domain/report.js';
import {displayMetricPercent, metricFutureLabel} from '../../gravity-app/src/domain/metricPresentation.js';
import {GOALS_FINAL_COUNTERPARTS} from '../../gravity-app/src/domain/goalsFinalScores.js';

const root = new URL('../../', import.meta.url), dir = new URL('.', import.meta.url);
const read = async path => JSON.parse(await fs.readFile(new URL(path, root), 'utf8'));
const source = await read('gravity-app/public/report-data.json');
const app = await fs.readFile(new URL('gravity-app/src/app/App.jsx', root), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlayNames = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(x => imports.get(x.trim()));
assert.ok(overlayNames.every(Boolean));
const overlays = await Promise.all(overlayNames.map(name => read('gravity-app/src/data/' + name)));
const args = await Promise.all(['salary-products', 'reporting-regularity-missing', 'funnel-action-missing'].map(name => read(`gravity-app/src/data/${name}-q3-2026.json`)));
const q3 = buildDdiPeriodProducts(source.products, 'III кв. 2026', overlays, ...args, await read('gravity-app/public/backlog-data.json'));
const q2 = source.products.filter(p => p.period === 'II кв. 2026');
const identity = p => JSON.stringify([p.id.replace(/::empty::.*/, ''), p.name, p.unit, p.type.toLocaleLowerCase('ru')]);
const two = new Map(q2.map(p => [identity(p), p])), three = new Map(q3.map(p => [identity(p), p]));
assert.equal(two.size, q2.length); assert.equal(three.size, q3.length);
const keys = [...new Set([...two.keys(), ...three.keys()])].sort((a,b) => {
  const x = three.get(a) || two.get(a), y = three.get(b) || two.get(b);
  return `${x.unit} ${x.name}`.localeCompare(`${y.unit} ${y.name}`, 'ru');
});
const detail = [], audit = [];
function assessment(product, metric) {
  if (!product || !metric) return 'Нет данных';
  const future = metricFutureLabel(product, metric);
  if (future) return future;
  if (metric.is_applicabble_flg === false || !(metric.max_value > 0)) return 'Не применимо';
  if (!Number.isFinite(metric.value)) return 'Нет данных';
  return displayMetricPercent(product, metric) / 100;
}
for (const key of keys) {
  const a = two.get(key), b = three.get(key), p = b || a;
  for (const blockCode of new Set([...(b?.metrics || []), ...(a?.metrics || [])].map(block => block.code))) {
    const oldBlock = a?.metrics.find(block => block.code === blockCode), newBlock = b?.metrics.find(block => block.code === blockCode);
    const oldMetrics = oldBlock?.metrics || [], consumed = new Set();
    const add = (oldMetric, newMetric, name) => {
      const left = assessment(a, oldMetric), right = assessment(b, newMetric);
      detail.push([p.unit, displayProductName(p.name), newBlock?.name || oldBlock.name, name, left, right, null]);
      audit.push({identity:key,blockCode,oldCode:oldMetric?.code,newCode:newMetric?.code,
        old:oldMetric ? {value:oldMetric.value,max:oldMetric.max_value,applicable:oldMetric.is_applicabble_flg} : null,
        current:newMetric ? {value:newMetric.value,max:newMetric.max_value,applicable:newMetric.is_applicabble_flg} : null});
    };
    for (const metric of newBlock?.metrics || []) {
      if (blockCode === 'goals' && Object.hasOwn(GOALS_FINAL_COUNTERPARTS, metric.code)) {
        add(null, metric, `${metric.name} — уровень ЛЮ/ЛТ (информационная)`);
        continue;
      }
      const baseCode = blockCode === 'goals' ? Object.keys(GOALS_FINAL_COUNTERPARTS).find(code => GOALS_FINAL_COUNTERPARTS[code] === metric.code) : null;
      const prior = oldMetrics.find(old => old.code === (baseCode || metric.code));
      if (prior) consumed.add(prior.code);
      const info = metric.excluded_from_index === true && metric.is_applicabble_flg !== false && metric.max_value > 0;
      add(prior, metric, metric.name + (baseCode ? ' — итоговая оценка' : info ? ' (информационная)' : ''));
    }
    for (const metric of newBlock?.goalsPoLevelMetrics || []) add(null, metric, `${metric.name} — уровень PO (информационная)`);
    for (const metric of oldMetrics) if (!consumed.has(metric.code)) add(metric, null, metric.name);
  }
}
assert.ok(detail.length > 3000);
for (const row of detail) for (const value of row.slice(4,6)) if (typeof value === 'number') assert.ok(value >= 0 && value <= 1);
const wb = Workbook.create(), sheet = wb.worksheets.add('Метрики');
const last = detail.length + 6;
sheet.showGridLines = false; sheet.tabColor = '#126C96';
sheet.getRange(`A1:G${last}`).format.font = {name:'Arial',size:10,color:'#253446'};
sheet.getRange(`A1:G${last}`).format.verticalAlignment = 'center';
sheet.getRange('A2').values = [['DDI — метрики II и III кварталов 2026']];
sheet.getRange('A2').format.font = {name:'Arial',size:15,bold:true,color:'#126C96'};
sheet.getRange('A2:G2').format.rowHeight = 30;
sheet.getRange('A3').values = [['Балл — процент от максимума метрики. Аплифт = III квартал − II квартал, п.п.']];
sheet.getRange('A4').values = [['Источник: текущий отчёт DDI со всеми подключёнными корректировками, 10.11.2026.']];
sheet.getRange('A3:G4').format.font = {name:'Arial',size:10,color:'#657385',italic:true};
sheet.getRange('A6:G6').values = [['Юнит','Продукт','Блок метрик','Метрика','Балл II квартал, %','Балл III квартал, %','Аплифт, п.п.']];
sheet.getRange(`A7:G${last}`).values = detail;
const table = sheet.tables.add(`A6:G${last}`, true, 'DdiMetricComparison');
table.showBandedRows = true; table.showFilterButton = true;
sheet.getRange('A6:G6').format = {fill:'#126C96',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center',rowHeight:34};
sheet.getRange(`A7:D${last}`).format.wrapText = true;
[13,39,30,76,20,20,18].forEach((width,i) => sheet.getRange(`${String.fromCharCode(65+i)}1:${String.fromCharCode(65+i)}${last}`).format.columnWidth = width);
sheet.getRange(`A7:G${last}`).format.rowHeight = 24;
sheet.getRange(`A7:G${last}`).format.autofitRows();
sheet.getRange(`E7:F${last}`).setNumberFormat('0%');
sheet.getRange(`E7:G${last}`).format.horizontalAlignment = 'right';
sheet.getRange(`G7:G${last}`).formulas = detail.map((_,i) => { const r=i+7; return [`=IF(AND(ISNUMBER(E${r}),ISNUMBER(F${r})),ROUND((F${r}-E${r})*100,0),"—")`]; });
const uplift = sheet.getRange(`G7:G${last}`);
uplift.setNumberFormat('+0" п.п.";-0" п.п.";0" п.п."');
uplift.conditionalFormats.add('cellIs',{operator:'greaterThan',formula:0,format:{font:{color:'#137343'},fill:'#E8F4ED'}});
uplift.conditionalFormats.add('cellIs',{operator:'lessThan',formula:0,format:{font:{color:'#B3261E'},fill:'#FCECE9'}});
sheet.freezePanes.freezeRows(6); sheet.freezePanes.freezeColumns(2);
wb.recalculate();
const computed = uplift.values;
detail.forEach((row,i) => {
  const expected = typeof row[4] === 'number' && typeof row[5] === 'number' ? Math.round((row[5]-row[4])*100) : '—';
  assert.equal(computed[i][0], expected, `Uplift row ${i+7}`);
});
const errors = await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},maxChars:2000});
await fs.writeFile(new URL('error-scan.json',dir),JSON.stringify(errors));
const inspection = await wb.inspect({kind:'region',sheetId:sheet.name,range:'A6:G12',maxChars:3500,tableMaxRows:7,tableMaxCols:7});
await fs.writeFile(new URL('inspection.json',dir),JSON.stringify(inspection));
const preview = await wb.render({sheetName:sheet.name,range:'A1:G13',scale:1.2,format:'png'});
await fs.writeFile(new URL('preview.png',dir),new Uint8Array(await preview.arrayBuffer()));
const output = new URL('DDI_final_metrics_Q2_Q3_2026.xlsx',dir);
await (await SpreadsheetFile.exportXlsx(wb)).save(output.pathname);
const hash = createHash('sha256').update(await fs.readFile(output)).digest('hex');
const validation = {output:output.pathname,sha256:hash,q2:q2.length,q3:q3.length,entities:keys.length,rows:detail.length,
  comparable:detail.filter(r=>typeof r[4]==='number'&&typeof r[5]==='number').length,overlays:overlayNames.length,errorScan:errors.ndjson};
await fs.writeFile(new URL('snapshot.json',dir),JSON.stringify({validation,overlayNames,detail,audit}));
await fs.writeFile(new URL('validation.json',dir),JSON.stringify(validation,null,2));
console.log(JSON.stringify(validation));
