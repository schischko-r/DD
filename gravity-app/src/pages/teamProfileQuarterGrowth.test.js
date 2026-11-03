import test from 'node:test';
import assert from 'node:assert/strict';
import {quarterMetricGrowthByCode} from './teamProfileQuarterGrowth.js';

const criterion = (code, value, max_value, applicable = true) => ({code, value, max_value,
  is_applicabble_flg: applicable, dd_calculation_flg: 1});
const prior = {id: 'team', name: 'Team', unit: 'Data', type: 'Продукт', period: 'II кв. 2026',
  metrics: [{code: 'cx', metrics: [criterion('cx.score', 0, 0, false)]},
    {code: 'alerts', metrics: [criterion('alerts.system_failures', 1, 1)]}]};
const current = {...prior, id: 'team::empty::III кв. 2026', period: 'III кв. 2026',
  metrics: [{code: 'cx', metrics: [criterion('cx.score', 0.5, 1)]}, prior.metrics[1]]};
const comparison = {previousPeriod: prior.period, currentTotalMaxPoints: 20, previousTotalMaxPoints: 19,
  metricGrowthByCode: {}};

test('a newly applicable CX criterion displays its DDI contribution without treating NA as a historical score', () => {
  const snapshot = JSON.stringify({prior, current, comparison});
  const growth = quarterMetricGrowthByCode(current, comparison, [prior]);
  assert.equal(growth['cx.score'].indexPctDelta, 2.5);
  assert.equal(growth['cx.score'].previousValue, null);
  assert.equal(growth['cx.score'].value, 0.5);
  assert.equal(growth['alerts.system_failures'], undefined, 'unchanged alerts ignore the global denominator shift');
  assert.equal(JSON.stringify({prior, current, comparison}), snapshot);
});

test('zero new contributions and missing baselines do not fabricate badges; comparable score deltas are retained', () => {
  const zero = structuredClone(current);
  zero.metrics[0].metrics[0].value = 0;
  assert.deepEqual(quarterMetricGrowthByCode(zero, comparison, [prior]), {});
  assert.deepEqual(quarterMetricGrowthByCode(current, comparison, []), {});
  assert.deepEqual(quarterMetricGrowthByCode(current, null, [prior]), {});
  const existing = {indexPctDelta: 1.2, previousValue: 0.25, value: 0.5};
  assert.equal(quarterMetricGrowthByCode(current, {...comparison, metricGrowthByCode: {'cx.score': existing}}, [prior])['cx.score'], existing);
});

test('changed criterion weights can reduce its contribution while its displayed assessment remains complete', () => {
  const old = structuredClone(prior);
  old.metrics[0].metrics[0] = criterion('cx.score', 0.5, 1);
  const weighted = structuredClone(current);
  weighted.metrics[0].metrics[0] = criterion('cx.score', 0.25, 0.25);
  const growth = quarterMetricGrowthByCode(weighted, comparison, [old])['cx.score'];
  assert.ok(Math.abs(growth.indexPctDelta - (-1.381578947368421)) < 1e-9);
  assert.equal(growth.previousValue, 0.5);
  assert.equal(growth.value, 0.25);
  assert.equal(weighted.metrics[0].metrics[0].value / weighted.metrics[0].metrics[0].max_value, 1);
});
