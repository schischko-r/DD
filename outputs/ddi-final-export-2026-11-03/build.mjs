import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {buildProductQuarterComparison} from '../../gravity-app/src/domain/productQuarterComparison.js';
import {quarterMetricGrowthByCode} from '../../gravity-app/src/pages/teamProfileQuarterGrowth.js';
import {completeProductPercent, displayProductName, isDdIndexMetricForPeriod} from '../../gravity-app/src/domain/report.js';
import {displayMetricPercent, metricFutureLabel} from '../../gravity-app/src/domain/metricPresentation.js';
import {GOALS_FINAL_COUNTERPARTS} from '../../gravity-app/src/domain/goalsFinalScores.js';

const root = new URL('../../', import.meta.url);
const dir = new URL('.', import.meta.url).pathname;
const read = async path => JSON.parse(await fs.readFile(new URL(path, root), 'utf8'));
const source = await read('gravity-app/public/report-data.json');
const app = await fs.readFile(new URL('gravity-app/src/app/App.jsx', root), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = await Promise.all(app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read('gravity-app/src/data/' + imports.get(key.trim()))));
const args = await Promise.all(['salary-products', 'reporting-regularity-missing', 'funnel-action-missing'].map(name => read(`gravity-app/src/data/${name}-q3-2026.json`)));
const q3 = buildDdiPeriodProducts(source.products, 'III кв. 2026', overlays, ...args, await read('gravity-app/public/backlog-data.json'));
const q2 = source.products.filter(p => p.period === 'II кв. 2026');
assert.equal(q2.length, 83); assert.equal(q3.length, 76);
const identity = p => JSON.stringify([p.id.replace(/::empty::.*/, ''), p.name, p.unit, p.type.toLocaleLowerCase('ru')]);
const two = new Map(q2.map(p => [identity(p), p])), three = new Map(q3.map(p => [identity(p), p]));
assert.equal(two.size, q2.length); assert.equal(three.size, q3.length);
const keys = [...new Set([...two.keys(), ...three.keys()])].sort((a,b) => {
  const x = three.get(a) || two.get(a), y = three.get(b) || two.get(b);
  return `${x.unit} ${x.name}`.localeCompare(`${y.unit} ${y.name}`, 'ru');
});
const summary = [], detail = [], controls = [];
const missing = 'Нет данных', na = 'Не применимо';
function assessment(p, metric) {
  if (!p || !metric) return missing;
  const future = metricFutureLabel(p, metric);
  if (future) return future;
  if (metric.is_applicabble_flg === false || !(metric.max_value > 0)) return na;
  if (!Number.isFinite(metric.value)) return missing;
  return displayMetricPercent(p, metric) / 100;
}
for (const key of keys) {
  const a = two.get(key), b = three.get(key), p = b || a;
  const baseline = source.title.rows.filter(row => row.name === a?.name && row.unit === a?.unit);
  if (a) assert.equal(baseline.length, 1, `Q2 identity ${key}`);
  const score2 = a ? baseline[0].score : null, score3 = b ? completeProductPercent(b) : null;
  if (b) assert.ok(Number.isFinite(score3), `Incomplete Q3 ${key}`);
  const comparison = b ? buildProductQuarterComparison(b, source.products, source.title.rows) : null;
  if (b) assert.ok(comparison, `No quarter comparison ${key}`);
  const growths = b ? quarterMetricGrowthByCode(b, comparison, source.products) : {};
  summary.push([p.unit, displayProductName(p.name), Number.isFinite(score2) ? score2/100 : missing,
    Number.isFinite(score3) ? score3/100 : missing, null]);
  controls.push({unit:p.unit, name:p.name, score2, score3, delta:comparison?.indexPctDelta ?? null});
  const blockCodes = [...new Set([...(b?.metrics || []), ...(a?.metrics || [])].map(block => block.code))];
  for (const blockCode of blockCodes) {
    const oldBlock = a?.metrics.find(block => block.code === blockCode);
    const newBlock = b?.metrics.find(block => block.code === blockCode);
    const oldMetrics = oldBlock?.metrics || [], newMetrics = newBlock?.metrics || [];
    const consumed = new Set();
    function addRow(oldMetric, newMetric, name, information = false) {
      const m = newMetric || oldMetric;
      const left = assessment(a, oldMetric), right = assessment(b, newMetric);
      const growth = newMetric && !information ? growths[newMetric.code] : null;
      const delta = growth ? growth.indexPctDelta
        : information ? 0
          : b && newMetric && isDdIndexMetricForPeriod(newMetric, b.period) && typeof right === 'number' ? 0
            : b && newMetric && newMetric.is_applicabble_flg !== false && typeof right === 'number' ? 0 : '—';
      detail.push([p.unit, displayProductName(p.name), newBlock?.name || oldBlock.name,
        name || m.name, left, right, delta]);
    }
    for (const metric of newMetrics) {
      const baseCode = blockCode === 'goals' ? Object.keys(GOALS_FINAL_COUNTERPARTS).find(code => GOALS_FINAL_COUNTERPARTS[code] === metric.code) : null;
      if (blockCode === 'goals' && Object.hasOwn(GOALS_FINAL_COUNTERPARTS, metric.code)) {
        addRow(null, metric, `${metric.name} — уровень ЛЮ/ЛТ (информационная)`, true);
        continue;
      }
      const prior = oldMetrics.find(old => old.code === (baseCode || metric.code));
      if (prior) consumed.add(prior.code);
      const informational = metric.excluded_from_index === true && metric.is_applicabble_flg !== false && metric.max_value > 0;
      addRow(prior, metric, metric.name + (baseCode ? ' — итоговая оценка' : informational ? ' (информационная)' : ''), informational);
    }
    for (const metric of newBlock?.goalsPoLevelMetrics || []) {
      addRow(null, metric, `${metric.name} — уровень PO (информационная)`, true);
    }
    for (const metric of oldMetrics) {
      if (consumed.has(metric.code)) continue;
      addRow(metric, null, metric.name, false);
    }
  }
}
assert.equal(summary.length, 83);
const snapshot = {generatedAt:new Date().toISOString(), commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),
  q2Count:q2.length, q3Count:q3.length, summary, detail, controls, source, q3};
