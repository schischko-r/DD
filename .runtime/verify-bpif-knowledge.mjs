import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {products} from './audit-missing-scores.mjs';
import {completeBlockPercent} from '../gravity-app/src/domain/report.js';
const before = JSON.parse(readFileSync(new URL('./before-bpif-knowledge.json', import.meta.url), 'utf8'));
let changes = 0, full = 0;
for (const product of products) {
  const old = before.find(item => item.id === product.id);
  assert.equal(product.indexMaxPoints, old.indexMaxPoints);
  if (!product.id.startsWith('339dfb56-')) {assert.deepEqual(product, old); continue;}
  for (const block of product.metrics) {
    const previous = old.metrics.find(item => item.code === block.code);
    if (block.code !== 'general') {assert.deepEqual(block, previous); continue;}
    for (const metric of block.metrics) {
      const prior = previous.metrics.find(item => item.code === metric.code);
      assert.equal(metric.max_value, prior.max_value);
      assert.equal(metric.is_applicabble_flg, prior.is_applicabble_flg);
      if (metric.is_applicabble_flg !== false && metric.max_value > 0) {
        assert.equal(metric.value, metric.max_value);
        full++;
      } else assert.deepEqual(metric, prior);
      if (metric.value !== prior.value) changes++;
    }
    assert.equal(completeBlockPercent(block, product.period), 100);
  }
}
assert.equal(full, 6);
assert.equal(changes, 3);
console.log('BPIF general block: 6/6 applicable metrics at full score, 3 gaps filled; other teams, blocks and weights preserved.');
