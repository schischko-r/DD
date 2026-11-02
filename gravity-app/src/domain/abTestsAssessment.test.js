import test from 'node:test';
import assert from 'node:assert/strict';
import {salaryBeforeMechanicsConfirmation} from './test-fixtures/salaryMechanicsStage.js';
import {isPostSnapshotExternalAssessment, historicalAssessmentBatch} from './test-fixtures/assessmentBatches.js';
import {readFileSync} from 'node:fs';
import {applyAbTestsAssessments} from './abTestsAssessment.js';
// Historical snapshots retain the explicitly separated cohort pipeline.
import {buildDdiCohortProducts as buildDdiPeriodProducts} from './quarterProfiles.js';
import {buildTeamProfileProducts, metricActualGrowth} from './teamProfileSelection.js';
import {isDdIndexMetric} from './report.js';
const code = 'hyp.ab_tests';
const period = 'III кв. 2026';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const metrics = (p) => p.metrics.flatMap((b) => b.metrics);
const source = read('../../public/report-data.json').products;
const assessment = read('../data/ab-tests-user-assessments-q3-2026.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
// The immutable AB baseline precedes the subsequent three funnel corrections.
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',')
  .filter((key) => !isPostSnapshotExternalAssessment(imports.get(key.trim())))
  .filter((key) => !['funnel-additional-user-assessments-q3-2026.json', 'knowledge-user-assessments-q3-2026.json', 'chat-entry-actions-q3-2026.json'].includes(imports.get(key.trim())))
  .map((key) => historicalAssessmentBatch(read(`../data/${imports.get(key.trim())}`)));

test('the 39 explicit assessments activate only their own AB rubric and preserve all unrelated scores, unlisted teams and Q2', () => {
  const before = read('../../../outputs/ab-tests-q3-2026/before.json');
  const salary = salaryBeforeMechanicsConfirmation(read('../data/salary-products-q3-2026.json'));
  const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
  const actions = read('../data/funnel-action-missing-q3-2026.json');
  const after = buildDdiPeriodProducts(source, period, overlays, salary, reporting, actions);
  const expectedQuarter = ['Автокредит', 'Вклады+НС', 'POS-кредиты', 'СберKids', 'ЗЛС', 'ВЗР', 'СберЧаевые'];
  const expectedHalf = ['СберПрайм', 'Зрелость'];
  const newRubrics = new Set(['Персональная рекомендация', 'Сделка ИЖС', 'Автокредит', 'POS-кредиты', 'Пенсионный продукт', 'ПДС', 'ЗЛС', 'ВЗР', 'ИнвестКопилка']);
  const counts = {0: 0, 0.25: 0, 0.5: 0, 1: 0};
  let checked = 0;
  for (let i = 0; i < after.length; i++) {
    const product = after[i], prior = before[i];
    assert.equal(product.id, prior.id);
    const fact = assessment.products.find((p) => p.id === prior.id.split('::empty::')[0]);
    if (!fact) {assert.deepEqual(product, prior); continue;}
    checked++;
    const metric = metrics(product).find((m) => m.code === code);
    const expected = product.name === 'Top Affluent' ? 0 : expectedQuarter.includes(product.name) ? 0.25
      : expectedHalf.includes(product.name) ? 0.5 : 1;
    assert.equal(metric.value, expected, product.name);
    assert.equal(metric.source.origin, 'userConfirmedAbTestsAssessment');
    assert.equal(metric.max_value, expected === 0.25 ? 0.25 : 1);
    assert.equal(metric.is_applicabble_flg, true);
    assert.equal(isDdIndexMetric(metric), true);
    counts[metric.value]++;
    assert.deepEqual(metrics(product).filter((m) => m.code !== code), metrics(prior).filter((m) => m.code !== code));
    assert.equal(product.indexMaxPoints, prior.indexMaxPoints + Number(newRubrics.has(product.name)) - (expected === 0.25 ? 0.75 : 0));
    assert.ok((metric.recommendation_items || []).every((item) => item.value === expected && item.max_value === metric.max_value && item.gap === metric.max_value - expected));
  }
  assert.equal(checked, 39);
  assert.deepEqual(counts, {0: 1, 0.25: 7, 0.5: 2, 1: 29});
  assert.deepEqual(buildDdiPeriodProducts(source, 'II кв. 2026', overlays, salary, reporting, actions), source);
});

test('quarter points apply only to the AB scope, exact identity and Q3; reactivated AB has no invented Q2 baseline', () => {
  const team = {id: 'x', name: 'Команда', unit: 'DB', type: 'Продукт', period: 'II кв. 2026', metrics: [{code: 'hyp', metrics: [
    {code, value: 0, max_value: 0, is_applicabble_flg: false, excluded_from_index: true, dd_calculation_flg: 0},
    {code: 'hyp.discovery_40_backlog', value: 0, max_value: 1, is_applicabble_flg: true},
  ]}]};
  const fact = {...assessment, products: [{id: team.id, name: team.name, unit: team.unit, type: team.type,
    metrics: {[code]: {rawValue: .25}, 'hyp.discovery_40_backlog': {rawValue: .25}}}]};
  const snapshot = JSON.stringify({team, fact});
  const product = buildTeamProfileProducts([team], period, fact)[0];
  assert.equal(metrics(product)[0].value, .25);
  assert.equal(metrics(product)[0].max_value, .25);
  assert.equal(metrics(product)[0].previousValue, undefined);
  assert.equal(metrics(product)[1].value, null);
  assert.equal(product.indexMaxPoints, 1.25);
  const applicablePrior = {...team, metrics: [{...team.metrics[0], metrics: team.metrics[0].metrics.map((m) => m.code === code
    ? {...m, value: 0, max_value: 1, is_applicabble_flg: true, excluded_from_index: false, dd_calculation_flg: 1} : m)}]};
  const compared = buildTeamProfileProducts([applicablePrior], period, fact)[0];
  const ab = metrics(compared)[0];
  assert.equal(ab.value, .25); assert.equal(ab.max_value, .25);
  assert.equal(ab.previousValue, 0); assert.equal(ab.previousMaxValue, 1);
  assert.equal(metricActualGrowth(ab, compared.indexMaxPoints, period), null, 'A changed maximum cannot invent comparable growth');
  assert.deepEqual(applyAbTestsAssessments([team], 'II кв. 2026', [fact], [team]), [team]);
  assert.deepEqual(buildTeamProfileProducts([team], period, {...fact, scope: 'goals-assessment'}), buildTeamProfileProducts([team], period));
  fact.products[0].unit = 'OTHER';
  assert.deepEqual(buildTeamProfileProducts([team], period, fact), buildTeamProfileProducts([team], period));
  fact.products[0].unit = team.unit;
  assert.equal(JSON.stringify({team, fact}), snapshot);
});
