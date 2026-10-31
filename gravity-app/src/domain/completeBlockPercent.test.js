import test from 'node:test';
import assert from 'node:assert/strict';
import {completeBlockPercent} from './report.js';

test('a complete block includes explicit zero scores and uses rubric weights', () => {
  const metric = (value, max_value = 1) => ({value, max_value});
  assert.equal(completeBlockPercent({metrics: [metric(1), metric(0.5), metric(0)]}), 50);
  assert.equal(completeBlockPercent({metrics: [metric(0), metric(0)]}), 0);
  assert.equal(completeBlockPercent({metrics: [metric(0.5, 0.5), metric(0)]}), 33);
  assert.equal(completeBlockPercent({metrics: [metric(1), metric(1)]}), 100);
});

test('missing applicable scores keep a block unknown without treating null as zero', () => {
  for (const value of [null, undefined, NaN, Infinity, -1, 2]) {
    assert.equal(completeBlockPercent({metrics: [{value: 1, max_value: 1}, {value, max_value: 1}]}), null);
  }
  assert.equal(completeBlockPercent({metrics: [{value: 1, max_value: 1, tbd: true}]}), null);
  assert.equal(completeBlockPercent({metrics: []}), null);
});

test('non-applicable, excluded and informational metrics do not block a completed index block', () => {
  const block = {metrics: [
    {value: 0.5, max_value: 1},
    {value: null, max_value: 1, is_applicabble_flg: false},
    {value: null, max_value: 1, excluded_from_index: true},
    {value: null, max_value: 1, dd_calculation_flg: 0},
    {value: null, max_value: 0},
  ]};
  const original = JSON.stringify(block);
  assert.equal(completeBlockPercent(block), 50);
  assert.equal(JSON.stringify(block), original);
  assert.equal(completeBlockPercent({metrics: block.metrics.slice(1)}), null);
});
