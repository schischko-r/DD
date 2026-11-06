import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyReportingAbsenceAssessments} from './reportingAbsence.js';
import {mergeSalaryCohorts} from './salaryCohortAverage.js';
import {buildDdiPeriodProducts} from './quarterProfiles.js';

const period = 'III кв. 2026';
const metric = (code, value, max_value = 1, extra = {}) => ({code, value, max_value, ...extra});
const team = (reportingValue, extra = {}) => ({id: 'team', name: 'Team', unit: 'DB', type: 'Продукт', period,
  metrics: [{code: 'attract', metrics: [
    metric('attract.nastroena_otchetnostь', reportingValue, 0.5),
    metric('attract.regulyarnostь', 1, 1, {dd_calculation_flg: 0, excluded_from_index: true}),
    metric('attract.report_completeness', 0.25, 0.5),
    metric('attract.benchmarks', 0.5, 0.5),
    metric('attract.funnel_analysis', 1),
  ]}, {code: 'churn', metrics: [metric('churn.report_completeness', 0.5, 0.5)]}], ...extra});
const evidence = (product, answer = 'Нет', extra = {}) => ({period, scope: 'reporting-absence-assessment', products: [{
  id: product.id.replace(/::empty::.*/, ''), name: product.name, unit: product.unit, type: product.type,
  blocks: [{blockCode: 'attract', reportingCode: 'attract.nastroena_otchetnostь', answer,
    source: {answer, file: 'survey.csv', csvRow: 2, questionId: 'attractConfigured'}, ...extra}],
}]});
const get = (product, code) => product.metrics.flatMap((block) => block.metrics).find((metric) => metric.code === code);

test('exact No with absent or zero reporting zeros the dependent rubric, including positive carried scores', () => {
  for (const value of [null, undefined, '', 0]) {
    const product = team(value);
    const snapshot = JSON.stringify(product);
    const result = applyReportingAbsenceAssessments([product], period, [evidence(product)])[0];
    for (const code of ['attract.nastroena_otchetnostь', 'attract.regulyarnostь', 'attract.report_completeness', 'attract.benchmarks']) {
      const before = get(product, code), after = get(result, code);
      assert.equal(after.value, 0);
      assert.equal(after.max_value, before.max_value);
      assert.equal(after.is_applicabble_flg, before.is_applicabble_flg);
      assert.equal(after.source.answer, 'Нет');
      assert.equal(after.source.csvRow, 2);
      assert.equal(after.source.previousAssessmentValue, before.value ?? null);
    }
    assert.deepEqual(get(result, 'attract.funnel_analysis'), get(product, 'attract.funnel_analysis'));
    assert.deepEqual(result.metrics[1], product.metrics[1]);
    assert.equal(JSON.stringify(product), snapshot);
    assert.deepEqual(applyReportingAbsenceAssessments([result], period, [evidence(product)])[0], result);
  }
});

test('positive reporting, missing or non-No answers, mismatched identities and Q2 protect the entire product', () => {
  for (const value of [0.25, 0.5, NaN, -1]) {
    const product = team(value);
    assert.deepEqual(applyReportingAbsenceAssessments([product], period, evidence(product)), [product]);
  }
  for (const answer of ['Да, по запросу', 'Затрудняюсь ответить', '', undefined]) {
    const product = team(0);
    const assessment = evidence(product, answer);
    if (answer === undefined) assessment.products[0].blocks[0].answer = undefined;
    assert.deepEqual(applyReportingAbsenceAssessments([product], period, assessment), [product]);
  }
  const product = team(null);
  const mismatch = evidence(product);
  mismatch.products[0].unit = 'Other';
  assert.deepEqual(applyReportingAbsenceAssessments([product], period, mismatch), [product]);
  assert.deepEqual(applyReportingAbsenceAssessments([product], 'II кв. 2026', evidence(product)), [product]);
  const inconsistent = evidence(product, 'Нет', {source: {answer: 'Да, по запросу'}});
  assert.deepEqual(applyReportingAbsenceAssessments([product], period, inconsistent), [product]);
});

test('non-applicable reporting blocks the rule; non-applicable dependent metrics stay unmodified', () => {
  const product = team(0);
  const original = get(product, 'attract.benchmarks');
  original.is_applicabble_flg = false;
  original.max_value = 0;
  const result = applyReportingAbsenceAssessments([product], period, evidence(product))[0];
  assert.deepEqual(get(result, 'attract.benchmarks'), original);
  const na = team(null);
  get(na, 'attract.nastroena_otchetnostь').is_applicabble_flg = false;
  assert.deepEqual(applyReportingAbsenceAssessments([na], period, evidence(na)), [na]);
});

