import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyMetricIndexExclusionAssessments} from './indexExclusion.js';
import {completeProductPercent, isDdIndexMetric} from './report.js';
import {buildDdiPeriodProducts} from './quarterProfiles.js';

const period = 'III кв. 2026';
const codes = ['general.obъem_celevogo_rynka_v_rossii', 'general.obъem_celevogo_rynka_v_sbere'];
const identity = {id: 'febe33a0-05c9-50d9-989c-9c1067e3ab21¦ЦФА', name: 'ЦФА', unit: 'УБ', type: 'Продукт'};
const product = () => ({...identity, id: `${identity.id}::empty::${period}`, period, indexMaxPoints: 1.4,
  metrics: [{code: 'general', metrics: [
    ...codes.map((code) => ({code, value: null, max_value: 0.2, is_applicabble_flg: true,
      excluded_from_index: false, dd_calculation_flg: 1, source: {origin: 'originalEvidence'}})),
    {code: 'general.mau_produkta', value: 0.25, max_value: 0.5},
    {code: 'general.navigator_reporting_knowledge', value: 0.5, max_value: 0.5, source: {origin: 'directNavigatorAssessment'}},
  ]}]});
const assessment = () => ({period, scope: 'metric-index-exclusion-assessment', products: [{...identity,
  metrics: Object.fromEntries(codes.map((code) => [code, {excludedFromIndex: true,
    source: {origin: 'userConfirmedCfaMarketIndexExclusions20261031', confirmedBy: 'user', period, date: '2026-10-31'}}])),
}]});
const metrics = (item) => item.metrics.flatMap((block) => block.metrics);

test('two CFA market metrics leave the index while their null values, maxima, applicability and evidence remain intact', () => {
  const before = product();
  const snapshot = JSON.stringify(before);
  const after = applyMetricIndexExclusionAssessments([before], period, assessment())[0];
  assert.equal(completeProductPercent(before), null);
  assert.equal(completeProductPercent(after), 75);
  assert.ok(Math.abs((before.indexMaxPoints - after.indexMaxPoints) - 0.4) < 1e-10);
  assert.equal(after.indexMaxPoints, 1);
  for (const [index, metric] of metrics(after).entries()) {
    const prior = metrics(before)[index];
    if (!codes.includes(metric.code)) {assert.deepEqual(metric, prior); continue;}
    assert.equal(metric.value, null);
    assert.equal(metric.max_value, 0.2);
    assert.equal(metric.is_applicabble_flg, true);
    assert.equal(metric.excluded_from_index, true);
    assert.equal(metric.dd_calculation_flg, 0);
    assert.equal(isDdIndexMetric(metric), false);
    assert.deepEqual(metric.source, prior.source);
    assert.equal(metric.indexExclusionSource.confirmedBy, 'user');
  }
  assert.equal(JSON.stringify(before), snapshot);
  assert.deepEqual(applyMetricIndexExclusionAssessments([after], period, assessment()), [after]);
});

test('an existing zero or positive market score is preserved exactly when excluded', () => {
  const before = product();
  metrics(before)[0].value = 0;
  metrics(before)[1].value = 0.1;
  const after = applyMetricIndexExclusionAssessments([before], period, assessment())[0];
  assert.deepEqual(metrics(after).slice(0, 2).map((metric) => metric.value), [0, 0.1]);
});

test('only Q3, exact CFA identity, the two market codes and an explicit confirmed true flag permit exclusion', () => {
  const before = product();
  assert.deepEqual(applyMetricIndexExclusionAssessments([before], 'II кв. 2026', assessment()), [before]);
  for (const field of ['id', 'name', 'unit', 'type']) {
    const wrong = assessment();
    wrong.products[0][field] = 'other';
    assert.deepEqual(applyMetricIndexExclusionAssessments([before], period, wrong), [before]);
    assert.deepEqual(applyMetricIndexExclusionAssessments([{...before, [field]: 'other'}], period, assessment()), [{...before, [field]: 'other'}]);
  }
  for (const flag of [false, null, 1, 'true']) {
    const wrong = assessment();
    Object.values(wrong.products[0].metrics).forEach((fact) => {fact.excludedFromIndex = flag;});
    assert.deepEqual(applyMetricIndexExclusionAssessments([before], period, wrong), [before]);
  }
  const unrelated = assessment();
  unrelated.products[0].metrics = {'general.mau_produkta': Object.values(unrelated.products[0].metrics)[0]};
  assert.deepEqual(applyMetricIndexExclusionAssessments([before], period, unrelated), [before]);
  const unconfirmed = assessment();
  Object.values(unconfirmed.products[0].metrics).forEach((fact) => {fact.source.confirmedBy = 'unknown';});
  assert.deepEqual(applyMetricIndexExclusionAssessments([before], period, unconfirmed), [before]);
});

test('full runtime applies the exclusions last, preserves direct Navigator and all other metric rubrics and keeps Q2 unchanged', () => {
  const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
  const source = read('../../public/report-data.json').products;
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((match) => [match[1], match[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => read(`../data/${imports.get(key.trim())}`));
  const salary = read('../data/salary-products-q3-2026.json');
  const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
  const actions = read('../data/funnel-action-missing-q3-2026.json');
  const build = (batches) => buildDdiPeriodProducts(source, period, batches, salary, reporting, actions);
  const before = build(overlays.filter((item) => item.scope !== 'metric-index-exclusion-assessment'));
  const after = build(overlays);
  let excluded = 0;
  for (const current of after) {
    const prior = before.find((item) => item.id === current.id);
    if (current.name !== identity.name) {assert.deepEqual(current, prior); continue;}
    assert.ok(Math.abs((prior.indexMaxPoints - current.indexMaxPoints) - 0.4) < 1e-10);
    for (const metric of metrics(current)) {
      const old = metrics(prior).find((item) => item.code === metric.code);
      if (!codes.includes(metric.code)) {assert.deepEqual(metric, old); continue;}
      assert.equal(metric.excluded_from_index, true);
      assert.equal(metric.dd_calculation_flg, 0);
      for (const key of ['value', 'max_value', 'is_applicabble_flg', 'source']) assert.deepEqual(metric[key], old[key]);
      excluded++;
    }
    const navigator = metrics(current).find((metric) => metric.code === 'general.navigator_reporting_knowledge');
    assert.equal(navigator.value, navigator.max_value);
  }
  assert.equal(excluded, 2);
  assert.deepEqual(buildDdiPeriodProducts(source, source[0].period, overlays, salary, reporting, actions), source);
});
