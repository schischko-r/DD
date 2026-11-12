import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const code = 'mehaniki.uderzhanie_klientov';
const metric = (product) => product.metrics.flatMap((block) => block.metrics).find((item) => item.code === code);
const withoutRetention = (product) => ({...product, metrics: product.metrics.map((block) => ({
  ...block, metrics: block.metrics.filter((item) => item.code !== code),
}))});

test('latest B2C retention correction reaches the complete Q3 pipeline and preserves B2B, other metrics and Q2', () => {
  const source = read('../../public/report-data.json').products;
  const salary = read('../data/salary-products-q3-2026.json');
  const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
  const actions = read('../data/funnel-action-missing-q3-2026.json');
  const backlog = read('../../public/backlog-data.json');
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((match) => [match[1], match[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => read(`../data/${imports.get(key.trim())}`));
  const cohort = salary.products.find((product) => product.cohort === 'B2C');
  const fact = cohort.metrics[code];
  assert.equal(fact.rawValue, 1);
  assert.equal(fact.source.confirmedBy, 'user');
  assert.equal(fact.source.cohort, 'B2C');
  assert.equal(fact.source.period, 'III кв. 2026');
  assert.equal(fact.source.date, '2026-11-11');
  assert.equal(fact.source.previousAssessment.rawValue, 0.5);
  const priorSalary = structuredClone(salary);
  priorSalary.products.find((product) => product.cohort === 'B2C').metrics[code] = fact.source.previousAssessment;
  const snapshot = JSON.stringify({source, salary, reporting, actions, backlog, overlays, priorSalary});
  const build = (config, period = salary.period) => buildDdiPeriodProducts(source, period, overlays, config, reporting, actions, backlog);
  const before = build(priorSalary);
  const after = build(salary);
  const merged = after.find((product) => product.name === 'Зарплатный продукт');
  const previous = before.find((product) => product.id === merged.id);
  assert.equal(metric(previous.salaryCohorts.b2c).value, 0.5);
  assert.equal(metric(merged.salaryCohorts.b2c).value, metric(merged.salaryCohorts.b2c).max_value);
  assert.deepEqual(metric(merged.salaryCohorts.b2c).source, fact.source);
  assert.deepEqual(merged.salaryCohorts.b2b, previous.salaryCohorts.b2b);
  assert.deepEqual(withoutRetention(merged.salaryCohorts.b2c), withoutRetention(previous.salaryCohorts.b2c));
  assert.equal(metric(merged).value, (metric(merged.salaryCohorts.b2b).value + metric(merged.salaryCohorts.b2c).value) / 2);
  const {salaryCohorts: afterCohorts, ...afterParent} = withoutRetention(merged);
  const {salaryCohorts: beforeCohorts, ...beforeParent} = withoutRetention(previous);
  assert.deepEqual(afterParent, beforeParent);
  assert.equal(metric(merged).max_value, metric(previous).max_value);
  assert.equal(metric(merged).is_applicabble_flg, metric(previous).is_applicabble_flg);
  for (const product of after.filter((item) => item !== merged)) {
    assert.deepEqual(product, before.find((item) => item.id === product.id));
  }
  assert.deepEqual(build(salary, 'II кв. 2026'), build(priorSalary, 'II кв. 2026'));
  assert.equal(JSON.stringify({source, salary, reporting, actions, backlog, overlays, priorSalary}), snapshot);
});