test('channel completeness, benchmarks and automatic regularity use their own block only', () => {
  const code = 'voronka_ispolьzovaniya';
  const product = team(0, {metrics: [{code, metrics: [
    metric(`${code}.nastroena_otchetnostь`, 0, 0.5),
    metric(`${code}.ispolьzovanie_regulyarnostь_avto`, 1),
    metric(`${code}.polnota_otcheta`, null, 0.5),
    metric(`${code}.nalichie_benchmarkov`, 0.5, 0.5),
    metric(`${code}.provedenie_analiza`, 1),
  ]}]});
  const fact = evidence(product);
  Object.assign(fact.products[0].blocks[0], {blockCode: code, reportingCode: `${code}.nastroena_otchetnostь`});
  const result = applyReportingAbsenceAssessments([product], period, fact)[0];
  assert.deepEqual(result.metrics[0].metrics.map((item) => item.value), [0, 0, 0, 0, 1]);
});

test('salary cohort zero is applied before the equally weighted mean, preserving the other cohort', () => {
  const baseline = team(0.5, {id: 'salary', name: 'Зарплатный продукт', period: 'II кв. 2026'});
  const b2b = team(0.5, {id: 'b2b::empty::III кв. 2026', name: 'Зарплатный продукт #B2B'});
  const b2c = team(null, {id: 'b2c::empty::III кв. 2026', name: 'Зарплатный продукт #B2C'});
  const salary = {period, source: {baseTeamId: 'salary'}, products: [
    {id: 'b2b', name: b2b.name, unit: 'DB', type: 'Продукт', cohort: 'B2B'},
    {id: 'b2c', name: b2c.name, unit: 'DB', type: 'Продукт', cohort: 'B2C'},
  ]};
  const updated = applyReportingAbsenceAssessments([b2b, b2c], period, evidence(b2c));
  assert.deepEqual(updated[0], b2b);
  const merged = mergeSalaryCohorts(updated, period, salary, [baseline])[0];
  assert.equal(get(merged, 'attract.nastroena_otchetnostь').value, 0.25);
  assert.equal(get(merged, 'attract.regulyarnostь').value, 0.5);
  assert.equal(get(merged, 'attract.report_completeness').value, 0.125);
  assert.equal(get(merged, 'attract.benchmarks').value, 0.25);
  assert.equal(get(merged.salaryCohorts.b2c, 'attract.benchmarks').value, 0);
  assert.equal(get(merged.salaryCohorts.b2b, 'attract.benchmarks').value, 0.5);
});

test('runtime applies only the verified No records after prior overlays and preserves all positive-reporting blocks', () => {
  const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
  const source = read('../../public/report-data.json').products;
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((match) => [match[1], match[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => read(`../data/${imports.get(key.trim())}`));
  const salary = read('../data/salary-products-q3-2026.json');
  const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
  const actions = read('../data/funnel-action-missing-q3-2026.json');
  // Validate absence scoring before later explicit reporting removals hide its inputs.
  const build = (batches) => buildDdiPeriodProducts(source, period, batches.filter(item => !item.applyAfterReporting), salary, reporting, actions);
  const before = build(overlays.filter((item) => item.scope !== 'reporting-absence-assessment'));
  const after = build(overlays);
  const assessment = read('../data/reporting-absence-user-q3-2026.json');
  for (const record of assessment.products) {
    const prior = before.find((product) => product.id.replace(/::empty::.*/, '') === record.id);
    const current = after.find((product) => product.id === prior.id);
    for (const fact of record.blocks) {
      const oldBlock = prior.metrics.find((block) => block.code === fact.blockCode);
      const block = current.metrics.find((block) => block.code === fact.blockCode);
      const reporting = oldBlock.metrics.find((metric) => metric.code === fact.reportingCode);
      if (reporting.value > 0) assert.deepEqual(block, oldBlock);
      else assert.equal(block.metrics.find((metric) => metric.code === fact.reportingCode).value, 0);
    }
  }
  assert.deepEqual(buildDdiPeriodProducts(source, source[0].period, overlays, salary, reporting, actions), source);
});

test('an explicit preserved dependent criterion does not protect reporting or the rest of its block', () => {
 const product = team(0);
 const assessment = evidence(product);
 assessment.products[0].blocks[0].preserveMetricCodes = ['attract.benchmarks', 'attract.nastroena_otchetnostь'];
 const result = applyReportingAbsenceAssessments([product], period, assessment)[0];
 assert.deepEqual(get(result, 'attract.benchmarks'), get(product, 'attract.benchmarks'));
 for (const code of ['attract.nastroena_otchetnostь', 'attract.regulyarnostь', 'attract.report_completeness']) {
  assert.equal(get(result, code).value, 0);
 }
 assert.deepEqual(result.metrics[1], product.metrics[1]);
});
