import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {products, source} from './audit-missing-scores.mjs';
const teams = [products.find(product => product.name === 'SberID'), products.find(product => product.id.startsWith('2aed0e7e-'))];
assert.ok(teams.every(Boolean));
writeFileSync(new URL('./before-digital-completion.json', import.meta.url), JSON.stringify(products));
const industrial = [], actions = [];
for (const product of teams) {
  const metrics = product.metrics.flatMap(block => block.metrics);
  const code = 'dannye.promyshlenye_dannye';
  const metric = metrics.find(metric => metric.code === code);
  assert.ok(metric?.is_applicabble_flg !== false && metric?.max_value > 0);
  assert.equal(metric.value, null);
  const baseline = source.products.find(team => team.id === product.id.split('::empty::')[0]);
  const old = baseline.metrics.flatMap(block => block.metrics).find(metric => metric.code === code);
  const carry = product.name === 'SberID';
  const rawValue = carry ? old.value / old.max_value : 1;
  assert.equal(rawValue, 1);
  const identity = {id: baseline.id, name: product.name, unit: product.unit, type: product.type};
  const proof = {origin: 'userConfirmedDigitalCompletion20261031', confirmedBy: 'user', date: '2026-10-31', period: product.period};
  industrial.push({...identity, metrics: {[code]: {rawValue, source: {...proof,
    sourceMetricName: metric.name,
    ...(carry ? {fromPeriod: baseline.period, sourceValue: old.value, sourceMaxValue: old.max_value,
      sourceFile: 'gravity-app/public/report-data.json', rule: 'Перенос оценки промышленных данных SberID из II квартала по прямому указанию пользователя.'}
      : {rawValue: 1, rule: 'Прямая оценка пользователя: промышленные данные Почта, Диск, Календарь = 1.'}),
  }}}});
  const candidates = metrics.filter(metric => /\.meropriyatiya_po_rabote_s_otkloneniyami$/.test(metric.code)
    && metric.is_applicabble_flg !== false && metric.max_value > 0);
  assert.equal(candidates.length, 1);
  const action = candidates[0];
  assert.equal(action.value, null);
  actions.push({...identity, metrics: {[action.code]: {rawValue: 1, source: {...proof,
    sourceMetricName: action.name, rawValue: 1, rule: 'Прямое указание пользователя: мероприятия по работе с отклонениями = 1.'}}}});
}
const base = {period: teams[0].period, source: {origin: 'userConfirmedDigitalCompletion20261031', confirmedBy: 'user', date: '2026-10-31'}};
writeFileSync(new URL('../gravity-app/src/data/industrial-data-user-q3-2026.json', import.meta.url), JSON.stringify({...base, scope: 'user-metric-assessment', products: industrial}, null, 2) + '\n');
writeFileSync(new URL('../gravity-app/src/data/digital-funnel-actions-user-q3-2026.json', import.meta.url), JSON.stringify({...base, scope: 'funnel-user-assessment', products: actions}, null, 2) + '\n');
console.log(JSON.stringify({industrial: industrial.map(team => team.name), actions: actions.map(team => ({name: team.name, codes: Object.keys(team.metrics)}))}, null, 2));
