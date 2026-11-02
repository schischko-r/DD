import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {applyQuarterRetentionAssessments} from './quarterRetentionAssessment.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const source = read('../../public/report-data.json').products;
const assessment = read('../data/segment-mechanics-floor-q3-2026.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`));
const salary = read('../data/salary-products-q3-2026.json');
const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
const actions = read('../data/funnel-action-missing-q3-2026.json');
const build = (items, period = assessment.period) => buildDdiPeriodProducts(source, period, items, salary, reporting, actions);
const metrics = product => product.metrics.flatMap(block => block.metrics);

test('the supplied assessments only rise or retain exact Q2 points, including fractional historical scores', () => {
  const before = build(overlays.filter(item => item.source?.policy !== assessment.source.policy));
  const after = build(overlays);
  let filled = 0, rises = 0, unchanged = 0;
  for (const product of after) {
    const old = before.find(item => item.id === product.id);
    const facts = assessment.products.find(item => item.id === product.id.split('::empty::')[0]);
    const q2 = source.find(item => item.id === product.id.split('::empty::')[0]);
    assert.equal(product.indexMaxPoints, old.indexMaxPoints);
    for (const metric of metrics(product)) {
      const previous = metrics(old).find(item => item.code === metric.code);
      const fact = facts?.metrics[metric.code];
      if (!fact) {assert.deepEqual(metric, previous); continue;}
      const baseline = metrics(q2).find(item => item.code === metric.code);
      const expected = Math.max(baseline.value, fact.source.proposedRawValue * metric.max_value);
      assert.equal(previous.value, null);
      assert.equal(metric.value, expected);
      assert.equal(metric.max_value, previous.max_value);
      assert.equal(metric.is_applicabble_flg, previous.is_applicabble_flg);
      assert.equal(metric.source.sourceValue, baseline.value);
      assert.ok(metric.value >= baseline.value);
      if (metric.value > baseline.value) rises++; else unchanged++;
      filled++;
    }
  }
  assert.equal(filled, 11);
  assert.equal(rises, 1);
  assert.equal(unchanged, 10);
  const workingAge = after.find(product => product.name === 'Рабочий возраст');
  const workingAgeRetention = metrics(workingAge).find(metric => metric.code === 'mehaniki.uderzhanie_klientov');
  assert.equal(workingAgeRetention.value / workingAgeRetention.max_value, 0.75);
  assert.deepEqual(build(overlays, source[0].period), source);
});

test('a segment floor requires its exact baseline, a valid supplied score and an allowed mechanic', () => {
  const team = assessment.products.find(item => Object.values(item.metrics).some(fact => fact.rawValue > 0.8 && fact.rawValue < 0.9));
  const code = Object.keys(team.metrics).find(key => team.metrics[key].rawValue > 0.8 && team.metrics[key].rawValue < 0.9);
  const baseline = source.find(item => item.id === team.id);
  const current = {...baseline, id: `${baseline.id}::empty::${assessment.period}`, period: assessment.period,
    metrics: baseline.metrics.map(block => ({...block, metrics: block.metrics.map(metric => ({...metric, value: null}))}))};
  const apply = fact => applyQuarterRetentionAssessments([current], assessment.period,
    [{...assessment, products: [{...team, metrics: {[code]: fact}}]}], source)[0];
  const fact = team.metrics[code];
  assert.equal(metrics(apply(fact)).find(metric => metric.code === code).value, 1.25);
  for (const patch of [{sourceMaxValue: 2}, {sourceValue: 0}, {proposedRawValue: 0.1}, {confirmedBy: 'other'}, {fromPeriod: assessment.period}]) {
    assert.equal(metrics(apply({...fact, source: {...fact.source, ...patch}})).find(metric => metric.code === code).value, null);
  }
  assert.equal(metrics(apply({...fact, rawValue: 0.5})).find(metric => metric.code === code).value, null);
  assert.deepEqual(applyQuarterRetentionAssessments([current], source[0].period, [assessment], source), [current]);
});
