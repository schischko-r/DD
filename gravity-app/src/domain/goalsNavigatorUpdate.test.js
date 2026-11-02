import test from 'node:test';
import assert from 'node:assert/strict';
import {salaryBeforeMechanicsConfirmation} from './test-fixtures/salaryMechanicsStage.js';
import {isPostSnapshotExternalAssessment, historicalAssessmentBatch} from './test-fixtures/assessmentBatches.js';
import {readFileSync} from 'node:fs';
// Historical snapshots retain the explicitly separated cohort pipeline.
import {buildDdiCohortProducts as buildDdiPeriodProducts} from './quarterProfiles.js';
import {applyCrossSellMissingZeros} from './crossSellDecomposition.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const source = read('../../public/report-data.json').products;
const salary = salaryBeforeMechanicsConfirmation(read('../data/salary-products-q3-2026.json'));
const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
const actions = read('../data/funnel-action-missing-q3-2026.json');
const goals = read('../data/goals-user-carry-forward-q3-2026.json');
const navigator = read('../data/navigator-market-knowledge-q3-2026.json');
// The later Cross-sell default is unrelated to this stage's goals/Navigator changes.
const before = applyCrossSellMissingZeros(read('../../../outputs/goals-navigator-update-2026-10-30/before.json'), goals.period);
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',')
  .filter((key) => !isPostSnapshotExternalAssessment(imports.get(key.trim())))
  .filter((key) => !['funnel-additional-user-assessments-q3-2026.json', 'knowledge-user-assessments-q3-2026.json', 'chat-entry-actions-q3-2026.json'].includes(imports.get(key.trim())))
  .map((key) => historicalAssessmentBatch(read(`../data/${imports.get(key.trim())}`)));
const metrics = (product) => product.metrics.flatMap((block) => block.metrics);
const code = 'general.navigator_reporting_knowledge';
const marketCode = 'general.obъem_celevogo_rynka_v_rossii';

test('BNPL goals and normalized-full-market Navigator fill exactly 20 blanks without changing any earlier score, NA, maximum or Q2', () => {
  const input = JSON.stringify({source, overlays, salary, reporting, actions, goals, navigator, before});
  const after = buildDdiPeriodProducts(source, goals.period, [...overlays.filter((o) => o.scope !== 'ab-tests-assessment'), goals, navigator], salary, reporting, actions);
  let goalChanges = 0, navigatorChanges = 0;
  for (let i = 0; i < after.length; i++) {
    const current = after[i], prior = before[i];
    assert.equal(current.id, prior.id);
    assert.equal(current.indexMaxPoints, prior.indexMaxPoints);
    const goalRecord = goals.products.find((p) => p.id === prior.id.split('::empty::')[0]);
    const navigatorRecord = navigator.products.find((p) => p.id === prior.id.split('::empty::')[0]);
    for (const [index, metric] of metrics(current).entries()) {
      const old = metrics(prior)[index];
      const fact = goalRecord?.metrics[metric.code] || navigatorRecord?.metrics[metric.code];
      if (!fact) {assert.deepEqual(metric, old); continue;}
      assert.equal(old.value, null);
      assert.equal(metric.value, fact.rawValue * old.max_value);
      for (const field of ['max_value', 'is_applicabble_flg', 'excluded_from_index', 'dd_calculation_flg']) {
        assert.equal(metric[field], old[field]);
      }
      if (metric.code === code) {
        navigatorChanges++;
        const market = metrics(prior).find((m) => m.code === marketCode);
        assert.equal(market.value / market.max_value, 1);
        assert.equal(metric.value, 0.5);
        assert.equal(metric.source.sourceValue, market.value);
        assert.equal(metric.source.sourceMaxValue, market.max_value);
      } else {
        goalChanges++;
        assert.equal(current.name, 'BNPL');
        const q2 = source.find((p) => p.name === 'BNPL');
        const original = metrics(q2).find((m) => m.code === metric.code);
        assert.equal(metric.value, original.value);
        assert.equal(metric.previousValue, original.value);
        assert.equal(metric.previousPeriod, 'II кв. 2026');
      }
    }
  }
  assert.equal(goalChanges, 3);
  assert.equal(navigatorChanges, 17);
  assert.deepEqual(buildDdiPeriodProducts(source, 'II кв. 2026', [...overlays, goals, navigator], salary, reporting, actions), source);
  assert.equal(JSON.stringify({source, overlays, salary, reporting, actions, goals, navigator, before}), input);
});

test('45 market-qualified teams retain 28 full Navigator assessments and receive 17 missing full assessments', () => {
  const after = buildDdiPeriodProducts(source, goals.period, [...overlays, goals, navigator], salary, reporting, actions);
  const qualified = before.filter((p) => {
    const market = metrics(p).find((m) => m.code === marketCode);
    return market?.is_applicabble_flg !== false && market?.max_value > 0 && market.value === market.max_value;
  });
  assert.equal(qualified.length, 45);
  assert.equal(qualified.filter((p) => metrics(p).find((m) => m.code === code).value === null).length, 17);
  for (const prior of qualified) {
    const product = after.find((p) => p.id === prior.id);
    const metric = metrics(product).find((m) => m.code === code);
    assert.equal(metric.value / metric.max_value, 1);
  }
});
