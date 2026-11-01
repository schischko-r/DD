import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {isDdIndexMetric} from './report.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const source = read('../../public/report-data.json').products;
const confirmation = read('../data/tips-funnel-user-q3-2026.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => read(`../data/${imports.get(key.trim())}`));
const salary = read('../data/salary-products-q3-2026.json');
const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
const actions = read('../data/funnel-action-missing-q3-2026.json');
const metrics = (product) => product.metrics.flatMap((block) => block.metrics);
const build = (batches, period = confirmation.period) => buildDdiPeriodProducts(source, period, batches, salary, reporting, actions);

test('tips confirmation uses the final supplied column and supersedes carried reporting without affecting other teams', () => {
  const before = build(overlays.filter((item) => item.source?.origin !== confirmation.source.origin));
  const after = build(overlays);
  const team = confirmation.products[0];
  const previous = before.find((product) => product.name === team.name);
  const current = after.find((product) => product.name === team.name);
  assert.ok(current);
  assert.equal(current.indexMaxPoints, previous.indexMaxPoints);
  const expected = new Map([
    ['churn.funnel_analysis', 0.5], ['churn.nastroena_otchetnostь', 0.5], ['churn.report_completeness', 0.5],
    ['attract.funnel_analysis', 0], ['attract.nastroena_otchetnostь', 1], ['attract.report_completeness', 0.5],
  ]);
  for (const metric of metrics(current)) {
    const old = metrics(previous).find((item) => item.code === metric.code);
    if (!expected.has(metric.code)) {
      assert.deepEqual(metric, old);
      continue;
    }
    assert.equal(metric.value / metric.max_value, expected.get(metric.code), metric.code);
    assert.equal(metric.max_value, old.max_value);
    assert.equal(metric.is_applicabble_flg, old.is_applicabble_flg);
    assert.equal(metric.source.origin, confirmation.source.origin);
    assert.equal(metric.source.override?.rawValue ?? metric.source.inputValues.at(-1), expected.get(metric.code));
  }
  const oldReporting = metrics(previous).find((metric) => metric.code === 'attract.nastroena_otchetnostь');
  assert.equal(oldReporting.value, oldReporting.max_value);
  assert.equal(metrics(current).find((metric) => metric.code === oldReporting.code).value, oldReporting.max_value);
  const missing = (product) => metrics(product).filter((metric) => isDdIndexMetric(metric) && !Number.isFinite(metric.value));
  assert.equal(missing(previous).length - missing(current).length, 2);
  assert.deepEqual(after.filter((product) => product.name !== team.name), before.filter((product) => product.name !== team.name));
  assert.deepEqual(build(overlays, source[0].period), source);
});

test('bullion duplicate rows apply once and the latest direct answer resolves churn analysis', () => {
  const bullion = read('../data/bullion-funnel-user-q3-2026.json');
  const team = bullion.products[0];
  const before = build(overlays.filter((item) => item.source?.origin !== bullion.source.origin));
  const after = build(overlays);
  const previous = before.find((product) => product.name === team.name);
  const current = after.find((product) => product.name === team.name);
  assert.equal(current.indexMaxPoints, previous.indexMaxPoints);
  const expected = new Map([
    ['churn.funnel_analysis', 0.5],
    ['churn.nastroena_otchetnostь', 1], ['churn.report_completeness', 0.5],
    ['attract.funnel_analysis', 0.5], ['attract.nastroena_otchetnostь', 1], ['attract.report_completeness', 0.5],
  ]);
  for (const metric of metrics(current)) {
    const old = metrics(previous).find((item) => item.code === metric.code);
    if (!expected.has(metric.code)) {assert.deepEqual(metric, old); continue;}
    assert.equal(metric.value / metric.max_value, expected.get(metric.code), metric.code);
    assert.equal(metric.max_value, old.max_value);
    assert.equal(metric.is_applicabble_flg, old.is_applicabble_flg);
    assert.equal(metric.source.origin, bullion.source.origin);
    assert.equal(metric.source.inputRows.length, metric.code === 'churn.funnel_analysis' ? 1 : 2);
  }
  assert.equal(metrics(current).find((metric) => metric.code === 'churn.funnel_analysis').value,
    metrics(current).find((metric) => metric.code === 'churn.funnel_analysis').max_value * 0.5);
  assert.equal(bullion.pending.length, 0);
  assert.equal(bullion.resolvedPending[0].resolvedRawValue, 0.5);
  const missing = metrics(current).filter((metric) => isDdIndexMetric(metric) && !Number.isFinite(metric.value));
  assert.equal(missing.length, 0);
  assert.deepEqual(after.filter((product) => product.name !== team.name), before.filter((product) => product.name !== team.name));
  assert.deepEqual(build(overlays, source[0].period), source);
});
