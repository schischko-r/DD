import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTeamProfileRadarData} from './teamProfileSelection.js';

const block = (values) => ({code: 'goals', metrics: values.map((value) => ({value, max_value: 1}))});
const team = (values, extra = {}) => ({period: 'III кв. 2026', type: 'Продукт', isPlaceholder: true, metrics: [block(values)], ...extra});

test('Q3 radar uses complete block scores and B2C from the same quarter, including real zeros', () => {
  const product = team([1, 0.5, 0]);
  const peers = [product, team([0, 0, 0]), team([1, 1, 1], {type: 'Сегмент'}),
    team([1, 1, 1], {period: 'II кв. 2026'}), team([1, 1, 1], {type: 'Канал'}), team([1, null, 0])];
  const original = JSON.stringify({product, peers});
  assert.deepEqual(buildTeamProfileRadarData(product, peers, product.metrics), [{code: 'goals', product: 50, benchmark: 50}]);
  assert.equal(JSON.stringify({product, peers}), original);
});

test('incomplete and inapplicable blocks stay unknown, without suppressing complete axes', () => {
  const product = team([null, 1, 0]);
  product.metrics.push({code: 'cx', metrics: [{value: 1, max_value: 1}]});
  product.metrics.push({code: 'na', metrics: [{value: null, max_value: 0, is_applicabble_flg: false}]});
  assert.deepEqual(buildTeamProfileRadarData(product, [product], product.metrics), [
    {code: 'goals', product: null, benchmark: null},
    {code: 'cx', product: 100, benchmark: 100},
    {code: 'na', product: null, benchmark: null},
  ]);
});

test('Q2 radar keeps existing aggregation and cannot use Q3 benchmarks', () => {
  const product = team([1, 0.5, 0], {period: 'II кв. 2026', isPlaceholder: false});
  assert.deepEqual(buildTeamProfileRadarData(product, [product, team([0, 0, 0])], product.metrics), [
    {code: 'goals', product: 50, benchmark: 50},
  ]);
});
