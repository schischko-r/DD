import test from 'node:test';
import assert from 'node:assert/strict';
import {isPostSnapshotExternalAssessment} from './test-fixtures/assessmentBatches.js';
import {readFileSync} from 'node:fs';
import {buildTeamProfileProducts} from './teamProfileSelection.js';
import {excludeRemovedTeams, isDdIndexMetric} from './report.js';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const source = excludeRemovedTeams(read('../../public/report-data.json')).products;
const manual = read('../data/alerts-carry-forward-q3-2026.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',')
  .filter((key) => !isPostSnapshotExternalAssessment(imports.get(key.trim())))
  .map((key) => read(`../data/${imports.get(key.trim())}`));
const metrics = (p) => p.metrics.flatMap((b) => b.metrics);

test('only 70 missing applicable Q3 alerts inherit full Q2 scores; explicit Q3 scores and everything else stay intact', () => {
  const snapshot = JSON.stringify({source, overlays});
  const before = buildTeamProfileProducts(source, manual.period, overlays.filter((o) => o.scope !== manual.scope));
  const after = buildTeamProfileProducts(source, manual.period, overlays);
  let filled = 0, remaining = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], prior = before[i];
    const baseline = source.find((p) => p.id === current.id.replace(/::empty::.*/, ''));
    const record = manual.products.find((p) => p.id === baseline.id);
    assert.equal(current.indexMaxPoints, prior.indexMaxPoints);
    for (const metric of metrics(current)) {
      const old = metrics(prior).find((m) => m.code === metric.code);
      const fact = record?.metrics[metric.code];
      const q2 = metrics(baseline).find((m) => m.code === metric.code);
      const eligible = metric.code.startsWith('alerts.') && isDdIndexMetric(old) && !Number.isFinite(old.value)
        && isDdIndexMetric(q2) && Number.isFinite(q2.value) && q2.value === q2.max_value;
      assert.equal(Boolean(fact), eligible, `${current.name} / ${metric.code}`);
      if (fact) {
        filled++;
        assert.equal(metric.value, metric.max_value);
        assert.equal(metric.max_value, old.max_value);
        assert.equal(metric.is_applicabble_flg, old.is_applicabble_flg);
        assert.equal(metric.source.fromPeriod, 'II кв. 2026');
        assert.equal(metric.source.sourceValue, q2.value);
      } else assert.deepEqual(metric, old);
      if (metric.code.startsWith('alerts.') && isDdIndexMetric(metric) && !Number.isFinite(metric.value)) remaining++;
    }
  }
  assert.equal(filled, 70);
  assert.equal(remaining, 15);
  assert.equal(manual.products.length, 56);
  assert.equal(manual.skipped.length, 2);
  assert.ok(manual.skipped.every((item) => item.value === 0.5 && item.reason === 'explicitQ3ValuePreserved'));
  assert.deepEqual(buildTeamProfileProducts(source, 'II кв. 2026', overlays), source);
  assert.equal(JSON.stringify({source, overlays}), snapshot);
});

test('alert carry scope cannot change other metrics, maxima or mismatched teams', () => {
  const team = source.find((p) => p.name === 'БПИФ');
  const fact = {period: manual.period, scope: manual.scope, metricMaxOverrides: {'alerts.system_failures': 999},
    products: [{...team, metrics: {'alerts.system_failures': {rawValue: 1}, 'goals.monitored': {rawValue: 1}}}]};
  const result = buildTeamProfileProducts([team], manual.period, fact)[0];
  const alert = metrics(result).find((m) => m.code === 'alerts.system_failures');
  assert.equal(alert.value, 1);
  assert.equal(alert.max_value, 1);
  assert.equal(metrics(result).find((m) => m.code === 'goals.monitored').value, null);
  fact.products[0].unit = 'wrong unit';
  assert.deepEqual(buildTeamProfileProducts([team], manual.period, fact), buildTeamProfileProducts([team], manual.period));
});

test('a later explicit alert zero or half score takes priority over a carried full score', () => {
  assert.match(app, /const Q3_OVERLAYS = \[mechanicsMetricsQ32026, alertsCarryForwardQ32026,/);
  const team = source.find((p) => p.name === 'БПИФ');
  const record = {...Object.fromEntries(['id', 'name', 'unit', 'type'].map((key) => [key, team[key]]))};
  const carried = {period: manual.period, scope: manual.scope,
    products: [{...record, metrics: {'alerts.system_failures': {rawValue: 1}}}]};
  for (const rawValue of [0, 0.5]) {
    const explicit = {period: manual.period, scope: 'user-metric-assessment',
      products: [{...record, metrics: {'alerts.system_failures': {rawValue}}}]};
    const result = buildTeamProfileProducts([team], manual.period, [carried, explicit])[0];
    assert.equal(metrics(result).find((m) => m.code === 'alerts.system_failures').value, rawValue);
  }
});