await fs.writeFile(dir+'snapshot.json', JSON.stringify(snapshot));

const wb = Workbook.create();
const teams = wb.worksheets.add('Команды'), metrics = wb.worksheets.add('Метрики');
function populate(sheet, headers, rows, widths, notes) {
  const last = rows.length + 6, end = String.fromCharCode(64+headers.length);
  sheet.showGridLines = false; sheet.tabColor = '#087FBD';
  sheet.getRange(`A1:${end}${last}`).format.font = {name:'Arial',size:10,color:'#253446'};
  sheet.getRange(`A1:${end}${last}`).format.verticalAlignment = 'center';
  sheet.getRange('A2').values = [['DDI — II и III кварталы 2026']];
  sheet.getRange('A2').format.font = {name:'Arial',size:15,bold:true,color:'#087FBD'};
  sheet.getRange(`A2:${end}2`).format.rowHeight = 30;
  notes.forEach((note,i) => {
    sheet.getRange(`A${i+3}`).values = [[note]];
    sheet.getRange(`A${i+3}`).format.font = {name:'Arial',size:10,color:'#657385',italic:true};
  });
  sheet.getRange(`A6:${end}6`).values = [headers];
  sheet.getRange(`A7:${end}${last}`).values = rows;
  const table = sheet.tables.add(`A6:${end}${last}`, true, sheet.name === 'Команды' ? 'DdiTeams' : 'DdiMetrics');
  table.showBandedRows = true; table.showFilterButton = true;
  sheet.getRange(`A6:${end}6`).format = {fill:'#126C96',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},
    wrapText:true,horizontalAlignment:'center',verticalAlignment:'center',rowHeight:34};
  sheet.getRange(`A7:${end}${last}`).format.rowHeight = sheet.name === 'Команды' ? 32 : 40;
  widths.forEach((width,i) => sheet.getRange(`${String.fromCharCode(65+i)}6:${String.fromCharCode(65+i)}${last}`).format.columnWidth = width);
  sheet.getRange(`A7:${sheet.name==='Команды'?'B':'D'}${last}`).format.wrapText = true;
  sheet.freezePanes.freezeRows(6); sheet.freezePanes.freezeColumns(2);
  return last;
}
const teamLast = populate(teams, ['Юнит','Команда','DDI II кв.','DDI III кв.','Аплифт, п.п.'], summary,
  [15,48,18,18,20], ['Аплифт = DDI III квартала − DDI II квартала, п.п.',
    'II квартал: 83 команды. III квартал: 76 команд. Отсутствие оценки не равно нулю.',
    'Источник: финальные данные отчёта DDI на 03.11.2026, со всеми подтверждёнными корректировками.']);
