import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {products, source} from './audit-missing-scores.mjs';
const before = JSON.parse(readFileSync(new URL('./before-digital-completion.json', import.meta.url), 'utf8'));
const batches = ['industrial-data-user-q3-2026.json', 'digital-funnel-actions-user-q3-2026.json']
  .map(file => JSON.parse(readFileSync(new URL(`../gravity-app/src/data/${file}`, import.meta.url), 'utf8')));
let changes = 0;
for (const product of products) {
  const old = before.find(team => team.id === product.id);
  const teams = batches.flatMap(batch => batch.products).filter(team => team.id === product.id.split('::empty::')[0]);
  const facts = Object.assign({}, ...teams.map(team => team.metrics));
  assert.equal(product.indexMaxPoints, old.indexMaxPoints);
  for (const metric of product.metrics.flatMap(block => block.metrics)) {
    const previous = old.metrics.flatMap(block => block.metrics).find(entry => entry.code === metric.code);
    if (!facts[metric.code]) {assert.deepEqual(metric, previous); continue;}
    assert.equal(previous.value, null);
    assert.equal(metric.value, metric.max_value);
    assert.equal(metric.max_value, previous.max_value);
    assert.equal(metric.is_applicabble_flg, previous.is_applicabble_flg);
    if (product.name === 'SberID' && metric.code === 'dannye.promyshlenye_dannye') {
      const q2 = source.products.find(team => team.name === product.name).metrics.flatMap(block => block.metrics)
        .find(entry => entry.code === metric.code);
      assert.equal(metric.value, q2.value);
      assert.equal(metric.source.fromPeriod, source.products[0].period);
    }
    changes++;
  }
}
assert.equal(changes, 4);
console.log('Verified four exact fills: industrial data and funnel actions for SberID/Mail; all other assessments and weights preserved.');
