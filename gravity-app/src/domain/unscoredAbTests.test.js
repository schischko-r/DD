import test from 'node:test';
import assert from 'node:assert/strict';
import {completeBlockPercent, completeProductPercent, isDdIndexMetric, isDdIndexMetricForPeriod} from './report.js';
import {buildSummaryPeriodData} from './summaryPeriod.js';
import {buildSummaryRadarData} from './summaryRadar.js';
import {buildTeamProfileRadarData} from './teamProfileSelection.js';

const period = 'III кв. 2026';
const block = (abValue, max = 1) => ({code: 'hyp', name: 'Гипотезы и инициативы', metrics: [
  {code: 'hyp.discovery_40_backlog', value: 1, max_value: 1},
  {code: 'hyp.datadriven_rating_7_5', value: 0, max_value: 1},
  {code: 'hyp.extra_initiatives', value: 1, max_value: 1},
  {code: 'hyp.ab_tests', value: abValue, max_value: max},
]});

test('unscored Q3 A/B leaves the hypotheses block, profile, summary and both radars at 67%', () => {
  const hypotheses = block(null);
  const product = {name: 'Team', unit: 'DB', type: 'Продукт', period, isPlaceholder: true,
    indexMaxPoints: 4, metrics: [hypotheses]};
  const snapshot = JSON.stringify(product);
  assert.equal(completeBlockPercent(hypotheses, period), 67);
  assert.equal(completeProductPercent(product), 67);
  assert.equal(buildSummaryPeriodData([], [], [product], period).rows[0].score, 67);
  assert.deepEqual(buildTeamProfileRadarData(product, [product], [hypotheses]), [
    {code: 'hyp', product: 67, benchmark: 67},
  ]);
  const summary = buildSummaryRadarData([product], period, 'DB', [{code: 'hyp'}]);
  assert.equal(summary.points[0].b2c, 67);
  assert.equal(summary.points[0].unit, 67);
  assert.equal(isDdIndexMetric(hypotheses.metrics[3]), true);
  assert.equal(isDdIndexMetricForPeriod(hypotheses.metrics[3], period), false);
  assert.equal(JSON.stringify(product), snapshot);
});

test('every explicit Q3 A/B assessment retains its score and its rubric weight', () => {
  for (const [value, max, expected] of [[0, 1, 50], [0.25, 0.25, 69], [0.5, 1, 63], [1, 1, 75]]) {
    assert.equal(completeBlockPercent(block(value, max), period), expected);
    assert.equal(isDdIndexMetricForPeriod(block(value, max).metrics[3], period), true);
  }
});

test('the A/B exception does not hide other gaps, invalid values, or change earlier periods', () => {
  for (const value of [null, undefined, '']) assert.equal(completeBlockPercent(block(value), period), 67);
  assert.equal(completeBlockPercent(block(null), 'II кв. 2026'), null);
  assert.equal(completeBlockPercent(block(null)), null);
  for (const value of [NaN, Infinity, -1, 2]) assert.equal(completeBlockPercent(block(value), period), null);
  const incomplete = block(null);
  incomplete.metrics[0].value = null;
  assert.equal(completeBlockPercent(incomplete, period), null);
  assert.equal(completeBlockPercent({metrics: [block(null).metrics[3]]}, period), null);
});
