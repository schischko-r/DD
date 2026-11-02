import test from 'node:test';
import assert from 'node:assert/strict';
import {withCurrentAbQuarterWeights} from './test-fixtures/abQuarterWeightStage.js';
import {isPostSnapshotExternalAssessment, historicalAssessmentBatch} from './test-fixtures/assessmentBatches.js';
import {salaryBeforeMechanicsConfirmation} from './test-fixtures/salaryMechanicsStage.js';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts, buildDdiCohortProducts, Q3_DB_TEAMS} from './quarterProfiles.js';
import {mergeSalaryCohorts, SALARY_TOGGLE_BLOCK_CODES} from './salaryCohortAverage.js';
import {isDdIndexMetric} from './report.js';
import {applyNavigatorKnowledge} from './navigatorKnowledge.js';
import {applyReportingFormatAssessments} from './reportingRegularity.js';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const metrics = (product) => product.metrics.flatMap((block) => block.metrics);
const source = read('../../public/report-data.json').products;
const salary = read('../data/salary-products-q3-2026.json');
const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
const actions = read('../data/funnel-action-missing-q3-2026.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => read(`../data/${imports.get(key.trim())}`));
const snapshotOverlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',')
  .filter((key) => !isPostSnapshotExternalAssessment(imports.get(key.trim())))
  .map((key) => {
    const file=imports.get(key.trim()),overlay=read(`../data/${file}`);
    // This immutable snapshot predates only these two later applicability facts.
    return historicalAssessmentBatch(file==='metric-applicability-q3-2026.json'
      ? {...overlay,products:overlay.products.filter(p=>!['КАСКО','ОСАГО'].includes(p.name))} : overlay);
  });
const period = salary.period;

test('loading the report with an empty source does not require salary cohorts before data arrives', () => {
  assert.deepEqual(buildDdiPeriodProducts([], period, overlays, salary, reporting, actions), []);
});

