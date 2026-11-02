import test from 'node:test';
import assert from 'node:assert/strict';
import {salaryBeforeMechanicsConfirmation} from './test-fixtures/salaryMechanicsStage.js';
import {isPostSnapshotExternalAssessment, historicalAssessmentBatch} from './test-fixtures/assessmentBatches.js';
import {readFileSync} from 'node:fs';
import {defaultMissingCrossSell, applyCrossSellMissingZeros} from './crossSellDecomposition.js';
// Historical snapshots retain the explicitly separated cohort pipeline.
import {buildDdiCohortProducts as buildDdiPeriodProducts} from './quarterProfiles.js';
const period = 'III кв. 2026';
const code = 'mehaniki.cross_sell';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const metrics = (product) => product.metrics.flatMap((block) => block.metrics);

test('missing components default to zero while known after-purchase scores and source history are preserved', () => {
  const source = {origin: 'salarySplitUnassignedAggregate'};
  const after = {value: .25, rawValue: .5, applicable: true, source: {origin: 'sharedManual'}};
  const metric = {code, value: null, max_value: 1, source, crossSellComponents: {during: {value: null, source}, after}};
  const snapshot = JSON.stringify(metric);
  const result = defaultMissingCrossSell(metric, period);
  assert.equal(result.value, .25);
  assert.equal(result.crossSellComponents.during.value, 0);
  assert.equal(result.crossSellComponents.after, after);
  assert.equal(result.crossSellComponents.during.source.origin, 'userConfirmedCrossSellMissingAsZero');
  assert.equal(result.crossSellComponents.during.source.system, undefined);
  assert.equal(result.crossSellComponents.during.source.previousSource, source);
  assert.equal(result.source.previousSource, source);
  assert.deepEqual(defaultMissingCrossSell(result, period), result);
  assert.equal(JSON.stringify(metric), snapshot);
});

test('fully missing, one known component, fractional maxima and non-applicable components stay distinct', () => {
  const empty = {code, value: null, max_value: 1};
  const zero = defaultMissingCrossSell(empty, period);
  assert.equal(zero.value, 0);
  assert.equal(zero.crossSellComponents.during.value, 0);
  assert.equal(zero.crossSellComponents.after.rawValue, 0);
  const during = defaultMissingCrossSell({...empty, crossSellComponents: {during: {value: .5}}}, period);
  assert.equal(during.value, .5);
  assert.equal(during.crossSellComponents.after.value, 0);
  const rawAfter = defaultMissingCrossSell({...empty, max_value: .5, crossSellComponents: {after: {rawValue: 1}}}, period);
  assert.equal(rawAfter.value, .25);
  const na = {value: null, rawValue: null, applicable: false};
  const irrelevantAfter = defaultMissingCrossSell({...empty, crossSellComponents: {after: na}}, period);
  assert.equal(irrelevantAfter.crossSellComponents.after, na);
  assert.equal(irrelevantAfter.value, 0);
  for (const metric of [{...empty, value: 0}, {...empty, value: .5}, {...empty, value: 1},
    {...empty, max_value: 0}, {...empty, is_applicabble_flg: false}, {...empty, code: 'hyp.discovery_40_backlog'}]) {
    assert.equal(defaultMissingCrossSell(metric, period), metric);
  }
  assert.equal(defaultMissingCrossSell(empty, 'II кв. 2026'), empty);
});

test('actual runtime changes exactly two missing salary parents and preserves every known metric, NA and Q2', () => {
  const before = read('../../../outputs/crosssell-missing-zero-2026-10-30/before.json');
  const source = read('../../public/report-data.json').products;
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',')
  .filter((key) => !isPostSnapshotExternalAssessment(imports.get(key.trim())))
    .filter((key) => !['funnel-additional-user-assessments-q3-2026.json', 'knowledge-user-assessments-q3-2026.json', 'chat-entry-actions-q3-2026.json'].includes(imports.get(key.trim())))
    .map((key) => historicalAssessmentBatch(read(`../data/${imports.get(key.trim())}`)));
  const salary = salaryBeforeMechanicsConfirmation(read('../data/salary-products-q3-2026.json'));
  const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
  const actions = read('../data/funnel-action-missing-q3-2026.json');
  // This immutable snapshot precedes the later explicit A/B assessments.
  const after = buildDdiPeriodProducts(source, period, overlays.filter((o) => o.scope !== 'ab-tests-assessment'), salary, reporting, actions);
  let changes = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], prior = before[i];
    assert.equal(current.id, prior.id);
    assert.equal(current.indexMaxPoints, prior.indexMaxPoints);
    for (const [index, metric] of metrics(current).entries()) {
      const old = metrics(prior)[index];
      if (metric.code === code && old.value === null && old.is_applicabble_flg !== false && old.max_value > 0) {
        assert.ok(current.name.startsWith('Зарплатный продукт #'));
        assert.equal(metric.value, .25);
        assert.equal(metric.crossSellComponents.during.value, 0);
        assert.deepEqual(metric.crossSellComponents.after, old.crossSellComponents.after);
        changes++;
      } else assert.deepEqual(metric, old);
    }
  }
  assert.equal(changes, 2);
  assert.deepEqual(applyCrossSellMissingZeros(after, period), after);
  assert.deepEqual(buildDdiPeriodProducts(source, 'II кв. 2026', overlays, salary, reporting, actions), source);
});
