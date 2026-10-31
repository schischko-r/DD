import test from 'node:test';
import assert from 'node:assert/strict';
import {salaryBeforeMechanicsConfirmation} from './test-fixtures/salaryMechanicsStage.js';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {buildTeamProfileProducts} from './teamProfileSelection.js';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const metrics = (product) => product.metrics.flatMap((block) => block.metrics);
const codes = ['mehaniki.vozvrat_klientov', 'mehaniki.doprodazhi_up_sell'];

test('respondent-specific mechanics assign exactly three cohort values and average the two merged metrics without changing anything else', () => {
  const original = read('../../public/report-data.json').products;
  const salary = read('../data/salary-products-q3-2026.json');
  const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
  const actions = read('../data/funnel-action-missing-q3-2026.json');
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => read(`../data/${imports.get(key.trim())}`));
  // Keep parallel assessment batches identical on both sides; the old four
  // salary mechanic facts alone are restored from the immutable prior snapshot.
  const before = buildDdiPeriodProducts(original, salary.period, overlays, salaryBeforeMechanicsConfirmation(salary, {restoreLaterMau: false}), reporting, actions);
  const snapshot = JSON.stringify({original, salary, reporting, actions, overlays});
  const after = buildDdiPeriodProducts(original, salary.period, overlays, salary, reporting, actions);
  const merged = after.find((product) => product.name === 'Зарплатный продукт');
  const prior = before.find((product) => product.name === merged.name);
  let changes = 0;
  for (const key of ['b2b', 'b2c']) {
    const child = merged.salaryCohorts[key], old = prior.salaryCohorts[key];
    const record = salary.products.find((product) => product.cohort.toLowerCase() === key);
    assert.equal(Object.keys(record.metrics).length, 15);
    assert.equal(record.resetMetricCodes.includes(codes[0]), false);
    for (const metric of metrics(child)) {
      const previous = metrics(old).find((item) => item.code === metric.code);
      if (!codes.includes(metric.code)) {assert.deepEqual(metric, previous); continue;}
      assert.equal(metric.value, metric.code === codes[0] || key === 'b2b' ? 1 : 0);
      assert.equal(metric.max_value, previous.max_value);
      assert.equal(metric.previousValue, undefined);
      assert.equal(metric.source.questionId, 'upsell');
      assert.equal(metric.source.respondent, key === 'b2b' ? 'Сауткин Андрей' : 'Королева Александра Дмитриевна');
      assert.equal(metric.source.csvRow, key === 'b2b' ? 5 : 46);
      assert.equal(metric.source.answer.includes('Возврат клиентов'), true);
      assert.equal(metric.source.answer.includes('Допродажи (upsell)'), key === 'b2b');
      if (metric.value !== previous.value) changes++;
    }
  }
  assert.equal(changes, 3);
  assert.equal(salary.pending.some((record) => record.code === codes[0]), false);
  assert.deepEqual(codes.map((code) => metrics(merged).find((metric) => metric.code === code).value), [1, .5]);
  assert.equal(merged.indexMaxPoints, prior.indexMaxPoints);
  assert.deepEqual(metrics(merged).filter((metric) => !codes.includes(metric.code)), metrics(prior).filter((metric) => !codes.includes(metric.code)));
  for (const product of after.filter((product) => product !== merged)) assert.deepEqual(product, before.find((previous) => previous.id === product.id));
  const generic = buildTeamProfileProducts(original, salary.period, overlays).find((product) => product.name === merged.name);
  assert.equal(metrics(generic).find((metric) => metric.code === codes[0]).value, null, 'The generic unsplit source layer is not replaced by a cohort assessment');
  assert.deepEqual(buildDdiPeriodProducts(original, 'II кв. 2026', overlays, salary, reporting, actions), original);
  assert.equal(JSON.stringify({original, salary, reporting, actions, overlays}), snapshot);
});
