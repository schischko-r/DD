import test from 'node:test';
import assert from 'node:assert/strict';
import {salaryB2cComparisonBlock} from './salaryCohortGrowth.js';
import {metricActualGrowth, blockActualGrowth} from './teamProfileSelection.js';
const metric = (code, value, max_value = 1) => ({code, value, max_value, is_applicabble_flg: true, dd_calculation_flg: 1});
const b2c = {}, b2b = {};
const product = {id: 'salary::empty::III кв. 2026', period: 'III кв. 2026', name: 'Зарплатный продукт', unit: 'DB', type: 'Продукт',
  salaryCohorts: {b2c, b2b}, salaryToggleBlockCodes: ['attract']};
const block = {code: 'attract', metrics: [metric('growth', 1), metric('down', 0), metric('flat', .5), metric('unknown', null),
  metric('changedWeight', 1), {...metric('na', 0), is_applicabble_flg: false}]};
const prior = {...product, id: 'salary', period: 'II кв. 2026', metrics: [{code: 'attract', metrics: [metric('growth', 0),
  metric('down', 1), metric('flat', .5), metric('unknown', 0), metric('changedWeight', 0, .5), metric('na', 0)]}]};

test('only B2C gets the explicit shared Q2 comparison with half-weight DDI changes', () => {
  const snapshot = JSON.stringify({product, block, prior});
  const result = salaryB2cComparisonBlock(product, b2c, block, [prior]);
  const growth = metricActualGrowth(result.metrics[0], 20, product.period);
  assert.equal(growth.pointsDelta, 1);
  assert.equal(growth.metricPctDelta, 100);
  assert.equal(growth.indexPctDelta, 2.5);
  assert.match(growth.comparisonLabel, /общего зарплатного продукта II квартала/);
  assert.equal(metricActualGrowth(result.metrics[1], 20, product.period).indexPctDelta, -2.5);
  for (const m of result.metrics.slice(2)) assert.equal(metricActualGrowth(m, 20, product.period), null);
  assert.equal(blockActualGrowth(result, 20, product.period).indexPctDelta, 0);
  for (let i = 0; i < block.metrics.length; i++) {
    for (const key of ['value', 'max_value', 'is_applicabble_flg', 'dd_calculation_flg']) assert.equal(result.metrics[i][key], block.metrics[i][key]);
  }
  assert.equal(salaryB2cComparisonBlock(product, b2b, block, [prior]), block);
  assert.equal(salaryB2cComparisonBlock({...product, period: 'II кв. 2026'}, b2c, block, [prior]), block);
  assert.equal(salaryB2cComparisonBlock(product, b2c, block, []), block);
  assert.equal(salaryB2cComparisonBlock(product, b2c, block, [{...prior, unit: 'Other'}]), block);
  assert.equal(salaryB2cComparisonBlock(product, b2c, block, [prior, prior]), block);
  assert.equal(salaryB2cComparisonBlock(product, b2c, {...block, code: 'alerts'}, [prior]).metrics, block.metrics);
  assert.equal(JSON.stringify({product, block, prior}), snapshot);
});
