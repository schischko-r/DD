import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {products} from './audit-missing-scores.mjs';
const file = new URL('../gravity-app/src/data/digital-funnel-actions-user-q3-2026.json', import.meta.url);
const data = JSON.parse(readFileSync(file, 'utf8'));
for (const [name, code] of [['Единый личный кабинет (ЕЛК)', 'voronka_ispolьzovaniya.meropriyatiya_po_rabote_s_otkloneniyami'],
  ['Колл-центр', 'voronka_vhoda_v_kanal.meropriyatiya_po_rabote_s_otkloneniyami']]) {
  const product = products.find(team => team.name === name);
  const metric = product.metrics.flatMap(block => block.metrics).find(metric => metric.code === code);
  assert.equal(metric.value, null);
  assert.ok(!data.products.some(team => team.name === name));
  data.products.push({id: product.id.split('::empty::')[0], name, unit: product.unit, type: product.type,
    metrics: {[code]: {rawValue: 1, source: {origin: data.source.origin, confirmedBy: 'user', date: '2026-10-31',
      period: product.period, sourceMetricName: metric.name, rawValue: 1, previousValue: null}}}});
}
writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const call = products.find(team => team.name === 'Колл-центр');
const proof = {origin: 'userConfirmedDirectNavigatorAssessment', confirmedBy: 'user', date: '2026-10-31', period: call.period,
  teamId: call.id.split('::empty::')[0], teamName: call.name, unit: call.unit, type: call.type, rawValue: 1};
const navigator = {period: call.period, scope: 'key-metrics-assessment', source: {origin: proof.origin, confirmedBy: 'user', date: proof.date},
  products: [{id: proof.teamId, name: call.name, unit: call.unit, type: call.type,
    metrics: {'general.navigator_reporting_knowledge': {rawValue: 1, source: proof}}}]};
writeFileSync(new URL('../gravity-app/src/data/call-center-navigator-user-q3-2026.json', import.meta.url), JSON.stringify(navigator, null, 2) + '\n');
console.log('Prepared ELK/call-center funnel actions and call-center Navigator knowledge.');