test('one salary product averages all metrics in exactly five blocks after child scoring and preserves both cohorts in full', () => {
  const before = withCurrentAbQuarterWeights(read('../../../outputs/salary-merged-2026-10-30/before.json'));
  const input = JSON.stringify({source, salary, reporting, actions, overlays, before});
  const legacy = buildDdiCohortProducts(source, period, overlays, salary, reporting, actions);
  const after = buildDdiPeriodProducts(source, period, overlays, salary, reporting, actions);
  // Reproduce the old snapshot without the eight later batches, then validate the
  // current merge against the current cohort pipeline with all overlays included.
  assert.deepEqual(buildDdiCohortProducts(source, period, snapshotOverlays, salaryBeforeMechanicsConfirmation(salary), reporting, actions), before);
  assert.equal(after.length, 76);
  assert.equal(after.filter((product) => product.unit === 'DB').length, 16);
  assert.deepEqual(after.filter((product) => product.unit === 'DB').map((product) => product.name).sort(), [...Q3_DB_TEAMS].sort());
  assert.equal(after.filter((product) => product.name === 'Зарплатный продукт').length, 1);
  assert.equal(after.some((product) => /Зарплатный продукт #/.test(product.name)), false);
  const merged = after.find((product) => product.name === 'Зарплатный продукт');
  assert.equal(merged.id, `${salary.source.baseTeamId}::empty::${period}`);
  assert.deepEqual(merged.salaryToggleBlockCodes, ['general', 'attract', 'churn', 'mehaniki', 'hyp']);
  for (const key of ['b2b', 'b2c']) {
    const cohort = merged.salaryCohorts[key];
    assert.deepEqual(cohort, legacy.find((product) => product.id === cohort.id));
    assert.ok(cohort.respondent);
    assert.ok(metrics(cohort).every((metric) => metric.previousValue === undefined));
  }
  const {b2b, b2c} = merged.salaryCohorts;
  for (const block of merged.metrics) {
    if (!SALARY_TOGGLE_BLOCK_CODES.includes(block.code)) {
      assert.deepEqual(block, b2c.metrics.find((entry) => entry.code === block.code)); continue;
    }
    assert.equal(block.source.origin, 'salaryCohortAverage');
    for (const metric of block.metrics) {
      const left = metrics(b2b).find((entry) => entry.code === metric.code);
      const right = metrics(b2c).find((entry) => entry.code === metric.code);
      const eligible = left.is_applicabble_flg !== false && right.is_applicabble_flg !== false && left.max_value > 0;
      const expected = eligible && Number.isFinite(left.value) && Number.isFinite(right.value) ? (left.value + right.value) / 2 : null;
      assert.equal(metric.value, expected, metric.code);
      assert.equal(metric.max_value, right.max_value);
      assert.equal(metric.is_applicabble_flg, right.is_applicabble_flg);
      assert.equal(metric.source.origin, 'salaryCohortAverage');
      assert.equal(metric.source.cohorts.b2b.value, left.value);
      assert.equal(metric.source.cohorts.b2c.value, right.value);
      for (const item of metric.recommendation_items || []) {
        assert.equal(item.value, expected);
        assert.equal(item.gap, expected === null ? null : metric.max_value - expected);
      }
    }
  }
  const raw = (code) => {const metric = metrics(merged).find((entry) => entry.code === code); return metric.value / metric.max_value;};
  assert.equal(raw('attract.nastroena_otchetnostь'), .75);
  assert.equal(raw('attract.funnel_analysis'), .75);
  assert.equal(raw('churn.funnel_analysis'), .5);
  assert.equal(raw('general.mau_produkta'), 1);
  assert.equal(metrics(b2b).find(m=>m.code==='general.mau_produkta').source.origin,'userConfirmedSharedQ2ProductKnowledgeCarry');
  assert.equal(metrics(b2b).find(m=>m.code==='general.mau_produkta').source.previousRawValue,0);
  assert.equal(metrics(b2b).find(m=>m.code==='general.mau_produkta').source.previousSource.origin,'salarySplitSurveyAssessment');
  assert.equal(raw('hyp.discovery_40_backlog'), .25);
  assert.equal(raw('attract.regulyarnostь'), .75, 'No full-report regularity rule runs after averaging');
  const cross = metrics(merged).find((entry) => entry.code === 'mehaniki.cross_sell');
  assert.equal(cross.value, .25);
  assert.equal(cross.crossSellComponents.during.value, 0);
  assert.equal(cross.crossSellComponents.after.rawValue, .5);
  assert.equal(cross.crossSellComponents.after.value, .25);
  assert.equal(cross.crossSellComponents.during.source.system, undefined);
  assert.equal(metrics(merged).find((metric) => metric.code === 'mehaniki.vozvrat_klientov').value, .5);
  assert.equal(metrics(merged).find((metric) => metric.code === 'mehaniki.doprodazhi_up_sell').value, .5);
  assert.equal(merged.indexMaxPoints, metrics(merged).filter(isDdIndexMetric).reduce((sum, metric) => sum + metric.max_value, 0));
  const currentLegacy = applyReportingFormatAssessments(applyNavigatorKnowledge(legacy, period), period, overlays);
  for (const product of after.filter((product) => product !== merged)) assert.deepEqual(product, currentLegacy.find((prior) => prior.id === product.id));
  assert.deepEqual(buildDdiPeriodProducts(source, 'II кв. 2026', overlays, salary, reporting, actions), source);
  assert.equal(JSON.stringify({source, salary, reporting, actions, overlays, before}), input);
});

test('the entire hypothesis block averages, and a missing applicable cohort score never becomes zero', () => {
  const base = {id: 'parent', name: 'Зарплатный продукт', unit: 'DB', type: 'Продукт', period: 'II кв. 2026', metrics: []};
  const config = {period, source: {baseTeamId: base.id}, products: ['B2B', 'B2C'].map((cohort) => ({
    id: cohort, name: cohort, unit: 'DB', type: 'Продукт', cohort,
  }))};
  const children = config.products.map((record, index) => ({...record, id: `${record.id}::empty::${period}`, period,
    metrics: [{code: 'hyp', metrics: [
      {code: 'hyp.discovery_40_backlog', value: index ? 1 : 0, max_value: 1, is_applicabble_flg: true},
      {code: 'hyp.datadriven_rating_7_5', value: index ? 1 : .5, max_value: 1, is_applicabble_flg: true},
      {code: 'hyp.ab_tests', value: index ? 1 : null, max_value: 1, is_applicabble_flg: true},
      {code: 'hyp.extra_initiatives', value: index ? .5 : 1, max_value: 1, is_applicabble_flg: true},
      {code: 'hyp.na', value: null, max_value: 0, is_applicabble_flg: false},
    ]}]}));
  const merged = mergeSalaryCohorts(children, period, config, [base])[0];
  assert.deepEqual(metrics(merged).map((metric) => metric.value), [.5, .75, null, .75, null]);
  assert.equal(metrics(merged).at(-1).is_applicabble_flg, false);
  assert.equal(metrics(merged).at(-1).max_value, 0);
  assert.deepEqual(mergeSalaryCohorts(children, 'II кв. 2026', config, [base]), children);
});
