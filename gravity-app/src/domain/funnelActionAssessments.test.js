import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyFunnelActionAssessments} from './funnelActionAssessments.js';
// Historical snapshots retain the explicitly separated cohort pipeline.
import {buildDdiCohortProducts as buildDdiPeriodProducts} from './quarterProfiles.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const source = read('../../public/report-data.json').products;
const salary = read('../data/salary-products-q3-2026.json');
const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
const actions = read('../data/funnel-action-missing-q3-2026.json');
const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => read(`../data/${imports.get(key.trim())}`));
const metrics = (product) => product.metrics.flatMap((block) => block.metrics);

test('132 source-backed action assessments fill only nulls and preserve every old score, rubric and Q2', () => {
  const snapshot = JSON.stringify({source, salary, reporting, actions, overlays});
  const before = buildDdiPeriodProducts(source, actions.period, overlays, salary, reporting);
  const after = buildDdiPeriodProducts(source, actions.period, overlays, salary, reporting, actions);
  let changes = 0, preserved = 0;
  for (let i = 0; i < before.length; i++) {
    const old = before[i], current = after[i];
    assert.equal(current.indexMaxPoints, old.indexMaxPoints);
    const facts = actions.products.find((p) => p.id === old.id.split('::empty::')[0]);
    for (const [index, metric] of metrics(current).entries()) {
      const prior = metrics(old)[index], fact = facts?.metrics[metric.code];
      if (!fact) assert.deepEqual(metric, prior);
      else if (Number.isFinite(prior.value)) {
        assert.deepEqual(metric, prior, 'explicit manual scores are preserved by missing-only fill');
        assert.equal(prior.source.confirmedBy, 'user');
        preserved++;
      }
      else {
        assert.equal(prior.value, null);
        assert.equal(metric.value, fact.rawValue * prior.max_value);
        assert.equal(metric.max_value, prior.max_value);
        assert.equal(metric.is_applicabble_flg, prior.is_applicabble_flg);
        assert.equal(metric.source.answer, fact.source.answer);
        changes++;
      }
    }
  }
  assert.equal(changes + preserved, 132);
  assert.ok(preserved >= 1);
  const premier = after.find(product => product.name === 'Пакет услуг СберПремьер');
  const premierInitiatives = metrics(premier).find(metric => metric.code === 'attract.initiatives_list');
  assert.equal(premierInitiatives.value, 1);
  assert.equal(premierInitiatives.source.approvalGroup, 'premier-attract-initiatives-2026-11-11');
  assert.equal(premierInitiatives.source.correction.rawValue, 1);
  assert.deepEqual(buildDdiPeriodProducts(source, 'II кв. 2026', overlays, salary, reporting, actions), source);
  assert.equal(JSON.stringify({source, salary, reporting, actions, overlays}), snapshot);
});

test('strict identity, null-only, exact two-code scope and original maxima protect unrelated metrics', () => {
  const product = {id: 'x::empty::III кв. 2026', name: 'X', unit: 'DB', type: 'Продукт', metrics: [{metrics: [
    {code: 'attract.initiatives_list', value: null, max_value: 1, is_applicabble_flg: true},
    {code: 'churn.deviation_actions', value: 0.5, max_value: 1, is_applicabble_flg: true},
    {code: 'other.meropriyatiya_po_rabote_s_otkloneniyami', value: null, max_value: 1},
  ]}]};
  const fact = {id: 'x', name: 'X', unit: 'DB', type: 'Продукт', metrics: Object.fromEntries(metrics(product).map((m) => [m.code,
    {rawValue: 1, expectedMaxValue: m.max_value, source: {answer: 'Да', sources: []}}]))};
  const config = {period: actions.period, scope: actions.scope, products: [fact]};
  const result = applyFunnelActionAssessments([product], config.period, config);
  assert.deepEqual(metrics(result[0]).map((m) => m.value), [1, 0.5, null]);
  assert.deepEqual(applyFunnelActionAssessments(result, config.period, config), result);
  for (const identity of [{id: 'other'}, {unit: 'OTHER'}, {name: 'Other'}, {type: 'Канал'}]) {
    assert.deepEqual(applyFunnelActionAssessments([product], config.period, {...config, products: [{...fact, ...identity}]}), [product]);
  }
  for (const change of [{is_applicabble_flg: false}, {max_value: 0}, {max_value: 0.5}, {value: 0}]) {
    const changed = {...product, metrics: [{metrics: [{...metrics(product)[0], ...change}]}]};
    assert.deepEqual(applyFunnelActionAssessments([changed], config.period, config), [changed]);
  }
});
