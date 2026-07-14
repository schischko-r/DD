import test from 'node:test';
import assert from 'node:assert/strict';
import {blockPercent, difficultyMeta, groupFor, metricDomId, percent, scoreFor} from './report.js';

test('report selectors preserve score and group fallbacks', () => {
  const product = {name: 'Team', unit: 'Unit'};
  const rows = [{name: 'Team', unit: 'Unit', score: 61, group: 'Mature'}];
  assert.equal(scoreFor(product, rows), 61);
  assert.equal(groupFor(product, rows), 'Mature');
  assert.equal(scoreFor(product, []), 0);
  assert.equal(groupFor(product, []), 'Нет данных');
});

test('report percentage helpers clamp and aggregate values', () => {
  assert.equal(percent(3, 4), 75);
  assert.equal(percent(5, 4), 100);
  assert.equal(percent(1, 0), 0);
  assert.equal(blockPercent({metrics: [{value: 1, max_value: 2}, {value: 2, max_value: 2}]}), 75);
});

test('report presentation helpers preserve stable output', () => {
  assert.equal(metricDomId('goals/value'), 'dd-metric-goals%2Fvalue');
  assert.deepEqual(difficultyMeta(3), {label: 'Легко', theme: 'success'});
  assert.deepEqual(difficultyMeta(6), {label: 'Средне', theme: 'warning'});
  assert.deepEqual(difficultyMeta(7), {label: 'Сложно', theme: 'danger'});
});
