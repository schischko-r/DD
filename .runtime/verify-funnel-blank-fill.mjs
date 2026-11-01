import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {products} from './audit-missing-scores.mjs';
const before = JSON.parse(readFileSync(new URL('./before-funnel-blank-fill.json', import.meta.url), 'utf8'));
const facts = JSON.parse(readFileSync(new URL('../gravity-app/src/data/funnel-missing-user-fill-q3-2026.json', import.meta.url), 'utf8'));
let changes = 0;
for (const product of products) {
  const prior = before.find((item) => item.id === product.id);
  assert.equal(product.indexMaxPoints, prior.indexMaxPoints);
  const team = facts.products.find((item) => item.id === product.id.split('::empty::')[0]);
  const oldMetrics = prior.metrics.flatMap((block) => block.metrics);
  for (const metric of product.metrics.flatMap((block) => block.metrics)) {
    const old = oldMetrics.find((item) => item.code === metric.code);
    const fact = team?.metrics[metric.code];
    if (!fact) {assert.deepEqual(metric, old); continue;}
    assert.equal(old.value, null);
    assert.equal(metric.value, 0.25);
    assert.equal(metric.value / metric.max_value, 0.5);
    assert.equal(metric.max_value, old.max_value);
    assert.equal(metric.is_applicabble_flg, old.is_applicabble_flg);
    changes++;
  }
}
assert.equal(changes, 2);
assert.equal(facts.sourceRows.filter((row) => row.status === 'preservedExistingScore').length, 9);
assert.equal(facts.sourceRows.filter((row) => row.status === 'preservedNonApplicable').length, 1);
console.log('Verified exactly two null-to-50% fills; every other metric, weight, applicability and existing zero preserved.');
