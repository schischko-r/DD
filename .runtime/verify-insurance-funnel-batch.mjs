import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {products} from './audit-missing-scores.mjs';
const before = JSON.parse(readFileSync(new URL('./before-insurance-funnel-batch.json', import.meta.url), 'utf8'));
const batch = JSON.parse(readFileSync(new URL('../gravity-app/src/data/insurance-funnel-user-q3-2026.json', import.meta.url), 'utf8'));
let facts = 0, fills = 0, reassessed = 0, retained = 0;
for (const product of products) {
  const previous = before.find(item => item.id === product.id);
  const team = batch.products.find(item => item.id === product.id.split('::empty::')[0]);
  assert.equal(product.indexMaxPoints, previous.indexMaxPoints);
  for (const block of product.metrics) for (const metric of block.metrics) {
    const old = previous.metrics.flatMap(item => item.metrics).find(item => item.code === metric.code);
    const fact = team?.metrics[metric.code];
    assert.equal(metric.max_value, old.max_value);
    assert.equal(metric.is_applicabble_flg, old.is_applicabble_flg);
    if (!fact) {assert.deepEqual(metric, old); continue;}
    facts++;
    assert.equal(metric.value / metric.max_value, fact.rawValue, `${product.name}: ${metric.code}`);
    if (old.value === null) fills++;
    else if (old.value !== metric.value) reassessed++;
    else retained++;
  }
}
assert.equal(facts, 20);
assert.equal(fills, 6);
assert.equal(reassessed, 1);
assert.equal(retained, 13);
console.log('Verified 20 supplied values: 6 missing fills, 1 explicit correction, 13 retained; all other metrics, weights and applicability preserved.');