teams.getRange(`C7:D${teamLast}`).setNumberFormat('0%');
teams.getRange(`E7:E${teamLast}`).formulas = summary.map((_,i) => {const r=i+7;return [`=IF(AND(ISNUMBER(C${r}),ISNUMBER(D${r})),(D${r}-C${r})*100,"—")`];});
const metricLast = populate(metrics, ['Юнит','Команда','Блок метрик','Метрика','Балл II кв.','Балл III кв.','Аплифт DDI, п.п.'], detail,
  [15,40,30,80,18,18,22], ['Балл метрики — оценка в процентах от максимума, как в интерфейсе. «Не применимо» и «Нет данных» различаются.',
    'Аплифт DDI — как у метрики в отчёте. Сумма строк может отличаться от дельты команды из-за состава, весов и округления.',
    'Цели: итоговые оценки сопоставлены между кварталами. Детализация ЛЮ/ЛТ и PO показана отдельными информационными строками.']);
metrics.getRange(`E7:F${metricLast}`).setNumberFormat('0%');
for (const [sheet,column,last] of [[teams,'E',teamLast],[metrics,'G',metricLast]]) {
  const range=sheet.getRange(`${column}7:${column}${last}`);
  range.setNumberFormat('+0.0;-0.0;0.0');
  range.conditionalFormats.add('cellIs',{operator:'greaterThan',formula:0,format:{font:{color:'#137343'},fill:'#E8F4ED'}});
  range.conditionalFormats.add('cellIs',{operator:'lessThan',formula:0,format:{font:{color:'#B3261E'},fill:'#FCECE9'}});
}
teams.getRange(`C7:E${teamLast}`).format.horizontalAlignment='right';
metrics.getRange(`E7:G${metricLast}`).format.horizontalAlignment='right';
wb.recalculate();
const computed = teams.getRange(`E7:E${teamLast}`).values;
controls.forEach((control,i) => {
  if (control.delta !== null) assert.ok(Math.abs(computed[i][0]-control.delta)<1e-8, `Team uplift ${control.name}`);
});
const deposits = detail.find(r=>r[0]==='CBP' && r[1]==='Вклады+НС' && r[3].startsWith('Знание об отчетности в Навигаторе'));
assert.equal(deposits[5],1);
const mail = detail.find(r=>r[1]==='Почта, Диск, Календарь' && r[3]==='CX Score');
assert.equal(mail[4],na); assert.equal(mail[5],.5); assert.ok(Math.abs(mail[6]-2.197802197802198)<1e-9);
const posClients = detail.find(r=>r[1]==='POS-кредиты' && r[3].startsWith('Клиенты с продуктом'));
assert.equal(posClients[5],1);
const errors = await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},maxChars:2000});
await fs.writeFile(dir+'error-scan.json',JSON.stringify(errors));
for (const [sheet,end,file] of [[teams,'E','preview-teams.png'],[metrics,'G','preview-metrics.png']]) {
  const preview=await wb.render({sheetName:sheet.name,range:`A1:${end}13`,scale:1.5,format:'png'});
  await fs.writeFile(dir+file,new Uint8Array(await preview.arrayBuffer()));
}
for (const [sheet,rows,end,file] of [[teams,summary,'E','preview-pos-team.png'],[metrics,detail,'G','preview-pos-metrics.png']]) {
  const start=rows.findIndex(row=>row[1]==='POS-кредиты')+7;
  const preview=await wb.render({sheetName:sheet.name,range:`A${start}:${end}${start+(sheet===teams?0:6)}`,scale:1.5,format:'png'});
  await fs.writeFile(dir+file,new Uint8Array(await preview.arrayBuffer()));
}
const output = dir+'DDI_финальные_II_III_кварталы_2026.xlsx';
await(await SpreadsheetFile.exportXlsx(wb)).save(output);
const validation={output,teams:summary.length,q2:q2.length,q3:q3.length,metricRows:detail.length,formulasChecked:controls.filter(c=>c.delta!==null).length,
  depositsNavigator:deposits,mailCx:mail,posClients,commit:snapshot.commit,errorScan:errors.ndjson};
await fs.writeFile(dir+'validation.json',JSON.stringify(validation,null,2));
console.log(JSON.stringify(validation));
