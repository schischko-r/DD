import {readFileSync, writeFileSync} from 'node:fs';
import {products, salary} from './audit-missing-scores.mjs';
const root = new URL('../gravity-app/', import.meta.url);
const team = products.find(p => p.name === 'Торговый Эквайринг');
const metric = team.metrics.flatMap(b => b.metrics).find(m => m.code === 'alerts.business_metrics');
if (metric.value !== null) throw new Error('Expected the last unfilled score');
const source = {origin: 'userConfirmedTradeAcquiringAlerts20261031', confirmedBy: 'user', date: '2026-10-31', period: salary.period};
const data = {period: salary.period, scope: 'user-metric-assessment', source, products: [{
  id: team.id.split('::empty::')[0], name: team.name, unit: team.unit, type: team.type,
  metrics: {[metric.code]: {rawValue: 0, source: {...source, rawValue: 0, previousValue: null}}},
}]};
writeFileSync(new URL('src/data/trade-acquiring-alerts-user-q3-2026.json', root), JSON.stringify(data, null, 2) + '\n');
const appPath = new URL('src/app/App.jsx', root);
let app = readFileSync(appPath, 'utf8');
app = app.replace("import telemarketingMechanicsUserQ32026 from '../data/telemarketing-mechanics-user-q3-2026.json';", "$&\nimport tradeAcquiringAlertsUserQ32026 from '../data/trade-acquiring-alerts-user-q3-2026.json';");
app = app.replace('telemarketingMechanicsUserQ32026];', 'telemarketingMechanicsUserQ32026, tradeAcquiringAlertsUserQ32026];');
writeFileSync(appPath, app);
const fixturePath = new URL('src/domain/test-fixtures/assessmentBatches.js', root);
writeFileSync(fixturePath, readFileSync(fixturePath, 'utf8').replace('const postSnapshotExternalFiles = new Set([', "const postSnapshotExternalFiles = new Set([\n  'trade-acquiring-alerts-user-q3-2026.json',"));
