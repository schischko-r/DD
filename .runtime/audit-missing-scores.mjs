import {readFileSync, writeFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from '../gravity-app/src/domain/quarterProfiles.js';
import {isDdIndexMetric, isTbdMetric} from '../gravity-app/src/domain/report.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const app = readFileSync(new URL('../gravity-app/src/app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => read(`../gravity-app/src/data/${imports.get(key.trim())}`));
const source = read('../gravity-app/public/report-data.json');
const salary = read('../gravity-app/src/data/salary-products-q3-2026.json');
const products = buildDdiPeriodProducts(source.products, salary.period, overlays, salary,
  read('../gravity-app/src/data/reporting-regularity-missing-q3-2026.json'),
  read('../gravity-app/src/data/funnel-action-missing-q3-2026.json'));
const abExemptPeriod = 'III кв. 2026';
const isMissing = (metric) => !Number.isFinite(metric.value) || isTbdMetric(metric);
const exemptAb = (metric) => salary.period === abExemptPeriod && metric.code === 'hyp.ab_tests' && isMissing(metric);
let total = 0, missing = 0;
const excludedAbTeams = [];
const rows = products.map((product) => {
  const all = product.metrics.flatMap((block) => block.metrics.map((metric) => ({...metric, block: block.name}))).filter(isDdIndexMetric);
  if (all.some(exemptAb)) excludedAbTeams.push(product.name);
  const blanks = all.filter((metric) => isMissing(metric) && !exemptAb(metric));
  total += all.length;
  missing += blanks.length;
  return {name: product.name, unit: product.unit, total: all.length, count: blanks.length,
    blanks: blanks.map((metric) => ({code: metric.code, name: metric.name, block: metric.block, value: metric.value}))};
}).filter((row) => row.count).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'));
const result = {period: salary.period, products: products.length, affected: rows.length, total, missing,
  policy: {confirmedBy: 'user', date: '2026-10-31', excludedMissingMetricCodes: ['hyp.ab_tests'],
    rule: 'A/B-тесты без оценки III квартала не считаются пропуском; оценки не изменяются.'},
  excludedAbTeams, rows};
writeFileSync(new URL('./missing-scores.json', import.meta.url), JSON.stringify(result, null, 2));
const metricGroups = new Map();
for (const row of rows) for (const metric of row.blanks) {
  const key = `${metric.block}|${metric.name}`;
  const group = metricGroups.get(key) || {block: metric.block, name: metric.name, teams: []};
  group.teams.push(row.name);
  metricGroups.set(key, group);
}
const metricRows = [...metricGroups.values()].map(group => ({...group, count: new Set(group.teams).size}))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'));
writeFileSync(new URL('./missing-metrics-summary.json', import.meta.url), JSON.stringify({
  period: result.period, missing, teams: result.affected, rows: metricRows,
}, null, 2));
console.log(JSON.stringify({period: result.period, affected: result.affected, missing, excludedAbTeams,
  tips: rows.find((row) => row.name === 'СберЧаевые')}, null, 2));
export {products, overlays, source, salary};
