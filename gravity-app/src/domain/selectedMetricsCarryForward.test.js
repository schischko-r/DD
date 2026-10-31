import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts, metricActualGrowth} from './teamProfileSelection.js';
import {isDdIndexMetric} from './report.js';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const actual = read('../../public/report-data.json').products;
const overlay = read('../data/selected-metrics-carry-forward-q3-2026.json');
const metrics = (p) => p.metrics.flatMap((b) => b.metrics);
const codes = new Set(['mehaniki.gibkoe_izmenenie_usloviy_produkta', 'hyp.extra_initiatives']);

test('both selected metrics preserve every applicable Q2 value, including zeros, halves and fractional maxima', () => {
  const source = JSON.stringify({actual, overlay});
  const baseline = buildTeamProfileProducts(actual, overlay.period);
  const next = buildTeamProfileProducts(actual, overlay.period, overlay);
  let carried = 0, zero = 0, partial = 0, na = 0;
  for (const p of next) {
    const old = actual.find((team) => p.id.startsWith(`${team.id}::empty::`));
    const before = baseline.find((team) => team.id === p.id);
    assert.equal(p.indexMaxPoints, before.indexMaxPoints);
    assert.equal(metrics(p).length, metrics(old).length);
    assert.equal(metrics(p).filter(isDdIndexMetric).length, metrics(before).filter(isDdIndexMetric).length);
    for (const metric of metrics(p)) {
      const previous = metrics(old).find((m) => m.code === metric.code);
      const initial = metrics(before).find((m) => m.code === metric.code);
      if (!codes.has(metric.code) || previous.is_applicabble_flg === false || previous.max_value <= 0) {
        assert.deepEqual(metric, initial);
        if (codes.has(metric.code)) na++;
        continue;
      }
      assert.equal(metric.value, previous.value);
      assert.equal(metric.max_value, previous.max_value);
      assert.equal(metricActualGrowth(metric, p.indexMaxPoints, p.period), null);
      assert.equal(metric.source.origin, 'priorQuarterCarryForward');
      for (const item of metric.recommendation_items || []) assert.equal(item.gap, metric.max_value - metric.value);
      carried++; if (metric.value === 0) zero++; else if (metric.value < metric.max_value) partial++;
    }
  }
  assert.deepEqual({carried, zero, partial, na}, {carried: 142, zero: 92, partial: 18, na: 2});
  assert.deepEqual(buildTeamProfileProducts(actual, 'II кв. 2026', overlay), actual);
  assert.equal(JSON.stringify({actual, overlay}), source);
});

test('the selected carry scope cannot import unrelated metrics, recommendations or new weights', () => {
  const old = actual.find((p) => p.name === 'Вклады+НС');
  const code = 'mehaniki.gibkoe_izmenenie_usloviy_produkta';
  const scoped = {period: overlay.period, scope: overlay.scope, metricMaxOverrides: {[code]: 99}, products: [{
    id: old.id, name: old.name, unit: old.unit, type: old.type,
    crosssellRecommendations: [{skill_key: 'cross_sell'}],
    metrics: {[code]: {rawValue: 0.5}, 'general.mau_produkta': {rawValue: 0.5}},
  }]};
  const result = buildTeamProfileProducts([old], overlay.period, scoped)[0];
  assert.equal(metrics(result).find((m) => m.code === code).value, 0.5);
  assert.equal(metrics(result).find((m) => m.code === code).max_value, 1);
  assert.equal(metrics(result).find((m) => m.code === 'general.mau_produkta').value, null);
  assert.equal(result.metric_recommendations, undefined);
});
