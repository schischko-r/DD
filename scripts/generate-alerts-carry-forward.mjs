import fs from 'node:fs';
import {buildTeamProfileProducts} from '../gravity-app/src/domain/teamProfileSelection.js';
import {excludeRemovedTeams, isDdIndexMetric} from '../gravity-app/src/domain/report.js';
const root = new URL('../', import.meta.url);
const read = (path) => JSON.parse(fs.readFileSync(new URL(path, root)));
const source = excludeRemovedTeams(read('gravity-app/public/report-data.json')).products;
const app = fs.readFileSync(new URL('gravity-app/src/app/App.jsx', root), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',')
  .map((key) => imports.get(key.trim())).filter((name) => name !== 'alerts-carry-forward-q3-2026.json')
  .map((name) => read(`gravity-app/src/data/${name}`));
const period = 'III кв. 2026';
const current = buildTeamProfileProducts(source, period, overlays);
const products = [], skipped = [];
for (const previous of source.filter((team) => team.period === 'II кв. 2026')) {
  const next = current.find((p) => p.id.replace(/::empty::.*/, '') === previous.id
    && ['name', 'unit', 'type'].every((key) => p[key] === previous[key]));
  if (!next) throw new Error(`Missing Q3 team: ${previous.name}`);
  const team = {...Object.fromEntries(['id', 'name', 'unit', 'type'].map((key) => [key, previous[key]])), metrics: {}};
  for (const metric of previous.metrics.filter((b) => b.code === 'alerts').flatMap((b) => b.metrics)) {
    if (!isDdIndexMetric(metric) || !Number.isFinite(metric.value) || metric.value !== metric.max_value) continue;
    const target = next.metrics.flatMap((b) => b.metrics).find((m) => m.code === metric.code);
    if (!isDdIndexMetric(target) || Number.isFinite(target.value)) {
      skipped.push({name: previous.name, unit: previous.unit, code: metric.code,
        reason: !isDdIndexMetric(target) ? 'notApplicableInQ3' : 'explicitQ3ValuePreserved', value: target?.value});
      continue;
    }
    team.metrics[metric.code] = {rawValue: 1, source: {
      origin: 'userConfirmedAlertsCarryForward', confirmedBy: 'user', date: '2026-10-30', period,
      fromPeriod: previous.period, sourceValue: metric.value, sourceMaxValue: metric.max_value,
      rule: 'Перенос 100% из II квартала только в незаполненную применимую оценку алертов III квартала.',
    }};
  }
  if (Object.keys(team.metrics).length) products.push(team);
}
const byMetric = {};
for (const p of products) for (const code of Object.keys(p.metrics)) byMetric[code] = (byMetric[code] || 0) + 1;
const result = {period, scope: 'alerts-carry-forward', source: {confirmedBy: 'user', date: '2026-10-30',
  rule: 'Применимые алерты с полной оценкой II квартала переносятся как 100%, если оценка III квартала отсутствует. Явные оценки III квартала, веса и применимость сохраняются.'},
products, skipped, counts: {teams: products.length, facts: Object.values(byMetric).reduce((a, b) => a + b, 0), byMetric, skipped: skipped.length}};
fs.writeFileSync(new URL('gravity-app/src/data/alerts-carry-forward-q3-2026.json', root), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result.counts));
