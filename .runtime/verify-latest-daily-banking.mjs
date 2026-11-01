import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {products} from './audit-missing-scores.mjs';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const before = read('./before-latest-daily-banking.json');
const batches = ['daily-banking-funnel-user-q3-2026.json', 'cross-border-mechanics-user-q3-2026.json',
  'elk-knowledge-user-q3-2026.json', 'call-center-navigator-user-q3-2026.json', 'notification-retention-user-q3-2026.json',
  'telemarketing-mechanics-user-q3-2026.json', 'trade-acquiring-alerts-user-q3-2026.json']
  .map(file => read(`../gravity-app/src/data/${file}`));
const digital = read('../gravity-app/src/data/digital-funnel-actions-user-q3-2026.json');
batches.push({...digital, products: digital.products.filter(team => ['Единый личный кабинет (ЕЛК)', 'Колл-центр', 'СберKids', 'Уведомления', 'Телемаркетинг'].includes(team.name))});
let facts = 0, fills = 0, same = 0;
for (const product of products) {
  const previous = before.find(team => team.id === product.id);
  const teams = batches.flatMap(batch => batch.products).filter(team => team.id === product.id.split('::empty::')[0]);
  const requested = Object.assign({}, ...teams.map(team => team.metrics));
  assert.equal(product.indexMaxPoints, previous.indexMaxPoints);
  for (const metric of product.metrics.flatMap(block => block.metrics)) {
    const old = previous.metrics.flatMap(block => block.metrics).find(metricOld => metricOld.code === metric.code);
    const fact = requested[metric.code];
    if (!fact) {assert.deepEqual(metric, old); continue;}
    assert.equal(metric.value / metric.max_value, fact.rawValue, `${product.name}: ${metric.code}`);
    assert.equal(metric.max_value, old.max_value);
    assert.equal(metric.is_applicabble_flg, old.is_applicabble_flg);
    facts++;
    if (old.value === null) fills++; else {assert.equal(metric.value, old.value); same++;}
  }
}
assert.equal(facts, 29);
assert.equal(fills, 22);
assert.equal(same, 7);
console.log('Verified 29 requested scores: 22 gaps filled, 7 existing values confirmed; all other scores, maxima and applicability preserved.');
